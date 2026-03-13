/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { TeamMember } from '../types.ts'
import type { Challenge } from './useChallengeBuilder.ts'
import type { GameProgress } from './useStorage.ts'

import axios from '@nextcloud/axios'
import { showError } from '@nextcloud/dialogs'
import { generateOcsUrl } from '@nextcloud/router'
import { computed, ref } from 'vue'
import {
	MAX_LIVES,
	PLACEHOLDER_PHOTO,
	XP_PER_LEVEL,
} from '../constants.ts'
import { defaultProgress } from './useStorage.ts'

// Re-export TeamMember so consumers can import it from here for backward compat
export type { TeamMember } from '../types.ts'

// Re-export types from sub-composables so consumers don't need to import both
export type { Challenge, ChallengeType } from './useChallengeBuilder.ts'
export { XP_PER_STAGE } from './useScoring.ts'
export { CLOSE_ANSWER_XP_DIVISOR } from '../constants.ts'

export interface SessionStats {
	answered: number
	correct: number
	wrong: number
	streak: number
	bestStreak: number
	xpEarned: number
	newlyMastered: string[]
}

// OCS response envelope
interface OcsResponse<T> {
	ocs: { data: T }
}

// Backend session shape
interface BackendSession {
	id: number
	lives: number
	streak: number
	bestStreak: number
	xpEarned: number
	answered: number
	correct: number
	wrong: number
	newlyMastered: string[]
	active: boolean
	hasChallenge: boolean
}

// Backend challenge response
interface ChallengeResponse {
	challenge?: Challenge
	session?: BackendSession
	gameOver?: boolean
	error?: string
}

// Backend answer response
interface AnswerResponse {
	correct: boolean
	close: boolean
	timedOut: boolean
	correctAnswer: string
	xp: number
	leveledUp: boolean
	streakBonus: number
	responseTime: number
	gameOver: boolean
	session: BackendSession
	progress: GameProgress
	error?: string
}

// Backend skip response
interface SkipResponse {
	correctAnswer: string
	session: BackendSession
	progress: GameProgress
	error?: string
}

// Backend hint response
interface HintResponse {
	hint?: string
	revealedMask?: string | null
	eliminatedOption?: string | null
	session?: BackendSession
	progress?: GameProgress
	error?: string
}

/**
 * Central game engine composable.
 * All game logic (question generation, answer validation, scoring, streaks)
 * is now handled by the backend. This composable is a thin client that
 * makes API calls and updates the UI state accordingly.
 */
export function useGameEngine() {
	// Local UI state backed by server data
	const progress = ref<GameProgress>(defaultProgress())
	const currentChallenge = ref<Challenge | null>(null)
	const sessionStats = ref<SessionStats>({
		answered: 0,
		correct: 0,
		wrong: 0,
		streak: 0,
		bestStreak: 0,
		xpEarned: 0,
		newlyMastered: [],
	})
	const lives = ref(MAX_LIVES)
	const maxLives = MAX_LIVES
	const gameOver = ref(false)
	const showingResult = ref(false)
	const lastAnswerCorrect = ref(false)
	const lastAnswerClose = ref(false)
	const lastResponseTime = ref(0)
	const lastStreakBonus = ref(0)

	// Runtime team data — fetched from PHP backend on first load
	const allMembersRaw = ref<TeamMember[]>([])
	const loading = ref(true)
	const loadError = ref(false)

	/**
	 * Fetch team members from the backend API.
	 */
	async function fetchTeamMembers() {
		loading.value = true
		loadError.value = false
		try {
			const { data } = await axios.get<OcsResponse<TeamMember[]>>(generateOcsUrl('apps/whoiswho/team'))
			allMembersRaw.value = data.ocs.data
		} catch {
			loadError.value = true
			showError('Could not load team members. Please check your connection and try again.')
		} finally {
			loading.value = false
		}
	}

	/**
	 * Fetch initial progress from backend.
	 */
	async function fetchProgress() {
		try {
			const { data } = await axios.get<OcsResponse<{ progress: GameProgress, session: BackendSession | null }>>(generateOcsUrl('apps/whoiswho/game/progress'))
			updateProgressFromBackend(data.ocs.data.progress)
		} catch {
			// Silently ignore — will use defaults
		}
	}

	// Kick off the initial fetches
	fetchTeamMembers()
	fetchProgress()

	const allMembers = computed(() => allMembersRaw.value.filter((m) => m.photo && m.name && m.photo !== PLACEHOLDER_PHOTO))

	const masteredCount = computed(() => allMembers.value.filter((m) => {
		const p = progress.value.people[m.id]
		return p && p.stage >= 4
	}).length)

	const totalCount = computed(() => allMembers.value.length)

	const levelProgress = computed(() => {
		const level = progress.value.level
		const previousThreshold = (level - 1) * XP_PER_LEVEL
		const xpIntoCurrentLevel = Math.max(0, progress.value.xp - previousThreshold)
		return Math.min(xpIntoCurrentLevel / XP_PER_LEVEL, 1)
	})

	/**
	 * Update local progress from backend response.
	 *
	 * @param backendProgress The progress data from the backend API
	 */
	function updateProgressFromBackend(backendProgress: GameProgress) {
		progress.value = backendProgress
	}

	/**
	 * Update local session stats from backend session.
	 *
	 * @param session The session data from the backend API
	 */
	function updateSessionFromBackend(session: BackendSession) {
		lives.value = session.lives
		sessionStats.value = {
			answered: session.answered,
			correct: session.correct,
			wrong: session.wrong,
			streak: session.streak,
			bestStreak: session.bestStreak,
			xpEarned: session.xpEarned,
			newlyMastered: session.newlyMastered,
		}
	}

	/**
	 * Reset session statistics and start a new session.
	 */
	async function startSession() {
		try {
			const { data } = await axios.post<OcsResponse<{ session: BackendSession, progress: GameProgress }>>(generateOcsUrl('apps/whoiswho/game/start'))
			const result = data.ocs.data
			updateProgressFromBackend(result.progress)
			updateSessionFromBackend(result.session)
			gameOver.value = false
			showingResult.value = false
			await nextChallenge()
		} catch {
			showError('Could not start game session. Please try again.')
		}
	}

	/**
	 * Mark the session as inactive.
	 */
	async function endSession() {
		try {
			const { data } = await axios.post<OcsResponse<{ session: BackendSession, progress: GameProgress }>>(generateOcsUrl('apps/whoiswho/game/end'))
			const result = data.ocs.data
			updateProgressFromBackend(result.progress)
			updateSessionFromBackend(result.session)
		} catch {
			// Silently ignore
		}
	}

	/**
	 * Advance to the next challenge by requesting it from the backend.
	 */
	async function nextChallenge() {
		if (gameOver.value) {
			return
		}

		try {
			const { data } = await axios.get<OcsResponse<ChallengeResponse>>(generateOcsUrl('apps/whoiswho/game/challenge'))
			const result = data.ocs.data

			if (result.gameOver) {
				gameOver.value = true
				return
			}

			if (result.error) {
				gameOver.value = true
				return
			}

			if (result.challenge) {
				currentChallenge.value = result.challenge
				showingResult.value = false
			}

			if (result.session) {
				updateSessionFromBackend(result.session)
			}
		} catch {
			gameOver.value = true
		}
	}

	/**
	 * Submit an answer for the current challenge.
	 * The backend validates the answer and returns the result.
	 *
	 * @param answer The player's answer string
	 */
	async function submitAnswer(answer: string): Promise<boolean> {
		if (!currentChallenge.value) {
			return false
		}

		try {
			const { data } = await axios.post<OcsResponse<AnswerResponse>>(
				generateOcsUrl('apps/whoiswho/game/answer'),
				{ answer },
			)
			const result = data.ocs.data

			if (result.error) {
				return false
			}

			lastAnswerCorrect.value = result.correct
			lastAnswerClose.value = result.close
			lastResponseTime.value = result.responseTime
			lastStreakBonus.value = result.streakBonus

			// The backend reveals the correct answer and person name only
			// AFTER validation — populate them for the result display.
			if (currentChallenge.value) {
				currentChallenge.value.correctAnswer = result.correctAnswer
				// Restore person.name (stripped by the server to prevent cheating)
				if (!currentChallenge.value.person.name) {
					currentChallenge.value.person.name = result.correctAnswer
				}
			}

			updateProgressFromBackend(result.progress)
			updateSessionFromBackend(result.session)
			showingResult.value = true

			if (result.gameOver) {
				gameOver.value = true
				await endSession()
			}

			return result.correct
		} catch {
			return false
		}
	}

	/**
	 * Mark the current challenge as skipped.
	 */
	async function skipAnswer() {
		if (!currentChallenge.value || showingResult.value) {
			return
		}

		try {
			const { data } = await axios.post<OcsResponse<SkipResponse>>(generateOcsUrl('apps/whoiswho/game/skip'))
			const result = data.ocs.data

			if (result.error) {
				return
			}

			// The backend reveals the correct answer and person name only
			// AFTER validation — populate them for the result display.
			if (currentChallenge.value) {
				currentChallenge.value.correctAnswer = result.correctAnswer
				// Restore person.name (stripped by the server to prevent cheating)
				if (!currentChallenge.value.person.name) {
					currentChallenge.value.person.name = result.correctAnswer
				}
			}

			lastAnswerCorrect.value = false
			lastAnswerClose.value = false
			showingResult.value = true

			updateProgressFromBackend(result.progress)
			updateSessionFromBackend(result.session)
		} catch {
			// Silently ignore
		}
	}

	/**
	 * Use the first hint: costs XP, returns "title — department" or null.
	 */
	async function useHint(): Promise<string | null> {
		try {
			const { data } = await axios.post<OcsResponse<HintResponse>>(
				generateOcsUrl('apps/whoiswho/game/hint'),
				{ level: 1 },
			)
			const result = data.ocs.data

			if (result.error) {
				return null
			}

			if (result.progress) {
				updateProgressFromBackend(result.progress)
			}
			if (result.session) {
				updateSessionFromBackend(result.session)
			}

			return result.hint ?? null
		} catch {
			return null
		}
	}

	/**
	 * Second-level hint.
	 * Returns what was revealed so App.vue can store and display it.
	 */
	async function useSecondHint(): Promise<{ revealedMask: string | null, eliminatedOption: string | null }> {
		const empty = { revealedMask: null, eliminatedOption: null }

		try {
			const { data } = await axios.post<OcsResponse<HintResponse>>(
				generateOcsUrl('apps/whoiswho/game/hint'),
				{ level: 2 },
			)
			const result = data.ocs.data

			if (result.error) {
				return empty
			}

			if (result.progress) {
				updateProgressFromBackend(result.progress)
			}
			if (result.session) {
				updateSessionFromBackend(result.session)
			}

			return {
				revealedMask: result.revealedMask ?? null,
				eliminatedOption: result.eliminatedOption ?? null,
			}
		} catch {
			return empty
		}
	}

	return {
		progress,
		currentChallenge,
		sessionStats,
		lives,
		maxLives,
		gameOver,
		showingResult,
		lastAnswerCorrect,
		lastAnswerClose,
		lastResponseTime,
		lastStreakBonus,
		loading,
		loadError,
		allMembers,
		masteredCount,
		totalCount,
		levelProgress,
		startSession,
		endSession,
		nextChallenge,
		submitAnswer,
		skipAnswer,
		useHint,
		useSecondHint,
		retryFetch: fetchTeamMembers,
	}
}

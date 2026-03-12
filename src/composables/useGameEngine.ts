/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { TeamMember } from '../types.ts'
import type { Challenge } from './useChallengeBuilder.ts'

import axios from '@nextcloud/axios'
import { showError } from '@nextcloud/dialogs'
import { generateOcsUrl } from '@nextcloud/router'
import { computed, ref } from 'vue'
import {
	CLOSE_ANSWER_THRESHOLD,
	HINT_COST_FIRST,
	HINT_COST_SECOND,
	MAX_LIVES,
	PLACEHOLDER_PHOTO,
	REVEAL_FRACTION,
	REVEAL_MIN_COUNT,
} from '../constants.ts'
import { levenshtein, normalizeText, shuffle } from '../utils/strings.ts'
import { buildChallenge, generateMaskedName } from './useChallengeBuilder.ts'
import {
	applyXp,
	computeLevelProgress,
	recordClose,
	recordCorrect,
	recordSkip,
	recordWrong,
} from './useScoring.ts'
import { pickNextPerson } from './useSpacedRepetition.ts'
import {
	type GameProgress,

	loadProgress,
	saveProgress,
} from './useStorage.ts'

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

/**
 * Central game engine composable.
 * Orchestrates spaced repetition, challenge building, scoring, and session state.
 */
export function useGameEngine() {
	const progress = ref<GameProgress>(loadProgress())
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
	// Track last shown person to avoid showing the same person twice in a row
	const lastPersonId = ref<number | null>(null)

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

	// Kick off the initial fetch
	fetchTeamMembers()

	const allMembers = computed(() => allMembersRaw.value.filter((m) => m.photo && m.name && m.photo !== PLACEHOLDER_PHOTO))

	const masteredCount = computed(() => allMembers.value.filter((m) => {
		const p = progress.value.people[m.id]
		return p && p.stage >= 4
	}).length)

	const totalCount = computed(() => allMembers.value.length)

	const levelProgress = computed(() => computeLevelProgress(progress.value))

	/**
	 * Reset session statistics and start a new session.
	 */
	function startSession() {
		sessionStats.value = {
			answered: 0,
			correct: 0,
			wrong: 0,
			streak: 0,
			bestStreak: 0,
			xpEarned: 0,
			newlyMastered: [],
		}
		lives.value = MAX_LIVES
		gameOver.value = false
		progress.value.sessionsPlayed++
		progress.value.lastPlayed = Date.now()
		saveProgress(progress.value)
		nextChallenge()
	}

	/**
	 * Advance to the next challenge, or signal game-over when no person is available.
	 */
	function nextChallenge() {
		if (gameOver.value) {
			return
		}

		const person = pickNextPerson(progress.value, allMembers.value, lastPersonId.value)
		if (!person) {
			gameOver.value = true
			return
		}

		lastPersonId.value = person.id
		showingResult.value = false
		currentChallenge.value = buildChallenge(person, progress.value, allMembers.value)
	}

	/**
	 * Submit an answer for the current challenge.
	 * Returns true when the answer is correct (or it's a "meet" card).
	 *
	 * @param answer The player's answer string
	 */
	function submitAnswer(answer: string): boolean {
		if (!currentChallenge.value) {
			return false
		}

		const challenge = currentChallenge.value
		const isMeet = challenge.type === 'meet'

		// Strip diacritics so answers are accent-agnostic (e.g. "Jose" matches "José")
		const normalizedAnswer = normalizeText(answer)
		const normalizedCorrect = normalizeText(challenge.correctAnswer)
		const isCorrect = isMeet || normalizedAnswer === normalizedCorrect
		// A "close" answer has Levenshtein distance ≤ threshold (catches typos)
		const isClose = !isCorrect && !isMeet
			&& normalizedAnswer.length > 0
			&& levenshtein(normalizedAnswer, normalizedCorrect) <= CLOSE_ANSWER_THRESHOLD

		if (isCorrect) {
			const { xp } = recordCorrect(
				progress.value,
				challenge.person.id,
				challenge.type,
				sessionStats.value.streak,
			)
			sessionStats.value.answered++
			sessionStats.value.correct++
			sessionStats.value.streak++
			sessionStats.value.xpEarned += xp

			if (sessionStats.value.streak > sessionStats.value.bestStreak) {
				sessionStats.value.bestStreak = sessionStats.value.streak
			}

			const pp = progress.value.people[challenge.person.id]
			if (pp && pp.stage === 4) {
				sessionStats.value.newlyMastered.push(challenge.person.name)
			}
		} else if (isClose) {
			const { xp } = recordClose(progress.value, challenge.person.id, challenge.type)
			sessionStats.value.answered++
			sessionStats.value.wrong++
			sessionStats.value.streak = 0
			sessionStats.value.xpEarned += xp
		} else {
			recordWrong(progress.value, challenge.person.id)
			sessionStats.value.answered++
			sessionStats.value.wrong++
			sessionStats.value.streak = 0

			lives.value--
			if (lives.value <= 0) {
				gameOver.value = true
			}
		}

		lastAnswerCorrect.value = isCorrect
		lastAnswerClose.value = isClose
		showingResult.value = true
		saveProgress(progress.value)

		return isCorrect
	}

	/**
	 * Mark the current challenge as skipped (wrong but no life lost).
	 * Used by the "I don't know" button.
	 */
	function skipAnswer() {
		if (!currentChallenge.value || showingResult.value) {
			return
		}
		const challenge = currentChallenge.value

		recordSkip(progress.value, challenge.person.id)
		sessionStats.value.answered++
		sessionStats.value.wrong++
		sessionStats.value.streak = 0

		lastAnswerCorrect.value = false
		lastAnswerClose.value = false
		showingResult.value = true
		saveProgress(progress.value)
	}

	/**
	 * Use the first hint: costs HINT_COST_FIRST XP, returns "title — department" or null
	 * when the player can't afford it.
	 */
	function useHint(): string | null {
		if (!currentChallenge.value || progress.value.xp < HINT_COST_FIRST) {
			return null
		}

		applyXp(progress.value, -HINT_COST_FIRST)
		sessionStats.value.xpEarned -= HINT_COST_FIRST
		saveProgress(progress.value)

		const person = currentChallenge.value.person
		return `${person.title} — ${person.department}`
	}

	/**
	 * Second-level hint for recall/type: reveals ~⅓ more letters.
	 * Returns a new masked string or null when not applicable.
	 */
	function revealMoreLetters(): string | null {
		if (!currentChallenge.value) {
			return null
		}
		const type = currentChallenge.value.type
		if (type !== 'recall' && type !== 'type') {
			return null
		}

		const name = currentChallenge.value.person.name
		// For 'type' there is no maskedName yet — generate a fresh base mask
		const baseMask = currentChallenge.value.maskedName ?? generateMaskedName(name)

		const hiddenIndices: number[] = []
		for (let i = 0; i < baseMask.length; i++) {
			if (baseMask[i] === '_') {
				hiddenIndices.push(i)
			}
		}
		if (hiddenIndices.length === 0) {
			return baseMask
		}

		// Reveal ~⅓ of remaining hidden letters (minimum REVEAL_MIN_COUNT)
		const revealCount = Math.max(REVEAL_MIN_COUNT, Math.ceil(hiddenIndices.length * REVEAL_FRACTION))
		const toReveal = shuffle([...hiddenIndices]).slice(0, revealCount)
		const chars = Array.from(baseMask)
		for (const idx of toReveal) {
			chars[idx] = name[idx]
		}
		return chars.join('')
	}

	/**
	 * Second-level hint for recognize/pick-face: returns the name of a wrong
	 * option to eliminate, or null when not applicable.
	 */
	function eliminateWrongOption(): string | null {
		if (!currentChallenge.value) {
			return null
		}
		const challenge = currentChallenge.value

		if (challenge.type === 'recognize' && challenge.options) {
			const wrong = challenge.options.filter((o) => o !== challenge.correctAnswer)
			if (wrong.length === 0) {
				return null
			}
			return wrong[Math.floor(Math.random() * wrong.length)]
		}

		if (challenge.type === 'pick-face' && challenge.photoOptions) {
			const wrong = challenge.photoOptions.filter((m) => m.name !== challenge.correctAnswer)
			if (wrong.length === 0) {
				return null
			}
			return wrong[Math.floor(Math.random() * wrong.length)].name
		}

		return null
	}

	/**
	 * Perform the second hint (costs HINT_COST_SECOND XP).
	 * Returns what was revealed so App.vue can store and display it.
	 */
	function useSecondHint(): { revealedMask: string | null, eliminatedOption: string | null } {
		const empty = { revealedMask: null, eliminatedOption: null }
		if (!currentChallenge.value || progress.value.xp < HINT_COST_SECOND) {
			return empty
		}

		applyXp(progress.value, -HINT_COST_SECOND)
		sessionStats.value.xpEarned -= HINT_COST_SECOND
		saveProgress(progress.value)

		const type = currentChallenge.value.type
		if (type === 'recall' || type === 'type') {
			return { revealedMask: revealMoreLetters(), eliminatedOption: null }
		}
		return { revealedMask: null, eliminatedOption: eliminateWrongOption() }
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
		loading,
		loadError,
		allMembers,
		masteredCount,
		totalCount,
		levelProgress,
		startSession,
		nextChallenge,
		submitAnswer,
		skipAnswer,
		useHint,
		useSecondHint,
		retryFetch: fetchTeamMembers,
	}
}

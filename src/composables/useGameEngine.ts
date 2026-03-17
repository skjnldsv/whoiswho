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
	FAST_ANSWER_BONUS_XP,
	FAST_ANSWER_THRESHOLD,
	HINT_COST_FIRST,
	HINT_COST_SECOND,
	LIFE_REFILL_STREAK,
	MAX_LIVES,
	PLACEHOLDER_PHOTO,
	REVEAL_FRACTION,
	REVEAL_MIN_COUNT,
	STREAK_BONUS_INTERVAL,
	STREAK_BONUS_XP,
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

	getPersonProgress,
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
	lowestLives: number // lowest lives count reached in this session (for comeback achievements)
	timedAnswerCount: number // number of answered timed challenges (timeLimit > 0)
	totalResponseTime: number // sum of response times for timed answers (ms)
	nearMiss: boolean // lost a life on the very next question after a life refill
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
		lowestLives: MAX_LIVES,
		timedAnswerCount: 0,
		totalResponseTime: 0,
		nearMiss: false,
	})
	const lives = ref(MAX_LIVES)
	const maxLives = MAX_LIVES
	const gameOver = ref(false)
	const showingResult = ref(false)
	const lastAnswerCorrect = ref(false)
	const lastAnswerClose = ref(false)
	const lastResponseTime = ref(0) // ms taken to answer the most recent challenge
	const lastStreakBonus = ref(0) // XP bonus awarded for streak milestone (0 if none)
	const lifeRefillGained = ref(false) // true when the most recent correct answer earned an extra life
	// Track last shown person to avoid showing the same person twice in a row
	const lastPersonId = ref<number | null>(null)
	// Track when the current challenge was shown, to measure response time
	const challengeStartTime = ref(0)

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

	/** Currently selected department to practice (null = all departments). */
	const selectedDepartment = ref<string | null>(null)

	/** Sorted list of departments extracted from the team roster. */
	const availableDepartments = computed(() => {
		const depts = new Set(allMembers.value.map((m) => m.department).filter(Boolean))
		return Array.from(depts).sort()
	})

	/** Members filtered to the selected department (or all members when no filter). */
	const filteredMembers = computed(() => selectedDepartment.value === null
		? allMembers.value
		: allMembers.value.filter((m) => m.department === selectedDepartment.value))

	const masteredCount = computed(() => filteredMembers.value.filter((m) => {
		const p = progress.value.people[m.id]
		return p && p.stage >= 4
	}).length)

	const totalCount = computed(() => filteredMembers.value.length)

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
			lowestLives: MAX_LIVES,
			timedAnswerCount: 0,
			totalResponseTime: 0,
			nearMiss: false,
		}

		// Restore persisted lives if a session was interrupted (e.g. force-close),
		// otherwise start fresh so the exploit of force-closing to regain hearts is closed.
		if (progress.value.sessionActive) {
			lives.value = progress.value.currentLives
		} else {
			lives.value = MAX_LIVES
			progress.value.currentLives = MAX_LIVES
		}

		gameOver.value = false
		progress.value.sessionActive = true
		progress.value.sessionsPlayed++
		progress.value.lastPlayed = Date.now()

		// Track play date for day-streak and weekend achievements
		const today = new Date().toISOString().substring(0, 10)
		if (!progress.value.playDates) {
			progress.value.playDates = []
		}
		if (!progress.value.playDates.includes(today)) {
			progress.value.playDates.push(today)
			// Keep only the last 35 dates (enough for 30-day streak check + buffer)
			if (progress.value.playDates.length > 35) {
				progress.value.playDates = progress.value.playDates.slice(-35)
			}
		}

		saveProgress(progress.value)
		nextChallenge()
	}

	/**
	 * Mark the session as inactive and persist the state.
	 * Resets the current streak since it is session-specific.
	 * Call this when a session ends (game over or user navigates away).
	 */
	function endSession() {
		progress.value.sessionActive = false
		progress.value.currentStreak = 0
		saveProgress(progress.value)
	}

	/**
	 * Advance to the next challenge, or signal game-over when no person is available.
	 */
	function nextChallenge() {
		if (gameOver.value) {
			return
		}

		const person = pickNextPerson(progress.value, filteredMembers.value, lastPersonId.value)
		if (!person) {
			gameOver.value = true
			endSession()
			return
		}

		lastPersonId.value = person.id
		showingResult.value = false
		currentChallenge.value = buildChallenge(person, progress.value, filteredMembers.value)
		challengeStartTime.value = Date.now()
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

		// Capture and reset the life-refill flag from the previous answer
		const wasLifeRefilled = lifeRefillGained.value
		lifeRefillGained.value = false

		// Strip diacritics so answers are accent-agnostic (e.g. "Jose" matches "José")
		const normalizedAnswer = normalizeText(answer)
		const normalizedCorrect = normalizeText(challenge.correctAnswer)
		const isCorrect = isMeet || normalizedAnswer === normalizedCorrect
		// A "close" answer has Levenshtein distance ≤ threshold (catches typos)
		const isClose = !isCorrect && !isMeet
			&& normalizedAnswer.length > 0
			&& levenshtein(normalizedAnswer, normalizedCorrect) <= CLOSE_ANSWER_THRESHOLD

		// Measure how long the player took to answer
		const responseTime = challengeStartTime.value > 0 ? Date.now() - challengeStartTime.value : 0
		lastResponseTime.value = responseTime

		// Update per-person response time stats (using running average over total answers)
		const pp = getPersonProgress(progress.value, challenge.person.id)
		// Capture stage before any mutation so we can detect new mastery below
		const prevStage = pp.stage
		pp.lastResponseTime = responseTime
		const totalAnswers = pp.totalCorrect + pp.totalWrong + 1 // +1 for this answer (not yet recorded)
		pp.avgResponseTime = pp.avgResponseTime === 0
			? responseTime
			: Math.round((pp.avgResponseTime * (totalAnswers - 1) + responseTime) / totalAnswers)

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

			// Track per-challenge-type correct counts for achievements
			if (challenge.type === 'meet') {
				progress.value.meetCount++
			} else if (challenge.type === 'recognize') {
				progress.value.recognizeCorrect++
			} else if (challenge.type === 'pick-face') {
				progress.value.pickFaceCorrect++
			} else if (challenge.type === 'recall' || challenge.type === 'type') {
				progress.value.recallCorrect++
			}

			// Award bonus XP for fast correct answers on timed challenges
			if (challenge.timeLimit > 0 && responseTime > 0 && responseTime < challenge.timeLimit * FAST_ANSWER_THRESHOLD) {
				applyXp(progress.value, FAST_ANSWER_BONUS_XP)
				sessionStats.value.xpEarned += FAST_ANSWER_BONUS_XP
			}

			// Track fast answers for achievement purposes (only timed challenges count)
			if (challenge.timeLimit > 0 && responseTime > 0) {
				sessionStats.value.timedAnswerCount++
				sessionStats.value.totalResponseTime += responseTime
				if (responseTime < 3000) {
					progress.value.fastAnswerCount++
				}
				if (responseTime < 2000) {
					progress.value.veryFastAnswerCount++
				}
			}

			// Award streak milestone bonus every STREAK_BONUS_INTERVAL consecutive correct answers
			if (sessionStats.value.streak > 0 && sessionStats.value.streak % STREAK_BONUS_INTERVAL === 0) {
				applyXp(progress.value, STREAK_BONUS_XP)
				sessionStats.value.xpEarned += STREAK_BONUS_XP
				lastStreakBonus.value = STREAK_BONUS_XP
			} else {
				lastStreakBonus.value = 0
			}

			// Award an extra life every LIFE_REFILL_STREAK consecutive correct answers
			if (sessionStats.value.streak >= LIFE_REFILL_STREAK && sessionStats.value.streak % LIFE_REFILL_STREAK === 0 && lives.value < MAX_LIVES) {
				lives.value++
				progress.value.currentLives = lives.value
				lifeRefillGained.value = true
			}

			if (sessionStats.value.streak > sessionStats.value.bestStreak) {
				sessionStats.value.bestStreak = sessionStats.value.streak
			}

			// Only push to newlyMastered when the person just reached stage 4 for the first time
			if (prevStage < 4 && pp.stage === 4) {
				sessionStats.value.newlyMastered.push(challenge.person.name)
			}
		} else if (isClose) {
			const { xp } = recordClose(progress.value, challenge.person.id, challenge.type)
			sessionStats.value.answered++
			sessionStats.value.wrong++
			sessionStats.value.streak = 0
			sessionStats.value.xpEarned += xp
			lastStreakBonus.value = 0
		} else {
			recordWrong(progress.value, challenge.person.id)
			sessionStats.value.answered++
			sessionStats.value.wrong++
			sessionStats.value.streak = 0
			lastStreakBonus.value = 0

			// Near miss: lost a life immediately after a life refill
			if (wasLifeRefilled) {
				sessionStats.value.nearMiss = true
			}

			lives.value--
			progress.value.currentLives = lives.value
			if (lives.value < sessionStats.value.lowestLives) {
				sessionStats.value.lowestLives = lives.value
			}
			if (lives.value <= 0) {
				gameOver.value = true
				endSession()
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
		lastStreakBonus.value = 0

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
		lastResponseTime,
		lastStreakBonus,
		lifeRefillGained,
		loading,
		loadError,
		allMembers,
		filteredMembers,
		selectedDepartment,
		availableDepartments,
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

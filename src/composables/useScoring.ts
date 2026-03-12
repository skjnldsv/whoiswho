/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { ChallengeType } from './useChallengeBuilder.ts'
import type { GameProgress } from './useStorage.ts'

import {
	CLOSE_ANSWER_XP_DIVISOR,
	CLOSE_RETRY_INTERVAL,
	WRONG_RETRY_INTERVAL,
	XP_PER_LEVEL,
} from '../constants.ts'
import { nextReviewAt } from './useSpacedRepetition.ts'
import { getPersonProgress } from './useStorage.ts'

/** XP earned per challenge type. */
export const XP_PER_STAGE: Record<ChallengeType, number> = {
	meet: 5,
	recognize: 15,
	'pick-face': 15,
	recall: 25,
	type: 40,
}

export interface ScoringResult {
	xpDelta: number
	leveledUp: boolean
	newLevel: number
}

/**
 * Apply XP to the progress object and handle level-ups.
 * Mutates progress in place.
 *
 * @param progress The game progress to update
 * @param xpDelta XP to add (may be negative for hint costs)
 */
export function applyXp(progress: GameProgress, xpDelta: number): ScoringResult {
	progress.xp = Math.max(0, progress.xp + xpDelta)

	let leveledUp = false
	const xpForLevel = progress.level * XP_PER_LEVEL
	if (progress.xp >= xpForLevel) {
		progress.level++
		leveledUp = true
	}

	return { xpDelta, leveledUp, newLevel: progress.level }
}

/**
 * Compute the XP fill fraction (0–1) for the current level's progress bar.
 * Each level requires a flat 100 XP (XP_PER_LEVEL) to complete.
 * Thresholds: level 1 = 100, level 2 = 200, level 3 = 300, …
 *
 * @param progress The game progress
 */
export function computeLevelProgress(progress: GameProgress): number {
	const level = progress.level
	// XP accumulated since the start of this level
	const previousThreshold = (level - 1) * XP_PER_LEVEL
	const xpIntoCurrentLevel = Math.max(0, progress.xp - previousThreshold)
	return Math.min(xpIntoCurrentLevel / XP_PER_LEVEL, 1)
}

/**
 * Record a correct answer: advance stage, update streaks, award XP.
 * Mutates progress and personProgress in place.
 *
 * @param progress The overall game progress
 * @param personId The ID of the person answered correctly
 * @param challengeType The type of challenge answered
 * @param sessionStreak Current session streak count (before this answer)
 */
export function recordCorrect(
	progress: GameProgress,
	personId: number,
	challengeType: ChallengeType,
	sessionStreak: number,
): { xp: number, leveledUp: boolean, newStage: number } {
	const pp = getPersonProgress(progress, personId)
	const now = Date.now()

	pp.lastSeen = now
	pp.totalCorrect++
	pp.correctStreak++
	pp.stage = Math.min(pp.stage + 1, 4)
	pp.nextReview = nextReviewAt(pp.stage)

	progress.totalAnswered++
	progress.totalCorrect++

	const xp = XP_PER_STAGE[challengeType]
	const { leveledUp } = applyXp(progress, xp)

	const newStreak = sessionStreak + 1
	if (newStreak > progress.bestStreak) {
		progress.bestStreak = newStreak
	}
	progress.currentStreak = newStreak

	return { xp, leveledUp, newStage: pp.stage }
}

/**
 * Record a close answer: partial XP, no stage change, retry soon.
 * Mutates progress in place.
 *
 * @param progress The overall game progress
 * @param personId The ID of the person answered
 * @param challengeType The type of challenge
 */
export function recordClose(
	progress: GameProgress,
	personId: number,
	challengeType: ChallengeType,
): { xp: number } {
	const pp = getPersonProgress(progress, personId)
	const now = Date.now()

	pp.lastSeen = now
	pp.totalWrong++
	pp.correctStreak = 0
	pp.nextReview = now + CLOSE_RETRY_INTERVAL

	progress.totalAnswered++
	progress.currentStreak = 0

	const partialXp = Math.ceil(XP_PER_STAGE[challengeType] / CLOSE_ANSWER_XP_DIVISOR)
	applyXp(progress, partialXp)

	return { xp: partialXp }
}

/**
 * Record a wrong answer: regress stage, lose a life.
 * Mutates progress in place.
 *
 * @param progress The overall game progress
 * @param personId The ID of the person answered
 */
export function recordWrong(
	progress: GameProgress,
	personId: number,
): void {
	const pp = getPersonProgress(progress, personId)
	const now = Date.now()

	pp.lastSeen = now
	pp.totalWrong++
	pp.correctStreak = 0
	pp.stage = Math.max(pp.stage - 1, 1)
	pp.nextReview = now + WRONG_RETRY_INTERVAL

	progress.totalAnswered++
	progress.currentStreak = 0
}

/**
 * Record a skipped answer (like wrong, but no life lost).
 * Mutates progress in place.
 *
 * @param progress The overall game progress
 * @param personId The ID of the person skipped
 */
export function recordSkip(
	progress: GameProgress,
	personId: number,
): void {
	recordWrong(progress, personId)
}

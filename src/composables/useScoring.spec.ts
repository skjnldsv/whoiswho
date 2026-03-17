/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock @nextcloud/browser-storage before module-level side effects in useStorage
vi.mock('@nextcloud/browser-storage', () => {
	const store: Record<string, string> = {}
	return {
		getBuilder: () => ({
			persist: () => ({
				build: () => ({
					getItem: (key: string) => store[key] ?? null,
					setItem: (key: string, value: string) => { store[key] = value },
					removeItem: (key: string) => { delete store[key] },
				}),
			}),
		}),
	}
})

import type { GameProgress } from './useStorage.ts'

import {
	CLOSE_ANSWER_XP_DIVISOR,
	CLOSE_RETRY_INTERVAL,
	WRONG_RETRY_INTERVAL,
} from '../constants.ts'
import {
	applyXp,
	computeLevelProgress,
	recordClose,
	recordCorrect,
	recordSkip,
	recordWrong,
	XP_PER_STAGE,
} from './useScoring.ts'
import { defaultProgress } from './useStorage.ts'

describe('applyXp', () => {
	let progress: GameProgress

	beforeEach(() => {
		progress = defaultProgress()
	})

	it('adds XP to the progress', () => {
		const result = applyXp(progress, 15)
		expect(progress.xp).toBe(15)
		expect(result.xpDelta).toBe(15)
	})

	it('does not let XP drop below 0', () => {
		progress.xp = 5
		applyXp(progress, -20)
		expect(progress.xp).toBe(0)
	})

	it('detects a level-up when XP reaches the threshold', () => {
		// Level 1 threshold = 1 * 100 = 100
		progress.xp = 99
		const result = applyXp(progress, 1)
		expect(result.leveledUp).toBe(true)
		expect(result.newLevel).toBe(2)
		expect(progress.level).toBe(2)
	})

	it('does not level-up when XP is below the threshold', () => {
		progress.xp = 50
		const result = applyXp(progress, 10)
		expect(result.leveledUp).toBe(false)
		expect(progress.level).toBe(1)
	})
})

describe('computeLevelProgress', () => {
	let progress: GameProgress

	beforeEach(() => {
		progress = defaultProgress()
	})

	it('returns 0 at the start of a level', () => {
		progress.xp = 0
		expect(computeLevelProgress(progress)).toBe(0)
	})

	it('returns 0.5 at the halfway point of a level', () => {
		// Level 1: threshold at 100 XP, halfway = 50 XP
		progress.xp = 50
		expect(computeLevelProgress(progress)).toBe(0.5)
	})

	it('returns 1 when XP exactly reaches the level threshold', () => {
		// Level 1: threshold = 100
		progress.xp = 100
		expect(computeLevelProgress(progress)).toBe(1)
	})

	it('clamps at 1 even with excess XP', () => {
		progress.xp = 200
		expect(computeLevelProgress(progress)).toBe(1)
	})

	it('calculates progress correctly mid-level-2', () => {
		// Level 2 starts at 100 XP, threshold at 200 XP
		progress.level = 2
		progress.xp = 150
		// 50 XP into the current level out of 100 → 0.5
		expect(computeLevelProgress(progress)).toBe(0.5)
	})
})

describe('recordCorrect', () => {
	let progress: GameProgress

	beforeEach(() => {
		progress = defaultProgress()
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-01-01T12:00:00Z'))
	})

	it('increments totalAnswered and totalCorrect', () => {
		recordCorrect(progress, 1, 'recognize', 0)
		expect(progress.totalAnswered).toBe(1)
		expect(progress.totalCorrect).toBe(1)
	})

	it('awards the correct XP for each challenge type', () => {
		for (const [type, xp] of Object.entries(XP_PER_STAGE)) {
			const p = defaultProgress()
			const result = recordCorrect(p, 1, type as keyof typeof XP_PER_STAGE, 0)
			expect(result.xp).toBe(xp)
		}
	})

	it('advances the person stage by 1 (capped at 4)', () => {
		const result = recordCorrect(progress, 1, 'recognize', 0)
		// Stage starts at 0, goes to 1 after correct answer
		expect(result.newStage).toBe(1)
	})

	it('does not advance stage beyond 4', () => {
		// Set person to stage 4 manually
		progress.people[1] = {
			personId: 1,
			stage: 4,
			correctStreak: 10,
			totalCorrect: 10,
			totalWrong: 0,
			lastSeen: 0,
			nextReview: 0,
			avgResponseTime: 0,
			lastResponseTime: 0,
		}
		const result = recordCorrect(progress, 1, 'type', 0)
		expect(result.newStage).toBe(4)
	})

	it('updates the bestStreak when the session streak is higher', () => {
		progress.bestStreak = 3
		recordCorrect(progress, 1, 'meet', 4) // sessionStreak 4 → newStreak 5
		expect(progress.bestStreak).toBe(5)
	})

	it('does not decrease bestStreak when new streak is lower', () => {
		progress.bestStreak = 10
		recordCorrect(progress, 1, 'meet', 0) // newStreak = 1
		expect(progress.bestStreak).toBe(10)
	})
})

describe('recordClose', () => {
	let progress: GameProgress

	beforeEach(() => {
		progress = defaultProgress()
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-01-01T12:00:00Z'))
	})

	it('increments totalAnswered but not totalCorrect', () => {
		recordClose(progress, 1, 'recall')
		expect(progress.totalAnswered).toBe(1)
		expect(progress.totalCorrect).toBe(0)
	})

	it('awards partial XP (1/CLOSE_ANSWER_XP_DIVISOR, rounded up)', () => {
		const result = recordClose(progress, 1, 'recall')
		const expected = Math.ceil(XP_PER_STAGE.recall / CLOSE_ANSWER_XP_DIVISOR)
		expect(result.xp).toBe(expected)
	})

	it('resets the session streak to 0', () => {
		progress.currentStreak = 5
		recordClose(progress, 1, 'recall')
		expect(progress.currentStreak).toBe(0)
	})

	it('schedules the next review after CLOSE_RETRY_INTERVAL', () => {
		const now = Date.now()
		recordClose(progress, 1, 'recall')
		expect(progress.people[1].nextReview).toBe(now + CLOSE_RETRY_INTERVAL)
	})
})

describe('recordWrong', () => {
	let progress: GameProgress

	beforeEach(() => {
		progress = defaultProgress()
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-01-01T12:00:00Z'))
	})

	it('increments totalAnswered but not totalCorrect', () => {
		recordWrong(progress, 1)
		expect(progress.totalAnswered).toBe(1)
		expect(progress.totalCorrect).toBe(0)
	})

	it('regresses person stage by 1 (minimum stage 1)', () => {
		// New person is at stage 0; after wrong → still 1 (min 1)
		recordWrong(progress, 1)
		expect(progress.people[1].stage).toBe(1)
	})

	it('does not let stage drop below 1', () => {
		progress.people[2] = {
			personId: 2,
			stage: 1,
			correctStreak: 0,
			totalCorrect: 0,
			totalWrong: 0,
			lastSeen: 0,
			nextReview: 0,
			avgResponseTime: 0,
			lastResponseTime: 0,
		}
		recordWrong(progress, 2)
		expect(progress.people[2].stage).toBe(1)
	})

	it('resets the session streak to 0', () => {
		progress.currentStreak = 7
		recordWrong(progress, 1)
		expect(progress.currentStreak).toBe(0)
	})

	it('schedules the next review after WRONG_RETRY_INTERVAL', () => {
		const now = Date.now()
		recordWrong(progress, 1)
		expect(progress.people[1].nextReview).toBe(now + WRONG_RETRY_INTERVAL)
	})
})

describe('recordSkip', () => {
	let progress: GameProgress

	beforeEach(() => {
		progress = defaultProgress()
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-01-01T12:00:00Z'))
	})

	it('behaves the same as recordWrong (no life lost, but stage regresses)', () => {
		recordSkip(progress, 1)
		expect(progress.totalAnswered).toBe(1)
		expect(progress.people[1].stage).toBe(1) // was 0 → min 1
		expect(progress.currentStreak).toBe(0)
	})
})

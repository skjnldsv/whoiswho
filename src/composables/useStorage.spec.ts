/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock @nextcloud/browser-storage before any module-level side effects
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

import { MAX_LIVES } from '../constants.ts'
import { defaultProgress, getPersonProgress, mergeProgress } from './useStorage.ts'

describe('defaultProgress', () => {
	it('returns a progress object with zero scores', () => {
		const progress = defaultProgress()
		expect(progress.xp).toBe(0)
		expect(progress.level).toBe(1)
		expect(progress.totalAnswered).toBe(0)
		expect(progress.totalCorrect).toBe(0)
		expect(progress.bestStreak).toBe(0)
		expect(progress.currentStreak).toBe(0)
	})

	it('starts with MAX_LIVES lives', () => {
		const progress = defaultProgress()
		expect(progress.currentLives).toBe(MAX_LIVES)
	})

	it('starts with an empty people record', () => {
		const progress = defaultProgress()
		expect(progress.people).toEqual({})
	})

	it('starts with sessionActive = false', () => {
		const progress = defaultProgress()
		expect(progress.sessionActive).toBe(false)
	})

	it('starts with empty playDates array', () => {
		const progress = defaultProgress()
		expect(progress.playDates).toEqual([])
	})
})

describe('getPersonProgress', () => {
	let progress: GameProgress

	beforeEach(() => {
		progress = defaultProgress()
	})

	it('creates a new entry for an unseen person', () => {
		const pp = getPersonProgress(progress, 42)
		expect(pp.personId).toBe(42)
		expect(pp.stage).toBe(0)
		expect(pp.correctStreak).toBe(0)
		expect(pp.totalCorrect).toBe(0)
		expect(pp.totalWrong).toBe(0)
	})

	it('returns the existing entry if the person already has progress', () => {
		// Create first reference
		const first = getPersonProgress(progress, 1)
		first.stage = 3
		first.totalCorrect = 5

		// Fetch again — should be the same object
		const second = getPersonProgress(progress, 1)
		expect(second.stage).toBe(3)
		expect(second.totalCorrect).toBe(5)
		expect(second).toBe(first)
	})

	it('initialises response-time fields for legacy records missing them', () => {
		// Simulate a legacy record that predates the avgResponseTime field
		progress.people[7] = {
			personId: 7,
			stage: 2,
			correctStreak: 1,
			totalCorrect: 1,
			totalWrong: 0,
			lastSeen: 0,
			nextReview: 0,
		} as unknown as ReturnType<typeof getPersonProgress>

		const pp = getPersonProgress(progress, 7)
		expect(pp.avgResponseTime).toBe(0)
		expect(pp.lastResponseTime).toBe(0)
	})

	it('stores the new entry in progress.people', () => {
		getPersonProgress(progress, 99)
		expect(progress.people[99]).toBeDefined()
		expect(progress.people[99].personId).toBe(99)
	})
})

describe('mergeProgress', () => {
	function makeProgress(overrides: Partial<GameProgress>): GameProgress {
		return { ...defaultProgress(), ...overrides }
	}

	it('prefers the server copy when it has more XP', () => {
		const local = makeProgress({ xp: 50, level: 1 })
		const server = makeProgress({ xp: 200, level: 3 })
		const merged = mergeProgress(local, server)
		expect(merged.xp).toBe(200)
		expect(merged.level).toBe(3)
	})

	it('prefers the local copy when it has more XP', () => {
		const local = makeProgress({ xp: 300, level: 4 })
		const server = makeProgress({ xp: 100, level: 2 })
		const merged = mergeProgress(local, server)
		expect(merged.xp).toBe(300)
		expect(merged.level).toBe(4)
	})

	it('merges people by taking the highest stage', () => {
		const local = makeProgress({
			xp: 0,
			people: {
				1: { personId: 1, stage: 3, correctStreak: 0, totalCorrect: 5, totalWrong: 0, lastSeen: 0, nextReview: 0, avgResponseTime: 0, lastResponseTime: 0 },
			},
		})
		const server = makeProgress({
			xp: 100,
			people: {
				1: { personId: 1, stage: 1, correctStreak: 0, totalCorrect: 1, totalWrong: 0, lastSeen: 0, nextReview: 0, avgResponseTime: 0, lastResponseTime: 0 },
				2: { personId: 2, stage: 2, correctStreak: 0, totalCorrect: 2, totalWrong: 0, lastSeen: 0, nextReview: 0, avgResponseTime: 0, lastResponseTime: 0 },
			},
		})
		const merged = mergeProgress(local, server)
		// server wins on XP; person 1 should keep stage 3 (from local which is higher)
		expect(merged.people[1].stage).toBe(3)
		// person 2 exists only on server — should be present
		expect(merged.people[2].stage).toBe(2)
	})

	it('includes people present only in local when server has more XP', () => {
		const local = makeProgress({
			xp: 0,
			people: {
				5: { personId: 5, stage: 4, correctStreak: 0, totalCorrect: 10, totalWrong: 0, lastSeen: 0, nextReview: 0, avgResponseTime: 0, lastResponseTime: 0 },
			},
		})
		const server = makeProgress({ xp: 500, people: {} })
		const merged = mergeProgress(local, server)
		expect(merged.people[5]).toBeDefined()
		expect(merged.people[5].stage).toBe(4)
	})

	it('returns a result with equal XP when both inputs match', () => {
		const a = makeProgress({ xp: 50 })
		const b = makeProgress({ xp: 50 })
		const merged = mergeProgress(a, b)
		expect(merged.xp).toBe(50)
	})
})

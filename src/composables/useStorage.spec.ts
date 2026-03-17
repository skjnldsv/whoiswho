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
import { defaultProgress, getPersonProgress } from './useStorage.ts'

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

/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

import { ACTIVE_POOL_SIZE, INTERVALS } from '../constants.ts'
import { nextReviewAt, pickNextPerson } from './useSpacedRepetition.ts'
import { defaultProgress } from './useStorage.ts'
import type { GameProgress } from './useStorage.ts'
import type { TeamMember } from '../types.ts'

/** Create a minimal TeamMember for testing. */
function makeMember(id: number, name = `Person ${id}`): TeamMember {
	return {
		id,
		name,
		title: 'Engineer',
		department: 'Engineering',
		photo: `https://example.com/photo${id}.jpg`,
	}
}

describe('nextReviewAt', () => {
	beforeEach(() => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-01-01T12:00:00Z'))
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('returns Date.now() for stage 0 (interval = 0)', () => {
		expect(nextReviewAt(0)).toBe(Date.now() + INTERVALS[0])
	})

	it('returns Date.now() for stage 1 (interval = 0)', () => {
		expect(nextReviewAt(1)).toBe(Date.now() + INTERVALS[1])
	})

	it('adds 30 seconds for stage 2', () => {
		expect(nextReviewAt(2)).toBe(Date.now() + INTERVALS[2])
	})

	it('adds 2 minutes for stage 3', () => {
		expect(nextReviewAt(3)).toBe(Date.now() + INTERVALS[3])
	})

	it('adds 10 minutes for stage 4+', () => {
		expect(nextReviewAt(4)).toBe(Date.now() + INTERVALS[4])
		// Stage 5 is clamped to INTERVALS[4]
		expect(nextReviewAt(5)).toBe(Date.now() + INTERVALS[4])
	})
})

describe('pickNextPerson', () => {
	let progress: GameProgress

	beforeEach(() => {
		progress = defaultProgress()
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-01-01T12:00:00Z'))
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('returns null when the member list is empty', () => {
		expect(pickNextPerson(progress, [], null)).toBeNull()
	})

	it('returns an unseen member when no progress exists', () => {
		const members = [makeMember(1), makeMember(2), makeMember(3)]
		const result = pickNextPerson(progress, members, null)
		expect(result).not.toBeNull()
		expect(members).toContainEqual(result)
	})

	it('avoids repeating the last-shown person when possible', () => {
		const members = [makeMember(1), makeMember(2)]
		// Run many times; lastPersonId=1 should not always be returned
		const results = new Set<number>()
		for (let i = 0; i < 50; i++) {
			const r = pickNextPerson(progress, members, 1)
			if (r) results.add(r.id)
		}
		expect(results.has(2)).toBe(true)
	})

	it('returns an overdue active member ahead of unseen members', () => {
		// Set up one active person who is overdue
		const now = Date.now()
		progress.people[1] = {
			personId: 1, stage: 2, correctStreak: 0,
			totalCorrect: 2, totalWrong: 0,
			lastSeen: now - 60_000, nextReview: now - 1, // overdue
			avgResponseTime: 0, lastResponseTime: 0,
		}

		const members = [makeMember(1), makeMember(2), makeMember(3)]
		const result = pickNextPerson(progress, members, null)
		expect(result?.id).toBe(1)
	})

	it('introduces a new member when the pool has room', () => {
		// Fill fewer than ACTIVE_POOL_SIZE active members
		const now = Date.now()
		// One active member (not yet overdue)
		progress.people[1] = {
			personId: 1, stage: 1, correctStreak: 0,
			totalCorrect: 1, totalWrong: 0,
			lastSeen: now, nextReview: now + 99_999,
			avgResponseTime: 0, lastResponseTime: 0,
		}

		// Members 2–ACTIVE_POOL_SIZE+1 are unseen
		const members = Array.from({ length: ACTIVE_POOL_SIZE + 1 }, (_, i) => makeMember(i + 1))
		const result = pickNextPerson(progress, members, null)
		// Should be an unseen member (id 2 through ACTIVE_POOL_SIZE+1)
		expect(result?.id).not.toBe(1)
	})

	it('returns the mastered person soonest due when nothing else is available', () => {
		const now = Date.now()
		// All members are mastered (stage 4) and both are due
		progress.people[1] = {
			personId: 1, stage: 4, correctStreak: 5,
			totalCorrect: 5, totalWrong: 0,
			lastSeen: now - 20_000, nextReview: now - 20_000, // most overdue
			avgResponseTime: 0, lastResponseTime: 0,
		}
		progress.people[2] = {
			personId: 2, stage: 4, correctStreak: 5,
			totalCorrect: 5, totalWrong: 0,
			lastSeen: now - 5_000, nextReview: now - 5_000,
			avgResponseTime: 0, lastResponseTime: 0,
		}

		const members = [makeMember(1), makeMember(2)]
		const result = pickNextPerson(progress, members, null)
		// Member 1 is more overdue → higher priority
		expect(result?.id).toBe(1)
	})
})

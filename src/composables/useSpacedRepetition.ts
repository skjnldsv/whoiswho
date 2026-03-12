/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { TeamMember } from '../types.ts'
import type { GameProgress, PersonProgress } from './useStorage.ts'

import {
	ACTIVE_POOL_SIZE,
	INTERVALS,
} from '../constants.ts'

export interface PersonWithPriority {
	member: TeamMember
	priority: number
}

interface ActiveMember {
	member: TeamMember
	pp: PersonProgress
}

/**
 * Pick the next person to show based on spaced-repetition rules.
 *
 * Priority order:
 * 1. Overdue active members (with more errors first)
 * 2. New unseen members (when pool has room)
 * 3. Active members soonest due
 * 4. Mastered members due for review
 * 5. New unseen members (pool is full but all active are not yet due)
 * 6. Least-recently seen overall
 *
 * @param progress The current game progress
 * @param members All available team members
 * @param lastPersonId ID of the person shown last (to avoid repeats)
 */
export function pickNextPerson(
	progress: GameProgress,
	members: TeamMember[],
	lastPersonId: number | null,
): TeamMember | null {
	if (members.length === 0) {
		return null
	}

	const now = Date.now()
	const unseen: TeamMember[] = []
	const dueForReview: PersonWithPriority[] = []
	const active: ActiveMember[] = []

	for (const m of members) {
		const pp = progress.people[m.id]
		if (!pp || pp.stage === 0) {
			unseen.push(m)
		} else if (pp.stage >= 4) {
			if (now >= pp.nextReview) {
				dueForReview.push({ member: m, priority: now - pp.nextReview })
			}
		} else {
			active.push({ member: m, pp })
		}
	}

	/**
	 * Return filtered array excluding lastPersonId (falls back to full array if empty).
	 *
	 * @param arr The team members to filter
	 */
	function preferNotLast(arr: TeamMember[]): TeamMember[] {
		const filtered = arr.filter((m) => m.id !== lastPersonId)
		return filtered.length > 0 ? filtered : arr
	}

	// 1. Overdue active members — prioritise those with more errors
	const overdue = active
		.filter((a) => now >= a.pp.nextReview)
		.sort((a, b) => a.pp.nextReview - b.pp.nextReview)

	let result: TeamMember | null

	if (overdue.length > 0) {
		const withErrors = overdue.filter((a) => a.pp.totalWrong > a.pp.totalCorrect)
		if (withErrors.length > 0) {
			const pool = preferNotLast(withErrors.map((a) => a.member))
			result = pool[Math.floor(Math.random() * pool.length)]
		} else {
			const pool = preferNotLast(overdue.map((a) => a.member))
			result = pool[0]
		}
	} else if (active.length < ACTIVE_POOL_SIZE && unseen.length > 0) {
		// 2. Introduce new members when pool has room
		const pool = preferNotLast(unseen)
		result = pool[Math.floor(Math.random() * pool.length)]
	} else if (active.length > 0) {
		// 3. Active member soonest due
		active.sort((a, b) => a.pp.nextReview - b.pp.nextReview)
		const pool = preferNotLast(active.map((a) => a.member))
		result = pool[0]
	} else if (dueForReview.length > 0) {
		// 4. Mastered members due for review
		dueForReview.sort((a, b) => b.priority - a.priority)
		const pool = preferNotLast(dueForReview.map((a) => a.member))
		result = pool[0]
	} else if (unseen.length > 0) {
		// 5. Introduce new members (pool full but all active not due)
		const pool = preferNotLast(unseen)
		result = pool[Math.floor(Math.random() * pool.length)]
	} else {
		// 6. Fallback: least-recently seen
		const allWithProgress = members
			.map((m) => ({ member: m, pp: progress.people[m.id] }))
			.filter((a) => a.pp)
			.sort((a, b) => a.pp.lastSeen - b.pp.lastSeen)

		result = allWithProgress.length > 0 ? allWithProgress[0].member : members[0]
	}

	return result
}

/**
 * Compute the next review timestamp for a given stage.
 *
 * @param stage The new stage (0–4)
 */
export function nextReviewAt(stage: number): number {
	return Date.now() + (INTERVALS[Math.min(stage, INTERVALS.length - 1)] ?? 0)
}

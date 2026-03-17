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

import type { TeamMember } from '../types.ts'
import type { GameProgress } from './useStorage.ts'

import { OPTION_COUNT, PLACEHOLDER_PHOTO } from '../constants.ts'
import {
	buildChallenge,
	generateMaskedName,
	getRandomOptions,
	getRandomPhotoOptions,
} from './useChallengeBuilder.ts'
import { defaultProgress } from './useStorage.ts'

/** Create a minimal TeamMember for testing. */
function makeMember(id: number, name = `Person${id}`): TeamMember {
	return {
		id,
		name,
		title: 'Engineer',
		department: 'Engineering',
		photo: `https://example.com/photo${id}.jpg`,
	}
}

/** Create OPTION_COUNT + 2 members so options can be built without running short. */
function makeMembers(count: number = OPTION_COUNT + 2): TeamMember[] {
	return Array.from({ length: count }, (_, i) => makeMember(i + 1))
}

describe('generateMaskedName', () => {
	it('keeps the first letter of each word', () => {
		const masked = generateMaskedName('John Doe')
		expect(masked.startsWith('J')).toBe(true)
		const parts = masked.split(' ')
		expect(parts[1].startsWith('D')).toBe(true)
	})

	it('replaces interior letters with underscores', () => {
		const masked = generateMaskedName('Alice')
		expect(masked).toBe('A____')
	})

	it('does not mask short words (≤ 2 characters)', () => {
		// "Jo" has length 2 — should be kept as-is
		expect(generateMaskedName('Jo')).toBe('Jo')
	})

	it('handles names with multiple words', () => {
		const masked = generateMaskedName('John de Vries')
		const parts = masked.split(' ')
		// "John" → "J___", "de" (≤2) → "de", "Vries" → "V____"
		expect(parts[0]).toBe('J___')
		expect(parts[1]).toBe('de')
		expect(parts[2]).toBe('V____')
	})
})

describe('getRandomOptions', () => {
	let members: TeamMember[]
	let correct: TeamMember

	beforeEach(() => {
		members = makeMembers()
		correct = members[0]
	})

	it('always includes the correct answer', () => {
		const options = getRandomOptions(correct, members)
		expect(options).toContain(correct.name)
	})

	it('returns OPTION_COUNT options by default', () => {
		const options = getRandomOptions(correct, members)
		expect(options).toHaveLength(OPTION_COUNT)
	})

	it('accepts a custom count', () => {
		const options = getRandomOptions(correct, members, 3)
		expect(options).toHaveLength(3)
	})

	it('never includes the placeholder photo member as a wrong option', () => {
		// Add a placeholder-photo member
		const placeholderMember: TeamMember = {
			id: 999,
			name: 'Placeholder',
			title: '',
			department: '',
			photo: PLACEHOLDER_PHOTO,
		}
		const extendedMembers = [...members, placeholderMember]

		// Run many times to be statistically confident
		for (let i = 0; i < 20; i++) {
			const options = getRandomOptions(correct, extendedMembers)
			expect(options).not.toContain('Placeholder')
		}
	})
})

describe('getRandomPhotoOptions', () => {
	let members: TeamMember[]
	let correct: TeamMember

	beforeEach(() => {
		members = makeMembers()
		correct = members[0]
	})

	it('always includes the correct person', () => {
		const options = getRandomPhotoOptions(correct, members)
		const ids = options.map((m) => m.id)
		expect(ids).toContain(correct.id)
	})

	it('returns OPTION_COUNT options by default', () => {
		const options = getRandomPhotoOptions(correct, members)
		expect(options).toHaveLength(OPTION_COUNT)
	})

	it('excludes placeholder-photo members from the wrong options', () => {
		const placeholderMember: TeamMember = {
			id: 999,
			name: 'Placeholder',
			title: '',
			department: '',
			photo: PLACEHOLDER_PHOTO,
		}
		const extendedMembers = [...members, placeholderMember]

		for (let i = 0; i < 20; i++) {
			const options = getRandomPhotoOptions(correct, extendedMembers)
			const ids = options.map((m) => m.id)
			expect(ids).not.toContain(999)
		}
	})
})

describe('buildChallenge', () => {
	let progress: GameProgress
	let members: TeamMember[]

	beforeEach(() => {
		progress = defaultProgress()
		members = makeMembers()
	})

	it('returns a challenge with a monotonically increasing seq', () => {
		const c1 = buildChallenge(members[0], progress, members)
		const c2 = buildChallenge(members[1], progress, members)
		expect(c2.seq).toBeGreaterThan(c1.seq)
	})

	it('builds a "meet" challenge for a new (stage 0) person', () => {
		const challenge = buildChallenge(members[0], progress, members)
		expect(challenge.type).toBe('meet')
		expect(challenge.person).toEqual(members[0])
		expect(challenge.correctAnswer).toBe(members[0].name)
		expect(challenge.timeLimit).toBe(0) // meet has no timer
	})

	it('builds a "recall" challenge for a stage-3 person', () => {
		progress.people[members[0].id] = {
			personId: members[0].id,
			stage: 3,
			correctStreak: 3,
			totalCorrect: 3,
			totalWrong: 0,
			lastSeen: 0,
			nextReview: 0,
			avgResponseTime: 0,
			lastResponseTime: 0,
		}
		// Force recall (not pick-face) by using fewer than 4 members for recognize
		const twoMembers = members.slice(0, 3)
		const challenge = buildChallenge(members[0], progress, twoMembers)
		expect(challenge.type).toBe('recall')
		expect(challenge.maskedName).toBeDefined()
	})

	it('builds a "type" challenge for a stage-4 person', () => {
		progress.people[members[0].id] = {
			personId: members[0].id,
			stage: 4,
			correctStreak: 5,
			totalCorrect: 5,
			totalWrong: 0,
			lastSeen: 0,
			nextReview: 0,
			avgResponseTime: 0,
			lastResponseTime: 0,
		}
		const challenge = buildChallenge(members[0], progress, members)
		expect(challenge.type).toBe('type')
	})

	it('includes options for a "recognize" challenge', () => {
		progress.people[members[0].id] = {
			personId: members[0].id,
			stage: 2,
			correctStreak: 2,
			totalCorrect: 2,
			totalWrong: 0,
			lastSeen: 0,
			nextReview: 0,
			avgResponseTime: 0,
			lastResponseTime: 0,
		}
		// Use only 3 members so recognize always stays as 'recognize' (not pick-face)
		const threeMembers = members.slice(0, 3)
		const challenge = buildChallenge(members[0], progress, threeMembers)
		expect(challenge.type).toBe('recognize')
		expect(challenge.options).toBeDefined()
		expect(challenge.options).toContain(members[0].name)
	})
})

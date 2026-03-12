/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { TeamMember } from '../types.ts'
import type { GameProgress } from './useStorage.ts'

import { OPTION_COUNT, PLACEHOLDER_PHOTO } from '../constants.ts'
import { shuffle } from '../utils/strings.ts'
import { getPersonProgress } from './useStorage.ts'

// Challenge types matching the 4 stages
export type ChallengeType = 'meet' | 'recognize' | 'pick-face' | 'recall' | 'type'

export interface Challenge {
	seq: number // monotonic counter — always changes, so Vue's Transition always animates
	type: ChallengeType
	person: TeamMember
	options?: string[] // for recognize: pick name from list
	photoOptions?: TeamMember[] // for pick-face: pick photo from grid
	maskedName?: string // for recall stage
	correctAnswer: string
}

// Maps stage index to challenge type
const STAGE_TO_TYPE: ChallengeType[] = ['meet', 'recognize', 'recognize', 'recall', 'type']

// Monotonic counter — ensures Vue's Transition always sees a new key
let challengeSeq = 0

/**
 * Generate a masked version of a name where all letters except the first
 * of each word are replaced with underscores.
 *
 * @param name The person's full name
 */
export function generateMaskedName(name: string): string {
	const parts = name.split(' ')
	return parts.map((part) => {
		if (part.length <= 2) {
			return part
		}
		return part[0] + part.slice(1).replace(/[a-zA-ZÀ-ÿ]/g, '_')
	}).join(' ')
}

/**
 * Pick N–1 random wrong options plus the correct answer and shuffle them.
 *
 * @param correct The correct team member
 * @param allMembers All available team members
 * @param count Total number of options (including correct)
 */
export function getRandomOptions(correct: TeamMember, allMembers: TeamMember[], count: number = OPTION_COUNT): string[] {
	const others = allMembers.filter((m) => m.id !== correct.id && m.photo !== PLACEHOLDER_PHOTO && m.name)
	const shuffled = shuffle([...others]).slice(0, count - 1)
	return shuffle([...shuffled.map((m) => m.name), correct.name])
}

/**
 * Pick N–1 random wrong photo options plus the correct person and shuffle them.
 *
 * @param correct The correct team member
 * @param allMembers All available team members
 * @param count Total number of options (including correct)
 */
export function getRandomPhotoOptions(correct: TeamMember, allMembers: TeamMember[], count: number = OPTION_COUNT): TeamMember[] {
	const others = allMembers.filter((m) => m.id !== correct.id && m.photo !== PLACEHOLDER_PHOTO && m.name)
	const shuffled = shuffle([...others]).slice(0, count - 1)
	return shuffle([...shuffled, correct])
}

/**
 * Build a challenge for the given person based on their current stage.
 *
 * @param person The team member to build a challenge for
 * @param progress The current game progress
 * @param allMembers All available team members
 */
export function buildChallenge(person: TeamMember, progress: GameProgress, allMembers: TeamMember[]): Challenge {
	const pp = getPersonProgress(progress, person.id)
	let type: ChallengeType = STAGE_TO_TYPE[Math.min(pp.stage, 4)]

	// At recognize stage, randomly alternate between name-pick and face-pick
	if (type === 'recognize' && allMembers.length >= 4) {
		type = Math.random() < 0.5 ? 'recognize' : 'pick-face'
	}

	const challenge: Challenge = {
		seq: ++challengeSeq,
		type,
		person,
		correctAnswer: person.name,
	}

	if (type === 'recognize') {
		challenge.options = getRandomOptions(person, allMembers)
	} else if (type === 'pick-face') {
		challenge.photoOptions = getRandomPhotoOptions(person, allMembers)
	} else if (type === 'recall') {
		challenge.maskedName = generateMaskedName(person.name)
	}

	return challenge
}

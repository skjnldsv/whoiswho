/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

const STORAGE_KEY = 'nc-whos-who-progress'

export interface PersonProgress {
	personId: number
	stage: number // 0=unseen, 1=meet, 2=recognize, 3=recall, 4=master
	correctStreak: number
	totalCorrect: number
	totalWrong: number
	lastSeen: number // timestamp
	nextReview: number // timestamp
}

export interface GameProgress {
	people: Record<number, PersonProgress>
	xp: number
	level: number
	totalAnswered: number
	totalCorrect: number
	bestStreak: number
	currentStreak: number
	sessionsPlayed: number
	lastPlayed: number
}

function defaultProgress(): GameProgress {
	return {
		people: {},
		xp: 0,
		level: 1,
		totalAnswered: 0,
		totalCorrect: 0,
		bestStreak: 0,
		currentStreak: 0,
		sessionsPlayed: 0,
		lastPlayed: 0,
	}
}

export function loadProgress(): GameProgress {
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (raw) {
			return { ...defaultProgress(), ...JSON.parse(raw) }
		}
	} catch {
		// corrupted data, start fresh
	}
	return defaultProgress()
}

export function saveProgress(progress: GameProgress): void {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
}

export function resetProgress(): void {
	localStorage.removeItem(STORAGE_KEY)
}

export function getPersonProgress(progress: GameProgress, personId: number): PersonProgress {
	if (!progress.people[personId]) {
		progress.people[personId] = {
			personId,
			stage: 0,
			correctStreak: 0,
			totalCorrect: 0,
			totalWrong: 0,
			lastSeen: 0,
			nextReview: 0,
		}
	}
	return progress.people[personId]
}

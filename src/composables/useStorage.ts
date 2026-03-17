/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import axios from '@nextcloud/axios'
import { getBuilder } from '@nextcloud/browser-storage'
import { generateOcsUrl } from '@nextcloud/router'
import { MAX_LIVES } from '../constants.ts'

const storage = getBuilder('whoiswho').persist().build()
const STORAGE_KEY = 'progress'
// Legacy key used before migration to @nextcloud/browser-storage
const LEGACY_STORAGE_KEY = 'nc-whos-who-progress'

// OCS response envelope
interface OcsResponse<T> {
	ocs: { data: T }
}

export interface PersonProgress {
	personId: number
	stage: number // 0=unseen, 1=meet, 2=recognize, 3=recall, 4=master
	correctStreak: number
	totalCorrect: number
	totalWrong: number
	lastSeen: number // timestamp
	nextReview: number // timestamp
	avgResponseTime: number // average milliseconds to answer
	lastResponseTime: number // most recent response time in milliseconds
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
	currentLives: number // persisted lives to prevent force-close exploit
	sessionActive: boolean // whether a session is currently in progress
	// Per-challenge-type correct counts (for achievement tracking)
	meetCount: number
	recognizeCorrect: number
	pickFaceCorrect: number
	recallCorrect: number // covers both "recall" and "type" challenge types
	// Speed tracking
	fastAnswerCount: number // timed answers completed under 3 s
	veryFastAnswerCount: number // timed answers completed under 2 s
	// Date tracking for day-streak and weekend achievements
	playDates: string[] // YYYY-MM-DD dates when user played
}

/**
 *
 */
export function defaultProgress(): GameProgress {
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
		currentLives: MAX_LIVES,
		sessionActive: false,
		meetCount: 0,
		recognizeCorrect: 0,
		pickFaceCorrect: 0,
		recallCorrect: 0,
		fastAnswerCount: 0,
		veryFastAnswerCount: 0,
		playDates: [],
	}
}

/**
 * Load progress from browser storage (synchronous, used as initial value).
 */
export function loadProgress(): GameProgress {
	try {
		const raw = storage.getItem(STORAGE_KEY)
		if (raw) {
			return { ...defaultProgress(), ...JSON.parse(raw) }
		}
		// Migrate from legacy localStorage key
		const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
		if (legacy) {
			const parsed = { ...defaultProgress(), ...JSON.parse(legacy) }
			storage.setItem(STORAGE_KEY, JSON.stringify(parsed))
			localStorage.removeItem(LEGACY_STORAGE_KEY)
			return parsed
		}
	} catch {
		// corrupted data, start fresh
	}
	return defaultProgress()
}

/**
 * Fetch the authenticated user's progress from the server.
 * Returns null when the server has no saved progress yet.
 */
export async function loadProgressFromServer(): Promise<GameProgress | null> {
	try {
		const url = generateOcsUrl('/apps/whoiswho/progress')
		const response = await axios.get<OcsResponse<{ progress: GameProgress | null }>>(url)
		const serverProgress = response.data.ocs.data.progress
		if (serverProgress === null) {
			return null
		}
		return { ...defaultProgress(), ...serverProgress }
	} catch {
		// Network error or server unavailable — fall back to local storage
		return null
	}
}

/**
 * Merge two progress objects, keeping the more advanced state from each.
 * The merge prefers whichever source has accumulated more XP.
 *
 * @param local Progress loaded from browser storage
 * @param server Progress loaded from the server
 */
export function mergeProgress(local: GameProgress, server: GameProgress): GameProgress {
	// Use the source with the higher XP total as the base
	const base = server.xp >= local.xp ? server : local
	const other = server.xp >= local.xp ? local : server

	// Merge per-person progress: take the higher stage for each person
	const mergedPeople: Record<number, typeof base.people[number]> = { ...other.people }
	for (const [idStr, person] of Object.entries(base.people)) {
		const id = Number(idStr)
		const existing = mergedPeople[id]
		if (!existing || person.stage > existing.stage) {
			mergedPeople[id] = person
		}
	}

	return { ...base, people: mergedPeople }
}

/**
 * Initialise game progress: load from server and merge with local storage.
 * This should be called once on app startup.
 * Returns the merged progress and updates browser storage with the result.
 */
export async function initProgress(): Promise<GameProgress> {
	const local = loadProgress()
	const server = await loadProgressFromServer()
	if (server === null) {
		// No server record yet — push local progress to server so it is persisted
		saveProgressToServer(local)
		return local
	}
	const merged = mergeProgress(local, server)
	// Persist the merged result locally and to the server
	storage.setItem(STORAGE_KEY, JSON.stringify(merged))
	saveProgressToServer(merged)
	return merged
}

/**
 * Save progress to browser storage (synchronous) and asynchronously to the server.
 *
 * @param progress The game progress to save
 */
export function saveProgress(progress: GameProgress): void {
	storage.setItem(STORAGE_KEY, JSON.stringify(progress))
	saveProgressToServer(progress)
}

/**
 * Push the current progress to the server (fire-and-forget).
 * Errors are swallowed — the local copy remains authoritative if the call fails.
 *
 * @param progress The game progress to persist on the server
 */
export function saveProgressToServer(progress: GameProgress): void {
	const url = generateOcsUrl('/apps/whoiswho/progress')
	axios.put(url, { progress }).catch(() => {
		// Network error — local storage copy is still intact
	})
}

/**
 * Remove progress from browser storage and from the server.
 */
export function resetProgress(): void {
	storage.removeItem(STORAGE_KEY)
	resetProgressOnServer()
}

/**
 * Delete the user's server-side progress record (fire-and-forget).
 */
export function resetProgressOnServer(): void {
	const url = generateOcsUrl('/apps/whoiswho/progress')
	axios.delete(url).catch(() => {
		// Network error — ignore
	})
}

/**
 *
 * @param progress The game progress object
 * @param personId The person's unique ID
 */
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
			avgResponseTime: 0,
			lastResponseTime: 0,
		}
	}
	// Migrate legacy records that predate the response-time fields
	const pp = progress.people[personId]
	if (pp.avgResponseTime === undefined) {
		pp.avgResponseTime = 0
	}
	if (pp.lastResponseTime === undefined) {
		pp.lastResponseTime = 0
	}
	return pp
}

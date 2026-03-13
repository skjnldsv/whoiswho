/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { SessionStats } from './useGameEngine.ts'
import type { GameProgress } from './useStorage.ts'

import axios from '@nextcloud/axios'
import { generateOcsUrl } from '@nextcloud/router'
import { ref } from 'vue'

export type AchievementCategory = 'learning' | 'streak' | 'speed' | 'progression' | 'dedication' | 'accuracy' | 'special'

export interface Achievement {
	id: string
	emoji: string
	name: string
	description: string
	category: AchievementCategory
}

// OCS response envelope
interface OcsResponse<T> {
	ocs: { data: T }
}

/** Full list of achievements – must stay in sync with AchievementController::VALID_IDS */
export const ACHIEVEMENTS: Achievement[] = [
	// ── Learning Milestones ──────────────────────────────────────────────────
	{ id: 'first-contact', emoji: '🤝', name: 'First Contact', description: 'Complete your first introduction', category: 'learning' },
	{ id: 'getting-to-know-you', emoji: '👋', name: 'Getting to Know You', description: 'Meet 10 people', category: 'learning' },
	{ id: 'name-recognition', emoji: '🎯', name: 'Name Recognition', description: 'Correctly recognize 25 names', category: 'learning' },
	{ id: 'memory-master', emoji: '🧠', name: 'Memory Master', description: 'Recall 50 names from memory', category: 'learning' },
	{ id: 'face-expert', emoji: '📸', name: 'Face Expert', description: 'Correctly identify 25 faces', category: 'learning' },
	{ id: 'team-expert', emoji: '⭐', name: 'Team Expert', description: 'Master 10 people', category: 'learning' },
	{ id: 'everyones-friend', emoji: '🌟', name: "Everyone's Friend", description: 'Master 50% of the team', category: 'learning' },
	{ id: 'company-legend', emoji: '👑', name: 'Company Legend', description: 'Master everyone on the team', category: 'learning' },

	// ── Streak & Consistency ─────────────────────────────────────────────────
	{ id: 'hot-streak', emoji: '🔥', name: 'Hot Streak', description: 'Get 5 correct in a row', category: 'streak' },
	{ id: 'on-fire', emoji: '🌶️', name: 'On Fire!', description: 'Get 10 correct in a row', category: 'streak' },
	{ id: 'unstoppable', emoji: '⚡', name: 'Unstoppable', description: 'Get 20 correct in a row', category: 'streak' },
	{ id: 'flawless-victory', emoji: '💎', name: 'Flawless Victory', description: 'Complete a session with 100% accuracy (10+ answers)', category: 'streak' },
	{ id: 'daily-dedication', emoji: '📅', name: 'Daily Dedication', description: 'Play 3 days in a row', category: 'streak' },
	{ id: 'weekly-warrior', emoji: '📆', name: 'Weekly Warrior', description: 'Play 7 days in a row', category: 'streak' },
	{ id: 'monthly-master', emoji: '🗓️', name: 'Monthly Master', description: 'Play 30 days in a row', category: 'streak' },

	// ── Speed & Performance ──────────────────────────────────────────────────
	{ id: 'quick-thinker', emoji: '💨', name: 'Quick Thinker', description: 'Answer 10 timed questions in under 3 seconds', category: 'speed' },
	{ id: 'lightning-reflexes', emoji: '⚡', name: 'Lightning Reflexes', description: 'Answer 25 timed questions in under 2 seconds', category: 'speed' },
	{ id: 'speed-demon', emoji: '🏎️', name: 'Speed Demon', description: 'Complete a session with average response under 3 seconds', category: 'speed' },
	{ id: 'no-mistakes', emoji: '🎯', name: 'No Mistakes', description: 'Complete a session without losing a life', category: 'speed' },

	// ── Progression & Growth ─────────────────────────────────────────────────
	{ id: 'level-up', emoji: '⬆️', name: 'Level Up!', description: 'Reach level 5', category: 'progression' },
	{ id: 'rising-star', emoji: '🌠', name: 'Rising Star', description: 'Reach level 10', category: 'progression' },
	{ id: 'expert-status', emoji: '🎓', name: 'Expert Status', description: 'Reach level 25', category: 'progression' },
	{ id: 'legendary', emoji: '🏅', name: 'Legendary', description: 'Reach level 50', category: 'progression' },
	{ id: 'xp-collector', emoji: '💰', name: 'XP Collector', description: 'Earn 1,000 total XP', category: 'progression' },
	{ id: 'xp-hoarder', emoji: '💎', name: 'XP Hoarder', description: 'Earn 10,000 total XP', category: 'progression' },

	// ── Dedication & Persistence ─────────────────────────────────────────────
	{ id: 'first-session', emoji: '🎪', name: 'First Session', description: 'Complete your first game session', category: 'dedication' },
	{ id: 'regular-player', emoji: '🎯', name: 'Regular Player', description: 'Play 10 sessions', category: 'dedication' },
	{ id: 'dedicated-learner', emoji: '💪', name: 'Dedicated Learner', description: 'Play 50 sessions', category: 'dedication' },
	{ id: 'century-club', emoji: '💯', name: 'Century Club', description: 'Answer 100 questions total', category: 'dedication' },
	{ id: 'thousand-club', emoji: '🚀', name: 'Thousand Club', description: 'Answer 1,000 questions total', category: 'dedication' },
	{ id: 'comeback-kid', emoji: '🔄', name: 'Comeback Kid', description: 'Win a session after being down to 1 life', category: 'dedication' },

	// ── Accuracy & Precision ─────────────────────────────────────────────────
	{ id: 'sharp-shooter', emoji: '🎯', name: 'Sharp Shooter', description: 'Finish a session with 90%+ accuracy and 50+ answers', category: 'accuracy' },
	{ id: 'near-perfect', emoji: '💯', name: 'Near Perfect', description: 'Finish a session with 95%+ accuracy and 100+ answers', category: 'accuracy' },

	// ── Fun & Special ────────────────────────────────────────────────────────
	{ id: 'comeback-champion', emoji: '💪', name: 'Comeback Champion', description: 'Complete a session with only 1 life remaining', category: 'special' },
	{ id: 'night-owl', emoji: '🦉', name: 'Night Owl', description: 'Play between midnight and 5am', category: 'special' },
	{ id: 'early-bird', emoji: '🐦', name: 'Early Bird', description: 'Play between 5am and 7am', category: 'special' },
	{ id: 'weekend-warrior', emoji: '🎮', name: 'Weekend Warrior', description: 'Play on both Saturday and Sunday', category: 'special' },
]

/** Map from achievement ID to definition for O(1) lookup */
export const ACHIEVEMENT_MAP: Record<string, Achievement> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]))

export interface AchievementCheckContext {
	progress: GameProgress
	sessionStats: SessionStats
	lives: number
	maxLives: number
	totalCount: number
	masteredCount: number
	isSessionEnd?: boolean
	sessionWon?: boolean // true if session ended without game-over
}

/**
 * Compute how many consecutive calendar days (ending today) appear in playDates.
 *
 * @param playDates Array of YYYY-MM-DD strings
 */
function consecutiveDays(playDates: string[]): number {
	if (playDates.length === 0) {
		return 0
	}

	const today = new Date()
	today.setHours(0, 0, 0, 0)

	const dateSet = new Set(playDates)
	let streak = 0
	const cursor = new Date(today)

	while (true) {
		const label = cursor.toISOString().substring(0, 10)
		if (!dateSet.has(label)) {
			break
		}
		streak++
		cursor.setDate(cursor.getDate() - 1)
	}

	return streak
}

/**
 * Composable for fetching and unlocking achievements (server-persisted).
 */
export function useAchievements() {
	/** Set of achievement IDs the current user has already unlocked */
	const unlockedIds = ref<Set<string>>(new Set())
	const loading = ref(false)
	const error = ref(false)

	/**
	 * Fetch the user's already-unlocked achievements from the server.
	 */
	async function fetchAchievements(): Promise<void> {
		loading.value = true
		error.value = false
		try {
			const { data } = await axios.get<OcsResponse<{ achievements: string[] }>>(generateOcsUrl('apps/whoiswho/achievements'))
			unlockedIds.value = new Set(data.ocs.data.achievements ?? [])
		} catch {
			error.value = true
		} finally {
			loading.value = false
		}
	}

	/**
	 * Persist a single achievement unlock to the server.
	 * Silently ignores failures (best-effort).
	 *
	 * @param id Achievement ID to unlock
	 */
	async function persistUnlock(id: string): Promise<void> {
		try {
			await axios.post(generateOcsUrl('apps/whoiswho/achievements/unlock'), { achievementId: id })
		} catch {
			// Best-effort; the optimistic local state is already set
		}
	}

	/**
	 * Evaluate all achievement conditions against the given context.
	 * Unlocks (locally + on server) any newly-earned achievements.
	 * Returns the list of Achievement objects that were newly unlocked.
	 *
	 * @param ctx Current game state snapshot
	 */
	async function checkAchievements(ctx: AchievementCheckContext): Promise<Achievement[]> {
		const { progress, sessionStats, lives, maxLives, totalCount, masteredCount } = ctx
		const isSessionEnd = ctx.isSessionEnd ?? false
		const sessionWon = ctx.sessionWon ?? false

		const nowHour = new Date().getHours()
		const nowDay = new Date().getDay() // 0 = Sun, 6 = Sat

		// Helper: has the user played on a Saturday AND a Sunday (ever)?
		const playDates = progress.playDates ?? []
		const playedSaturday = playDates.some((d) => new Date(d + 'T12:00:00').getDay() === 6)
		const playedSunday = playDates.some((d) => new Date(d + 'T12:00:00').getDay() === 0)
		const dayStreak = consecutiveDays(playDates)

		// Session accuracy (avoid division by zero)
		const accuracy = sessionStats.answered > 0
			? sessionStats.correct / sessionStats.answered
			: 0

		// Average session response time for timed answers
		const avgResponseTime = sessionStats.timedAnswerCount > 0
			? sessionStats.totalResponseTime / sessionStats.timedAnswerCount
			: Infinity

		const conditions: Record<string, boolean> = {
			// Learning
			'first-contact': (progress.meetCount ?? 0) >= 1,
			'getting-to-know-you': (progress.meetCount ?? 0) >= 10,
			'name-recognition': (progress.recognizeCorrect ?? 0) >= 25,
			'memory-master': (progress.recallCorrect ?? 0) >= 50,
			'face-expert': (progress.pickFaceCorrect ?? 0) >= 25,
			'team-expert': masteredCount >= 10,
			'everyones-friend': totalCount > 0 && masteredCount >= Math.ceil(totalCount * 0.5),
			'company-legend': totalCount > 0 && masteredCount >= totalCount,

			// Streak & Consistency
			'hot-streak': sessionStats.bestStreak >= 5,
			'on-fire': sessionStats.bestStreak >= 10,
			unstoppable: sessionStats.bestStreak >= 20,
			'flawless-victory': isSessionEnd && sessionWon && sessionStats.answered >= 10 && sessionStats.wrong === 0,
			'daily-dedication': dayStreak >= 3,
			'weekly-warrior': dayStreak >= 7,
			'monthly-master': dayStreak >= 30,

			// Speed & Performance
			'quick-thinker': (progress.fastAnswerCount ?? 0) >= 10,
			'lightning-reflexes': (progress.veryFastAnswerCount ?? 0) >= 25,
			'speed-demon': isSessionEnd && sessionWon && sessionStats.timedAnswerCount >= 5 && avgResponseTime < 3000,
			'no-mistakes': isSessionEnd && sessionWon && lives >= maxLives,

			// Progression & Growth
			'level-up': progress.level >= 5,
			'rising-star': progress.level >= 10,
			'expert-status': progress.level >= 25,
			legendary: progress.level >= 50,
			'xp-collector': progress.xp >= 1000,
			'xp-hoarder': progress.xp >= 10000,

			// Dedication & Persistence
			'first-session': isSessionEnd && progress.sessionsPlayed >= 1,
			'regular-player': progress.sessionsPlayed >= 10,
			'dedicated-learner': progress.sessionsPlayed >= 50,
			'century-club': progress.totalAnswered >= 100,
			'thousand-club': progress.totalAnswered >= 1000,
			'comeback-kid': isSessionEnd && sessionWon && sessionStats.lowestLives <= 1,

			// Accuracy & Precision
			'sharp-shooter': isSessionEnd && sessionWon && sessionStats.answered >= 50 && accuracy >= 0.9,
			'near-perfect': isSessionEnd && sessionWon && sessionStats.answered >= 100 && accuracy >= 0.95,

			// Fun & Special
			'comeback-champion': isSessionEnd && sessionWon && sessionStats.lowestLives === 1,
			'night-owl': nowHour >= 0 && nowHour < 5,
			'early-bird': nowHour >= 5 && nowHour < 7,
			'weekend-warrior': (nowDay === 0 || nowDay === 6) && playedSaturday && playedSunday,
		}

		const newlyUnlocked: Achievement[] = []

		for (const [id, met] of Object.entries(conditions)) {
			if (met && !unlockedIds.value.has(id)) {
				unlockedIds.value.add(id)
				newlyUnlocked.push(ACHIEVEMENT_MAP[id])
				// Persist to server (fire-and-forget)
				persistUnlock(id)
			}
		}

		return newlyUnlocked
	}

	return {
		unlockedIds,
		loading,
		error,
		fetchAchievements,
		checkAchievements,
	}
}

/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

// ── Lives ──────────────────────────────────────────────────────────────────
/** Number of lives the player starts each session with. */
export const MAX_LIVES = 3

// ── Spaced-repetition intervals (milliseconds) ─────────────────────────────
/** How long to wait before reviewing each stage again. Index = stage number. */
export const INTERVALS: number[] = [
	0, // stage 0: unseen
	0, // stage 1: meet — immediate
	30_000, // stage 2: recognize — 30 s
	120_000, // stage 3: recall — 2 min
	600_000, // stage 4: mastered — 10 min
]

/** How long (ms) to wait before retrying after a wrong answer. */
export const WRONG_RETRY_INTERVAL = 5_000

/** How long (ms) to wait before retrying a "close" answer. */
export const CLOSE_RETRY_INTERVAL = 30_000

// ── XP ─────────────────────────────────────────────────────────────────────
/** XP cost for the first hint (title + department). */
export const HINT_COST_FIRST = 10

/** XP cost for the second hint (reveal letters / eliminate option). */
export const HINT_COST_SECOND = 15

/** Divisor applied to full XP for a "close" answer (earns 1/4). */
export const CLOSE_ANSWER_XP_DIVISOR = 4

/** XP threshold multiplier per level: level N unlocks at N * XP_PER_LEVEL. */
export const XP_PER_LEVEL = 100

// ── Challenge pool ─────────────────────────────────────────────────────────
/** Maximum number of people in the active learning pool at once. */
export const ACTIVE_POOL_SIZE = 6

/** Number of options shown in the recognize / pick-face challenges. */
export const OPTION_COUNT = 4

// ── Close-answer detection ──────────────────────────────────────────────────
/** Maximum Levenshtein distance to be considered a "close" answer. */
export const CLOSE_ANSWER_THRESHOLD = 2

// ── Second-hint reveal tuning ───────────────────────────────────────────────
/** Minimum number of letters to reveal in the second hint. */
export const REVEAL_MIN_COUNT = 2

/** Fraction of hidden letters to reveal in the second hint. */
export const REVEAL_FRACTION = 1 / 3

// ── Auto-advance ────────────────────────────────────────────────────────────
/** Milliseconds before auto-advancing to the next challenge after a result. */
export const AUTO_SKIP_DELAY_MS = 3_000

/** Milliseconds before auto-advancing from a "meet" card. */
export const MEET_AUTO_ADVANCE_MS = 800

// ── Answer timers (milliseconds) ─────────────────────────────────────────────
/** Time limit per challenge type (0 = no timer). */
export const ANSWER_TIME_LIMITS = {
	meet: 0,
	recognize: 5_000,
	'pick-face': 5_000,
	recall: 10_000,
	type: 15_000,
} as const

/** Bonus XP awarded for answering faster than FAST_ANSWER_THRESHOLD of the time limit. */
export const FAST_ANSWER_BONUS_XP = 2

/** Fraction of time limit: answers below this threshold earn bonus XP. */
export const FAST_ANSWER_THRESHOLD = 0.3

// ── Streak bonus ─────────────────────────────────────────────────────────────
/** Number of consecutive correct answers required to earn a streak bonus. */
export const STREAK_BONUS_INTERVAL = 5

/** XP awarded each time the player reaches a streak bonus milestone. */
export const STREAK_BONUS_XP = 5

// ── Placeholder ─────────────────────────────────────────────────────────────
/** Nextcloud placeholder photo URL — members with this URL are excluded. */
export const PLACEHOLDER_PHOTO = 'https://nextcloud.com/c/themes/nextcloud-theme/dist/img/person.jpg'

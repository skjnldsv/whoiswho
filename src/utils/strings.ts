/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Strip diacritics for accent-agnostic text comparison.
 * E.g. "Jose" matches "José".
 */
export function normalizeText(s: string): string {
	return s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Levenshtein distance — used for close-answer detection (e.g. 1–2 char typos).
 */
export function levenshtein(a: string, b: string): number {
	const m = a.length
	const n = b.length
	const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
		Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
	)
	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			dp[i][j] = a[i - 1] === b[j - 1]
				? dp[i - 1][j - 1]
				: 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
		}
	}
	return dp[m][n]
}

/**
 * Return the display label for a leaderboard rank position (0-indexed).
 */
export function rankLabel(i: number): string {
	if (i === 0) return '🥇'
	if (i === 1) return '🥈'
	if (i === 2) return '🥉'
	return `#${i + 1}`
}

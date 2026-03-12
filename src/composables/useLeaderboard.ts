/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { ref } from 'vue'
import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'
import { getCurrentUser } from '@nextcloud/auth'

export interface LeaderboardEntry {
	user_id: string
	display_name: string
	total_score?: number
	week_score?: number
	week_label?: string
	updated_at?: number
}

export interface LeaderboardData {
	allTime: LeaderboardEntry[]
	weekly: LeaderboardEntry[]
}

export function useLeaderboard() {
	const allTime = ref<LeaderboardEntry[]>([])
	const weekly = ref<LeaderboardEntry[]>([])
	const loading = ref(false)
	const error = ref(false)

	// Current Nextcloud user ID
	const currentUser: string = getCurrentUser()?.uid ?? ''

	async function fetchScores(): Promise<void> {
		loading.value = true
		error.value = false
		try {
			const url = generateUrl('/apps/whoiswho/leaderboard')
			const { data } = await axios.get<LeaderboardData>(url)
			allTime.value = data.allTime ?? []
			weekly.value = data.weekly ?? []
		} catch {
			error.value = true
		} finally {
			loading.value = false
		}
	}

	async function submitScore(xpEarned: number): Promise<void> {
		if (xpEarned <= 0) return
		try {
			const url = generateUrl('/apps/whoiswho/leaderboard/score')
			await axios.post(url, { score: xpEarned })
		} catch {
			// Silently ignore — leaderboard submission is best-effort
		}
	}

	return {
		allTime,
		weekly,
		loading,
		error,
		currentUser,
		fetchScores,
		submitScore,
	}
}

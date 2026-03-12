/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { getCurrentUser } from '@nextcloud/auth'
import axios from '@nextcloud/axios'
import { generateOcsUrl } from '@nextcloud/router'
import { ref } from 'vue'

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

// OCS response envelope
interface OcsResponse<T> {
	ocs: { data: T }
}

/**
 *
 */
export function useLeaderboard() {
	const allTime = ref<LeaderboardEntry[]>([])
	const weekly = ref<LeaderboardEntry[]>([])
	const loading = ref(false)
	const error = ref(false)

	// Current Nextcloud user ID
	const currentUser: string = getCurrentUser()?.uid ?? ''

	/**
	 *
	 */
	async function fetchScores(): Promise<void> {
		loading.value = true
		error.value = false
		try {
			const { data } = await axios.get<OcsResponse<LeaderboardData>>(generateOcsUrl('apps/whoiswho/leaderboard'))
			allTime.value = data.ocs.data.allTime ?? []
			weekly.value = data.ocs.data.weekly ?? []
		} catch {
			error.value = true
		} finally {
			loading.value = false
		}
	}

	/**
	 *
	 * @param xpEarned The XP score to submit
	 */
	async function submitScore(xpEarned: number): Promise<void> {
		if (xpEarned <= 0) {
			return
		}
		try {
			await axios.post(generateOcsUrl('apps/whoiswho/leaderboard/score'), { score: xpEarned })
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

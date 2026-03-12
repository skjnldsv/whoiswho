<!--
  - SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
  - SPDX-License-Identifier: AGPL-3.0-or-later
  -->
<template>
	<div class="leaderboard-screen">
		<!-- Header -->
		<div class="lb-header">
			<h2 class="lb-title">🏆 Leaderboard</h2>
			<button class="btn-back" @click="emit('close')">
				← Back
			</button>
		</div>

		<!-- Tabs -->
		<div class="lb-tabs">
			<button :class="['tab-btn', { active: tab === 'weekly' }]" @click="tab = 'weekly'">
				📅 This Week
			</button>
			<button :class="['tab-btn', { active: tab === 'alltime' }]" @click="tab = 'alltime'">
				🏅 All Time
			</button>
		</div>

		<!-- Loading / error -->
		<div v-if="loading" class="lb-status">
			<span class="lb-spinner">⏳</span> Loading…
		</div>
		<div v-else-if="error" class="lb-status lb-error">
			Failed to load leaderboard. Check your connection.
		</div>

		<!-- List -->
		<div v-else class="lb-list">
			<div v-if="currentList.length === 0" class="lb-empty">
				No scores yet — be the first! 🚀
			</div>

			<div v-for="(entry, i) in currentList"
				:key="entry.user_id"
				class="lb-entry"
				:class="{
					'is-me': entry.user_id === currentUser,
					'rank-gold': i === 0,
					'rank-silver': i === 1,
					'rank-bronze': i === 2,
				}">
				<span class="lb-rank">{{ rankLabel(i) }}</span>
				<span class="lb-avatar">{{ avatarLetter(entry) }}</span>
				<span class="lb-name">
					{{ entry.display_name || entry.user_id }}
					<span v-if="entry.user_id === currentUser" class="you-badge">You</span>
				</span>
				<span class="lb-score">
					{{ tab === 'weekly' ? entry.week_score : entry.total_score }} XP
				</span>
			</div>

			<!-- Show user's own rank if not in top list -->
			<div v-if="myRank > currentList.length && myRank > 0" class="lb-my-rank">
				<span class="my-rank-label">Your rank: #{{ myRank }}</span>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useLeaderboard } from '../composables/useLeaderboard'
import { rankLabel } from '../utils/strings'
import type { LeaderboardEntry } from '../composables/useLeaderboard'

const emit = defineEmits<{ close: [] }>()

const { allTime, weekly, loading, error, currentUser, fetchScores } = useLeaderboard()

const tab = ref<'weekly' | 'alltime'>('weekly')

const currentList = computed<LeaderboardEntry[]>(() =>
	tab.value === 'weekly' ? weekly.value : allTime.value,
)

const myRank = computed(() => {
	const idx = currentList.value.findIndex(e => e.user_id === currentUser)
	return idx >= 0 ? idx + 1 : 0
})

function avatarLetter(entry: LeaderboardEntry): string {
	const name = entry.display_name || entry.user_id
	return name.charAt(0).toUpperCase()
}

onMounted(fetchScores)
</script>

<style scoped>
.leaderboard-screen {
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	background: var(--color-main-background);
	color: var(--color-main-text);
	overflow: hidden;
}

/* ── Header ── */
.lb-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 16px 24px;
	border-bottom: 1px solid var(--color-border);
	flex-shrink: 0;
}

.lb-title {
	margin: 0;
	font-size: 1.4rem;
	font-weight: 700;
}

.btn-back {
	margin: 0;
	padding: 8px 18px;
	border-radius: var(--border-radius-pill);
	border: 1px solid var(--color-border-dark);
	background: transparent;
	color: var(--color-main-text);
	font-size: 0.88rem;
	font-weight: 600;
	cursor: pointer;
	transition: background 0.15s ease;
}

.btn-back:hover {
	background: var(--color-background-hover);
}

/* ── Tabs ── */
.lb-tabs {
	display: flex;
	gap: 0;
	padding: 12px 24px;
	border-bottom: 1px solid var(--color-border);
	flex-shrink: 0;
}

.tab-btn {
	margin: 0;
	flex: 1;
	padding: 10px 18px;
	border: 2px solid var(--color-border-dark);
	background: transparent;
	color: var(--color-text-maxcontrast);
	font-size: 0.9rem;
	font-weight: 600;
	cursor: pointer;
	transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.tab-btn:first-child {
	border-radius: var(--border-radius-element) 0 0 var(--border-radius-element);
	border-inline-end: none;
}

.tab-btn:last-child {
	border-radius: 0 var(--border-radius-element) var(--border-radius-element) 0;
}

.tab-btn.active {
	background: var(--color-primary-element);
	border-color: var(--color-primary-element);
	color: var(--color-primary-element-text);
}

/* ── Status ── */
.lb-status {
	padding: 32px;
	text-align: center;
	color: var(--color-text-maxcontrast);
	font-size: 1rem;
}

.lb-error {
	color: var(--color-text-error);
}

.lb-spinner {
	font-size: 1.5rem;
}

/* ── List ── */
.lb-list {
	flex: 1;
	overflow-y: auto;
	padding: 12px 24px 24px;
}

.lb-empty {
	text-align: center;
	padding: 48px 24px;
	color: var(--color-text-maxcontrast);
	font-size: 1rem;
}

.lb-entry {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 12px 14px;
	margin-bottom: 8px;
	border: 1px solid var(--color-border-dark);
	border-radius: var(--border-radius-element);
	background: var(--color-main-background);
	transition: background 0.12s;
}

.lb-entry.is-me {
	border-color: var(--color-primary-element);
	background: var(--color-primary-element-light);
}

.lb-entry.rank-gold   { border-color: #f7971e; background: rgba(247, 151, 30, 0.07); }

.lb-entry.rank-silver { border-color: #aaa; background: rgba(170, 170, 170, 0.07); }

.lb-entry.rank-bronze { border-color: #cd7f32; background: rgba(205, 127, 50, 0.07); }

.lb-rank {
	font-size: 1.1rem;
	min-width: 32px;
	text-align: center;
	flex-shrink: 0;
}

.lb-avatar {
	width: 36px;
	height: 36px;
	border-radius: 50%;
	background: var(--color-primary-element);
	color: var(--color-primary-element-text);
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 1rem;
	font-weight: 700;
	flex-shrink: 0;
}

.lb-name {
	flex: 1;
	font-size: 0.95rem;
	font-weight: 600;
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.you-badge {
	font-size: 0.7rem;
	font-weight: 700;
	background: var(--color-primary-element);
	color: var(--color-primary-element-text);
	padding: 2px 8px;
	border-radius: var(--border-radius-pill);
	flex-shrink: 0;
}

.lb-score {
	font-size: 0.95rem;
	font-weight: 700;
	color: var(--color-primary-element);
	flex-shrink: 0;
}

/* ── My rank (when outside top list) ── */
.lb-my-rank {
	text-align: center;
	padding: 16px;
	color: var(--color-text-maxcontrast);
	font-size: 0.88rem;
	border-top: 1px dashed var(--color-border-dark);
	margin-top: 8px;
}

.my-rank-label {
	font-weight: 600;
}
</style>

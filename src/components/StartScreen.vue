<!--
  - SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
  - SPDX-License-Identifier: AGPL-3.0-or-later
  -->
<template>
	<div class="start-screen">
		<!-- Top: hero + actions -->
		<div class="start-top">
			<div class="hero">
				<div class="logo-icon">
					{{ heroEmoji }}
				</div>
				<h1>Who's Who</h1>
				<p class="subtitle">
					Learn the names and faces of the Nextcloud team
				</p>
			</div>

			<div v-if="hasProgress" class="resume-banner">
				Welcome back! Level <strong>{{ level }}</strong> · <strong>{{ mastered }}/{{ total }}</strong> mastered · {{ xp }} XP
			</div>

			<div class="actions">
				<!-- Loading state -->
				<div v-if="loading" class="load-state">
					<NcLoadingIcon :size="32" />
					<span>Loading team members…</span>
				</div>
				<!-- Error state -->
				<div v-else-if="loadError" class="load-state load-error">
					<span>⚠️ Could not load team members.</span>
					<button class="btn-retry" @click="$emit('retry')">
						↺ Retry
					</button>
				</div>
				<template v-else>
					<button class="btn-start" @click="$emit('start')">
						{{ hasProgress ? '▶ Continue Learning' : '🎮 Start Game' }}
					</button>
					<button v-if="hasProgress" class="btn-reset" @click="$emit('reset')">
						↺ Reset Progress
					</button>
				</template>
			</div>
		</div>

		<!-- Bottom: two columns -->
		<div class="start-main">
			<!-- How it works -->
			<div class="how-it-works panel">
				<h3>How it works</h3>
				<div class="stages">
					<div class="stage-item">
						<span class="stage-num">1</span>
						<div>
							<strong>Meet — 5 XP</strong>
							<p>See each person's photo, name and role</p>
						</div>
					</div>
					<div class="stage-item">
						<span class="stage-num">2</span>
						<div>
							<strong>Recognize — 15 XP</strong>
							<p>Pick the correct name from 4 options (or the right face)</p>
						</div>
					</div>
					<div class="stage-item">
						<span class="stage-num">3</span>
						<div>
							<strong>Recall — 25 XP</strong>
							<p>Fill in the missing letters</p>
						</div>
					</div>
					<div class="stage-item">
						<span class="stage-num">4</span>
						<div>
							<strong>Master — 40 XP</strong>
							<p>Type the full name from memory</p>
						</div>
					</div>
				</div>
				<div class="mechanics">
					<div class="mechanic-item">
						<span class="mechanic-icon">🔥</span>
						<p><strong>Streaks</strong> count consecutive correct answers within a session. A wrong or close answer resets the streak to zero. Every <strong>5 correct answers in a row</strong> earns a <strong>+5 XP streak bonus</strong>. Streaks don't carry over to the next session.</p>
					</div>
					<div class="mechanic-item">
						<span class="mechanic-icon">⚡</span>
						<p><strong>Speed bonus</strong> — answer within the first 30% of the time limit to earn +2 XP. Challenges have countdown timers: Recognize/Pick-face 5 s, Recall 10 s, Type 15 s.</p>
					</div>
					<div class="mechanic-item">
						<span class="mechanic-icon">❤️</span>
						<p><strong>Lives</strong> — you have 3 per session. Only outright wrong answers and time-outs cost a life; skipping and close answers (typos) do not. Hearts cannot be regained once lost.</p>
					</div>
					<div class="mechanic-item">
						<span class="mechanic-icon">💡</span>
						<p><strong>Hints</strong> cost XP: first hint −10 XP (shows title & department), second hint −15 XP (reveals letters or removes a wrong option). Close answers earn ¼ XP.</p>
					</div>
				</div>
			</div>

			<!-- Leaderboard widget -->
			<div class="leaderboard-widget panel">
				<div class="lb-widget-header">
					<h3>🏆 Leaderboard</h3>
					<button class="btn-link" @click="$emit('leaderboard')">
						View all →
					</button>
				</div>
				<div class="lb-tabs">
					<button class="lb-tab" :class="[{ active: lbTab === 'weekly' }]" @click="lbTab = 'weekly'">
						This Week
					</button>
					<button class="lb-tab" :class="[{ active: lbTab === 'alltime' }]" @click="lbTab = 'alltime'">
						All Time
					</button>
				</div>
				<div class="lb-body">
					<div v-if="lbLoading" class="lb-status">
						⏳ Loading…
					</div>
					<div v-else-if="lbError" class="lb-status lb-error">
						Failed to load
					</div>
					<div v-else-if="currentList.length === 0" class="lb-status">
						No scores yet — be the first! 🚀
					</div>
					<div v-else class="lb-list">
						<div
							v-for="(entry, i) in currentList.slice(0, 5)"
							:key="entry.user_id"
							class="lb-entry"
							:class="{ 'is-me': entry.user_id === currentUser }">
							<span class="lb-rank">{{ rankLabel(i) }}</span>
							<span class="lb-name">{{ entry.display_name || entry.user_id }}</span>
							<span class="lb-score">{{ lbTab === 'weekly' ? entry.week_score : entry.total_score }} XP</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { TeamMember } from '../composables/useGameEngine.ts'
import type { GameProgress } from '../composables/useStorage.ts'

import { NcLoadingIcon } from '@nextcloud/vue'
import { computed, onMounted, ref } from 'vue'
import { useLeaderboard } from '../composables/useLeaderboard.ts'
import { rankLabel } from '../utils/strings.ts'

const props = defineProps<{
	allMembers: TeamMember[]
	loading: boolean
	loadError: boolean
	progress: GameProgress
}>()
defineEmits<{
	start: []
	reset: []
	leaderboard: []
	retry: []
}>()
const HERO_EMOJIS = ['🧑‍🤝‍🧑', '👫', '👬', '👭', '🫂']
const heroEmoji = HERO_EMOJIS[Math.floor(Math.random() * HERO_EMOJIS.length)]

const hasProgress = computed(() => props.progress.totalAnswered > 0)
const mastered = computed(() => Object.values(props.progress.people).filter((p) => p.stage >= 4).length)
const total = computed(() => props.allMembers.length)
const level = computed(() => props.progress.level)
const xp = computed(() => props.progress.xp)

// Inline leaderboard
const { allTime, weekly, loading: lbLoading, error: lbError, currentUser, fetchScores } = useLeaderboard()
const lbTab = ref<'weekly' | 'alltime'>('weekly')
const currentList = computed(() => lbTab.value === 'weekly' ? weekly.value : allTime.value)

onMounted(fetchScores)
</script>

<style scoped>
.start-screen {
	width: 100%;
	min-height: 100%;
	display: flex;
	flex-direction: column;
	gap: 16px;
	padding: 20px 24px;
	box-sizing: border-box;
	overflow-y: auto;
}

/* ── Top section ── */
.start-top {
	flex-shrink: 0;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 12px;
}

.hero {
	text-align: center;
}

.logo-icon {
	font-size: 2.8rem;
	line-height: 1;
	margin-bottom: 4px;
}

h1 {
	font-size: 2rem;
	font-weight: 800;
	color: var(--color-main-text);
	margin: 0 0 4px 0;
	letter-spacing: -0.02em;
}

.subtitle {
	font-size: 0.95rem;
	color: var(--color-text-maxcontrast);
	margin: 0;
}

.resume-banner {
	background: var(--color-primary-element-light);
	border: 1px solid var(--color-border-dark);
	border-radius: var(--border-radius-container);
	padding: 10px 20px;
	color: var(--color-primary-element-light-text);
	font-size: 0.9rem;
	text-align: center;
	width: 100%;
	max-width: 500px;
	box-sizing: border-box;
}

.actions {
	display: flex;
	align-items: center;
	gap: 12px;
	flex-wrap: wrap;
	justify-content: center;
}

.load-state {
	display: flex;
	align-items: center;
	gap: 10px;
	color: var(--color-text-maxcontrast);
	font-size: 0.95rem;
}

.load-error {
	color: var(--color-text-error, #e74c3c);
}

.btn-retry {
	margin: 0;
	padding: 8px 18px;
	border-radius: var(--border-radius-pill);
	border: 1px solid currentColor;
	background: transparent;
	color: inherit;
	font-size: 0.88rem;
	font-weight: 600;
	cursor: pointer;
	transition: background 0.15s ease;
}

.btn-retry:hover {
	background: var(--color-background-hover);
}

.btn-start {
	margin: 0;
	padding: 12px 36px;
	border-radius: var(--border-radius-pill);
	border: none;
	background: var(--color-primary-element);
	color: var(--color-primary-element-text);
	font-size: 1.05rem;
	font-weight: 700;
	cursor: pointer;
	transition: background 0.15s ease, box-shadow 0.15s ease;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
	letter-spacing: 0.01em;
}

.btn-start:hover {
	background: var(--color-primary-element-hover);
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.btn-reset {
	margin: 0;
	padding: 10px 20px;
	border-radius: var(--border-radius-pill);
	border: 1px solid var(--color-border-dark);
	background: transparent;
	color: var(--color-text-maxcontrast);
	font-size: 0.85rem;
	font-weight: 600;
	cursor: pointer;
	transition: background 0.15s ease, color 0.15s ease;
}

.btn-reset:hover {
	background: var(--color-background-dark);
	color: var(--color-main-text);
}

/* ── Main 2-column section ── */
.start-main {
	flex: 1;
	min-height: 0;
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 16px;
}

.panel {
	background: var(--color-background-dark);
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-container);
	padding: 18px;
	overflow: hidden;
	display: flex;
	flex-direction: column;
}

.panel h3 {
	margin: 0 0 14px 0;
	font-size: 0.95rem;
	font-weight: 700;
	color: var(--color-main-text);
	text-align: center;
}

/* ── How it works ── */
.stages {
	display: flex;
	flex-direction: column;
	gap: 10px;
	flex: 1;
}

.stage-item {
	display: flex;
	align-items: flex-start;
	gap: 10px;
	color: var(--color-main-text);
}

.stage-num {
	width: 24px;
	height: 24px;
	border-radius: 50%;
	background: var(--color-primary-element);
	color: var(--color-primary-element-text);
	display: flex;
	align-items: center;
	justify-content: center;
	font-weight: 700;
	font-size: 0.78rem;
	flex-shrink: 0;
}

.stage-item strong {
	display: block;
	font-size: 0.88rem;
}

.stage-item p {
	margin: 2px 0 0 0;
	font-size: 0.78rem;
	color: var(--color-text-maxcontrast);
}

.mechanics {
	display: flex;
	flex-direction: column;
	gap: 8px;
	margin-top: 12px;
}

.mechanic-item {
	display: flex;
	align-items: flex-start;
	gap: 8px;
}

.mechanic-icon {
	font-size: 1rem;
	line-height: 1.4;
	flex-shrink: 0;
}

.mechanic-item p {
	margin: 0;
	font-size: 0.78rem;
	color: var(--color-text-maxcontrast);
	line-height: 1.4;
}

.mechanic-item strong {
	color: var(--color-main-text);
}

/* ── Leaderboard widget ── */
.lb-widget-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 10px;
}

.lb-widget-header h3 {
	margin: 0;
	text-align: start;
}

.btn-link {
	margin: 0; /* override server.css margin: 3px */
	min-height: unset; /* override server.css min-height: var(--default-clickable-area) for compact link */
	background: none;
	border: none;
	color: var(--color-primary-element);
	font-size: 0.82rem;
	font-weight: 600;
	cursor: pointer;
	padding: 2px 6px;
	border-radius: var(--border-radius-small);
	transition: background 0.12s;
}

.btn-link:hover {
	background: var(--color-primary-element-light);
	color: var(--color-primary-element-light-text);
}

.lb-tabs {
	display: flex;
	margin-bottom: 10px;
	border-radius: var(--border-radius-element);
	overflow: hidden;
	border: 1px solid var(--color-border);
}

.lb-tab {
	margin: 0; /* override server.css margin: 3px */
	min-height: unset; /* override server.css min-height: var(--default-clickable-area) for compact tab */
	flex: 1;
	padding: 6px 10px;
	border: none;
	background: transparent;
	color: var(--color-text-maxcontrast);
	font-size: 0.8rem;
	font-weight: 600;
	cursor: pointer;
	transition: background 0.15s ease, color 0.15s ease;
}

.lb-tab.active {
	background: var(--color-primary-element);
	color: var(--color-primary-element-text);
}

.lb-body {
	flex: 1;
	min-height: 0;
	overflow: hidden;
}

.lb-status {
	text-align: center;
	padding: 16px 8px;
	color: var(--color-text-maxcontrast);
	font-size: 0.85rem;
}

.lb-error {
	color: var(--color-text-error);
}

.lb-list {
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.lb-entry {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 7px 10px;
	border-radius: var(--border-radius-element);
	background: var(--color-main-background);
	border: 1px solid transparent;
	font-size: 0.85rem;
}

.lb-entry.is-me {
	border-color: var(--color-primary-element);
	background: var(--color-primary-element-light);
}

.lb-rank {
	font-size: 1rem;
	min-width: 28px;
	text-align: center;
	flex-shrink: 0;
}

.lb-name {
	flex: 1;
	font-weight: 600;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: var(--color-main-text);
}

.lb-score {
	font-weight: 700;
	color: var(--color-primary-element);
	flex-shrink: 0;
}

/* ── Responsive: stack on narrow screens ── */
@media (max-width: 600px) {
	.start-screen {
		padding: 16px;
		overflow-y: auto;
	}

	.start-main {
		grid-template-columns: 1fr;
		flex: none;
	}

	.panel {
		min-height: 0;
	}
}
</style>

<!--
  - SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
  - SPDX-License-Identifier: AGPL-3.0-or-later
  -->
<template>
	<div class="results-screen">
		<div class="results-card">
			<h2 v-if="stats.wrong >= 3" class="title">
				💔 Game Over
			</h2>
			<h2 v-else class="title">
				🎉 Session Complete!
			</h2>

			<div class="big-stats">
				<div class="big-stat">
					<span class="big-value">{{ stats.correct }}</span>
					<span class="big-label">Correct</span>
				</div>
				<div class="big-stat">
					<span class="big-value">{{ stats.answered }}</span>
					<span class="big-label">Answered</span>
				</div>
				<div class="big-stat">
					<span class="big-value">{{ accuracy }}%</span>
					<span class="big-label">Accuracy</span>
				</div>
			</div>

			<div class="detail-stats">
				<div class="detail-row">
					<span>🔥 Best Streak</span>
					<strong>{{ stats.bestStreak }}</strong>
				</div>
				<div class="detail-row">
					<span>⭐ XP Earned</span>
					<strong>+{{ stats.xpEarned }}</strong>
				</div>
				<div class="detail-row">
					<span>📈 Level</span>
					<strong>{{ level }}</strong>
				</div>
				<div class="detail-row">
					<span>✅ Total Mastered</span>
					<strong>{{ mastered }}/{{ total }}</strong>
				</div>
			</div>

			<div v-if="stats.newlyMastered.length > 0" class="mastered-section">
				<h3>🏆 Newly Mastered</h3>
				<div class="mastered-names">
					<span v-for="name in stats.newlyMastered" :key="name" class="mastered-badge">
						{{ name }}
					</span>
				</div>
			</div>

			<div v-if="newlyUnlockedAchievements.length > 0" class="achievements-section">
				<h3>🎖️ Achievements Unlocked</h3>
				<div class="achievements-list">
					<div
						v-for="achievement in newlyUnlockedAchievements"
						:key="achievement.id"
						class="achievement-row">
						<span class="achievement-row-emoji">{{ achievement.emoji }}</span>
						<div class="achievement-row-info">
							<span class="achievement-row-name">{{ achievement.name }}</span>
							<span class="achievement-row-desc">{{ achievement.description }}</span>
						</div>
					</div>
				</div>
			</div>

			<div class="result-actions">
				<button class="btn-primary btn-play-again" @click="$emit('playAgain')">
					🎮 Play Again
				</button>
				<button class="btn-tertiary" @click="$emit('goHome')">
					← Back to Menu
				</button>
				<button class="btn-secondary" @click="$emit('leaderboard')">
					🏆 Leaderboard
				</button>
				<button class="btn-secondary" @click="$emit('achievements')">
					🎖️ Achievements
				</button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { Achievement } from '../composables/useAchievements.ts'
import type { SessionStats } from '../composables/useGameEngine.ts'

import { computed } from 'vue'

const props = defineProps<{
	stats: SessionStats
	level: number
	mastered: number
	total: number
	newlyUnlockedAchievements: Achievement[]
}>()

defineEmits<{
	playAgain: []
	goHome: []
	leaderboard: []
	achievements: []
}>()

const accuracy = computed(() => {
	if (props.stats.answered === 0) {
		return 0
	}
	return Math.round((props.stats.correct / props.stats.answered) * 100)
})
</script>

<style scoped>
.results-screen {
	max-width: 560px;
	margin: 0 auto;
	padding: 32px 20px 44px;
	width: 100%;
	box-sizing: border-box;
	flex: 1 0 auto;
}

.results-card {
	background: var(--color-main-background);
	border: 1px solid var(--color-border-dark);
	border-radius: var(--border-radius-container-large);
	padding: 32px 28px;
	box-shadow: 0 4px 20px var(--color-box-shadow);
	text-align: center;
}

.title {
	font-size: 1.6rem;
	font-weight: 800;
	color: var(--color-main-text);
	margin: 0 0 24px 0;
}

.big-stats {
	display: flex;
	justify-content: center;
	gap: 24px;
	margin-bottom: 24px;
}

.big-stat {
	display: flex;
	flex-direction: column;
	align-items: center;
}

.big-value {
	font-size: 2rem;
	font-weight: 800;
	color: var(--color-primary-element);
	line-height: 1;
}

.big-label {
	font-size: 0.75rem;
	color: var(--color-text-maxcontrast);
	font-weight: 600;
	text-transform: uppercase;
	margin-top: 4px;
}

.detail-stats {
	background: var(--color-background-dark);
	border-radius: var(--border-radius-container);
	padding: 16px;
	margin-bottom: 24px;
}

.detail-row {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 8px 4px;
	font-size: 0.9rem;
	color: var(--color-main-text);
}

.detail-row + .detail-row {
	border-top: 1px solid var(--color-border);
}

.detail-row strong {
	color: var(--color-main-text);
}

.mastered-section {
	margin-bottom: 24px;
}

.mastered-section h3 {
	font-size: 1rem;
	color: var(--color-main-text);
	margin: 0 0 12px 0;
}

.mastered-names {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	justify-content: center;
}

.mastered-badge {
	padding: 4px 12px;
	border-radius: var(--border-radius-pill);
	background: var(--color-primary-element);
	color: var(--color-primary-element-text);
	font-size: 0.8rem;
	font-weight: 600;
}

.result-actions {
	display: flex;
	gap: 10px;
	align-items: center;
	justify-content: center;
	flex-wrap: wrap;
}

.btn-primary {
	margin: 0;
	padding: 12px 32px;
	border-radius: var(--border-radius-pill);
	border: none;
	background: var(--color-primary-element);
	color: var(--color-primary-element-text);
	font-size: 1rem;
	font-weight: 700;
	cursor: pointer;
	transition: background 0.15s ease;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.btn-primary:hover {
	background: var(--color-primary-element-hover);
}

.btn-secondary {
	margin: 0;
	padding: 10px 24px;
	border-radius: var(--border-radius-pill);
	border: 2px solid var(--color-primary-element);
	background: transparent;
	color: var(--color-primary-element);
	font-size: 0.92rem;
	font-weight: 600;
	cursor: pointer;
	transition: background 0.15s ease, color 0.15s ease;
}

.btn-secondary:hover {
	background: var(--color-primary-element-light);
	color: var(--color-primary-element-light-text);
}

.btn-tertiary {
	margin: 0;
	padding: 8px 16px;
	border-radius: var(--border-radius-pill);
	border: 1px solid var(--color-border-dark);
	background: transparent;
	color: var(--color-text-maxcontrast);
	font-size: 0.88rem;
	font-weight: 600;
	cursor: pointer;
	transition: background 0.15s ease, color 0.15s ease;
}

.btn-tertiary:hover {
	background: var(--color-background-dark);
	color: var(--color-main-text);
}

.btn-play-again {
	min-width: 180px;
}

.achievements-section {
	margin-bottom: 24px;
	text-align: start;
}

.achievements-section h3 {
	font-size: 1rem;
	color: var(--color-main-text);
	margin: 0 0 12px 0;
	text-align: center;
}

.achievements-list {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.achievement-row {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 10px 14px;
	border-radius: var(--border-radius-element);
	background: var(--color-primary-element-light);
	border: 1px solid var(--color-primary-element);
}

.achievement-row-emoji {
	font-size: 1.4rem;
	flex-shrink: 0;
}

.achievement-row-info {
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.achievement-row-name {
	font-size: 0.88rem;
	font-weight: 700;
	color: var(--color-main-text);
}

.achievement-row-desc {
	font-size: 0.76rem;
	color: var(--color-text-maxcontrast);
}
</style>

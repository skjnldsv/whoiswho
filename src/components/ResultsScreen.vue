<template>
	<div class="results-screen">
		<div class="results-card">
			<h2 v-if="stats.wrong >= 3" class="title">💔 Game Over</h2>
			<h2 v-else class="title">🎉 Session Complete!</h2>

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

			<div class="result-actions">
				<button class="btn-primary" @click="$emit('playAgain')">
					🎮 Play Again
				</button>
				<button class="btn-secondary" @click="$emit('leaderboard')">
					🏆 Leaderboard
				</button>
				<button class="btn-secondary" @click="$emit('goHome')">
					← Back to Menu
				</button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SessionStats } from '../composables/useGameEngine'

const props = defineProps<{
	stats: SessionStats
	level: number
	mastered: number
	total: number
}>()

defineEmits<{
	playAgain: []
	goHome: []
	leaderboard: []
}>()

const accuracy = computed(() => {
	if (props.stats.answered === 0) return 0
	return Math.round((props.stats.correct / props.stats.answered) * 100)
})
</script>

<style scoped>
.results-screen {
	max-width: 560px;
	margin: 0 auto;
	padding: 32px 20px;
	width: 100%;
	box-sizing: border-box;
	overflow-y: auto;
}

.results-card {
	background: var(--color-main-background);
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-large, 16px);
	padding: 32px 28px;
	box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
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
	color: var(--color-primary-element, #0082c9);
	line-height: 1;
}

.big-label {
	font-size: 0.75rem;
	color: var(--color-text-lighter, #888);
	font-weight: 600;
	text-transform: uppercase;
	margin-top: 4px;
}

.detail-stats {
	background: var(--color-background-dark, rgba(0,0,0,0.04));
	border-radius: var(--border-radius-large, 12px);
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
	border-radius: var(--border-radius-pill, 16px);
	background: var(--color-primary-element, #0082c9);
	color: var(--color-primary-element-text, #fff);
	font-size: 0.8rem;
	font-weight: 600;
}

.result-actions {
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.btn-primary {
	padding: 14px 32px;
	font-size: 1rem;
	font-weight: 700;
	border: none;
	border-radius: var(--border-radius-pill, var(--border-radius-large, 20px));
	background: var(--color-primary-element, #0082c9);
	color: var(--color-primary-element-text, #fff);
	cursor: pointer;
	transition: opacity 0.15s ease;
	min-height: 44px;
}

.btn-primary:hover {
	opacity: 0.9;
}

.btn-secondary {
	padding: 10px 24px;
	font-size: 0.9rem;
	font-weight: 600;
	border: 2px solid var(--color-border);
	border-radius: var(--border-radius-pill, var(--border-radius-large, 20px));
	background: transparent;
	color: var(--color-main-text);
	cursor: pointer;
	transition: all 0.15s ease;
	min-height: 40px;
}

.btn-secondary:hover {
	background: var(--color-background-hover);
	border-color: var(--color-primary-element);
}
</style>

<!--
  - SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
  - SPDX-License-Identifier: AGPL-3.0-or-later
  -->
<template>
	<div class="progress-bar-container">
		<div class="stats-row">
			<div class="stat">
				<span class="stat-icon">⭐</span>
				<span class="stat-label">Level {{ level }}</span>
			</div>
			<div class="stat">
				<span class="stat-icon">✅</span>
				<span class="stat-value">{{ mastered }}/{{ total }}</span>
			</div>
			<div class="stat stat--right">
				<span class="stat-icon">🔥</span>
				<span class="stat-value">{{ streak }}</span>
			</div>
			<div class="lives">
				<span
					v-for="i in maxLives"
					:key="i"
					class="heart"
					:class="{ lost: i > lives }">
					{{ i <= lives ? '❤️' : '🖤' }}
				</span>
			</div>
		</div>
		<div class="xp-bar">
			<div class="xp-fill" :style="{ width: (progress * 100) + '%' }">
				<span v-if="xp > 0" class="xp-text">{{ xp }} XP</span>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
defineProps<{
	level: number
	xp: number
	progress: number
	streak: number
	mastered: number
	total: number
	lives: number
	maxLives: number
}>()
</script>

<style scoped>
.progress-bar-container {
	width: 100%;
}

.stats-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 8px;
	gap: 12px;
	flex-wrap: wrap;
}

.stat {
	display: flex;
	align-items: center;
	gap: 4px;
	font-size: 0.9rem;
	font-weight: 600;
	color: var(--color-main-text);
}

/* Push streak + lives to the right */
.stat--right {
	margin-inline-start: auto;
}

.stat-icon {
	font-size: 1rem;
}

.stat-value {
	font-variant-numeric: tabular-nums;
}

.lives {
	display: flex;
	gap: 2px;
}

.heart {
	font-size: 1.1rem;
	transition: transform 0.3s ease, opacity 0.3s ease;
}

.heart.lost {
	opacity: 0.3;
	transform: scale(0.8);
}

.xp-bar {
	height: 16px;
	background: var(--color-background-dark);
	border-radius: var(--border-radius-pill);
	overflow: hidden;
}

.xp-fill {
	height: 100%;
	background: var(--color-primary-element);
	border-radius: var(--border-radius-pill);
	transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
	display: flex;
	align-items: center;
	justify-content: flex-end;
	min-width: 0;
}

.xp-text {
	font-size: 0.75rem;
	font-weight: 700;
	color: var(--color-primary-element-text);
	padding-inline-end: 6px;
	white-space: nowrap;
}
</style>

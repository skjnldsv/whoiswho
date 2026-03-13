<!--
  - SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
  - SPDX-License-Identifier: AGPL-3.0-or-later
  -->
<template>
	<div class="achievements-screen">
		<div class="achievements-header">
			<button class="btn-back" @click="$emit('close')">
				← Back
			</button>
			<h2>🏆 Achievements</h2>
			<span class="achievements-count">{{ unlockedCount }} / {{ total }} unlocked</span>
		</div>

		<div v-if="loading" class="achievements-loading">
			<NcLoadingIcon :size="32" />
			<span>Loading achievements…</span>
		</div>
		<div v-else>
			<div
				v-for="category in CATEGORIES"
				:key="category.key"
				class="category-section">
				<h3 class="category-title">
					{{ category.label }}
				</h3>
				<div class="achievements-grid">
					<div
						v-for="achievement in achievementsByCategory[category.key]"
						:key="achievement.id"
						class="achievement-card"
						:class="{ unlocked: unlockedIds.has(achievement.id), locked: !unlockedIds.has(achievement.id) }">
						<div class="achievement-emoji">
							{{ achievement.emoji }}
						</div>
						<div class="achievement-info">
							<div class="achievement-name">
								{{ achievement.name }}
							</div>
							<div class="achievement-desc">
								{{ achievement.description }}
							</div>
						</div>
						<div v-if="unlockedIds.has(achievement.id)" class="achievement-badge">
							✓
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { AchievementCategory } from '../composables/useAchievements.ts'

import { NcLoadingIcon } from '@nextcloud/vue'
import { computed } from 'vue'
import { ACHIEVEMENTS } from '../composables/useAchievements.ts'

const props = defineProps<{
	unlockedIds: Set<string>
	loading: boolean
}>()

defineEmits<{
	close: []
}>()

const CATEGORIES: { key: AchievementCategory, label: string }[] = [
	{ key: 'learning', label: '📚 Learning Milestones' },
	{ key: 'streak', label: '🔥 Streak & Consistency' },
	{ key: 'speed', label: '⚡ Speed & Performance' },
	{ key: 'progression', label: '📈 Progression & Growth' },
	{ key: 'dedication', label: '🎮 Dedication & Persistence' },
	{ key: 'accuracy', label: '🎯 Accuracy & Precision' },
	{ key: 'special', label: '🎉 Fun & Special' },
]

const achievementsByCategory = computed(() => {
	const result: Record<string, typeof ACHIEVEMENTS> = {}
	for (const category of CATEGORIES) {
		result[category.key] = ACHIEVEMENTS.filter((a) => a.category === category.key)
	}
	return result
})

const total = ACHIEVEMENTS.length
const unlockedCount = computed(() => props.unlockedIds.size)
</script>

<style scoped>
.achievements-screen {
	width: 100%;
	min-height: 100%;
	padding: 20px 24px;
	box-sizing: border-box;
}

.achievements-header {
	display: flex;
	align-items: center;
	gap: 12px;
	margin-bottom: 24px;
}

.achievements-header h2 {
	flex: 1;
	margin: 0;
	font-size: 1.4rem;
	font-weight: 800;
	color: var(--color-main-text);
}

.achievements-count {
	font-size: 0.88rem;
	color: var(--color-text-maxcontrast);
	font-weight: 600;
}

.btn-back {
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
	white-space: nowrap;
}

.btn-back:hover {
	background: var(--color-background-dark);
	color: var(--color-main-text);
}

.achievements-loading {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 32px;
	color: var(--color-text-maxcontrast);
	justify-content: center;
}

.category-section {
	margin-bottom: 28px;
}

.category-title {
	font-size: 1rem;
	font-weight: 700;
	color: var(--color-main-text);
	margin: 0 0 12px 0;
}

.achievements-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
	gap: 10px;
}

.achievement-card {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 14px 16px;
	border-radius: var(--border-radius-container);
	border: 1px solid var(--color-border);
	background: var(--color-background-dark);
	transition: border-color 0.15s ease, background 0.15s ease;
}

.achievement-card.unlocked {
	border-color: var(--color-primary-element);
	background: var(--color-primary-element-light);
}

.achievement-card.locked {
	opacity: 0.55;
}

.achievement-emoji {
	font-size: 1.6rem;
	line-height: 1;
	flex-shrink: 0;
	width: 36px;
	text-align: center;
}

.achievement-info {
	flex: 1;
	min-width: 0;
}

.achievement-name {
	font-size: 0.9rem;
	font-weight: 700;
	color: var(--color-main-text);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.achievement-desc {
	font-size: 0.78rem;
	color: var(--color-text-maxcontrast);
	margin-top: 2px;
}

.achievement-badge {
	width: 22px;
	height: 22px;
	border-radius: 50%;
	background: var(--color-primary-element);
	color: var(--color-primary-element-text);
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 0.75rem;
	font-weight: 700;
	flex-shrink: 0;
}

@media (max-width: 600px) {
	.achievements-screen {
		padding: 16px;
	}

	.achievements-grid {
		grid-template-columns: 1fr;
	}
}
</style>

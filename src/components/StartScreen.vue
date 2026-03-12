<template>
	<div class="start-screen">
		<div class="hero">
			<div class="logo-icon">🧑‍🤝‍🧑</div>
			<h1>Who's Who</h1>
			<p class="subtitle">Learn the names and faces of the Nextcloud team</p>
		</div>

		<div v-if="hasProgress" class="resume-banner">
			<p>
				Welcome back! You've mastered <strong>{{ mastered }}/{{ total }}</strong> people.
				Level <strong>{{ level }}</strong> — {{ xp }} XP
			</p>
		</div>

		<div class="filters">
			<h3>Choose departments</h3>
			<div class="dept-chips">
				<button class="chip"
					:class="{ active: selectedDepts.length === 0 }"
					@click="selectAll">
					All ({{ allCount }})
				</button>
				<button v-for="dept in departments"
					:key="dept.name"
					class="chip"
					:class="{ active: selectedDepts.includes(dept.name) }"
					@click="toggleDept(dept.name)">
					{{ dept.name }} ({{ dept.count }})
				</button>
			</div>
		</div>

		<div class="actions">
			<button class="btn-primary" @click="$emit('start')">
				{{ hasProgress ? '▶ Continue Learning' : '🎮 Start Game' }}
			</button>
			<button class="btn-secondary btn-leaderboard" @click="$emit('leaderboard')">
				🏆 Leaderboard
			</button>
			<button v-if="hasProgress" class="btn-secondary" @click="$emit('reset')">
				↺ Reset Progress
			</button>
		</div>

		<div class="how-it-works">
			<h3>How it works</h3>
			<div class="stages">
				<div class="stage-item">
					<span class="stage-num">1</span>
					<div>
						<strong>Meet</strong>
						<p>See each person's photo, name and role</p>
					</div>
				</div>
				<div class="stage-item">
					<span class="stage-num">2</span>
					<div>
						<strong>Recognize</strong>
						<p>Pick the correct name from 4 options</p>
					</div>
				</div>
				<div class="stage-item">
					<span class="stage-num">3</span>
					<div>
						<strong>Recall</strong>
						<p>Fill in the missing letters</p>
					</div>
				</div>
				<div class="stage-item">
					<span class="stage-num">4</span>
					<div>
						<strong>Master</strong>
						<p>Type the full name from memory</p>
					</div>
				</div>
			</div>
			<p class="tip">💡 Wrong answers cost a life but show that person again sooner. You have 3 lives per session!</p>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TeamMember } from '../composables/useGameEngine'
import type { GameProgress } from '../composables/useStorage'

const props = defineProps<{
	allMembers: TeamMember[]
	progress: GameProgress
	selectedDepts: string[]
}>()

const emit = defineEmits<{
	start: []
	reset: []
	leaderboard: []
	'update:selectedDepts': [value: string[]]
}>()

const departments = computed(() => {
	const map = new Map<string, number>()
	for (const m of props.allMembers) {
		map.set(m.department, (map.get(m.department) || 0) + 1)
	}
	return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name))
})

const allCount = computed(() => props.allMembers.length)
const hasProgress = computed(() => props.progress.totalAnswered > 0)
const mastered = computed(() => Object.values(props.progress.people).filter(p => p.stage >= 4).length)
const total = computed(() => props.allMembers.length)
const level = computed(() => props.progress.level)
const xp = computed(() => props.progress.xp)

function toggleDept(dept: string) {
	const current = [...props.selectedDepts]
	const idx = current.indexOf(dept)
	if (idx >= 0) {
		current.splice(idx, 1)
	} else {
		current.push(dept)
	}
	emit('update:selectedDepts', current)
}

function selectAll() {
	emit('update:selectedDepts', [])
}
</script>

<style scoped>
.start-screen {
	max-width: 640px;
	margin: 0 auto;
	padding: 28px 20px 40px;
	text-align: center;
	flex: 1;
	min-height: 0;
	box-sizing: border-box;
	overflow-y: auto;
	overscroll-behavior: contain;
}

.hero {
	margin-bottom: 28px;
}

.logo-icon {
	font-size: 3.5rem;
	margin-bottom: 8px;
}

h1 {
	font-size: 2.2rem;
	font-weight: 800;
	color: var(--color-main-text);
	margin: 0 0 8px 0;
	letter-spacing: -0.02em;
}

.subtitle {
	font-size: 1rem;
	color: var(--color-text-lighter, var(--color-sub-text, #888));
	margin: 0;
}

.resume-banner {
	background: var(--color-background-dark, rgba(0,0,0,0.04));
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-large, 12px);
	padding: 14px 20px;
	margin-bottom: 24px;
	color: var(--color-main-text);
}

.resume-banner p {
	margin: 0;
}

.filters {
	margin-bottom: 24px;
}

.filters h3 {
	color: var(--color-main-text);
	font-size: 0.85rem;
	text-transform: uppercase;
	letter-spacing: 0.08em;
	margin: 0 0 12px 0;
}

.dept-chips {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	justify-content: center;
}

.chip {
	padding: 6px 14px;
	border-radius: var(--border-radius-pill, 20px);
	border: 2px solid var(--color-border);
	background: var(--color-main-background);
	color: var(--color-main-text);
	font-size: 0.82rem;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.15s ease;
}

.chip:hover {
	background: var(--color-background-hover);
	border-color: var(--color-primary-element);
}

.chip.active {
	background: var(--color-primary-element);
	color: var(--color-primary-element-text, #fff);
	border-color: var(--color-primary-element);
}

.actions {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 12px;
	margin-bottom: 32px;
}

.btn-primary {
	padding: 14px 44px;
	font-size: 1.1rem;
	font-weight: 700;
	border: none;
	border-radius: var(--border-radius-pill, var(--border-radius-large, 22px));
	background: var(--color-primary-element, #0082c9);
	color: var(--color-primary-element-text, #fff);
	cursor: pointer;
	transition: opacity 0.15s ease;
	min-height: 48px;
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
}

.btn-secondary:hover {
	background: var(--color-background-hover);
	border-color: var(--color-primary-element);
}

.how-it-works {
	text-align: left;
	background: var(--color-background-dark, rgba(0,0,0,0.04));
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-large, 16px);
	padding: 20px;
}

.how-it-works h3 {
	text-align: center;
	color: var(--color-main-text);
	margin: 0 0 16px 0;
	font-size: 1rem;
}

.stages {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.stage-item {
	display: flex;
	align-items: flex-start;
	gap: 12px;
	color: var(--color-main-text);
}

.stage-num {
	width: 26px;
	height: 26px;
	border-radius: 50%;
	background: var(--color-primary-element, #0082c9);
	color: var(--color-primary-element-text, #fff);
	display: flex;
	align-items: center;
	justify-content: center;
	font-weight: 700;
	font-size: 0.82rem;
	flex-shrink: 0;
}

.stage-item strong {
	display: block;
	font-size: 0.92rem;
}

.stage-item p {
	margin: 2px 0 0 0;
	font-size: 0.82rem;
	color: var(--color-text-lighter, var(--color-sub-text, #888));
}

.tip {
	text-align: center;
	margin: 14px 0 0 0;
	font-size: 0.82rem;
	color: var(--color-text-lighter, var(--color-sub-text, #888));
}
</style>

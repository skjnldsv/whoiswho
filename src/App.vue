<!--
  - SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
  - SPDX-License-Identifier: AGPL-3.0-or-later
  -->
<template>
	<div id="whos-who-app">
		<StartScreen
			v-if="screen === 'start'"
			:all-members="allMembers"
			:progress="progress"
			:selected-depts="selectedDepts"
			@start="startGame"
			@reset="handleReset"
			@leaderboard="screen = 'leaderboard'"
			@update:selectedDepts="selectedDepts = $event"
		/>
		<GameScreen
			v-else-if="screen === 'game'"
			:current-challenge="currentChallenge"
			:showing-result="showingResult"
			:last-answer-correct="lastAnswerCorrect"
			:progress="progress"
			:session-stats="sessionStats"
			:lives="lives"
			:max-lives="maxLives"
			:mastered-count="masteredCount"
			:total-count="totalCount"
			:level-progress="levelProgress"
			:game-over="gameOver"
			:hint-text="hintText"
			@answer="handleAnswer"
			@next="handleNext"
			@hint="handleHint"
			@end="endGame"
		/>
		<ResultsScreen
			v-else-if="screen === 'results'"
			:stats="sessionStats"
			:level="progress.level"
			:mastered="masteredCount"
			:total="totalCount"
			@play-again="startGame"
			@go-home="screen = 'start'"
			@leaderboard="screen = 'leaderboard'"
		/>
		<LeaderboardScreen
			v-else-if="screen === 'leaderboard'"
			@close="screen = 'start'"
		/>
	</div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useGameEngine } from './composables/useGameEngine'
import { useLeaderboard } from './composables/useLeaderboard'
import { resetProgress as doResetProgress } from './composables/useStorage'
import StartScreen from './components/StartScreen.vue'
import GameScreen from './components/GameScreen.vue'
import ResultsScreen from './components/ResultsScreen.vue'
import LeaderboardScreen from './components/LeaderboardScreen.vue'

const screen = ref<'start' | 'game' | 'results' | 'leaderboard'>('start')
const selectedDepts = ref<string[]>([])
const hintText = ref<string | null>(null)

const { submitScore } = useLeaderboard()

const {
	progress,
	currentChallenge,
	sessionStats,
	lives,
	maxLives,
	gameOver,
	showingResult,
	lastAnswerCorrect,
	allMembers,
	masteredCount,
	totalCount,
	levelProgress,
	startSession,
	nextChallenge,
	submitAnswer,
	useHint,
} = useGameEngine(selectedDepts)

function startGame() {
	hintText.value = null
	startSession()
	screen.value = 'game'
}

function handleAnswer(answer: string) {
	submitAnswer(answer)
	hintText.value = null
}

function handleNext() {
	nextChallenge()
	hintText.value = null
	if (gameOver.value) {
		endGame()
	}
}

function endGame() {
	// Submit this session's XP to the leaderboard
	const xp = sessionStats.value.xpEarned
	if (xp > 0) {
		submitScore(xp)
	}
	screen.value = 'results'
}

function handleHint() {
	hintText.value = useHint()
}

function handleReset() {
	doResetProgress()
	progress.value = {
		people: {},
		xp: 0,
		level: 1,
		totalAnswered: 0,
		totalCorrect: 0,
		bestStreak: 0,
		currentStreak: 0,
		sessionsPlayed: 0,
		lastPlayed: 0,
	}
	selectedDepts.value = []
}

// End game when lives run out
watch(lives, (val) => {
	if (val <= 0 && screen.value === 'game') {
		endGame()
	}
})
</script>

<style>
/* Card colours follow Nextcloud theme automatically */
:root {
	--whw-card-bg: var(--color-main-background);
	--whw-card-text: var(--color-main-text);
	--whw-card-title: var(--color-text-lighter, var(--color-sub-text, #888));
}

/* ── Root container ── */
#content {
	overflow: hidden;
}

#whos-who-app {
	height: 100%;
	width: 100%;
	overflow: hidden;
	font-family: var(--font-face, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
	background-color: var(--color-main-background);
	color: var(--color-main-text);
	display: flex;
	flex-direction: column;
}
</style>

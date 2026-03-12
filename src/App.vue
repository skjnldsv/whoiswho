<!--
  - SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
  - SPDX-License-Identifier: AGPL-3.0-or-later
  -->
<template>
	<div id="whos-who-app">
		<StartScreen
			v-if="screen === 'start'"
			:allMembers="allMembers"
			:loading="loading"
			:loadError="loadError"
			:progress="progress"
			@start="startGame"
			@reset="handleReset"
			@leaderboard="screen = 'leaderboard'"
			@retry="retryFetch" />
		<GameScreen
			v-else-if="screen === 'game'"
			:currentChallenge="currentChallenge"
			:showingResult="showingResult"
			:lastAnswerCorrect="lastAnswerCorrect"
			:lastAnswerClose="lastAnswerClose"
			:lastResponseTime="lastResponseTime"
			:lastStreakBonus="lastStreakBonus"
			:progress="progress"
			:sessionStats="sessionStats"
			:lives="lives"
			:maxLives="maxLives"
			:masteredCount="masteredCount"
			:totalCount="totalCount"
			:levelProgress="levelProgress"
			:gameOver="gameOver"
			:hintText="hintText"
			:hintLevel="hintLevel"
			:eliminatedOptions="eliminatedOptions"
			:revealedMask="revealedMask"
			@answer="handleAnswer"
			@next="handleNext"
			@skip="handleSkip"
			@hint="handleHint"
			@end="endGame" />
		<ResultsScreen
			v-else-if="screen === 'results'"
			:stats="sessionStats"
			:level="progress.level"
			:mastered="masteredCount"
			:total="totalCount"
			@playAgain="startGame"
			@goHome="handleGoHome"
			@leaderboard="screen = 'leaderboard'" />
		<LeaderboardScreen
			v-else-if="screen === 'leaderboard'"
			@close="handleGoHome" />
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import GameScreen from './components/GameScreen.vue'
import LeaderboardScreen from './components/LeaderboardScreen.vue'
import ResultsScreen from './components/ResultsScreen.vue'
import StartScreen from './components/StartScreen.vue'
import { useGameEngine } from './composables/useGameEngine.ts'
import { useLeaderboard } from './composables/useLeaderboard.ts'
import { defaultProgress } from './composables/useStorage.ts'

const screen = ref<'start' | 'game' | 'results' | 'leaderboard'>('start')
const hintText = ref<string | null>(null)
const hintLevel = ref(0)
const eliminatedOptions = ref<string[]>([])
const revealedMask = ref<string | null>(null)

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
	lastAnswerClose,
	lastResponseTime,
	lastStreakBonus,
	loading,
	loadError,
	allMembers,
	masteredCount,
	totalCount,
	levelProgress,
	startSession,
	endSession,
	nextChallenge,
	submitAnswer,
	skipAnswer,
	useHint,
	useSecondHint,
	retryFetch,
} = useGameEngine()

/**
 *
 */
async function startGame() {
	hintText.value = null
	hintLevel.value = 0
	eliminatedOptions.value = []
	revealedMask.value = null
	await startSession()
	screen.value = 'game'
}

/**
 *
 * @param answer The player's answer string
 */
async function handleAnswer(answer: string) {
	await submitAnswer(answer)
	hintText.value = null
}

/**
 *
 */
async function handleSkip() {
	await skipAnswer()
	hintText.value = null
}

/**
 *
 */
async function handleNext() {
	await nextChallenge()
	hintText.value = null
	hintLevel.value = 0
	eliminatedOptions.value = []
	revealedMask.value = null
	if (gameOver.value) {
		endGame()
	}
}

/**
 *
 */
function endGame() {
	// Submit this session's XP to the leaderboard
	const xp = sessionStats.value.xpEarned
	if (xp > 0) {
		submitScore(xp)
	}
	hintText.value = null
	hintLevel.value = 0
	eliminatedOptions.value = []
	revealedMask.value = null
	endSession()
	screen.value = 'results'
}

/**
 * Navigate back to the start screen, resetting session-specific state.
 * Called from the results screen and leaderboard.
 */
function handleGoHome() {
	endSession()
	screen.value = 'start'
}

/**
 *
 */
async function handleHint() {
	if (hintLevel.value === 0) {
		const text = await useHint()
		if (text !== null) {
			hintText.value = text
			hintLevel.value = 1
		}
	} else if (hintLevel.value === 1) {
		const result = await useSecondHint()
		if (result.revealedMask || result.eliminatedOption) {
			if (result.revealedMask) {
				revealedMask.value = result.revealedMask
			}
			if (result.eliminatedOption) {
				eliminatedOptions.value = [...eliminatedOptions.value, result.eliminatedOption]
			}
			hintLevel.value = 2
		}
	}
}

/**
 *
 */
function handleReset() {
	// Reset is now a UI-only operation; progress is managed server-side
	progress.value = defaultProgress()
}
</script>

<style>
/* Card colours follow Nextcloud theme automatically */
:root {
	--whw-card-bg: var(--color-main-background);
	--whw-card-text: var(--color-main-text);
	--whw-card-title: var(--color-text-maxcontrast);
}

/* ── Root container ── */
#content {
	overflow-y: auto;
}

#whos-who-app {
	min-height: 100%;
	height: 100%;
	width: 100%;
	overflow-y: auto;
	font-family: var(--font-face, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
	background-color: var(--color-main-background);
	color: var(--color-main-text);
	display: flex;
	flex-direction: column;
}
</style>

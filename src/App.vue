<!--
  - SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
  - SPDX-License-Identifier: AGPL-3.0-or-later
  -->
<template>
	<div id="whos-who-app">
		<StartScreen
			v-if="screen === 'start'"
			:allMembers="allMembers"
			:progress="progress"
			@start="startGame"
			@reset="handleReset"
			@leaderboard="screen = 'leaderboard'" />
		<GameScreen
			v-else-if="screen === 'game'"
			:currentChallenge="currentChallenge"
			:showingResult="showingResult"
			:lastAnswerCorrect="lastAnswerCorrect"
			:lastAnswerClose="lastAnswerClose"
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
			@goHome="screen = 'start'"
			@leaderboard="screen = 'leaderboard'" />
		<LeaderboardScreen
			v-else-if="screen === 'leaderboard'"
			@close="screen = 'start'" />
	</div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import GameScreen from './components/GameScreen.vue'
import LeaderboardScreen from './components/LeaderboardScreen.vue'
import ResultsScreen from './components/ResultsScreen.vue'
import StartScreen from './components/StartScreen.vue'
import { useGameEngine } from './composables/useGameEngine.ts'
import { useLeaderboard } from './composables/useLeaderboard.ts'
import { resetProgress as doResetProgress } from './composables/useStorage.ts'

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
	allMembers,
	masteredCount,
	totalCount,
	levelProgress,
	startSession,
	nextChallenge,
	submitAnswer,
	skipAnswer,
	useHint,
	useSecondHint,
} = useGameEngine()

/**
 *
 */
function startGame() {
	hintText.value = null
	hintLevel.value = 0
	eliminatedOptions.value = []
	revealedMask.value = null
	startSession()
	screen.value = 'game'
}

/**
 *
 * @param answer The player's answer string
 */
function handleAnswer(answer: string) {
	submitAnswer(answer)
	hintText.value = null
}

/**
 *
 */
function handleSkip() {
	skipAnswer()
	hintText.value = null
}

/**
 *
 */
function handleNext() {
	nextChallenge()
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
	screen.value = 'results'
}

/**
 *
 */
function handleHint() {
	if (hintLevel.value === 0) {
		const text = useHint()
		if (text !== null) {
			hintText.value = text
			hintLevel.value = 1
		}
	} else if (hintLevel.value === 1) {
		const result = useSecondHint()
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
	--whw-card-title: var(--color-text-maxcontrast);
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

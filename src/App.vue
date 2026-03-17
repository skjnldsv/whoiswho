<!--
  - SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
  - SPDX-License-Identifier: AGPL-3.0-or-later
  -->
<template>
	<div id="whos-who-app">
		<StartScreen
			v-if="screen === 'start'"
			:allMembers="allMembers"
			:filteredMembers="filteredMembers"
			:selectedDepartment="selectedDepartment"
			:availableDepartments="availableDepartments"
			:loading="loading"
			:loadError="loadError"
			:progress="progress"
			:unlockedAchievementCount="unlockedIds.size"
			@start="startGame"
			@reset="handleReset"
			@leaderboard="screen = 'leaderboard'"
			@achievements="screen = 'achievements'"
			@retry="retryFetch"
			@selectDepartment="selectedDepartment = $event" />
		<GameScreen
			v-else-if="screen === 'game'"
			:currentChallenge="currentChallenge"
			:showingResult="showingResult"
			:lastAnswerCorrect="lastAnswerCorrect"
			:lastAnswerClose="lastAnswerClose"
			:lastResponseTime="lastResponseTime"
			:lastStreakBonus="lastStreakBonus"
			:lifeRefillGained="lifeRefillGained"
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
			:newlyUnlockedAchievements="newlyUnlockedAchievements"
			@playAgain="startGame"
			@goHome="handleGoHome"
			@leaderboard="screen = 'leaderboard'"
			@achievements="screen = 'achievements'" />
		<LeaderboardScreen
			v-else-if="screen === 'leaderboard'"
			@close="handleGoHome" />
		<AchievementsScreen
			v-else-if="screen === 'achievements'"
			:unlockedIds="unlockedIds"
			:unlockCounts="unlockCounts"
			:loading="achievementsLoading"
			@close="handleGoHome" />

		<!-- Achievement unlock toast -->
		<Transition name="achievement-pop">
			<div v-if="achievementToast" class="achievement-toast">
				<span class="achievement-toast-emoji">{{ achievementToast.emoji }}</span>
				<div class="achievement-toast-text">
					<div class="achievement-toast-title">
						Achievement Unlocked!
					</div>
					<div class="achievement-toast-name">
						{{ achievementToast.name }}
					</div>
				</div>
			</div>
		</Transition>
	</div>
</template>

<script setup lang="ts">
import type { Achievement } from './composables/useAchievements.ts'

import { ref } from 'vue'
import AchievementsScreen from './components/AchievementsScreen.vue'
import GameScreen from './components/GameScreen.vue'
import LeaderboardScreen from './components/LeaderboardScreen.vue'
import ResultsScreen from './components/ResultsScreen.vue'
import StartScreen from './components/StartScreen.vue'
import { useAchievements } from './composables/useAchievements.ts'
import { useGameEngine } from './composables/useGameEngine.ts'
import { useLeaderboard } from './composables/useLeaderboard.ts'
import { defaultProgress, resetProgress as doResetProgress } from './composables/useStorage.ts'

const screen = ref<'start' | 'game' | 'results' | 'leaderboard' | 'achievements'>('start')
const hintText = ref<string | null>(null)
const hintLevel = ref(0)
const eliminatedOptions = ref<string[]>([])
const revealedMask = ref<string | null>(null)
const achievementToast = ref<Achievement | null>(null)
const newlyUnlockedAchievements = ref<Achievement[]>([])

const { submitScore } = useLeaderboard()

const {
	unlockedIds,
	unlockCounts,
	loading: achievementsLoading,
	fetchAchievements,
	checkAchievements,
} = useAchievements()

// Fetch achievements on app load
fetchAchievements()

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
	lifeRefillGained,
	loading,
	loadError,
	allMembers,
	filteredMembers,
	selectedDepartment,
	availableDepartments,
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

let toastTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Show newly unlocked achievements as sequential toasts.
 *
 * @param achievements List of newly unlocked achievements to display
 */
async function showAchievementToasts(achievements: Achievement[]): Promise<void> {
	for (const achievement of achievements) {
		if (toastTimer !== null) {
			clearTimeout(toastTimer)
		}
		achievementToast.value = achievement
		await new Promise<void>((resolve) => {
			toastTimer = setTimeout(() => {
				achievementToast.value = null
				toastTimer = null
				resolve()
			}, 3000)
		})
		// Small gap between consecutive toasts
		await new Promise<void>((resolve) => setTimeout(resolve, 300))
	}
}

/**
 *
 */
function startGame() {
	hintText.value = null
	hintLevel.value = 0
	eliminatedOptions.value = []
	revealedMask.value = null
	newlyUnlockedAchievements.value = []
	startSession()
	screen.value = 'game'

	// Check time-of-day and weekend achievements when starting a session
	const ctx = {
		progress: progress.value,
		sessionStats: sessionStats.value,
		lives: lives.value,
		maxLives,
		totalCount: totalCount.value,
		masteredCount: masteredCount.value,
	}
	checkAchievements(ctx).then((unlocked) => {
		if (unlocked.length > 0) {
			showAchievementToasts(unlocked)
		}
	})
}

/**
 *
 * @param answer The player's answer string
 */
async function handleAnswer(answer: string) {
	const xpBefore = sessionStats.value.xpEarned
	submitAnswer(answer)
	hintText.value = null
	const xpDelta = sessionStats.value.xpEarned - xpBefore
	if (xpDelta > 0) {
		submitScore(xpDelta, sessionStats.value.bestStreak)
	}

	const unlocked = await checkAchievements({
		progress: progress.value,
		sessionStats: sessionStats.value,
		lives: lives.value,
		maxLives,
		totalCount: totalCount.value,
		masteredCount: masteredCount.value,
	})
	if (unlocked.length > 0) {
		showAchievementToasts(unlocked)
	}
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
async function endGame() {
	hintText.value = null
	hintLevel.value = 0
	eliminatedOptions.value = []
	revealedMask.value = null
	endSession()

	// Check session-end achievements
	const unlocked = await checkAchievements({
		progress: progress.value,
		sessionStats: sessionStats.value,
		lives: lives.value,
		maxLives,
		totalCount: totalCount.value,
		masteredCount: masteredCount.value,
		isSessionEnd: true,
		sessionWon: !gameOver.value,
	})
	newlyUnlockedAchievements.value = unlocked
	if (unlocked.length > 0) {
		showAchievementToasts(unlocked)
	}

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
/* Fill #content exactly and be the sole scroll container for all screens */
#whos-who-app {
	height: 100%;
	width: 100%;
	font-family: var(--font-face, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
	background-color: var(--color-main-background);
	color: var(--color-main-text);
	position: relative;
	overflow-y: auto;
}

/* ── Achievement toast ── */
.achievement-toast {
	position: fixed;
	bottom: 24px;
	left: 50%;
	transform: translateX(-50%);
	background: var(--color-main-background);
	border: 2px solid var(--color-primary-element);
	border-radius: var(--border-radius-container);
	padding: 12px 20px;
	display: flex;
	align-items: center;
	gap: 12px;
	box-shadow: 0 4px 20px var(--color-box-shadow);
	z-index: 10000;
	min-width: 280px;
	max-width: 400px;
}

.achievement-toast-emoji {
	font-size: 1.8rem;
	flex-shrink: 0;
}

.achievement-toast-title {
	font-size: 0.72rem;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.06em;
	color: var(--color-primary-element);
}

.achievement-toast-name {
	font-size: 0.95rem;
	font-weight: 700;
	color: var(--color-main-text);
}

.achievement-pop-enter-active,
.achievement-pop-leave-active {
	transition: opacity 0.3s ease, transform 0.3s ease;
}

.achievement-pop-enter-from,
.achievement-pop-leave-to {
	opacity: 0;
	transform: translateX(-50%) translateY(16px);
}
</style>

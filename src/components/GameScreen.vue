<!--
  - SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
  - SPDX-License-Identifier: AGPL-3.0-or-later
  -->
<template>
	<div class="game-screen">
		<!-- ── Header: progress bar ── -->
		<div class="game-header">
			<ProgressBar
				:level="progress.level"
				:xp="progress.xp"
				:progress="levelProgress"
				:streak="sessionStats.streak"
				:mastered="masteredCount"
				:total="totalCount"
				:lives="lives"
				:maxLives="maxLives" />
		</div>

		<!-- ── Two-column body ── -->
		<div
			v-if="currentChallenge"
			class="game-body"
			:class="{ 'game-body--meet-pending': currentChallenge.type === 'meet' && !showingResult }">
			<!-- LEFT: photo card (animates per challenge) -->
			<div class="card-column">
				<Transition name="card-fade" mode="out-in">
					<div :key="currentChallenge.seq" class="card-wrapper">
						<!-- pick-face: show name as the clue, not a photo -->
						<div v-if="currentChallenge.type === 'pick-face'" class="name-badge">
							<div class="name-badge-avatar">
								<img
									v-if="showingResult && !pickFacePhotoFailed"
									:src="currentChallenge.person.photo"
									:alt="currentChallenge.person.name"
									class="name-badge-photo"
									@error="onPickFacePhotoError">
								<span v-else>{{ currentChallenge.person.name.charAt(0) }}</span>
							</div>
							<h2 class="name-badge-name">
								{{ currentChallenge.person.name }}
							</h2>
							<p class="name-badge-title">
								{{ currentChallenge.person.title }}
							</p>
							<p class="name-badge-dept">
								{{ currentChallenge.person.department }}
							</p>
						</div>
						<PersonCard
							v-else
							:person="currentChallenge.person"
							:showName="currentChallenge.type === 'meet'"
							:correct="showingResult && lastAnswerCorrect"
							:wrong="showingResult && !lastAnswerCorrect" />
						<!-- "Got it" button lives below the card for meet challenges -->
						<button
							v-if="currentChallenge.type === 'meet' && !showingResult"
							class="btn-action btn-action--meet"
							:disabled="answered"
							@click="handleMeet">
							Got it <kbd class="kbd-gap">↵</kbd>
						</button>
					</div>
				</Transition>
			</div>

			<!-- RIGHT: challenge interaction -->
			<div class="challenge-column">
				<!-- Countdown timer bar (hidden for meet challenges and while showing result) -->
				<div
					v-if="currentChallenge.timeLimit > 0 && !showingResult"
					class="timer-bar">
					<div class="timer-track">
						<div
							class="timer-fill"
							:style="{ width: (timeRemainingMs / currentChallenge.timeLimit * 100) + '%' }"
							:class="{ 'timer-fill--warning': (timeRemainingMs / currentChallenge.timeLimit * 100) < 20 }" />
					</div>
					<span class="timer-text">{{ Math.ceil(timeRemainingMs / 1000) }}s</span>
				</div>

				<!-- Challenge input (animates per challenge) -->
				<Transition name="fade" mode="out-in">
					<div :key="currentChallenge.seq" class="input-area" :class="{ 'pick-face': currentChallenge.type === 'pick-face' }">
						<ChallengeInput
							:challenge="currentChallenge"
							:showingResult="showingResult"
							:eliminatedOptions="eliminatedOptions"
							:revealedMask="revealedMask ?? null"
							@answer="handleAnswerFromInput" />
					</div>
				</Transition>

				<!-- Hints + skip row -->
				<div v-if="hintText" class="hint-bubble">
					💡 {{ hintText }}
				</div>
				<div v-if="!showingResult && currentChallenge.type !== 'meet'" class="hint-skip-row">
					<button
						v-if="hintLevel < 2"
						class="btn-hint"
						:disabled="progress.xp < (hintLevel === 0 ? 10 : 15)"
						:title="hintLevel === 0
							? (progress.xp < 10 ? 'Need 10 XP for a hint' : 'Use hint (-10 XP)')
							: (progress.xp < 15 ? 'Need 15 XP for more help' : 'Reveal more (-15 XP)')"
						@click="requestHint">
						💡 {{ hintLevel === 0 ? 'Hint' : 'More help' }} <kbd class="kbd-gap">H</kbd>
					</button>
					<button class="btn-skip" @click="handleSkip">
						🤷 I don't know <kbd class="kbd-gap">Esc</kbd>
					</button>
				</div>

				<!-- Spacer pushes action row to bottom -->
				<div class="flex-spacer" />

				<!-- ── Action bar: result + button ── -->
				<div class="action-area">
					<Transition name="fade">
						<div
							v-if="showingResult && currentChallenge.type !== 'meet'"
							class="result-msg"
							:class="{
								'result-correct': lastAnswerCorrect,
								'result-close': lastAnswerClose && !lastAnswerCorrect,
								'result-wrong': !lastAnswerCorrect && !lastAnswerClose,
							}">
							<img
								v-if="currentChallenge.person.photo"
								:src="currentChallenge.person.photo"
								:alt="currentChallenge.person.name"
								class="result-avatar">
							<span class="feedback-icon">{{ lastAnswerCorrect ? '✨' : lastAnswerClose ? '🎯' : timedOut ? '⏰' : '😕' }}</span>
							<span v-if="lastAnswerCorrect">
								Correct! +{{ xpEarned }} XP
								<span v-if="lastStreakBonus > 0" class="streak-bonus">🔥 +{{ lastStreakBonus }} streak</span>
								<span v-if="lastResponseTime > 0" class="response-time">· {{ (lastResponseTime / 1000).toFixed(1) }}s</span>
							</span>
							<span v-else-if="lastAnswerClose">So close! It's <strong>{{ currentChallenge.correctAnswer }}</strong> (+{{ xpEarned }} XP)</span>
							<span v-else-if="timedOut">Time's up! It's <strong>{{ currentChallenge.correctAnswer }}</strong></span>
							<span v-else>It's <strong>{{ currentChallenge.correctAnswer }}</strong></span>
						</div>
					</Transition>
					<button
						v-if="showingResult && currentChallenge.type !== 'meet'"
						class="btn-action"
						:class="{ 'btn-action--auto-advancing': autoAdvancing }"
						:style="autoAdvancing ? { '--auto-progress-duration': AUTO_SKIP_DELAY_MS + 'ms' } : {}"
						@click="handleNext">
						{{ gameOver ? '📊 See Results' : 'Next' }} <kbd class="kbd-gap">↵</kbd>
					</button>
				</div>
			</div>
		</div>

		<!-- XP popup -->
		<Transition name="pop">
			<div v-if="xpPopup" :key="xpPopupKey" class="xp-popup">
				+{{ xpPopup }} XP
			</div>
		</Transition>

		<!-- Streak milestone -->
		<Transition name="pop">
			<div v-if="streakMilestone" class="streak-popup">
				🔥 {{ streakMilestone }} streak!
			</div>
		</Transition>

		<!-- Confetti -->
		<div v-if="showConfetti" class="confetti-container">
			<div
				v-for="i in 30"
				:key="i"
				class="confetti-piece"
				:style="confettiStyle(i)" />
		</div>
	</div>
</template>

<script setup lang="ts">
import type { Challenge } from '../composables/useGameEngine.ts'
import type { SessionStats } from '../composables/useGameEngine.ts'
import type { GameProgress } from '../composables/useStorage.ts'

import { useHotKey } from '@nextcloud/vue'
import { ref, watch } from 'vue'
import ChallengeInput from './ChallengeInput.vue'
import PersonCard from './PersonCard.vue'
import ProgressBar from './ProgressBar.vue'
import { CLOSE_ANSWER_XP_DIVISOR, XP_PER_STAGE } from '../composables/useGameEngine.ts'
import { FAST_ANSWER_BONUS_XP, FAST_ANSWER_THRESHOLD } from '../constants.ts'

const props = defineProps<{
	currentChallenge: Challenge | null
	showingResult: boolean
	lastAnswerCorrect: boolean
	lastAnswerClose: boolean
	lastResponseTime: number
	lastStreakBonus: number
	progress: GameProgress
	sessionStats: SessionStats
	lives: number
	maxLives: number
	masteredCount: number
	totalCount: number
	levelProgress: number
	gameOver: boolean
	hintText?: string | null
	hintLevel: number
	eliminatedOptions: string[]
	revealedMask?: string | null
}>()

const emit = defineEmits<{
	answer: [value: string]
	next: []
	skip: []
	hint: []
	end: []
}>()

const xpEarned = ref(0)
const xpPopup = ref(0)
const xpPopupKey = ref(0)
const streakMilestone = ref(0)
const showConfetti = ref(false)
// Prevent double-submission of the meet challenge
const answered = ref(false)
// Prevent double-navigation when clicking Next
const advancing = ref(false)
// Whether auto-advancing is in progress (drives CSS gradient fill on Next button)
const autoAdvancing = ref(false)
// Whether the pick-face reveal photo failed to load
const pickFacePhotoFailed = ref(false)
let autoSkipTimeoutId: ReturnType<typeof setTimeout> | null = null
const AUTO_SKIP_DELAY_MS = 3000 // ms before auto-advancing to next challenge

// ── Timer state ────────────────────────────────────────────────────────────────
// Whether the last answer timed out (used to show "Time's up!" in the result)
const timedOut = ref(false)
// Countdown: milliseconds remaining for the current challenge timer
const timeRemainingMs = ref(0)
let timerInterval: ReturnType<typeof setInterval> | null = null
let timerStartMs = 0 // wall-clock ms when the current timer run started
let accumulatedElapsedMs = 0 // ms elapsed before the current run (paused time excluded)

/**
 * Clear the countdown interval without modifying timerStartMs / accumulatedElapsedMs.
 */
function clearTimer() {
	if (timerInterval !== null) {
		clearInterval(timerInterval)
		timerInterval = null
	}
}

/**
 * Tick function called every 100 ms by the timer interval.
 */
function tickTimer() {
	const timeLimit = props.currentChallenge?.timeLimit ?? 0
	const elapsed = accumulatedElapsedMs + (Date.now() - timerStartMs)
	const remaining = Math.max(0, timeLimit - elapsed)
	timeRemainingMs.value = remaining

	if (remaining === 0) {
		clearTimer()
		if (!props.showingResult && !answered.value) {
			timedOut.value = true
			answered.value = true
			emit('answer', '') // empty string → wrong answer → costs a life
		}
	}
}

/**
 * Start (or restart) the countdown for the current challenge.
 *
 * @param timeLimit milliseconds (0 = no timer)
 */
function startTimer(timeLimit: number) {
	clearTimer()
	if (timeLimit === 0) {
		return
	}
	accumulatedElapsedMs = 0
	timerStartMs = Date.now()
	timeRemainingMs.value = timeLimit
	timerInterval = setInterval(tickTimer, 100)
}

/**
 * Pause the timer (e.g. while a hint is shown).
 */
function pauseTimer() {
	if (timerInterval !== null) {
		accumulatedElapsedMs += Date.now() - timerStartMs
		clearTimer()
	}
}

/**
 * Resume the timer after a pause.
 */
function resumeTimer() {
	const timeLimit = props.currentChallenge?.timeLimit ?? 0
	if (timeLimit === 0 || props.showingResult || timeRemainingMs.value === 0) {
		return
	}
	timerStartMs = Date.now()
	timerInterval = setInterval(tickTimer, 100)
}

// Pause timer when a hint is shown; resume when it is dismissed
watch(() => props.hintLevel, (newLevel, oldLevel) => {
	if (newLevel > 0 && oldLevel === 0) {
		pauseTimer()
	} else if (newLevel === 0 && oldLevel > 0) {
		resumeTimer()
	}
})

/**
 *
 */
function clearAutoSkipTimers() {
	if (autoSkipTimeoutId !== null) {
		clearTimeout(autoSkipTimeoutId)
		autoSkipTimeoutId = null
	}
	autoAdvancing.value = false
}

// Reset per-challenge state when a new challenge arrives
watch(() => props.currentChallenge, (challenge) => {
	answered.value = false
	advancing.value = false
	xpEarned.value = 0
	timedOut.value = false
	pickFacePhotoFailed.value = false
	clearAutoSkipTimers()
	startTimer(challenge?.timeLimit ?? 0)
}, { immediate: true })

// Watch for streak milestones
watch(() => props.sessionStats.streak, (streak) => {
	if (streak > 0 && streak % 5 === 0) {
		streakMilestone.value = streak
		setTimeout(() => {
			streakMilestone.value = 0
		}, 2000)
	}
})

// Watch for mastery events
watch(() => props.sessionStats.newlyMastered, (list) => {
	if (list.length > 0) {
		showConfetti.value = true
		setTimeout(() => {
			showConfetti.value = false
		}, 3000)
	}
}, { deep: true })

// Unified XP popup + auto-advance logic triggered by showingResult
watch(() => props.showingResult, (showing) => {
	if (showing && props.currentChallenge) {
		// Stop the countdown — no longer needed once we have a result
		clearTimer()

		// Compute XP to display based on the engine's determination
		if (props.lastAnswerCorrect) {
			const baseXp = XP_PER_STAGE[props.currentChallenge.type]
			// Mirror the fast-answer bonus logic from the engine
			const isFast = props.currentChallenge.timeLimit > 0
				&& props.lastResponseTime > 0
				&& props.lastResponseTime < props.currentChallenge.timeLimit * FAST_ANSWER_THRESHOLD
			xpEarned.value = baseXp + (isFast ? FAST_ANSWER_BONUS_XP : 0)
			triggerXpPopup(xpEarned.value)
		} else if (props.lastAnswerClose) {
			xpEarned.value = Math.ceil(XP_PER_STAGE[props.currentChallenge.type] / CLOSE_ANSWER_XP_DIVISOR)
			triggerXpPopup(xpEarned.value)
		} else {
			xpEarned.value = 0
		}

		if (props.lastAnswerCorrect && props.currentChallenge.type === 'meet') {
			// Auto-advance meet cards immediately to skip the confusing in-between screen
			setTimeout(() => {
				if (advancing.value) {
					return
				}
				advancing.value = true
				if (props.gameOver) {
					emit('end')
				} else {
					emit('next')
				}
			}, 0)
		} else if (props.currentChallenge.type !== 'meet') {
			// Auto-skip: fill Next button with a gradient over AUTO_SKIP_DELAY_MS
			autoAdvancing.value = true
			autoSkipTimeoutId = setTimeout(() => {
				handleNext()
			}, AUTO_SKIP_DELAY_MS)
		}
	} else if (!showing) {
		clearAutoSkipTimers()
	}
})

/**
 *
 * @param answer The answer string from the ChallengeInput component
 */
function handleAnswerFromInput(answer: string) {
	emit('answer', answer)
}

/**
 *
 */
function handleMeet() {
	if (answered.value) {
		return
	}
	answered.value = true
	emit('answer', 'ok')
}

/**
 *
 */
function handleNext() {
	if (advancing.value) {
		return
	}
	advancing.value = true
	clearAutoSkipTimers()
	if (props.gameOver) {
		emit('end')
	} else {
		emit('next')
	}
}

/**
 *
 */
function handleSkip() {
	if (answered.value || props.showingResult) {
		return
	}
	answered.value = true
	emit('skip')
}

/**
 *
 */
function requestHint() {
	emit('hint')
}

/**
 *
 * @param amount The XP amount to display in the popup
 */
function triggerXpPopup(amount: number) {
	xpPopup.value = amount
	xpPopupKey.value++
	setTimeout(() => {
		xpPopup.value = 0
	}, 1500)
}

/**
 *
 * @param i The confetti piece index
 */
function confettiStyle(i: number) {
	const colors = ['#f7971e', '#ffd200', '#0082c9', '#764ba2', '#2ecc71', '#e74c3c', '#3498db']
	return {
		left: Math.random() * 100 + '%',
		animationDelay: Math.random() * 0.5 + 's',
		animationDuration: (1.5 + Math.random() * 2) + 's',
		backgroundColor: colors[i % colors.length],
	}
}

/**
 * Mark pick-face reveal photo as failed so we fall back to the initial
 */
function onPickFacePhotoError() {
	pickFacePhotoFailed.value = true
}

// ── Keyboard shortcuts ────────────────────────────────────────────────

// Enter → Got it (meet) or advance when showing result
useHotKey((e) => e.key === 'Enter', (e) => {
	e.preventDefault()
	if (props.showingResult) {
		handleNext()
	} else if (props.currentChallenge?.type === 'meet' && !answered.value) {
		handleMeet()
	}
})

// Escape → I don't know
useHotKey('Escape', () => {
	if (!props.showingResult && !answered.value && props.currentChallenge?.type !== 'meet') {
		handleSkip()
	}
})

// H → hint
useHotKey('h', () => {
	if (!props.showingResult && !answered.value && props.currentChallenge?.type !== 'meet' && props.hintLevel < 2) {
		requestHint()
	}
})
</script>

<style scoped>
/* ── Outer shell ─────────────────────────────────────────────────*/
.game-screen {
	width: 100%;
	min-height: 100%;
	display: flex;
	flex-direction: column;
	background-color: var(--color-main-background);
	color: var(--color-main-text);
}

/* ── Header ────────────────────────────────────────────────────*/
.game-header {
	flex-shrink: 0;
	padding: 10px 20px 12px;
	border-bottom: 1px solid var(--color-border);
	position: sticky;
	top: 0;
	z-index: 10;
	background-color: var(--color-main-background);
}

/* ── Two-column body ───────────────────────────────────────────────*/
.game-body {
	flex: 1;
	min-height: 0;
	display: flex;
	overflow: hidden;
	transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Meet-pending: center the card, hide the right column */
.game-body--meet-pending {
	justify-content: center;
}

.game-body--meet-pending .card-column {
	/* Wide enough to comfortably display the business card + "Got it" button */
	flex: 0 0 min(360px, 90%);
	border-inline-end: none;
}

.game-body--meet-pending .challenge-column {
	display: none;
}

/* ── Left: photo card ──────────────────────────────────────────────*/
.card-column {
	flex: 0 0 min(300px, 42%);
	display: flex;
	justify-content: center;
	padding: 20px 16px;
	border-inline-end: 1px solid var(--color-border);
	overflow: hidden;
}

.card-wrapper {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 14px;
	width: 100%;
}

/* ── Right: interaction ──────────────────────────────────────────────*/
.challenge-column {
	flex: 1;
	min-width: 0;
	max-width: 500px;
	display: flex;
	flex-direction: column;
	padding: 20px 24px 16px;
	overflow: hidden;
	gap: 12px;
}

.input-area {
	display: flex;
	flex-direction: column;
	gap: 14px;
	flex-shrink: 0;
}

/* When showing the face-pick grid, let the input-area fill the column
   so the face images are constrained to the viewport instead of overflowing */
.input-area.pick-face {
	flex: 1000 1 0%;
	min-height: 0;
	overflow: hidden;
}

.flex-spacer {
	flex: 1;
}

/* ── Timer bar ─────────────────────────────────────────────────────────────*/
.timer-bar {
	display: flex;
	align-items: center;
	gap: 8px;
	flex-shrink: 0;
}

.timer-track {
	flex: 1;
	height: 6px;
	background: var(--color-border, rgba(0, 0, 0, 0.1));
	border-radius: 3px;
	overflow: hidden;
}

.timer-fill {
	height: 100%;
	background: var(--color-primary-element);
	border-radius: 3px;
	transition: width 0.1s linear, background-color 0.3s ease;
}

.timer-fill--warning {
	background: #e9322d;
}

.timer-text {
	font-size: 0.78rem;
	font-weight: 600;
	color: var(--color-text-maxcontrast);
	min-width: 2.2em;
	text-align: end;
}

/* ── Response time inline display ────────────────────────────────*/
.response-time {
	font-weight: 400;
	opacity: 0.85;
	font-size: 0.9em;
}

.streak-bonus {
	font-weight: 700;
	opacity: 0.95;
}

/* ── Hint ──────────────────────────────────────────────────────*/
.hint-bubble {
	background: var(--color-background-dark);
	border: 1px solid var(--color-border-dark);
	border-radius: var(--border-radius-container);
	padding: 10px 14px;
	color: var(--color-main-text);
	font-size: 0.85rem;
	flex-shrink: 0;
}

.btn-hint {
	margin: 0;
	padding: 6px 14px;
	border: 1px solid var(--color-border-dark);
	border-radius: var(--border-radius-element);
	background: transparent;
	color: var(--color-text-maxcontrast);
	font-size: 0.78rem;
	cursor: pointer;
	transition: background 0.15s ease, color 0.15s ease;
	align-self: flex-start;
	flex-shrink: 0;
}

.btn-hint:hover:not(:disabled) {
	background: var(--color-background-hover);
	color: var(--color-main-text);
}

.btn-hint:disabled { opacity: 0.4; cursor: default; }

/* ── Hint + skip row ───────────────────────────────────────────────*/
.hint-skip-row {
	display: flex;
	align-items: center;
	gap: 8px;
	flex-wrap: wrap;
	flex-shrink: 0;
}

/* ── "I don't know" skip button ──────────────────────────────────────────*/
.btn-skip {
	margin: 0;
	padding: 6px 14px;
	border: 1px solid var(--color-border-dark);
	border-radius: var(--border-radius-element);
	background: transparent;
	color: var(--color-text-maxcontrast);
	font-size: 0.78rem;
	cursor: pointer;
	transition: background 0.15s ease, color 0.15s ease;
	flex-shrink: 0;
}

.btn-skip:hover {
	background: var(--color-background-hover);
	color: var(--color-main-text);
}

/* ── Keyboard shortcut labels ────────────────────────────────────────────*/
kbd {
	display: inline-block;
	padding: 1px 5px;
	border: 1px solid currentColor;
	border-radius: 4px;
	font-size: 0.65em;
	font-family: inherit;
	opacity: 0.7;
	vertical-align: middle;
	line-height: 1.4;
}

/* Add a small gap between button text and the hotkey badge */
.kbd-gap {
	margin-inline-start: 4px;
}

/* ── Action area ─────────────────────────────────────────────────*/
.action-area {
	flex-shrink: 0;
	display: flex;
	flex-direction: column;
	position: relative;
	/* Always reserve the button footprint so the result banner doesn't shift layout */
	min-height: var(--clickable-area-large, 44px);
}

.result-msg {
	position: absolute;
	bottom: calc(100% + 8px);
	left: 0;
	right: 0;
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 12px 16px;
	border-radius: var(--border-radius-element);
	font-size: 0.95rem;
	font-weight: 600;
}

.result-avatar {
	width: 36px;
	height: 36px;
	border-radius: 50%;
	object-fit: cover;
	flex-shrink: 0;
	border: 2px solid currentColor;
	opacity: 0.9;
}

.result-correct {
	background: var(--color-success);
	border: 1px solid var(--color-element-success);
	color: var(--color-text-success);
}

.result-wrong {
	background: var(--color-error);
	border: 1px solid var(--color-element-error);
	color: var(--color-text-error);
}

.result-close {
	background: var(--color-warning);
	border: 1px solid var(--color-element-warning);
	color: var(--color-text-warning, var(--color-main-text));
}

.feedback-icon {
	font-size: 1.3rem;
	flex-shrink: 0;
}

/* Primary action button — full width */
.btn-action {
	margin: 0;
	width: 100%;
	min-height: var(--clickable-area-large);
	padding: 12px 24px;
	border: none;
	border-radius: var(--border-radius-pill);
	background: var(--color-primary-element);
	color: var(--color-primary-element-text);
	font-size: 1.05rem;
	font-weight: 700;
	cursor: pointer;
	transition: background 0.15s ease;
	display: flex;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
}

/* "Got it" button below the card for meet challenges */
.btn-action--meet {
	max-width: 300px;
}

.btn-action:hover:not(:disabled) { background: var(--color-primary-element-hover); }

.btn-action:disabled { opacity: 0.45; cursor: default; }

/* Gradient fill animation when auto-advancing to next challenge */
.btn-action--auto-advancing {
	--auto-progress-duration: 3000ms;
	background: linear-gradient(
		to right,
		var(--color-primary-element-hover) var(--fill-pct, 0%),
		var(--color-primary-element) var(--fill-pct, 0%)
	);
	animation: btnAutoFill var(--auto-progress-duration) linear forwards;
}

@keyframes btnAutoFill {
	from { --fill-pct: 0%; }
	to   { --fill-pct: 100%; }
}

@property --fill-pct {
	syntax: '<percentage>';
	inherits: false;
	initial-value: 0%;
}

/* ── Responsive: stack on narrow screens ─────────────────────────────────────*/
@media (max-width: 680px) {
	.game-body {
		flex-direction: column;
		overflow-y: visible; /* parent (#whos-who-app) scrolls */
		flex: none;
	}

	.card-column {
		flex: 0 0 auto;
		border-inline-end: none;
		border-bottom: 1px solid var(--color-border);
		padding: 14px 16px 12px;
		/* Cap photo height so the interaction area is always visible */
		max-height: 220px;
	}

	.challenge-column {
		padding: 14px 16px 16px;
		overflow: visible;
		flex: none;
	}

	.input-area.pick-face {
		flex: none;
		overflow: visible;
		min-height: auto;
	}

	.flex-spacer {
		display: none;
	}

	.action-area {
		position: sticky;
		bottom: 0;
		background: var(--color-main-background);
		padding-bottom: env(safe-area-inset-bottom, 8px);
		padding-top: 8px;
		z-index: 5;
	}

	/* Meet (discover) phase: let the card + "Got it" button size naturally */
	.game-body--meet-pending {
		flex: 1;
		min-height: 0;
		align-items: center;
	}

	.game-body--meet-pending .card-column {
		flex: 0 0 auto;
		max-height: none;
		border-bottom: none;
	}
}

/* ── Name badge (pick-face left column) ─────────────────────────────────────*/
.name-badge {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 10px;
	padding: 24px 16px;
	background: var(--color-background-dark);
	border: 1px solid var(--color-border-dark);
	border-radius: var(--border-radius-container-large);
	width: 100%;
	box-sizing: border-box;
	text-align: center;
}

.name-badge-avatar {
	width: 64px;
	height: 64px;
	border-radius: 50%;
	background: var(--color-primary-element);
	color: var(--color-primary-element-text);
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 1.6rem;
	font-weight: 700;
	flex-shrink: 0;
	overflow: hidden;
}

.name-badge-photo {
	width: 100%;
	height: 100%;
	object-fit: cover;
	display: block;
}

.name-badge-name {
	margin: 0;
	font-size: 1.2rem;
	font-weight: 700;
	color: var(--color-main-text);
	line-height: 1.3;
}

.name-badge-title {
	margin: 0;
	font-size: 0.85rem;
	color: var(--color-text-maxcontrast);
}

.name-badge-dept {
	margin: 0;
	font-size: 0.78rem;
	color: var(--color-text-maxcontrast);
	text-transform: uppercase;
	letter-spacing: 0.06em;
}

/* ── Overlays ─────────────────────────────────────────────────────*/
.xp-popup {
	position: fixed;
	top: 45%;
	inset-inline-start: 50%;
	transform: translate(-50%, -50%);
	font-size: 2rem;
	font-weight: 800;
	color: var(--color-primary-element);
	pointer-events: none;
	z-index: 100;
}

.streak-popup {
	position: fixed;
	top: 30%;
	inset-inline-start: 50%;
	transform: translateX(-50%);
	font-size: 1.5rem;
	font-weight: 800;
	color: var(--color-element-warning);
	pointer-events: none;
	z-index: 100;
	animation: streakBounce 2s ease-out forwards;
}

@keyframes streakBounce {
	0%   { opacity: 0; transform: translateX(-50%) scale(0.5); }
	20%  { opacity: 1; transform: translateX(-50%) scale(1.2); }
	40%  { transform: translateX(-50%) scale(1); }
	100% { opacity: 0; transform: translateX(-50%) translateY(-50px); }
}

.confetti-container {
	position: fixed;
	inset: 0;
	pointer-events: none;
	z-index: 200;
	overflow: hidden;
}

.confetti-piece {
	position: absolute;
	top: -10px;
	width: 10px;
	height: 10px;
	border-radius: 2px;
	animation: confettiFall linear forwards;
}

@keyframes confettiFall {
	0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
	100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
}

/* ── Transitions ────────────────────────────────────────────────────*/
.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.18s ease;
}

.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}

.card-fade-enter-active,
.card-fade-leave-active {
	transition: opacity 0.22s ease, transform 0.22s ease;
}

.card-fade-enter-from {
	opacity: 0;
	transform: translateY(12px);
}

.card-fade-leave-to {
	opacity: 0;
	transform: translateY(-12px);
}

.pop-enter-active {
	animation: popIn 0.3s ease;
}

.pop-leave-active {
	animation: popOut 0.3s ease;
}

@keyframes popIn {
	0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
	70%  { transform: translate(-50%, -50%) scale(1.1); }
	100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

@keyframes popOut {
	0%   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
	100% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
}
</style>

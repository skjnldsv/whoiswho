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
		<div v-if="currentChallenge" class="game-body">
			<!-- LEFT: photo card (animates per challenge) -->
			<div class="card-column">
				<Transition name="card-fade" mode="out-in">
					<div :key="currentChallenge.seq" class="card-wrapper">
						<span class="stage-tag" :class="currentChallenge.type.replace('-', '_')">
							{{ stageLabels[currentChallenge.type] }}
						</span>
						<!-- pick-face: show name as the clue, not a photo -->
						<div v-if="currentChallenge.type === 'pick-face'" class="name-badge">
							<div class="name-badge-avatar">
								{{ currentChallenge.person.name.charAt(0) }}
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
							:flipped="showingResult && currentChallenge.type !== 'meet'"
							:correct="showingResult && lastAnswerCorrect"
							:wrong="showingResult && !lastAnswerCorrect" />
					</div>
				</Transition>
			</div>

			<!-- RIGHT: challenge interaction -->
			<div class="challenge-column">
				<!-- Challenge input (animates per challenge) -->
				<Transition name="fade" mode="out-in">
					<div :key="currentChallenge.seq" class="input-area" :class="{ 'pick-face': currentChallenge.type === 'pick-face' }">
						<!-- Meet: see and remember -->
						<div v-if="currentChallenge.type === 'meet'" class="meet-area">
							<p class="prompt">
								Remember this person!
							</p>
							<p class="sub-prompt">
								Name, title, and department — then click Got it.
							</p>
						</div>

						<!-- Recognize: multiple choice -->
						<div v-else-if="currentChallenge.type === 'recognize'" class="choice-area">
							<p class="prompt">
								Who is this person?
							</p>
							<div class="choice-grid">
								<button
									v-for="option in currentChallenge.options"
									:key="option"
									class="choice-btn"
									:class="{
										correct: showingResult && option === currentChallenge.correctAnswer,
										wrong: showingResult && chosenAnswer === option && option !== currentChallenge.correctAnswer,
										disabled: showingResult,
										eliminated: !showingResult && eliminatedOptions.includes(option),
									}"
									:disabled="showingResult || (!showingResult && eliminatedOptions.includes(option))"
									@click="handleChoice(option)">
									{{ option }}
								</button>
							</div>
						</div>

						<!-- Pick-face: choose the photo that matches the name -->
						<div v-else-if="currentChallenge.type === 'pick-face'" class="pick-face-area">
							<p class="prompt">
								Find this person's face:
							</p>
							<div class="face-grid">
								<button
									v-for="member in currentChallenge.photoOptions"
									:key="member.id"
									class="face-option"
									:class="{
										correct: showingResult && member.name === currentChallenge.correctAnswer,
										wrong: showingResult && chosenAnswer === member.name && member.name !== currentChallenge.correctAnswer,
										disabled: showingResult,
										eliminated: !showingResult && eliminatedOptions.includes(member.name),
									}"
									:disabled="showingResult || (!showingResult && eliminatedOptions.includes(member.name))"
									@click="handleChoice(member.name)">
									<img :src="member.photo" :alt="showingResult ? member.name : ''" class="face-option-img">
									<span v-if="showingResult && member.name === currentChallenge.correctAnswer" class="face-correct-label">✓ {{ member.name }}</span>
								</button>
							</div>
						</div>

						<!-- Recall: fill in blanks -->
						<div v-else-if="currentChallenge.type === 'recall'" class="recall-area">
							<p class="prompt">
								Complete the name:
							</p>
							<p class="masked-name">
								{{ revealedMask || currentChallenge.maskedName }}
							</p>
							<div class="type-input-row">
								<input
									ref="recallInput"
									v-model="typedAnswer"
									type="text"
									class="name-input"
									placeholder="Type the full name…"
									:disabled="showingResult"
									autocomplete="off"
									@keydown.enter="handleTypedAnswer">
								<button
									class="btn-submit"
									:disabled="showingResult || !typedAnswer.trim()"
									:aria-label="t('whoiswho', 'Submit answer')"
									@click="handleTypedAnswer">
									✓
								</button>
							</div>
						</div>

						<!-- Type: free recall -->
						<div v-else-if="currentChallenge.type === 'type'" class="type-area">
							<p class="prompt">
								Type this person's full name:
							</p>
							<div v-if="revealedMask" class="hint-bubble hint-bubble--inline">
								🔤 {{ revealedMask }}
							</div>
							<div class="type-input-row">
								<input
									ref="typeInput"
									v-model="typedAnswer"
									type="text"
									class="name-input"
									placeholder="Full name…"
									:disabled="showingResult"
									autocomplete="off"
									@keydown.enter="handleTypedAnswer">
								<button
									class="btn-submit"
									:disabled="showingResult || !typedAnswer.trim()"
									:aria-label="t('whoiswho', 'Submit answer')"
									@click="handleTypedAnswer">
									✓
								</button>
							</div>
						</div>
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
						💡 {{ hintLevel === 0 ? 'Hint' : 'More help' }} <kbd>H</kbd>
					</button>
					<button class="btn-skip" @click="handleSkip">
						🤷 I don't know <kbd>Esc</kbd>
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
							<span class="feedback-icon">{{ lastAnswerCorrect ? '✨' : lastAnswerClose ? '🎯' : '😕' }}</span>
							<span v-if="lastAnswerCorrect">Correct! +{{ xpEarned }} XP</span>
							<span v-else-if="lastAnswerClose">So close! It's <strong>{{ currentChallenge.correctAnswer }}</strong> (+{{ xpEarned }} XP)</span>
							<span v-else>It's <strong>{{ currentChallenge.correctAnswer }}</strong></span>
						</div>
					</Transition>
					<button
						v-if="currentChallenge.type === 'meet' && !showingResult"
						class="btn-action"
						:disabled="answered"
						@click="handleMeet">
						Got it <kbd>↵</kbd>
					</button>
					<button
						v-else-if="showingResult && currentChallenge.type !== 'meet'"
						class="btn-action"
						:class="{ 'btn-action--auto-advancing': autoAdvancing }"
						:style="autoAdvancing ? { '--auto-progress-duration': AUTO_SKIP_DELAY_MS + 'ms' } : {}"
						@click="handleNext">
						{{ gameOver ? '📊 See Results' : 'Next' }} <kbd>↵</kbd>
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

import { t } from '@nextcloud/l10n'
import { useHotKey } from '@nextcloud/vue'
import { nextTick, ref, useTemplateRef, watch } from 'vue'
import PersonCard from './PersonCard.vue'
import ProgressBar from './ProgressBar.vue'

const props = defineProps<{
	currentChallenge: Challenge | null
	showingResult: boolean
	lastAnswerCorrect: boolean
	lastAnswerClose: boolean
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

const stageLabels: Record<string, string> = {
	meet: '👋 Meet',
	recognize: '🎯 Recognize',
	'pick-face': '🖼️ Pick the Face',
	recall: '🧩 Recall',
	type: '✍️ Master',
}

const typedAnswer = ref('')
const chosenAnswer = ref('')
const xpPopup = ref(0)
const xpPopupKey = ref(0)
const streakMilestone = ref(0)
const showConfetti = ref(false)
const recallInput = useTemplateRef<HTMLInputElement>('recallInput')
const typeInput = useTemplateRef<HTMLInputElement>('typeInput')
// Prevent double-submission of the same challenge
const answered = ref(false)
// Prevent double-navigation when clicking Next
const advancing = ref(false)
// Whether auto-advancing is in progress (drives CSS gradient fill on Next button)
const autoAdvancing = ref(false)
let autoSkipTimeoutId: ReturnType<typeof setTimeout> | null = null
const AUTO_SKIP_DELAY_MS = 3000 // ms before auto-advancing to next challenge

// Strip diacritics for accent-agnostic comparison
/**
 *
 * @param s The text string to normalize
 */
function normalizeText(s: string): string {
	return s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// Local Levenshtein — mirrors the game engine so XP popup is shown immediately
/**
 *
 * @param a The first string
 * @param b The second string
 */
function levenshtein(a: string, b: string): number {
	const m = a.length
	const n = b.length
	const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			dp[i][j] = a[i - 1] === b[j - 1]
				? dp[i - 1][j - 1]
				: 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
		}
	}
	return dp[m][n]
}

const xpEarned = ref(0)

const XP_PER_STAGE: Record<string, number> = {
	meet: 5,
	recognize: 15,
	'pick-face': 15,
	recall: 25,
	type: 40,
}

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
watch(() => props.currentChallenge, async () => {
	answered.value = false
	advancing.value = false
	typedAnswer.value = ''
	chosenAnswer.value = ''
	xpEarned.value = 0
	clearAutoSkipTimers()
	await nextTick()
	recallInput.value?.focus()
	typeInput.value?.focus()
})

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
 * @param option The selected option text
 */
function handleChoice(option: string) {
	if (answered.value) {
		return
	}
	answered.value = true
	chosenAnswer.value = option
	emit('answer', option)

	if (option === props.currentChallenge?.correctAnswer) {
		xpEarned.value = XP_PER_STAGE[props.currentChallenge.type]
		triggerXpPopup(xpEarned.value)
	}
}

/**
 *
 */
function handleTypedAnswer() {
	if (!typedAnswer.value.trim() || answered.value) {
		return
	}
	answered.value = true
	emit('answer', typedAnswer.value)

	if (props.currentChallenge) {
		const norm = normalizeText(typedAnswer.value)
		const correct = normalizeText(props.currentChallenge.correctAnswer)
		if (norm === correct) {
			xpEarned.value = XP_PER_STAGE[props.currentChallenge.type]
			triggerXpPopup(xpEarned.value)
		} else if (levenshtein(norm, correct) <= 2) {
			xpEarned.value = Math.ceil(XP_PER_STAGE[props.currentChallenge.type] / 4)
			triggerXpPopup(xpEarned.value)
		}
	}
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

// Auto-advance meet cards; auto-skip other challenges after 3 s
watch(() => props.showingResult, (showing) => {
	if (showing && props.lastAnswerCorrect && props.currentChallenge?.type === 'meet') {
		xpEarned.value = XP_PER_STAGE.meet
		triggerXpPopup(xpEarned.value)
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
		}, 800)
	} else if (showing && props.currentChallenge?.type !== 'meet') {
		// Auto-skip: fill Next button with a gradient over AUTO_SKIP_DELAY_MS
		autoAdvancing.value = true
		autoSkipTimeoutId = setTimeout(() => {
			handleNext()
		}, AUTO_SKIP_DELAY_MS)
	} else if (!showing) {
		clearAutoSkipTimers()
	}
})

/**
 *
 * @param amount The XP amount to display
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

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

// Enter → submit typed answer (non-inputs) or advance when showing result
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

// 1-4 → select choice / face (recognize / pick-face)
useHotKey(['1', '2', '3', '4'], (e) => {
	if (props.showingResult || answered.value) {
		return
	}
	const idx = parseInt(e.key) - 1
	const type = props.currentChallenge?.type
	if (type === 'recognize' && props.currentChallenge?.options) {
		const visible = props.currentChallenge.options.filter((o) => !props.eliminatedOptions.includes(o))
		if (visible[idx] !== undefined) {
			handleChoice(visible[idx])
		}
	} else if (type === 'pick-face' && props.currentChallenge?.photoOptions) {
		const visible = props.currentChallenge.photoOptions.filter((m) => !props.eliminatedOptions.includes(m.name))
		if (visible[idx] !== undefined) {
			handleChoice(visible[idx].name)
		}
	}
})
</script>

<style scoped>
/* ── Outer shell ─────────────────────────────────*/
.game-screen {
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	background-color: var(--color-main-background);
	color: var(--color-main-text);
}

/* ── Header ──────────────────────────────────────*/
.game-header {
	flex-shrink: 0;
	padding: 10px 20px 12px;
	border-bottom: 1px solid var(--color-border);
}

/* ── Two-column body ─────────────────────────────*/
.game-body {
	flex: 1;
	min-height: 0;
	display: flex;
	overflow: hidden;
}

/* ── Left: photo card ────────────────────────────*/
.card-column {
	flex: 0 0 min(300px, 42%);
	display: flex;
	align-items: center;
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

/* ── Right: interaction ──────────────────────────*/
.challenge-column {
	flex: 1;
	min-width: 0;
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

/* ── Stage badge ─────────────────────────────────*/
.stage-tag {
	display: inline-flex;
	align-items: center;
	padding: 4px 14px;
	border-radius: var(--border-radius-pill);
	font-size: 0.78rem;
	font-weight: 700;
	letter-spacing: 0.05em;
	text-transform: uppercase;
}

.stage-tag.meet        { background: var(--color-primary-element); color: var(--color-primary-element-text); }

.stage-tag.recognize   { background: #9b59b6; color: #fff; }

.stage-tag.pick_face   { background: #16a085; color: #fff; }

.stage-tag.recall      { background: #e67e22; color: #fff; }

.stage-tag.type        { background: #e74c3c; color: #fff; }

/* ── Prompts ─────────────────────────────────────*/
.prompt {
	font-size: 1.1rem;
	font-weight: 600;
	color: var(--color-main-text);
	margin: 0;
}

.sub-prompt {
	font-size: 0.88rem;
	color: var(--color-text-maxcontrast);
	margin: 0;
}

/* ── Meet ────────────────────────────────────────*/
.meet-area {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

/* ── Multiple choice ─────────────────────────────*/
.choice-area {
	display: flex;
	flex-direction: column;
	gap: 14px;
}

.choice-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 10px;
}

.choice-btn {
	padding: 12px 10px;
	border: 2px solid var(--color-border-dark);
	border-radius: var(--border-radius-element);
	background: var(--color-main-background);
	color: var(--color-main-text);
	font-size: 0.88rem;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.15s ease;
	text-align: center;
	line-height: 1.3;
	margin: 0;
}

.choice-btn:hover:not(.disabled) {
	background: var(--color-background-hover);
	border-color: var(--color-primary-element);
}

.choice-btn.correct {
	background: var(--color-success);
	border-color: var(--color-element-success);
	color: var(--color-text-success);
}

.choice-btn.wrong {
	background: var(--color-error);
	border-color: var(--color-element-error);
	color: var(--color-text-error);
}

.choice-btn.disabled { cursor: default; }

.choice-btn.eliminated {
	opacity: 0.3;
	text-decoration: line-through;
	cursor: default;
}

/* ── Recall / Type ───────────────────────────────*/
.recall-area,
.type-area {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.masked-name {
	font-size: 1.3rem;
	font-weight: 700;
	color: var(--color-main-text);
	letter-spacing: 0.15em;
	font-family: 'Courier New', monospace;
	margin: 0;
}

.type-input-row {
	display: flex;
	gap: 8px;
}

.name-input {
	flex: 1;
	padding: 10px 14px;
	border: 2px solid var(--color-border-dark);
	border-radius: var(--border-radius-element);
	background: var(--color-main-background);
	color: var(--color-main-text);
	font-size: 1rem;
	font-weight: 500;
	outline: none;
	transition: border-color 0.15s ease;
}

.name-input::placeholder {
	color: var(--color-placeholder-dark);
}

.name-input:focus {
	border-color: var(--color-primary-element);
}

.name-input:disabled {
	opacity: 0.6;
}

.btn-submit {
	margin: 0;
	padding: 10px 18px;
	border: none;
	border-radius: var(--border-radius-element);
	background: var(--color-primary-element);
	color: var(--color-primary-element-text);
	font-size: 1.1rem;
	font-weight: 700;
	cursor: pointer;
	transition: background 0.15s ease;
	flex-shrink: 0;
}

.btn-submit:hover:not(:disabled) { background: var(--color-primary-element-hover); }

.btn-submit:disabled { opacity: 0.4; cursor: default; }

/* ── Hint ────────────────────────────────────────*/
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

/* ── Hint + skip row ─────────────────────────────*/
.hint-skip-row {
	display: flex;
	align-items: center;
	gap: 8px;
	flex-wrap: wrap;
	flex-shrink: 0;
}

/* Inline hint bubble (inside type-area) */
.hint-bubble--inline {
	font-family: 'Courier New', monospace;
	font-weight: 700;
	letter-spacing: 0.1em;
}

/* ── "I don't know" skip button ──────────────────*/
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

/* ── Keyboard shortcut labels ────────────────────*/
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

.key-hint {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 1.4em;
	height: 1.4em;
	margin-inline-end: 6px;
	border: 1px solid var(--color-border-dark);
	border-radius: 4px;
	font-size: 0.75em;
	font-weight: 700;
	opacity: 0.6;
	flex-shrink: 0;
	vertical-align: middle;
}

.face-key-hint {
	position: absolute;
	top: 6px;
	inset-inline-start: 6px;
	width: 22px;
	height: 22px;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(0, 0, 0, 0.55);
	color: #fff;
	border-radius: 5px;
	font-size: 0.72rem;
	font-weight: 700;
	z-index: 1;
}

/* ── Action area ─────────────────────────────────*/
.action-area {
	flex-shrink: 0;
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.result-msg {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 12px 16px;
	border-radius: var(--border-radius-element);
	font-size: 0.95rem;
	font-weight: 600;
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

/* ── Responsive: stack on narrow screens ─────────*/
@media (max-width: 680px) {
	.game-body {
		flex-direction: column;
		overflow-y: auto;
	}

	.card-column {
		flex: 0 0 auto;
		border-inline-end: none;
		border-bottom: 1px solid var(--color-border);
		padding: 14px 16px 12px;
	}

	.challenge-column {
		padding: 14px 16px 12px;
	}

	.flex-spacer {
		display: none;
	}

	.choice-grid {
		grid-template-columns: 1fr;
	}
}

/* ── Name badge (pick-face left column) ──────────*/
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

/* ── Pick-face photo grid ────────────────────────*/
.pick-face-area {
	display: flex;
	flex-direction: column;
	gap: 12px;
	flex: 1;
	min-height: 0;
	overflow: hidden;
}

.face-grid {
	display: flex;
	flex-direction: row;
	gap: 10px;
	flex: 1;
	min-height: 0;
}

.face-option {
	position: relative;
	border: 3px solid var(--color-border-dark);
	border-radius: var(--border-radius-container);
	overflow: hidden;
	background: var(--color-background-dark);
	cursor: pointer;
	padding: 0;
	min-height: 0;
	flex: 1;
	transition: border-color 0.15s ease, transform 0.12s ease;
	margin: 0;
}

.face-option:hover:not(.disabled) {
	border-color: var(--color-primary-element);
	transform: scale(1.03);
}

.face-option.correct {
	border-color: var(--color-element-success);
	box-shadow: 0 0 0 3px var(--color-success);
}

.face-option.wrong {
	border-color: var(--color-element-error);
	box-shadow: 0 0 0 3px var(--color-error);
}

.face-option.disabled { cursor: default; }

.face-option.eliminated {
	opacity: 0.25;
	cursor: default;
}

.face-option-img {
	width: 100%;
	height: 100%;
	object-fit: cover;
	object-position: center center;
	display: block;
}

.face-correct-label {
	position: absolute;
	bottom: 0;
	inset-inline: 0;
	background: var(--color-element-success);
	color: #fff;
	font-size: 0.72rem;
	font-weight: 700;
	padding: 4px 6px;
	text-align: center;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

/* ── Overlays ─────────────────────────────────────*/
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

/* ── Transitions ──────────────────────────────────*/
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

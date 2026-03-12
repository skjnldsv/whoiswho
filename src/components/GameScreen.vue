<!--
  - SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
  - SPDX-License-Identifier: AGPL-3.0-or-later
  -->
<template>
	<div class="game-screen">
		<!-- ── Header: progress bar ── -->
		<div class="game-header">
			<ProgressBar :level="progress.level"
				:xp="progress.xp"
				:progress="levelProgress"
				:streak="sessionStats.streak"
				:mastered="masteredCount"
				:total="totalCount"
				:lives="lives"
				:max-lives="maxLives" />
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
							<div class="name-badge-avatar">{{ currentChallenge.person.name.charAt(0) }}</div>
							<h2 class="name-badge-name">{{ currentChallenge.person.name }}</h2>
							<p class="name-badge-title">{{ currentChallenge.person.title }}</p>
							<p class="name-badge-dept">{{ currentChallenge.person.department }}</p>
						</div>
						<PersonCard v-else
							:person="currentChallenge.person"
							:show-name="currentChallenge.type === 'meet'"
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
					<div :key="currentChallenge.seq" class="input-area">
						<!-- Meet: see and remember -->
						<div v-if="currentChallenge.type === 'meet'" class="meet-area">
							<p class="prompt">Remember this person!</p>
							<p class="sub-prompt">Name, title, and department — then click Got it.</p>
						</div>

						<!-- Recognize: multiple choice -->
						<div v-else-if="currentChallenge.type === 'recognize'" class="choice-area">
							<p class="prompt">Who is this person?</p>
							<div class="choice-grid">
								<button v-for="option in currentChallenge.options"
									:key="option"
									class="choice-btn"
									:class="{
										correct: showingResult && option === currentChallenge.correctAnswer,
										wrong: showingResult && chosenAnswer === option && option !== currentChallenge.correctAnswer,
										disabled: showingResult,
									}"
									:disabled="showingResult"
									@click="handleChoice(option)">
									{{ option }}
								</button>
							</div>
						</div>

						<!-- Pick-face: choose the photo that matches the name -->
						<div v-else-if="currentChallenge.type === 'pick-face'" class="pick-face-area">
							<p class="prompt">Find this person's face:</p>
							<div class="face-grid">
								<button v-for="member in currentChallenge.photoOptions"
									:key="member.id"
									class="face-option"
									:class="{
										correct: showingResult && member.name === currentChallenge.correctAnswer,
										wrong: showingResult && chosenAnswer === member.name && member.name !== currentChallenge.correctAnswer,
										disabled: showingResult,
									}"
									:disabled="showingResult"
									@click="handleChoice(member.name)">
									<img :src="member.photo" :alt="showingResult ? member.name : ''" class="face-option-img" />
									<span v-if="showingResult && member.name === currentChallenge.correctAnswer" class="face-correct-label">✓ {{ member.name }}</span>
								</button>
							</div>
						</div>

						<!-- Recall: fill in blanks -->
						<div v-else-if="currentChallenge.type === 'recall'" class="recall-area">
							<p class="prompt">Complete the name:</p>
							<p class="masked-name">{{ currentChallenge.maskedName }}</p>
							<div class="type-input-row">
								<input ref="recallInput"
									v-model="typedAnswer"
									type="text"
									class="name-input"
									placeholder="Type the full name…"
									:disabled="showingResult"
									autocomplete="off"
									@keydown.enter="handleTypedAnswer">
								<button class="btn-submit"
									:disabled="showingResult || !typedAnswer.trim()"
									:aria-label="t('whoiswho', 'Submit answer')"
									@click="handleTypedAnswer">
									✓
								</button>
							</div>
						</div>

						<!-- Type: free recall -->
						<div v-else-if="currentChallenge.type === 'type'" class="type-area">
							<p class="prompt">Type this person's full name:</p>
							<div class="type-input-row">
								<input ref="typeInput"
									v-model="typedAnswer"
									type="text"
									class="name-input"
									placeholder="Full name…"
									:disabled="showingResult"
									autocomplete="off"
									@keydown.enter="handleTypedAnswer">
								<button class="btn-submit"
									:disabled="showingResult || !typedAnswer.trim()"
									:aria-label="t('whoiswho', 'Submit answer')"
									@click="handleTypedAnswer">
									✓
								</button>
							</div>
						</div>
					</div>
				</Transition>

				<!-- Hint -->
				<div v-if="hintText" class="hint-bubble">
					💡 {{ hintText }}
				</div>
				<button v-if="!showingResult && currentChallenge.type !== 'meet' && !hintText"
					class="btn-hint"
					type="tertiary"
					:disabled="progress.xp < 10"
					:title="progress.xp < 10 ? 'Need 10 XP for a hint' : 'Use hint (-10 XP)'"
					@click="requestHint">
					💡 Hint (-10 XP)
				</button>

				<!-- Spacer pushes action row to bottom -->
				<div class="flex-spacer" />

				<!-- ── Action bar: result + button ── -->
				<div class="action-area">
					<Transition name="fade">
						<div v-if="showingResult && currentChallenge.type !== 'meet'"
							class="result-msg"
							:class="lastAnswerCorrect ? 'result-correct' : 'result-wrong'">
							<span class="feedback-icon">{{ lastAnswerCorrect ? '✨' : '😕' }}</span>
							<span v-if="lastAnswerCorrect">Correct! +{{ xpEarned }} XP</span>
							<span v-else>It's <strong>{{ currentChallenge.correctAnswer }}</strong></span>
						</div>
					</Transition>
					<button v-if="currentChallenge.type === 'meet' && !showingResult"
						class="btn-action"
						type="primary"
						:disabled="answered"
						@click="handleMeet">
						Got it →
					</button>
					<button v-else-if="showingResult && currentChallenge.type !== 'meet'"
						class="btn-action"
						type="primary"
						@click="handleNext">
						{{ gameOver ? '📊 See Results' : 'Next →' }}
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
			<div v-for="i in 30" :key="i" class="confetti-piece" :style="confettiStyle(i)" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, useTemplateRef } from 'vue'
import { t } from '@nextcloud/l10n'
import type { Challenge } from '../composables/useGameEngine'
import type { GameProgress } from '../composables/useStorage'
import type { SessionStats } from '../composables/useGameEngine'
import PersonCard from './PersonCard.vue'
import ProgressBar from './ProgressBar.vue'

const props = defineProps<{
	currentChallenge: Challenge | null
	showingResult: boolean
	lastAnswerCorrect: boolean
	progress: GameProgress
	sessionStats: SessionStats
	lives: number
	maxLives: number
	masteredCount: number
	totalCount: number
	levelProgress: number
	gameOver: boolean
	hintText?: string | null
}>()

const emit = defineEmits<{
	answer: [value: string]
	next: []
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

// Strip diacritics for accent-agnostic comparison
function normalizeText(s: string): string {
	return s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

const xpEarned = ref(0)

const XP_PER_STAGE: Record<string, number> = {
	meet: 5,
	recognize: 15,
	'pick-face': 15,
	recall: 25,
	type: 40,
}

// Reset per-challenge state when a new challenge arrives
watch(() => props.currentChallenge, async () => {
	answered.value = false
	advancing.value = false
	typedAnswer.value = ''
	chosenAnswer.value = ''
	xpEarned.value = 0
	await nextTick()
	recallInput.value?.focus()
	typeInput.value?.focus()
})

// Watch for streak milestones
watch(() => props.sessionStats.streak, (streak) => {
	if (streak > 0 && streak % 5 === 0) {
		streakMilestone.value = streak
		setTimeout(() => { streakMilestone.value = 0 }, 2000)
	}
})

// Watch for mastery events
watch(() => props.sessionStats.newlyMastered, (list) => {
	if (list.length > 0) {
		showConfetti.value = true
		setTimeout(() => { showConfetti.value = false }, 3000)
	}
}, { deep: true })

function handleMeet() {
	if (answered.value) return
	answered.value = true
	emit('answer', 'ok')
}

function handleChoice(option: string) {
	if (answered.value) return
	answered.value = true
	chosenAnswer.value = option
	emit('answer', option)

	if (option === props.currentChallenge?.correctAnswer) {
		xpEarned.value = XP_PER_STAGE[props.currentChallenge.type]
		triggerXpPopup(xpEarned.value)
	}
}

function handleTypedAnswer() {
	if (!typedAnswer.value.trim() || answered.value) return
	answered.value = true
	emit('answer', typedAnswer.value)

	if (props.currentChallenge) {
		if (normalizeText(typedAnswer.value) === normalizeText(props.currentChallenge.correctAnswer)) {
			xpEarned.value = XP_PER_STAGE[props.currentChallenge.type]
			triggerXpPopup(xpEarned.value)
		}
	}
}

function handleNext() {
	if (advancing.value) return
	advancing.value = true
	if (props.gameOver) {
		emit('end')
	} else {
		emit('next')
	}
}

function requestHint() {
	emit('hint')
}

// Auto-advance meet cards after showing XP briefly
watch(() => props.showingResult, (showing) => {
	if (showing && props.lastAnswerCorrect && props.currentChallenge?.type === 'meet') {
		xpEarned.value = XP_PER_STAGE.meet
		triggerXpPopup(xpEarned.value)
		setTimeout(() => {
			if (advancing.value) return
			advancing.value = true
			if (props.gameOver) {
				emit('end')
			} else {
				emit('next')
			}
		}, 800)
	}
})

function triggerXpPopup(amount: number) {
	xpPopup.value = amount
	xpPopupKey.value++
	setTimeout(() => { xpPopup.value = 0 }, 1500)
}

function confettiStyle(i: number) {
	const colors = ['#f7971e', '#ffd200', '#0082c9', '#764ba2', '#2ecc71', '#e74c3c', '#3498db']
	return {
		left: Math.random() * 100 + '%',
		animationDelay: Math.random() * 0.5 + 's',
		animationDuration: (1.5 + Math.random() * 2) + 's',
		backgroundColor: colors[i % colors.length],
	}
}
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

.flex-spacer {
	flex: 1;
}

/* ── Stage badge ─────────────────────────────────*/
.stage-tag {
	display: inline-flex;
	align-items: center;
	padding: 4px 14px;
	border-radius: var(--border-radius-pill, 20px);
	font-size: 0.78rem;
	font-weight: 700;
	letter-spacing: 0.05em;
	text-transform: uppercase;
}

.stage-tag.meet        { background: var(--color-primary-element, #0082c9); color: var(--color-primary-element-text, #fff); }

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
	color: var(--color-text-lighter, var(--color-sub-text, #888));
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
	border: 2px solid var(--color-border);
	border-radius: var(--border-radius-large, 12px);
	background: var(--color-main-background);
	color: var(--color-main-text);
	font-size: 0.88rem;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.15s ease;
	text-align: center;
	line-height: 1.3;
}

.choice-btn:hover:not(.disabled) {
	background: var(--color-background-hover);
	border-color: var(--color-primary-element);
}

.choice-btn.correct {
	background: rgba(70, 186, 97, 0.12);
	border-color: var(--color-success, #46ba61);
	color: var(--color-success, #2ecc71);
}

.choice-btn.wrong {
	background: rgba(233, 50, 45, 0.08);
	border-color: var(--color-error, #e9322d);
	color: var(--color-error, #e9322d);
}

.choice-btn.disabled { cursor: default; }

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
	border: 2px solid var(--color-border);
	border-radius: var(--border-radius-large, 12px);
	background: var(--color-main-background);
	color: var(--color-main-text);
	font-size: 1rem;
	font-weight: 500;
	outline: none;
	transition: border-color 0.15s ease;
}

.name-input::placeholder {
	color: var(--color-placeholder-text, var(--color-text-lighter, #bbb));
}

.name-input:focus {
	border-color: var(--color-primary-element);
}

.name-input:disabled {
	opacity: 0.6;
}

.btn-submit {
	padding: 10px 18px;
	border: none;
	border-radius: var(--border-radius-large, 12px);
	background: var(--color-primary-element, #0082c9);
	color: var(--color-primary-element-text, #fff);
	font-size: 1.1rem;
	font-weight: 700;
	cursor: pointer;
	transition: opacity 0.15s ease;
	flex-shrink: 0;
}

.btn-submit:hover:not(:disabled) { opacity: 0.88; }

.btn-submit:disabled { opacity: 0.4; cursor: default; }

/* ── Hint ────────────────────────────────────────*/
.hint-bubble {
	background: var(--color-background-dark, rgba(0, 0, 0, 0.05));
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-large, 12px);
	padding: 10px 14px;
	color: var(--color-main-text);
	font-size: 0.85rem;
	flex-shrink: 0;
}

.btn-hint {
	padding: 6px 14px;
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius, 8px);
	background: transparent;
	color: var(--color-text-lighter, #888);
	font-size: 0.78rem;
	cursor: pointer;
	transition: all 0.15s ease;
	align-self: flex-start;
	flex-shrink: 0;
}

.btn-hint:hover:not(:disabled) {
	background: var(--color-background-hover);
	color: var(--color-main-text);
}

.btn-hint:disabled { opacity: 0.4; cursor: default; }

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
	border-radius: var(--border-radius-large, 12px);
	font-size: 0.95rem;
	font-weight: 600;
}

.result-correct {
	background: rgba(70, 186, 97, 0.1);
	border: 1px solid var(--color-success, #46ba61);
	color: var(--color-success, #2ecc71);
}

.result-wrong {
	background: rgba(233, 50, 45, 0.08);
	border: 1px solid var(--color-error, #e9322d);
	color: var(--color-error, #e9322d);
}

.feedback-icon {
	font-size: 1.3rem;
	flex-shrink: 0;
}

/* Primary action button — full width, NC-styled */
.btn-action {
	width: 100%;
	min-height: 48px;
	padding: 12px 24px;
	border: none;
	border-radius: var(--border-radius-pill, var(--border-radius-large, 24px));
	background: var(--color-primary-element, #0082c9);
	color: var(--color-primary-element-text, #fff);
	font-size: 1.05rem;
	font-weight: 700;
	cursor: pointer;
	transition: opacity 0.15s ease;
	display: flex;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
}

.btn-action:hover:not(:disabled) { opacity: 0.9; }

.btn-action:disabled { opacity: 0.45; cursor: default; }

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
	background: var(--color-background-dark, rgba(0,0,0,0.04));
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-large, 16px);
	width: 100%;
	box-sizing: border-box;
	text-align: center;
}

.name-badge-avatar {
	width: 64px;
	height: 64px;
	border-radius: 50%;
	background: var(--color-primary-element, #0082c9);
	color: var(--color-primary-element-text, #fff);
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
	color: var(--color-text-lighter, #888);
}

.name-badge-dept {
	margin: 0;
	font-size: 0.78rem;
	color: var(--color-text-lighter, #bbb);
	text-transform: uppercase;
	letter-spacing: 0.06em;
}

/* ── Pick-face photo grid ────────────────────────*/
.pick-face-area {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.face-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 10px;
}

.face-option {
	position: relative;
	border: 3px solid var(--color-border);
	border-radius: var(--border-radius-large, 12px);
	overflow: hidden;
	background: var(--color-background-dark, rgba(0,0,0,0.04));
	cursor: pointer;
	padding: 0;
	aspect-ratio: 1;
	transition: border-color 0.15s ease, transform 0.12s ease;
}

.face-option:hover:not(.disabled) {
	border-color: var(--color-primary-element);
	transform: scale(1.03);
}

.face-option.correct {
	border-color: var(--color-success, #46ba61);
	box-shadow: 0 0 0 3px rgba(70, 186, 97, 0.25);
}

.face-option.wrong {
	border-color: var(--color-error, #e9322d);
	box-shadow: 0 0 0 3px rgba(233, 50, 45, 0.2);
}

.face-option.disabled { cursor: default; }

.face-option-img {
	width: 100%;
	height: 100%;
	object-fit: cover;
	display: block;
}

.face-correct-label {
	position: absolute;
	bottom: 0;
	inset-inline: 0;
	background: rgba(70, 186, 97, 0.9);
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
	color: var(--color-primary-element, #0082c9);
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
	color: var(--color-error, #e74c3c);
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

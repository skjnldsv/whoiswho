<!--
  - SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
  - SPDX-License-Identifier: AGPL-3.0-or-later
  -->
<template>
	<!-- Meet: see and remember -->
	<div v-if="challenge.type === 'meet'" class="meet-area">
		<p class="prompt">
			Remember this person!
		</p>
		<p class="sub-prompt">
			Name, title, and department — then click Got it.
		</p>
	</div>

	<!-- Recognize: multiple choice -->
	<div v-else-if="challenge.type === 'recognize'" class="choice-area">
		<p class="prompt">
			Who is this person?
		</p>
		<div class="choice-grid">
			<button
				v-for="option in challenge.options"
				:key="option"
				class="choice-btn"
				:class="{
					correct: showingResult && option === challenge.correctAnswer,
					wrong: showingResult && chosenAnswer === option && option !== challenge.correctAnswer,
					disabled: showingResult,
					eliminated: !showingResult && eliminatedOptions.includes(option),
					'choice-focused': !showingResult && !eliminatedOptions.includes(option) && focusedKey === option,
				}"
				:disabled="showingResult || eliminatedOptions.includes(option)"
				@click="handleChoiceClick(option)">
				{{ option }}
			</button>
		</div>
	</div>

	<!-- Pick-face: choose the photo that matches the name -->
	<div v-else-if="challenge.type === 'pick-face'" class="pick-face-area">
		<p class="prompt">
			Find this person's face:
		</p>
		<div class="face-grid">
			<button
				v-for="member in challenge.photoOptions"
				:key="member.id"
				class="face-option"
				:class="{
					correct: showingResult && member.name === challenge.correctAnswer,
					wrong: showingResult && chosenAnswer === member.name && member.name !== challenge.correctAnswer,
					disabled: showingResult,
					eliminated: !showingResult && eliminatedOptions.includes(member.name),
					'choice-focused': !showingResult && !eliminatedOptions.includes(member.name) && focusedKey === member.name,
				}"
				:disabled="showingResult || eliminatedOptions.includes(member.name)"
				@click="handleChoiceClick(member.name)">
				<img :src="member.photo" :alt="showingResult ? member.name : ''" class="face-option-img">
				<span v-if="showingResult && member.name === challenge.correctAnswer" class="face-correct-label">✓ {{ member.name }}</span>
			</button>
		</div>
	</div>

	<!-- Recall: fill in blanks -->
	<div v-else-if="challenge.type === 'recall'" class="recall-area">
		<p class="prompt">
			Complete the name:
		</p>
		<p class="masked-name">
			{{ showingResult ? challenge.correctAnswer : (revealedMask || challenge.maskedName) }}
		</p>
		<div v-if="!showingResult" class="type-input-row">
			<input
				ref="recallInput"
				v-model="typedAnswer"
				type="text"
				class="name-input"
				placeholder="Type the full name…"
				autocomplete="off"
				@keydown.enter="handleTypedSubmit">
			<button
				class="btn-submit"
				:disabled="!typedAnswer.trim()"
				:aria-label="t('whoiswho', 'Submit answer')"
				@click="handleTypedSubmit">
				✓
			</button>
		</div>
	</div>

	<!-- Type: free recall -->
	<div v-else-if="challenge.type === 'type'" class="type-area">
		<p class="prompt">
			Type this person's full name:
		</p>
		<template v-if="showingResult">
			<p class="masked-name">
				{{ challenge.correctAnswer }}
			</p>
		</template>
		<template v-else>
			<div v-if="revealedMask" class="mask-hint">
				🔤 {{ revealedMask }}
			</div>
			<div class="type-input-row">
				<input
					ref="typeInput"
					v-model="typedAnswer"
					type="text"
					class="name-input"
					placeholder="Full name…"
					autocomplete="off"
					@keydown.enter="handleTypedSubmit">
				<button
					class="btn-submit"
					:disabled="!typedAnswer.trim()"
					:aria-label="t('whoiswho', 'Submit answer')"
					@click="handleTypedSubmit">
					✓
				</button>
			</div>
		</template>
	</div>
</template>

<script setup lang="ts">
import type { Challenge } from '../composables/useGameEngine.ts'

import { t } from '@nextcloud/l10n'
import { useHotKey } from '@nextcloud/vue'
import { nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'

const props = defineProps<{
	challenge: Challenge
	showingResult: boolean
	eliminatedOptions: string[]
	revealedMask: string | null
}>()

const emit = defineEmits<{
	answer: [value: string]
}>()

const typedAnswer = ref('')
const chosenAnswer = ref('')
// Prevent double-emission before showingResult prop updates
const emitted = ref(false)
// Currently keyboard-focused option key for recognize/pick-face navigation
const focusedKey = ref<string | null>(null)

const recallInput = useTemplateRef<HTMLInputElement>('recallInput')
const typeInput = useTemplateRef<HTMLInputElement>('typeInput')

/**
 * Returns the visible (non-eliminated) option keys for the current challenge.
 */
function getVisibleKeys(): string[] {
	if (props.challenge.type === 'recognize' && props.challenge.options) {
		return props.challenge.options.filter((o) => !props.eliminatedOptions.includes(o))
	}
	if (props.challenge.type === 'pick-face' && props.challenge.photoOptions) {
		return props.challenge.photoOptions
			.filter((m) => !props.eliminatedOptions.includes(m.name))
			.map((m) => m.name)
	}
	return []
}

/**
 * Initialize keyboard focus to the first visible option for choice challenges.
 */
function initChoiceFocus() {
	const keys = getVisibleKeys()
	focusedKey.value = keys.length > 0 ? keys[0] : null
}

/**
 * Focus whichever text input is currently rendered (recall or type challenge)
 */
async function focusInput() {
	await nextTick()
	recallInput.value?.focus()
	typeInput.value?.focus()
}

// Reset internal state and focus the text input on each new challenge
watch(() => props.challenge, () => {
	typedAnswer.value = ''
	chosenAnswer.value = ''
	emitted.value = false
	initChoiceFocus()
	focusInput()
})

// Auto-focus the text input on initial mount
onMounted(() => {
	initChoiceFocus()
	focusInput()
})

/**
 *
 * @param option The selected option text or photo owner name
 */
function handleChoiceClick(option: string) {
	if (emitted.value || props.showingResult) {
		return
	}
	emitted.value = true
	chosenAnswer.value = option
	emit('answer', option)
}

/**
 *
 */
function handleTypedSubmit() {
	if (!typedAnswer.value.trim() || emitted.value || props.showingResult) {
		return
	}
	emitted.value = true
	emit('answer', typedAnswer.value)
}

// 1–4 → select choice / face (recognize / pick-face)
useHotKey(['1', '2', '3', '4'], (e) => {
	if (props.showingResult || emitted.value) {
		return
	}
	const idx = parseInt(e.key) - 1
	if (props.challenge.type === 'recognize' && props.challenge.options) {
		const visible = props.challenge.options.filter((o) => !props.eliminatedOptions.includes(o))
		if (visible[idx] !== undefined) {
			handleChoiceClick(visible[idx])
		}
	} else if (props.challenge.type === 'pick-face' && props.challenge.photoOptions) {
		const visible = props.challenge.photoOptions.filter((m) => !props.eliminatedOptions.includes(m.name))
		if (visible[idx] !== undefined) {
			handleChoiceClick(visible[idx].name)
		}
	}
})

/**
 * Move keyboard focus by `direction` steps through visible options, wrapping around.
 * If the current focusedKey is no longer visible (e.g. was eliminated), indexOf
 * returns -1, which causes navigation to start cleanly from either end.
 *
 * @param direction +1 for next, -1 for previous
 */
function navigateOptions(direction: 1 | -1) {
	const keys = getVisibleKeys()
	if (keys.length === 0) {
		return
	}
	// indexOf returns -1 when focusedKey is missing/eliminated; navigation still
	// wraps correctly because -1 + 1 = 0 (first) and -1 - 1 = -2 < 0 → last.
	const currentIdx = focusedKey.value !== null ? keys.indexOf(focusedKey.value) : -1
	let nextIdx = currentIdx + direction
	if (nextIdx < 0) {
		nextIdx = keys.length - 1
	} else if (nextIdx >= keys.length) {
		nextIdx = 0
	}
	focusedKey.value = keys[nextIdx]
}

// Arrow keys → navigate between options (recognize / pick-face only)
useHotKey(['ArrowLeft', 'ArrowUp'], (e) => {
	if (props.showingResult || emitted.value) {
		return
	}
	if (props.challenge.type !== 'recognize' && props.challenge.type !== 'pick-face') {
		return
	}
	e.preventDefault()
	navigateOptions(-1)
})

useHotKey(['ArrowRight', 'ArrowDown'], (e) => {
	if (props.showingResult || emitted.value) {
		return
	}
	if (props.challenge.type !== 'recognize' && props.challenge.type !== 'pick-face') {
		return
	}
	e.preventDefault()
	navigateOptions(1)
})

// Enter → confirm the keyboard-focused option (recognize / pick-face only)
useHotKey((e) => e.key === 'Enter', (e) => {
	if (props.showingResult || emitted.value) {
		return
	}
	if (props.challenge.type !== 'recognize' && props.challenge.type !== 'pick-face') {
		return
	}
	if (focusedKey.value === null) {
		return
	}
	e.preventDefault()
	handleChoiceClick(focusedKey.value)
})
</script>

<style scoped>
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

.choice-btn.choice-focused:not(.disabled):not(.eliminated) {
	border-color: var(--color-primary-element);
	background: var(--color-background-hover);
	outline: 2px solid var(--color-primary-element);
	outline-offset: 1px;
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
	align-items: center;
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
	height: 44px !important;
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
	width: 44px !important;
	height: 44px !important;
}

.btn-submit:hover:not(:disabled) { background: var(--color-primary-element-hover); }

.btn-submit:disabled { opacity: 0.4; cursor: default; }

/* Inline mask hint for the type challenge */
.mask-hint {
	background: var(--color-background-dark);
	border: 1px solid var(--color-border-dark);
	border-radius: var(--border-radius-container);
	padding: 10px 14px;
	color: var(--color-main-text);
	font-size: 0.85rem;
	font-family: 'Courier New', monospace;
	font-weight: 700;
	letter-spacing: 0.1em;
}

/* ── Pick-face photo grid ────────────────────────*/
.pick-face-area {
	display: flex;
	flex-direction: column;
	gap: 12px;
	flex: 1;
	min-height: 0;
	overflow: hidden;
	padding: 4px;
}

.face-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
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

.face-option.choice-focused:not(.disabled):not(.eliminated) {
	border-color: var(--color-primary-element);
	box-shadow: 0 0 0 3px var(--color-primary-element);
	transform: scale(1.03);
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

/* ── Responsive ──────────────────────────────────*/
@media (max-width: 680px) {
	.choice-grid {
		grid-template-columns: 1fr;
	}
}
</style>

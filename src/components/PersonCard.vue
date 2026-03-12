<!--
  - SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
  - SPDX-License-Identifier: AGPL-3.0-or-later
  -->
<template>
	<div class="person-card" :class="{ 'card-correct': correct, 'card-wrong': wrong, 'card-shake': wrong }">
		<div class="photo-frame">
			<img
				:src="person.photo"
				:alt="showInfo ? person.name : 'Team member'"
				class="photo"
				@error="onImgError">
			<div v-if="fallbackInitials" class="photo-fallback">
				{{ fallbackInitials }}
			</div>
		</div>
		<Transition name="info-slide">
			<div v-if="showInfo" class="card-info">
				<h3 class="name">
					{{ person.name }}
				</h3>
				<p class="title">
					{{ person.title }}
				</p>
				<span class="dept-badge">{{ person.department }}</span>
			</div>
		</Transition>
	</div>
</template>

<script setup lang="ts">
import type { TeamMember } from '../composables/useGameEngine.ts'

import { computed, ref } from 'vue'

const props = defineProps<{
	person: TeamMember
	showName?: boolean
	correct?: boolean
	wrong?: boolean
}>()

const imgFailed = ref(false)

/** Show name+info when explicitly requested (meet), or when result is revealed */
const showInfo = computed(() => props.showName || props.correct || props.wrong)

const fallbackInitials = computed(() => {
	if (!imgFailed.value) {
		return null
	}
	return props.person.name
		.split(' ')
		.map((p) => p[0])
		.join('')
		.substring(0, 2)
		.toUpperCase()
})

/**
 *
 */
function onImgError() {
	imgFailed.value = true
}
</script>

<style scoped>
/* ── Card shell ──────────────────────────────────────────────*/
.person-card {
	width: min(220px, 90%);
	margin: 0 auto;
	border-radius: var(--border-radius-container-large);
	background: var(--color-primary-element);
	box-shadow: 0 4px 24px var(--color-box-shadow);
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 24px 20px 20px;
	gap: 16px;
	transition: box-shadow 0.3s ease;
	overflow: hidden;
	flex-shrink: 0;
}

.card-correct {
	box-shadow: 0 0 0 4px var(--color-element-success), 0 8px 32px var(--color-success);
}

.card-wrong {
	box-shadow: 0 0 0 4px var(--color-element-error), 0 8px 32px var(--color-error);
}

/* ── Avatar ──────────────────────────────────────────────────*/
.photo-frame {
	width: min(150px, 38vw);
	height: min(150px, 38vw);
	border-radius: 50%;
	overflow: hidden;
	border: 4px solid white;
	flex-shrink: 0;
	position: relative;
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	box-shadow: 0 2px 16px rgba(0, 0, 0, 0.25);
}

.photo {
	width: 100%;
	height: 100%;
	object-fit: cover;
	display: block;
}

.photo-fallback {
	position: absolute;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 48px;
	font-weight: 700;
	color: white;
}

/* ── Info panel (slides up on reveal) ───────────────────────*/
.card-info {
	width: 100%;
	text-align: center;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 6px;
}

.name {
	margin: 0;
	font-size: clamp(1rem, 2.5vw, 1.25rem);
	font-weight: 700;
	color: white;
	line-height: 1.3;
	text-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}

.title {
	margin: 0;
	font-size: clamp(0.78rem, 2vw, 0.88rem);
	color: rgba(255, 255, 255, 0.85);
	line-height: 1.4;
}

.dept-badge {
	display: inline-block;
	padding: 4px 12px;
	border-radius: var(--border-radius-pill);
	background: rgba(255, 255, 255, 0.2);
	color: white;
	font-size: 0.72rem;
	font-weight: 600;
	letter-spacing: 0.03em;
	margin-top: 2px;
}

/* ── Info slide-up transition ────────────────────────────────*/
.info-slide-enter-active {
	transition: opacity 0.35s ease, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.info-slide-leave-active {
	transition: opacity 0.2s ease, transform 0.2s ease;
}

.info-slide-enter-from {
	opacity: 0;
	transform: translateY(20px);
}

.info-slide-leave-to {
	opacity: 0;
	transform: translateY(10px);
}

/* ── Shake on wrong ──────────────────────────────────────────*/
.card-shake {
	animation: cardShake 0.45s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
}

@keyframes cardShake {
	0%,
	100% { transform: translateX(0); }
	15%  { transform: translateX(-8px) rotate(-1deg); }
	30%  { transform: translateX(8px) rotate(1deg); }
	45%  { transform: translateX(-6px) rotate(-0.5deg); }
	60%  { transform: translateX(6px) rotate(0.5deg); }
	75%  { transform: translateX(-3px); }
	90%  { transform: translateX(3px); }
}
</style>

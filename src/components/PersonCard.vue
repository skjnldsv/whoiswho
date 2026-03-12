<template>
	<div class="person-card" :class="{ 'card-flip': flipped, 'card-correct': correct, 'card-wrong': wrong }">
		<div class="card-inner">
			<div class="card-front">
				<div class="photo-frame">
					<img :src="person.photo"
						:alt="showName ? person.name : 'Team member'"
						class="photo"
						@error="onImgError">
					<div v-if="fallbackInitials" class="photo-fallback">
						{{ fallbackInitials }}
					</div>
				</div>
				<div v-if="showName" class="card-info">
					<h3 class="name">{{ person.name }}</h3>
					<p class="title">{{ person.title }}</p>
					<span class="dept-badge">{{ person.department }}</span>
				</div>
			</div>
			<div class="card-back">
				<div class="photo-frame small">
					<img :src="person.photo" :alt="person.name" class="photo" @error="onImgError">
				</div>
				<h3 class="name">{{ person.name }}</h3>
				<p class="title">{{ person.title }}</p>
				<span class="dept-badge">{{ person.department }}</span>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { TeamMember } from '../composables/useGameEngine'

const props = defineProps<{
	person: TeamMember
	showName?: boolean
	flipped?: boolean
	correct?: boolean
	wrong?: boolean
}>()

const imgFailed = ref(false)

const fallbackInitials = computed(() => {
	if (!imgFailed.value) return null
	return props.person.name
		.split(' ')
		.map(p => p[0])
		.join('')
		.substring(0, 2)
		.toUpperCase()
})

function onImgError() {
	imgFailed.value = true
}
</script>

<style scoped>
.person-card {
	perspective: 800px;
	width: min(220px, 90%);
	height: min(300px, 44vh);
	margin: 0 auto;
	flex-shrink: 0;
}

.card-inner {
	position: relative;
	width: 100%;
	height: 100%;
	transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
	transform-style: preserve-3d;
}

.card-flip .card-inner {
	transform: rotateY(180deg);
}

.card-front,
.card-back {
	position: absolute;
	inset: 0;
	backface-visibility: hidden;
	border-radius: var(--border-radius-large, 16px);
	background: var(--whw-card-bg, var(--color-main-background, #fff));
	border: 1px solid var(--color-border, rgba(0,0,0,0.1));
	box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 16px;
	overflow: hidden;
}

.card-back {
	transform: rotateY(180deg);
	justify-content: center;
	gap: 12px;
}

.card-correct .card-inner {
	box-shadow: 0 0 0 4px #2ecc71, 0 8px 32px rgba(46, 204, 113, 0.3);
	border-radius: 20px;
}

.card-wrong .card-inner {
	box-shadow: 0 0 0 4px #e74c3c, 0 8px 32px rgba(231, 76, 60, 0.3);
	border-radius: 20px;
}

.photo-frame {
	width: min(150px, 38vw);
	height: min(150px, 38vw);
	border-radius: 50%;
	overflow: hidden;
	border: 4px solid rgba(102, 126, 234, 0.4);
	flex-shrink: 0;
	position: relative;
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.photo-frame.small {
	width: min(80px, 22vw);
	height: min(80px, 22vw);
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

.card-info {
	text-align: center;
	margin-top: 10px;
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 4px;
	min-height: 0;
	overflow: hidden;
}

.name {
	margin: 0;
	font-size: clamp(0.95rem, 2.5vw, 1.2rem);
	font-weight: 700;
	color: var(--whw-card-text, #1a1a2e);
	line-height: 1.3;
	text-align: center;
}

.title {
	margin: 0;
	font-size: clamp(0.75rem, 2vw, 0.85rem);
	color: var(--whw-card-title, #666);
	line-height: 1.4;
	text-align: center;
}

.dept-badge {
	display: inline-block;
	padding: 3px 10px;
	border-radius: var(--border-radius-pill, 20px);
	background: var(--color-primary-element, #0082c9);
	color: var(--color-primary-element-text, #fff);
	font-size: 0.72rem;
	font-weight: 600;
	letter-spacing: 0.02em;
}
</style>

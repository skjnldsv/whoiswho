/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { ref, computed } from 'vue'
import axios from '@nextcloud/axios'
import { generateOcsUrl } from '@nextcloud/router'
import { levenshtein, normalizeText } from '../utils/strings'
import {
loadProgress,
saveProgress,
getPersonProgress,
type GameProgress,
type PersonProgress,
} from './useStorage'

export interface TeamMember {
id: number
name: string
title: string
department: string
photo: string
}

// Challenge types matching the 4 stages
export type ChallengeType = 'meet' | 'recognize' | 'pick-face' | 'recall' | 'type'

export interface Challenge {
seq: number // monotonic counter — always changes, so Vue's Transition always animates
type: ChallengeType
person: TeamMember
options?: string[] // for recognize: pick name from list
photoOptions?: TeamMember[] // for pick-face: pick photo from grid
maskedName?: string // for recall stage
correctAnswer: string
}

export interface SessionStats {
answered: number
correct: number
wrong: number
streak: number
bestStreak: number
xpEarned: number
newlyMastered: string[]
}

// Spaced repetition intervals (ms)
const INTERVALS = [
0, // stage 0: unseen
0, // stage 1: meet — immediate
30_000, // stage 2: recognize — 30s
120_000, // stage 3: recall — 2min
600_000, // stage 4: mastered — 10min
]

export const XP_PER_STAGE: Record<ChallengeType, number> = {
meet: 5,
recognize: 15,
'pick-face': 15,
recall: 25,
type: 40,
}

const STAGE_TO_TYPE: ChallengeType[] = ['meet', 'recognize', 'recognize', 'recall', 'type']

const PLACEHOLDER_PHOTO = 'https://nextcloud.com/c/themes/nextcloud-theme/dist/img/person.jpg'

// Pool size — how many people we juggle at once
const ACTIVE_POOL_SIZE = 6

// Close-answer tuning
const CLOSE_ANSWER_THRESHOLD = 2 // max Levenshtein distance to be "close"
export const CLOSE_ANSWER_XP_DIVISOR = 4 // close answers earn 1/4 of full XP

// Second-hint reveal tuning
const REVEAL_MIN_COUNT = 2 // minimum letters to reveal
const REVEAL_FRACTION = 1 / 3 // fraction of hidden letters to reveal

// Monotonic counter — ensures Vue's Transition always sees a new key even when person+type stays the same
let challengeSeq = 0

// OCS response envelope
interface OcsResponse<T> {
ocs: { data: T }
}

export function useGameEngine() {
const progress = ref<GameProgress>(loadProgress())
const currentChallenge = ref<Challenge | null>(null)
const sessionStats = ref<SessionStats>({
answered: 0,
correct: 0,
wrong: 0,
streak: 0,
bestStreak: 0,
xpEarned: 0,
newlyMastered: [],
})
const lives = ref(3)
const maxLives = 3
const gameOver = ref(false)
const showingResult = ref(false)
const lastAnswerCorrect = ref(false)
const lastAnswerClose = ref(false)
// Track last shown person to avoid showing the same person twice in a row
const lastPersonId = ref<number | null>(null)

// Runtime team data — fetched from PHP backend on first load
const allMembersRaw = ref<TeamMember[]>([])
const loading = ref(true)
const loadError = ref(false)

axios.get<OcsResponse<TeamMember[]>>(generateOcsUrl('apps/whoiswho/team'))
.then(({ data }) => { allMembersRaw.value = data.ocs.data })
.catch(() => { loadError.value = true })
.finally(() => { loading.value = false })

const allMembers = computed(() =>
allMembersRaw.value.filter(m => m.photo && m.name && m.photo !== PLACEHOLDER_PHOTO),
)

const masteredCount = computed(() => {
return allMembers.value.filter(m => {
const p = progress.value.people[m.id]
return p && p.stage >= 4
}).length
})

const totalCount = computed(() => allMembers.value.length)

const levelProgress = computed(() => {
const xpForLevel = progress.value.level * 100
return Math.min((progress.value.xp % xpForLevel) / xpForLevel, 1)
})

function startSession() {
sessionStats.value = {
answered: 0,
correct: 0,
wrong: 0,
streak: 0,
bestStreak: 0,
xpEarned: 0,
newlyMastered: [],
}
lives.value = maxLives
gameOver.value = false
progress.value.sessionsPlayed++
progress.value.lastPlayed = Date.now()
saveProgress(progress.value)
nextChallenge()
}

function pickNextPerson(): TeamMember | null {
const now = Date.now()
const members = allMembers.value

if (members.length === 0) return null

const unseen: TeamMember[] = []
const dueForReview: { member: TeamMember; priority: number }[] = []
const active: { member: TeamMember; pp: PersonProgress }[] = []

for (const m of members) {
const pp = progress.value.people[m.id]
if (!pp || pp.stage === 0) {
unseen.push(m)
} else if (pp.stage >= 4) {
if (now >= pp.nextReview) {
dueForReview.push({ member: m, priority: now - pp.nextReview })
}
} else {
active.push({ member: m, pp })
}
}

// Helper: prefer members that aren't the last-shown person
function preferNotLast(arr: TeamMember[]): TeamMember[] {
const filtered = arr.filter(m => m.id !== lastPersonId.value)
return filtered.length > 0 ? filtered : arr
}

const overdue = active
.filter(a => now >= a.pp.nextReview)
.sort((a, b) => a.pp.nextReview - b.pp.nextReview)

let result: TeamMember | null = null

if (overdue.length > 0) {
const withErrors = overdue.filter(a => a.pp.totalWrong > a.pp.totalCorrect)
if (withErrors.length > 0) {
const pool = preferNotLast(withErrors.map(a => a.member))
result = pool[Math.floor(Math.random() * pool.length)]
} else {
const pool = preferNotLast(overdue.map(a => a.member))
result = pool[0]
}
} else if (active.length < ACTIVE_POOL_SIZE && unseen.length > 0) {
const pool = preferNotLast(unseen)
result = pool[Math.floor(Math.random() * pool.length)]
} else if (active.length > 0) {
active.sort((a, b) => a.pp.nextReview - b.pp.nextReview)
const pool = preferNotLast(active.map(a => a.member))
result = pool[0]
} else if (dueForReview.length > 0) {
dueForReview.sort((a, b) => b.priority - a.priority)
const pool = preferNotLast(dueForReview.map(a => a.member))
result = pool[0]
} else if (unseen.length > 0) {
const pool = preferNotLast(unseen)
result = pool[Math.floor(Math.random() * pool.length)]
} else {
const allWithProgress = members
.map(m => ({ member: m, pp: progress.value.people[m.id] }))
.filter(a => a.pp)
.sort((a, b) => a.pp.lastSeen - b.pp.lastSeen)

result = allWithProgress.length > 0 ? allWithProgress[0].member : members[0]
}

if (result) lastPersonId.value = result.id
return result
}

function generateMaskedName(name: string): string {
const parts = name.split(' ')
return parts.map((part, i) => {
if (i === 0) {
return part[0] + part.slice(1).replace(/[a-zA-ZÀ-ÿ]/g, '_')
}
if (part.length <= 2) return part
return part[0] + part.slice(1).replace(/[a-zA-ZÀ-ÿ]/g, '_')
}).join(' ')
}

function getRandomOptions(correct: TeamMember, count: number): string[] {
const others = allMembers.value.filter(m => m.id !== correct.id)
const shuffled = others.sort(() => Math.random() - 0.5).slice(0, count - 1)
const options = [...shuffled.map(m => m.name), correct.name]
return options.sort(() => Math.random() - 0.5)
}

function getRandomPhotoOptions(correct: TeamMember, count: number): TeamMember[] {
const others = allMembers.value.filter(m => m.id !== correct.id)
const shuffled = others.sort(() => Math.random() - 0.5).slice(0, count - 1)
return [...shuffled, correct].sort(() => Math.random() - 0.5)
}

function buildChallenge(person: TeamMember): Challenge {
const pp = getPersonProgress(progress.value, person.id)
let type: ChallengeType = STAGE_TO_TYPE[Math.min(pp.stage, 4)]

// At recognize stage, randomly alternate between name-pick and face-pick
if (type === 'recognize' && allMembers.value.length >= 4) {
type = Math.random() < 0.5 ? 'recognize' : 'pick-face'
}

const challenge: Challenge = {
seq: ++challengeSeq,
type,
person,
correctAnswer: person.name,
}

if (type === 'recognize') {
challenge.options = getRandomOptions(person, 4)
} else if (type === 'pick-face') {
challenge.photoOptions = getRandomPhotoOptions(person, 4)
} else if (type === 'recall') {
challenge.maskedName = generateMaskedName(person.name)
}

return challenge
}

function nextChallenge() {
if (gameOver.value) return

const person = pickNextPerson()
if (!person) {
gameOver.value = true
return
}

showingResult.value = false
currentChallenge.value = buildChallenge(person)
}

function submitAnswer(answer: string): boolean {
if (!currentChallenge.value) return false

const challenge = currentChallenge.value
const pp = getPersonProgress(progress.value, challenge.person.id)
const now = Date.now()
const isMeet = challenge.type === 'meet'

const normalizedAnswer = normalizeText(answer)
const normalizedCorrect = normalizeText(challenge.correctAnswer)
const isCorrect = isMeet || normalizedAnswer === normalizedCorrect
// A "close" answer has Levenshtein distance ≤ 2 (catches 1-2 char typos)
const isClose = !isCorrect && !isMeet && levenshtein(normalizedAnswer, normalizedCorrect) <= CLOSE_ANSWER_THRESHOLD

pp.lastSeen = now
sessionStats.value.answered++
progress.value.totalAnswered++

if (isCorrect) {
pp.totalCorrect++
pp.correctStreak++
pp.stage = Math.min(pp.stage + 1, 4)
pp.nextReview = now + INTERVALS[pp.stage]

progress.value.totalCorrect++
sessionStats.value.correct++
sessionStats.value.streak++

const xp = XP_PER_STAGE[challenge.type]
progress.value.xp += xp
sessionStats.value.xpEarned += xp

if (sessionStats.value.streak > sessionStats.value.bestStreak) {
sessionStats.value.bestStreak = sessionStats.value.streak
}
if (sessionStats.value.streak > progress.value.bestStreak) {
progress.value.bestStreak = sessionStats.value.streak
}
progress.value.currentStreak = sessionStats.value.streak

const xpForLevel = progress.value.level * 100
if (progress.value.xp >= xpForLevel) {
progress.value.level++
}

if (pp.stage === 4) {
sessionStats.value.newlyMastered.push(challenge.person.name)
}
} else if (isClose) {
// Close answer: give ¼ XP, don't penalize stage or life (honest near-miss)
pp.totalWrong++
pp.correctStreak = 0
pp.nextReview = now + 30_000 // retry soon

sessionStats.value.wrong++
sessionStats.value.streak = 0
progress.value.currentStreak = 0

const partialXp = Math.ceil(XP_PER_STAGE[challenge.type] / CLOSE_ANSWER_XP_DIVISOR)
progress.value.xp += partialXp
sessionStats.value.xpEarned += partialXp

const xpForLevelClose = progress.value.level * 100
if (progress.value.xp >= xpForLevelClose) {
progress.value.level++
}
} else {
pp.totalWrong++
pp.correctStreak = 0
pp.stage = Math.max(pp.stage - 1, 1)
pp.nextReview = now + 5000

sessionStats.value.wrong++
sessionStats.value.streak = 0
progress.value.currentStreak = 0

lives.value--
if (lives.value <= 0) {
gameOver.value = true
}
}

lastAnswerCorrect.value = isCorrect
lastAnswerClose.value = isClose
showingResult.value = true
saveProgress(progress.value)

return isCorrect
}

function useHint(): string | null {
if (!currentChallenge.value) return null
const cost = 10
if (progress.value.xp < cost) return null

progress.value.xp -= cost
sessionStats.value.xpEarned -= cost
saveProgress(progress.value)

const person = currentChallenge.value.person
return `${person.title} — ${person.department}`
}

/**
 * Mark the current challenge as skipped (wrong but no life lost).
 * Used by the "I don't know" button.
 */
function skipAnswer() {
if (!currentChallenge.value || showingResult.value) return
const challenge = currentChallenge.value
const pp = getPersonProgress(progress.value, challenge.person.id)
const now = Date.now()

pp.lastSeen = now
pp.totalWrong++
pp.correctStreak = 0
pp.stage = Math.max(pp.stage - 1, 1)
pp.nextReview = now + 5000

sessionStats.value.answered++
sessionStats.value.wrong++
sessionStats.value.streak = 0
progress.value.totalAnswered++
progress.value.currentStreak = 0

lastAnswerCorrect.value = false
lastAnswerClose.value = false
showingResult.value = true
saveProgress(progress.value)
}

/**
 * Second-level hint for recall/type: reveals ~⅓ more letters.
 * Returns a new masked string or null when not applicable.
 */
function revealMoreLetters(): string | null {
if (!currentChallenge.value) return null
const type = currentChallenge.value.type
if (type !== 'recall' && type !== 'type') return null

const name = currentChallenge.value.person.name
// For 'type' there is no maskedName yet — generate a fresh base mask
const baseMask = currentChallenge.value.maskedName ?? generateMaskedName(name)

const hiddenIndices: number[] = []
for (let i = 0; i < baseMask.length; i++) {
if (baseMask[i] === '_') hiddenIndices.push(i)
}
if (hiddenIndices.length === 0) return baseMask

// Reveal ~⅓ of remaining hidden letters (minimum 2)
const revealCount = Math.max(REVEAL_MIN_COUNT, Math.ceil(hiddenIndices.length * REVEAL_FRACTION))
const toReveal = hiddenIndices.sort(() => Math.random() - 0.5).slice(0, revealCount)
const chars = Array.from(baseMask)
for (const idx of toReveal) {
chars[idx] = name[idx]
}
return chars.join('')
}

/**
 * Second-level hint for recognize/pick-face: returns the name of a wrong
 * option that should be eliminated, or null when not applicable.
 */
function eliminateWrongOption(): string | null {
if (!currentChallenge.value) return null
const challenge = currentChallenge.value

if (challenge.type === 'recognize' && challenge.options) {
const wrong = challenge.options.filter(o => o !== challenge.correctAnswer)
if (wrong.length === 0) return null
return wrong[Math.floor(Math.random() * wrong.length)]
}

if (challenge.type === 'pick-face' && challenge.photoOptions) {
const wrong = challenge.photoOptions.filter(m => m.name !== challenge.correctAnswer)
if (wrong.length === 0) return null
return wrong[Math.floor(Math.random() * wrong.length)].name
}

return null
}

/**
 * Perform the second hint (costs 15 XP).
 * Returns what was revealed so App.vue can store and display it.
 */
function useSecondHint(): { revealedMask: string | null; eliminatedOption: string | null } {
const empty = { revealedMask: null, eliminatedOption: null }
if (!currentChallenge.value) return empty
const cost = 15
if (progress.value.xp < cost) return empty

progress.value.xp -= cost
sessionStats.value.xpEarned -= cost
saveProgress(progress.value)

const type = currentChallenge.value.type
if (type === 'recall' || type === 'type') {
return { revealedMask: revealMoreLetters(), eliminatedOption: null }
}
return { revealedMask: null, eliminatedOption: eliminateWrongOption() }
}

return {
progress,
currentChallenge,
sessionStats,
lives,
maxLives,
gameOver,
showingResult,
lastAnswerCorrect,
lastAnswerClose,
loading,
loadError,
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
}
}

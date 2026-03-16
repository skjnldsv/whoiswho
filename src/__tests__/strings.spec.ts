/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest'
import { computeRanks, levenshtein, normalizeText, rankLabel, shuffle } from '../utils/strings.ts'

describe('normalizeText', () => {
	it('trims whitespace and lowercases', () => {
		expect(normalizeText('  Hello  ')).toBe('hello')
	})

	it('strips diacritics for accent-agnostic comparison', () => {
		expect(normalizeText('José')).toBe('jose')
		expect(normalizeText('Ångström')).toBe('angstrom')
		expect(normalizeText('Ñoño')).toBe('nono')
	})

	it('handles already-normalized strings', () => {
		expect(normalizeText('hello world')).toBe('hello world')
	})

	it('handles empty string', () => {
		expect(normalizeText('')).toBe('')
	})
})

describe('levenshtein', () => {
	it('returns 0 for identical strings', () => {
		expect(levenshtein('hello', 'hello')).toBe(0)
	})

	it('returns the length of the other string when one is empty', () => {
		expect(levenshtein('hello', '')).toBe(5)
		expect(levenshtein('', 'hello')).toBe(5)
	})

	it('returns 0 for two empty strings', () => {
		expect(levenshtein('', '')).toBe(0)
	})

	it('counts a single substitution', () => {
		expect(levenshtein('cat', 'bat')).toBe(1)
	})

	it('counts a single insertion', () => {
		expect(levenshtein('cat', 'cart')).toBe(1)
	})

	it('counts a single deletion', () => {
		expect(levenshtein('cart', 'car')).toBe(1)
	})

	it('handles multiple edits (kitten → sitting = 3)', () => {
		expect(levenshtein('kitten', 'sitting')).toBe(3)
	})

	it('is symmetric', () => {
		expect(levenshtein('abc', 'xyz')).toBe(levenshtein('xyz', 'abc'))
	})
})

describe('rankLabel', () => {
	it('returns gold medal emoji for rank 1', () => {
		expect(rankLabel(1)).toBe('🥇')
	})

	it('returns silver medal emoji for rank 2', () => {
		expect(rankLabel(2)).toBe('🥈')
	})

	it('returns bronze medal emoji for rank 3', () => {
		expect(rankLabel(3)).toBe('🥉')
	})

	it('returns #N for ranks beyond 3', () => {
		expect(rankLabel(4)).toBe('#4')
		expect(rankLabel(10)).toBe('#10')
		expect(rankLabel(100)).toBe('#100')
	})
})

describe('computeRanks', () => {
	it('assigns rank 1 to a single entry', () => {
		expect(computeRanks([100])).toEqual([1])
	})

	it('assigns sequential ranks for distinct scores', () => {
		expect(computeRanks([30, 20, 10])).toEqual([1, 2, 3])
	})

	it('assigns the same rank to tied scores (competition ranking)', () => {
		// [30, 24, 24, 24, 10] → [1, 2, 2, 2, 5]
		expect(computeRanks([30, 24, 24, 24, 10])).toEqual([1, 2, 2, 2, 5])
	})

	it('assigns rank 1 to all entries when all scores are equal', () => {
		expect(computeRanks([10, 10, 10])).toEqual([1, 1, 1])
	})

	it('handles an empty array', () => {
		expect(computeRanks([])).toEqual([])
	})
})

describe('shuffle', () => {
	it('returns the same array reference (in-place mutation)', () => {
		const arr = [1, 2, 3, 4, 5]
		const result = shuffle(arr)
		expect(result).toBe(arr)
	})

	it('preserves all original elements', () => {
		const original = [1, 2, 3, 4, 5]
		const shuffled = shuffle([...original])
		expect(shuffled).toHaveLength(original.length)
		expect([...shuffled].sort((a, b) => a - b)).toEqual([...original].sort((a, b) => a - b))
	})

	it('handles an empty array without errors', () => {
		expect(shuffle([])).toEqual([])
	})

	it('handles a single-element array', () => {
		expect(shuffle([42])).toEqual([42])
	})
})

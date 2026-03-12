/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/** A single Nextcloud team member as returned by the backend API. */
export interface TeamMember {
	id: number
	name: string
	title: string
	department: string
	photo: string
}

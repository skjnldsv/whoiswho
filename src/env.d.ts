/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/// <reference types="@nextcloud/typings" />

declare module '*.vue' {
	import type { DefineComponent } from 'vue'
	const component: DefineComponent
	export default component
}

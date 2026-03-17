/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Global Vitest setup — mocks Nextcloud-specific modules that access browser
 * APIs (window, document, localStorage) at module-initialisation time.
 *
 * These mocks are registered via the `setupFiles` option in vitest.config.ts
 * and run before each test file.
 */

import { vi } from 'vitest'

// ── @nextcloud/axios ──────────────────────────────────────────────────────────
// The real module accesses `window` during import.  Replace it with a minimal
// axios-compatible stub so any code that imports @nextcloud/axios in tests
// receives sensible defaults without touching browser APIs.
vi.mock('@nextcloud/axios', () => {
	const noop = () => Promise.resolve({ data: { ocs: { data: {} } } })
	return {
		default: {
			get: noop,
			put: noop,
			post: noop,
			delete: noop,
		},
	}
})

// ── @nextcloud/router ─────────────────────────────────────────────────────────
vi.mock('@nextcloud/router', () => ({
	generateOcsUrl: (path: string) => `/ocs/v2.php/${path}`,
	generateUrl: (path: string) => path,
}))

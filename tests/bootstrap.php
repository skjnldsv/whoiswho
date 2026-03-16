<?php

/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

declare(strict_types=1);

// When running inside the Nextcloud server context (CI: server at ../../, app at apps/whoiswho/)
// lib/base.php bootstraps NC's autoloader which provides OCP class loading.
$ncBase = __DIR__ . '/../../lib/base.php';
if (file_exists($ncBase)) {
	if (!defined('PHPUNIT_RUN')) {
		define('PHPUNIT_RUN', 1);
	}
	require_once $ncBase;
} else {
	// Local dev fallback: vendor-bin has phpunit + nextcloud/ocp stubs with manual registration
	require_once __DIR__ . '/../vendor-bin/phpunit/vendor/autoload.php';

	$ocpDir = __DIR__ . '/../vendor-bin/phpunit/vendor/nextcloud/ocp';

	// Register autoloader for the Nextcloud OCP public API (nextcloud/ocp has no composer autoload)
	spl_autoload_register(function (string $className) use ($ocpDir): void {
		foreach (['OCP', 'NCU'] as $prefix) {
			if (!str_starts_with($className, $prefix . '\\')) {
				continue;
			}
			$relative = substr($className, strlen($prefix) + 1);
			$file = $ocpDir . '/' . $prefix . '/' . str_replace('\\', '/', $relative) . '.php';
			if (file_exists($file)) {
				require_once $file;
				return;
			}
		}
	});
}

// Register an autoloader for the app's own source files under lib/
spl_autoload_register(function (string $className): void {
	if (!str_starts_with($className, 'OCA\\WhoIsWho\\')) {
		return;
	}
	$relative = substr($className, strlen('OCA\\WhoIsWho\\'));
	$file = __DIR__ . '/../lib/' . str_replace('\\', '/', $relative) . '.php';
	if (file_exists($file)) {
		require_once $file;
	}
});

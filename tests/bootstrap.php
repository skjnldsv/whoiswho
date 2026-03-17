<?php

/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

declare(strict_types=1);

// Load composer vendor autoloader (provides PHPUnit and any other dev dependencies).
require_once __DIR__ . '/../vendor/autoload.php';

// Register an autoloader for the Nextcloud OCP public API.
//
// CI context: the app lives at apps/<name>/ inside the NC server checkout.
//   __DIR__ = apps/<name>/tests  →  dirname(__DIR__, 3) = server root
//   OCP interfaces are in server root/lib/public/
//
// Local dev context: nextcloud/ocp stubs are installed via composer in vendor/.
$serverRoot = dirname(__DIR__, 3);
$serverLibPublic = $serverRoot . '/lib/public';

if (is_dir($serverLibPublic) && file_exists($serverLibPublic . '/IRequest.php')) {
	// NC server context: load OCP interfaces directly from lib/public/
	spl_autoload_register(function (string $className) use ($serverLibPublic): void {
		if (!str_starts_with($className, 'OCP\\')) {
			return;
		}
		$relative = substr($className, 4); // strip 'OCP\'
		$file = $serverLibPublic . '/' . str_replace('\\', '/', $relative) . '.php';
		if (file_exists($file)) {
			require_once $file;
		}
	});
} else {
	// Local dev fallback: nextcloud/ocp stubs (no composer autoload, manual mapping needed)
	$ocpDir = __DIR__ . '/../vendor/nextcloud/ocp';
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

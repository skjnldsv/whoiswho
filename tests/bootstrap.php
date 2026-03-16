<?php

/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

declare(strict_types=1);

// Load PHPUnit and all its dependencies
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

<?php

/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

declare(strict_types=1);

namespace OCA\WhoIsWho\AppInfo;

use OCP\AppFramework\App;

class Application extends App {
	public const APP_ID = 'whoiswho';

	public function __construct() {
		parent::__construct(self::APP_ID);
	}
}

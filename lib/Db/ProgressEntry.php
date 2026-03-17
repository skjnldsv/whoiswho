<?php

/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

declare(strict_types=1);

namespace OCA\WhoIsWho\Db;

use OCP\AppFramework\Db\Entity;

/**
 * @method string getUserId()
 * @method void setUserId(string $userId)
 * @method string getProgressJson()
 * @method void setProgressJson(string $progressJson)
 * @method int getUpdatedAt()
 * @method void setUpdatedAt(int $updatedAt)
 */
class ProgressEntry extends Entity {
	protected string $userId = '';
	protected string $progressJson = '';
	protected int $updatedAt = 0;

	public function __construct() {
		$this->addType('updatedAt', 'integer');
	}
}

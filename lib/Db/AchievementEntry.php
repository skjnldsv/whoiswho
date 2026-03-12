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
 * @method string getAchievementId()
 * @method void setAchievementId(string $achievementId)
 * @method int getUnlockedAt()
 * @method void setUnlockedAt(int $unlockedAt)
 */
class AchievementEntry extends Entity {
	protected string $userId = '';
	protected string $achievementId = '';
	protected int $unlockedAt = 0;

	public function __construct() {
		$this->addType('unlockedAt', 'integer');
	}
}

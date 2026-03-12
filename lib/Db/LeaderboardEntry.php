<?php

/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

declare(strict_types=1);

namespace OCA\WhoisWho\Db;

use OCP\AppFramework\Db\Entity;

/**
 * @method string getUserId()
 * @method void setUserId(string $userId)
 * @method string getDisplayName()
 * @method void setDisplayName(string $displayName)
 * @method int getTotalScore()
 * @method void setTotalScore(int $totalScore)
 * @method string getWeekLabel()
 * @method void setWeekLabel(string $weekLabel)
 * @method int getWeekScore()
 * @method void setWeekScore(int $weekScore)
 * @method int getUpdatedAt()
 * @method void setUpdatedAt(int $updatedAt)
 */
class LeaderboardEntry extends Entity {
	protected string $userId = '';
	protected string $displayName = '';
	protected int $totalScore = 0;
	protected string $weekLabel = '';
	protected int $weekScore = 0;
	protected int $updatedAt = 0;

	public function __construct() {
		$this->addType('totalScore', 'integer');
		$this->addType('weekScore', 'integer');
		$this->addType('updatedAt', 'integer');
	}
}

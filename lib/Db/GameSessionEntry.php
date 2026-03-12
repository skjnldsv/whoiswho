<?php

/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

declare(strict_types=1);

namespace OCA\WhoIsWho\Db;

use OCP\AppFramework\Db\Entity;

/**
 * Tracks the state of an active game session (lives, streaks, current challenge).
 *
 * @method string getUserId()
 * @method void setUserId(string $userId)
 * @method int getLives()
 * @method void setLives(int $lives)
 * @method int getStreak()
 * @method void setStreak(int $streak)
 * @method int getBestStreak()
 * @method void setBestStreak(int $bestStreak)
 * @method int getXpEarned()
 * @method void setXpEarned(int $xpEarned)
 * @method int getAnswered()
 * @method void setAnswered(int $answered)
 * @method int getCorrect()
 * @method void setCorrect(int $correct)
 * @method int getWrong()
 * @method void setWrong(int $wrong)
 * @method int|null getCurrentPersonId()
 * @method void setCurrentPersonId(?int $currentPersonId)
 * @method string|null getCurrentChallengeType()
 * @method void setCurrentChallengeType(?string $currentChallengeType)
 * @method string|null getCurrentCorrectAnswer()
 * @method void setCurrentCorrectAnswer(?string $currentCorrectAnswer)
 * @method int getCurrentTimeLimit()
 * @method void setCurrentTimeLimit(int $currentTimeLimit)
 * @method int getChallengeStartedAt()
 * @method void setChallengeStartedAt(int $challengeStartedAt)
 * @method int|null getLastPersonId()
 * @method void setLastPersonId(?int $lastPersonId)
 * @method string getNewlyMasteredJson()
 * @method void setNewlyMasteredJson(string $newlyMasteredJson)
 * @method bool getActive()
 * @method void setActive(bool $active)
 * @method int getCreatedAt()
 * @method void setCreatedAt(int $createdAt)
 * @method int getUpdatedAt()
 * @method void setUpdatedAt(int $updatedAt)
 */
class GameSessionEntry extends Entity {
	protected string $userId = '';
	protected int $lives = 3;
	protected int $streak = 0;
	protected int $bestStreak = 0;
	protected int $xpEarned = 0;
	protected int $answered = 0;
	protected int $correct = 0;
	protected int $wrong = 0;
	protected ?int $currentPersonId = null;
	protected ?string $currentChallengeType = null;
	protected ?string $currentCorrectAnswer = null;
	protected int $currentTimeLimit = 0;
	protected int $challengeStartedAt = 0;
	protected ?int $lastPersonId = null;
	protected string $newlyMasteredJson = '[]';
	protected bool $active = true;
	protected int $createdAt = 0;
	protected int $updatedAt = 0;

	public function __construct() {
		$this->addType('lives', 'integer');
		$this->addType('streak', 'integer');
		$this->addType('bestStreak', 'integer');
		$this->addType('xpEarned', 'integer');
		$this->addType('answered', 'integer');
		$this->addType('correct', 'integer');
		$this->addType('wrong', 'integer');
		$this->addType('currentPersonId', 'integer');
		$this->addType('currentTimeLimit', 'integer');
		$this->addType('challengeStartedAt', 'integer');
		$this->addType('lastPersonId', 'integer');
		$this->addType('active', 'boolean');
		$this->addType('createdAt', 'integer');
		$this->addType('updatedAt', 'integer');
	}
}

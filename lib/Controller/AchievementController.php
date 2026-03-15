<?php

/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

declare(strict_types=1);

namespace OCA\WhoIsWho\Controller;

use OCA\WhoIsWho\AppInfo\Application;
use OCA\WhoIsWho\Db\AchievementMapper;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\ApiRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\DataResponse;
use OCP\AppFramework\OCSController;
use OCP\IRequest;
use OCP\IUserSession;

class AchievementController extends OCSController {
	/** Allowlist of valid achievement IDs – must stay in sync with useAchievements.ts */
	private const VALID_IDS = [
		'first-contact',
		'getting-to-know-you',
		'name-recognition',
		'memory-master',
		'face-expert',
		'team-expert',
		'everyones-friend',
		'company-legend',
		'hot-streak',
		'on-fire',
		'unstoppable',
		'flawless-victory',
		'daily-dedication',
		'weekly-warrior',
		'monthly-master',
		'quick-thinker',
		'lightning-reflexes',
		'speed-demon',
		'no-mistakes',
		'level-up',
		'rising-star',
		'expert-status',
		'legendary',
		'xp-collector',
		'xp-hoarder',
		'first-session',
		'regular-player',
		'dedicated-learner',
		'century-club',
		'thousand-club',
		'comeback-kid',
		'sharp-shooter',
		'near-perfect',
		'night-owl',
		'early-bird',
		'weekend-warrior',
		'near-miss',
	];

	public function __construct(
		IRequest $request,
		private AchievementMapper $mapper,
		private IUserSession $userSession,
	) {
		parent::__construct(Application::APP_ID, $request);
	}

	#[NoAdminRequired]
	#[ApiRoute(verb: 'GET', url: '/achievements')]
	public function getAchievements(): DataResponse {
		$user = $this->userSession->getUser();
		if ($user === null) {
			return new DataResponse(['error' => 'Not authenticated'], Http::STATUS_UNAUTHORIZED);
		}
		$ids = $this->mapper->getUnlockedIds($user->getUID());
		return new DataResponse(['achievements' => $ids]);
	}

	#[NoAdminRequired]
	#[ApiRoute(verb: 'POST', url: '/achievements/unlock')]
	public function unlockAchievement(string $achievementId): DataResponse {
		$user = $this->userSession->getUser();
		if ($user === null) {
			return new DataResponse(['error' => 'Not authenticated'], Http::STATUS_UNAUTHORIZED);
		}
		if (!in_array($achievementId, self::VALID_IDS, true)) {
			return new DataResponse(['error' => 'Invalid achievement ID'], Http::STATUS_BAD_REQUEST);
		}
		$this->mapper->unlock($user->getUID(), $achievementId);
		return new DataResponse(['ok' => true]);
	}
}

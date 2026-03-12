<?php

/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

declare(strict_types=1);

namespace OCA\WhoIsWho\Controller;

use OCA\WhoIsWho\AppInfo\Application;
use OCA\WhoIsWho\Db\LeaderboardMapper;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\ApiRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\DataResponse;
use OCP\AppFramework\OCSController;
use OCP\IRequest;
use OCP\IUserSession;

class LeaderboardController extends OCSController {
	public function __construct(
		IRequest $request,
		private LeaderboardMapper $mapper,
		private IUserSession $userSession,
	) {
		parent::__construct(Application::APP_ID, $request);
	}

	#[NoAdminRequired]
	#[ApiRoute(verb: 'GET', url: '/leaderboard')]
	public function getScores(): DataResponse {
		$allTime = $this->mapper->getTopAllTime(20);
		$weekly = $this->mapper->getTopWeekly(20);
		return new DataResponse(['allTime' => $allTime, 'weekly' => $weekly]);
	}

	#[NoAdminRequired]
	#[ApiRoute(verb: 'POST', url: '/leaderboard/score')]
	public function submitScore(int $score): DataResponse {
		$user = $this->userSession->getUser();
		if ($user === null) {
			return new DataResponse(['error' => 'Not authenticated'], Http::STATUS_UNAUTHORIZED);
		}
		if ($score <= 0) {
			return new DataResponse(['error' => 'Score must be positive'], Http::STATUS_BAD_REQUEST);
		}
		$this->mapper->upsertScore($user->getUID(), $user->getDisplayName(), $score);
		return new DataResponse(['ok' => true]);
	}
}

<?php

/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

declare(strict_types=1);

namespace OCA\WhoisWho\Controller;

use OCA\WhoisWho\AppInfo\Application;
use OCA\WhoisWho\Db\LeaderboardMapper;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IRequest;
use OCP\IUserSession;

class LeaderboardController extends Controller {
	public function __construct(
		IRequest $request,
		private LeaderboardMapper $mapper,
		private IUserSession $userSession,
	) {
		parent::__construct(Application::APP_ID, $request);
	}

	#[NoAdminRequired]
	#[NoCSRFRequired]
	public function getScores(): JSONResponse {
		$allTime = $this->mapper->getTopAllTime(20);
		$weekly  = $this->mapper->getTopWeekly(20);
		return new JSONResponse(['allTime' => $allTime, 'weekly' => $weekly]);
	}

	#[NoAdminRequired]
	public function submitScore(int $score): JSONResponse {
		$user = $this->userSession->getUser();
		if ($user === null) {
			return new JSONResponse(['error' => 'Not authenticated'], Http::STATUS_UNAUTHORIZED);
		}
		if ($score <= 0) {
			return new JSONResponse(['error' => 'Score must be positive'], Http::STATUS_BAD_REQUEST);
		}
		$this->mapper->upsertScore($user->getUID(), $user->getDisplayName(), $score);
		return new JSONResponse(['ok' => true]);
	}
}

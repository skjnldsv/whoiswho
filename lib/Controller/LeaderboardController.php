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
use OCP\IConfig;
use OCP\IRequest;
use OCP\IUserSession;

class LeaderboardController extends OCSController {
	/** Token validity window in seconds (4 hours). */
	private const TOKEN_TTL = 4 * 3600;

	public function __construct(
		IRequest $request,
		private LeaderboardMapper $mapper,
		private IUserSession $userSession,
		private IConfig $config,
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

	/**
	 * Issue a time-limited, HMAC-signed session token for score submission.
	 * The token encodes the current user and issue time so that the server
	 * can verify it is authentic without storing any session state.
	 */
	#[NoAdminRequired]
	#[ApiRoute(verb: 'GET', url: '/leaderboard/token')]
	public function getSessionToken(): DataResponse {
		$user = $this->userSession->getUser();
		if ($user === null) {
			return new DataResponse(['error' => 'Not authenticated'], Http::STATUS_UNAUTHORIZED);
		}

		$issuedAt = time();
		$token = $this->generateToken($user->getUID(), $issuedAt);
		if ($token === null) {
			return new DataResponse(['error' => 'Server is not properly configured for score submission'], Http::STATUS_INTERNAL_SERVER_ERROR);
		}
		return new DataResponse(['token' => $token, 'issuedAt' => $issuedAt]);
	}

	#[NoAdminRequired]
	#[ApiRoute(verb: 'POST', url: '/leaderboard/score')]
	public function submitScore(int $score, string $token = '', int $issuedAt = 0): DataResponse {
		$user = $this->userSession->getUser();
		if ($user === null) {
			return new DataResponse(['error' => 'Not authenticated'], Http::STATUS_UNAUTHORIZED);
		}
		if ($score <= 0) {
			return new DataResponse(['error' => 'Score must be positive'], Http::STATUS_BAD_REQUEST);
		}
		if (!$this->validateToken($user->getUID(), $token, $issuedAt)) {
			return new DataResponse(['error' => 'Invalid or expired session token'], Http::STATUS_FORBIDDEN);
		}
		$this->mapper->upsertScore($user->getUID(), $user->getDisplayName(), $score);
		return new DataResponse(['ok' => true]);
	}

	/**
	 * Generate an HMAC-SHA256 token for the given user and issue time.
	 * Returns null when the instance secret is not configured.
	 */
	private function generateToken(string $userId, int $issuedAt): ?string {
		$secret = $this->config->getSystemValueString('secret', '');
		if ($secret === '') {
			return null;
		}
		return hash_hmac('sha256', $userId . ':' . $issuedAt, $secret);
	}

	/**
	 * Validate that the token was issued by this server for this user
	 * and is still within the allowed time window.
	 */
	private function validateToken(string $userId, string $token, int $issuedAt): bool {
		if ($token === '' || $issuedAt <= 0) {
			return false;
		}

		$now = time();
		if ($now - $issuedAt > self::TOKEN_TTL || $issuedAt > $now) {
			return false;
		}

		$expected = $this->generateToken($userId, $issuedAt);
		if ($expected === null) {
			return false;
		}
		return hash_equals($expected, $token);
	}
}

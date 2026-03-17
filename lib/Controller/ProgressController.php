<?php

/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

declare(strict_types=1);

namespace OCA\WhoIsWho\Controller;

use OCA\WhoIsWho\AppInfo\Application;
use OCA\WhoIsWho\Db\ProgressMapper;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\ApiRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\DataResponse;
use OCP\AppFramework\OCSController;
use OCP\IRequest;
use OCP\IUserSession;

class ProgressController extends OCSController {
	/** Maximum size of the JSON blob we accept from the client (256 KiB). */
	private const MAX_PAYLOAD_BYTES = 262144;

	public function __construct(
		IRequest $request,
		private ProgressMapper $mapper,
		private IUserSession $userSession,
	) {
		parent::__construct(Application::APP_ID, $request);
	}

	/**
	 * Return the stored game progress for the authenticated user.
	 * Returns an empty object when no progress has been saved yet.
	 */
	#[NoAdminRequired]
	#[ApiRoute(verb: 'GET', url: '/progress')]
	public function getProgress(): DataResponse {
		$user = $this->userSession->getUser();
		if ($user === null) {
			return new DataResponse(['error' => 'Not authenticated'], Http::STATUS_UNAUTHORIZED);
		}

		$entry = $this->mapper->findByUserId($user->getUID());
		if ($entry === null) {
			return new DataResponse(['progress' => null]);
		}

		$decoded = json_decode($entry->getProgressJson(), true);
		return new DataResponse(['progress' => $decoded]);
	}

	/**
	 * Persist the game progress for the authenticated user.
	 *
	 * @param array<mixed> $progress The full progress object serialised by the frontend.
	 */
	#[NoAdminRequired]
	#[ApiRoute(verb: 'PUT', url: '/progress')]
	public function saveProgress(array $progress): DataResponse {
		$user = $this->userSession->getUser();
		if ($user === null) {
			return new DataResponse(['error' => 'Not authenticated'], Http::STATUS_UNAUTHORIZED);
		}

		$json = json_encode($progress);
		if ($json === false || strlen($json) > self::MAX_PAYLOAD_BYTES) {
			return new DataResponse(['error' => 'Invalid or oversized payload'], Http::STATUS_BAD_REQUEST);
		}

		$this->mapper->upsert($user->getUID(), $json);
		return new DataResponse(['ok' => true]);
	}

	/**
	 * Delete the stored game progress for the authenticated user.
	 */
	#[NoAdminRequired]
	#[ApiRoute(verb: 'DELETE', url: '/progress')]
	public function deleteProgress(): DataResponse {
		$user = $this->userSession->getUser();
		if ($user === null) {
			return new DataResponse(['error' => 'Not authenticated'], Http::STATUS_UNAUTHORIZED);
		}

		$existing = $this->mapper->findByUserId($user->getUID());
		if ($existing !== null) {
			$this->mapper->delete($existing);
		}
		return new DataResponse(['ok' => true]);
	}
}

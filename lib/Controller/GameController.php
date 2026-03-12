<?php

/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

declare(strict_types=1);

namespace OCA\WhoIsWho\Controller;

use OCA\WhoIsWho\AppInfo\Application;
use OCA\WhoIsWho\Service\GameService;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\ApiRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\DataResponse;
use OCP\AppFramework\OCSController;
use OCP\IRequest;
use OCP\IUserSession;

/**
 * Server-side game API controller.
 * All game logic (questions, validation, scoring, streaks) runs here.
 */
class GameController extends OCSController {
	public function __construct(
		IRequest $request,
		private GameService $gameService,
		private TeamController $teamController,
		private IUserSession $userSession,
	) {
		parent::__construct(Application::APP_ID, $request);
	}

	/**
	 * Get all team members (needed for game operations).
	 * Uses the same data source as TeamController.
	 */
	private function getTeamMembers(): array {
		$response = $this->teamController->index();
		return $response->getData();
	}

	private function getUserId(): ?string {
		return $this->userSession->getUser()?->getUID();
	}

	/**
	 * Start a new game session.
	 */
	#[NoAdminRequired]
	#[ApiRoute(verb: 'POST', url: '/game/start')]
	public function startSession(): DataResponse {
		$userId = $this->getUserId();
		if ($userId === null) {
			return new DataResponse(['error' => 'Not authenticated'], Http::STATUS_UNAUTHORIZED);
		}

		$members = $this->getTeamMembers();
		if (isset($members['error'])) {
			return new DataResponse(['error' => 'Could not load team members'], Http::STATUS_SERVICE_UNAVAILABLE);
		}

		$result = $this->gameService->startSession($userId, $members);
		return new DataResponse($result);
	}

	/**
	 * Get the next challenge for the current session.
	 * The correct answer is never included in the response.
	 */
	#[NoAdminRequired]
	#[ApiRoute(verb: 'GET', url: '/game/challenge')]
	public function getChallenge(): DataResponse {
		$userId = $this->getUserId();
		if ($userId === null) {
			return new DataResponse(['error' => 'Not authenticated'], Http::STATUS_UNAUTHORIZED);
		}

		$members = $this->getTeamMembers();
		if (isset($members['error'])) {
			return new DataResponse(['error' => 'Could not load team members'], Http::STATUS_SERVICE_UNAVAILABLE);
		}

		$result = $this->gameService->getNextChallenge($userId, $members);
		if (isset($result['error'])) {
			return new DataResponse($result, Http::STATUS_BAD_REQUEST);
		}

		return new DataResponse($result);
	}

	/**
	 * Submit an answer for the current challenge.
	 * The backend validates the answer and returns the result.
	 */
	#[NoAdminRequired]
	#[ApiRoute(verb: 'POST', url: '/game/answer')]
	public function submitAnswer(string $answer): DataResponse {
		$userId = $this->getUserId();
		if ($userId === null) {
			return new DataResponse(['error' => 'Not authenticated'], Http::STATUS_UNAUTHORIZED);
		}

		$members = $this->getTeamMembers();
		if (isset($members['error'])) {
			return new DataResponse(['error' => 'Could not load team members'], Http::STATUS_SERVICE_UNAVAILABLE);
		}

		$result = $this->gameService->submitAnswer($userId, $answer, $members);
		if (isset($result['error'])) {
			return new DataResponse($result, Http::STATUS_BAD_REQUEST);
		}

		return new DataResponse($result);
	}

	/**
	 * Skip the current challenge (I don't know).
	 */
	#[NoAdminRequired]
	#[ApiRoute(verb: 'POST', url: '/game/skip')]
	public function skipChallenge(): DataResponse {
		$userId = $this->getUserId();
		if ($userId === null) {
			return new DataResponse(['error' => 'Not authenticated'], Http::STATUS_UNAUTHORIZED);
		}

		$result = $this->gameService->skipChallenge($userId);
		if (isset($result['error'])) {
			return new DataResponse($result, Http::STATUS_BAD_REQUEST);
		}

		return new DataResponse($result);
	}

	/**
	 * Use a hint (level 1 or 2).
	 */
	#[NoAdminRequired]
	#[ApiRoute(verb: 'POST', url: '/game/hint')]
	public function useHint(int $level): DataResponse {
		$userId = $this->getUserId();
		if ($userId === null) {
			return new DataResponse(['error' => 'Not authenticated'], Http::STATUS_UNAUTHORIZED);
		}

		if ($level !== 1 && $level !== 2) {
			return new DataResponse(['error' => 'Invalid hint level'], Http::STATUS_BAD_REQUEST);
		}

		$members = $this->getTeamMembers();
		if (isset($members['error'])) {
			return new DataResponse(['error' => 'Could not load team members'], Http::STATUS_SERVICE_UNAVAILABLE);
		}

		$result = $this->gameService->useHint($userId, $level, $members);
		if (isset($result['error'])) {
			return new DataResponse($result, Http::STATUS_BAD_REQUEST);
		}

		return new DataResponse($result);
	}

	/**
	 * End the current game session.
	 */
	#[NoAdminRequired]
	#[ApiRoute(verb: 'POST', url: '/game/end')]
	public function endSession(): DataResponse {
		$userId = $this->getUserId();
		if ($userId === null) {
			return new DataResponse(['error' => 'Not authenticated'], Http::STATUS_UNAUTHORIZED);
		}

		$result = $this->gameService->endSession($userId);
		if (isset($result['error'])) {
			return new DataResponse($result, Http::STATUS_BAD_REQUEST);
		}

		return new DataResponse($result);
	}

	/**
	 * Get the current game progress.
	 */
	#[NoAdminRequired]
	#[ApiRoute(verb: 'GET', url: '/game/progress')]
	public function getProgress(): DataResponse {
		$userId = $this->getUserId();
		if ($userId === null) {
			return new DataResponse(['error' => 'Not authenticated'], Http::STATUS_UNAUTHORIZED);
		}

		$result = $this->gameService->getProgress($userId);
		return new DataResponse($result);
	}
}

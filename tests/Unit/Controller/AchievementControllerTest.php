<?php

/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

declare(strict_types=1);

namespace OCA\WhoIsWho\Tests\Unit\Controller;

use OCA\WhoIsWho\Controller\AchievementController;
use OCA\WhoIsWho\Db\AchievementMapper;
use OCP\AppFramework\Http;
use OCP\IRequest;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class AchievementControllerTest extends TestCase {
	private AchievementController $controller;
	/** @var MockObject&AchievementMapper */
	private MockObject $mapper;
	/** @var MockObject&IUserSession */
	private MockObject $userSession;
	/** @var MockObject&IRequest */
	private MockObject $request;

	protected function setUp(): void {
		parent::setUp();

		$this->request = $this->createMock(IRequest::class);
		$this->mapper = $this->createMock(AchievementMapper::class);
		$this->userSession = $this->createMock(IUserSession::class);

		$this->controller = new AchievementController(
			$this->request,
			$this->mapper,
			$this->userSession,
		);
	}

	// ── getAchievements ──────────────────────────────────────────────────────

	public function testGetAchievementsReturnsUnauthorizedWhenNotLoggedIn(): void {
		$this->userSession->method('getUser')->willReturn(null);

		$response = $this->controller->getAchievements();

		$this->assertEquals(Http::STATUS_UNAUTHORIZED, $response->getStatus());
	}

	public function testGetAchievementsReturnsAchievementListForAuthenticatedUser(): void {
		$user = $this->createMock(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$this->userSession->method('getUser')->willReturn($user);
		$this->mapper->method('getUnlockedIds')->with('alice')->willReturn(['first-contact', 'hot-streak']);

		$response = $this->controller->getAchievements();

		$this->assertEquals(Http::STATUS_OK, $response->getStatus());
		$this->assertSame(['first-contact', 'hot-streak'], $response->getData()['achievements']);
	}

	// ── unlockAchievement ────────────────────────────────────────────────────

	public function testUnlockAchievementReturnsUnauthorizedWhenNotLoggedIn(): void {
		$this->userSession->method('getUser')->willReturn(null);

		$response = $this->controller->unlockAchievement('first-contact');

		$this->assertEquals(Http::STATUS_UNAUTHORIZED, $response->getStatus());
	}

	public function testUnlockAchievementReturnsBadRequestForInvalidId(): void {
		$user = $this->createMock(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$this->userSession->method('getUser')->willReturn($user);

		$response = $this->controller->unlockAchievement('not-a-real-achievement');

		$this->assertEquals(Http::STATUS_BAD_REQUEST, $response->getStatus());
		$this->assertArrayHasKey('error', $response->getData());
	}

	public function testUnlockAchievementCallsMapperForValidId(): void {
		$user = $this->createMock(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$this->userSession->method('getUser')->willReturn($user);

		$this->mapper->expects($this->once())
			->method('unlock')
			->with('alice', 'first-contact');

		$response = $this->controller->unlockAchievement('first-contact');

		$this->assertEquals(Http::STATUS_OK, $response->getStatus());
		$this->assertTrue($response->getData()['ok']);
	}

	/** @dataProvider validAchievementIdProvider */
	public function testAllValidAchievementIdsAreAccepted(string $id): void {
		$user = $this->createMock(IUser::class);
		$user->method('getUID')->willReturn('bob');
		$this->userSession->method('getUser')->willReturn($user);
		$this->mapper->method('unlock');

		$response = $this->controller->unlockAchievement($id);

		$this->assertEquals(Http::STATUS_OK, $response->getStatus());
	}

	/** @return array<string, array{string}> */
	public static function validAchievementIdProvider(): array {
		return [
			'first-contact' => ['first-contact'],
			'hot-streak' => ['hot-streak'],
			'flawless-victory' => ['flawless-victory'],
			'night-owl' => ['night-owl'],
			'weekend-warrior' => ['weekend-warrior'],
		];
	}
}

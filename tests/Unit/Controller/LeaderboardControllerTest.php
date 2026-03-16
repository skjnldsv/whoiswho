<?php

/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

declare(strict_types=1);

namespace OCA\WhoIsWho\Tests\Unit\Controller;

use OCA\WhoIsWho\Controller\LeaderboardController;
use OCA\WhoIsWho\Db\LeaderboardMapper;
use OCP\AppFramework\Http;
use OCP\IRequest;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class LeaderboardControllerTest extends TestCase {
	private LeaderboardController $controller;
	/** @var MockObject&LeaderboardMapper */
	private MockObject $mapper;
	/** @var MockObject&IUserSession */
	private MockObject $userSession;
	/** @var MockObject&IRequest */
	private MockObject $request;

	protected function setUp(): void {
		parent::setUp();

		$this->request = $this->createMock(IRequest::class);
		$this->mapper = $this->createMock(LeaderboardMapper::class);
		$this->userSession = $this->createMock(IUserSession::class);

		$this->controller = new LeaderboardController(
			$this->request,
			$this->mapper,
			$this->userSession,
		);
	}

	// ── getScores ────────────────────────────────────────────────────────────

	public function testGetScoresReturnsAllThreeLeaderboards(): void {
		$allTime = [['display_name' => 'Alice', 'total_score' => 500]];
		$weekly = [['display_name' => 'Alice', 'week_score' => 100]];
		$streak = [['display_name' => 'Alice', 'best_streak' => 10]];

		$this->mapper->method('getTopAllTime')->with(20)->willReturn($allTime);
		$this->mapper->method('getTopWeekly')->with(20)->willReturn($weekly);
		$this->mapper->method('getTopByStreak')->with(20)->willReturn($streak);

		$response = $this->controller->getScores();

		$this->assertEquals(Http::STATUS_OK, $response->getStatus());
		$data = $response->getData();
		$this->assertSame($allTime, $data['allTime']);
		$this->assertSame($weekly, $data['weekly']);
		$this->assertSame($streak, $data['streak']);
	}

	// ── submitScore ──────────────────────────────────────────────────────────

	public function testSubmitScoreReturnsUnauthorizedWhenNotLoggedIn(): void {
		$this->userSession->method('getUser')->willReturn(null);

		$response = $this->controller->submitScore(100);

		$this->assertEquals(Http::STATUS_UNAUTHORIZED, $response->getStatus());
	}

	/** @dataProvider invalidScoreProvider */
	public function testSubmitScoreReturnsBadRequestForInvalidScore(int $score): void {
		$user = $this->createMock(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$user->method('getDisplayName')->willReturn('Alice');
		$this->userSession->method('getUser')->willReturn($user);

		$response = $this->controller->submitScore($score);

		$this->assertEquals(Http::STATUS_BAD_REQUEST, $response->getStatus());
		$this->assertArrayHasKey('error', $response->getData());
	}

	/** @return array<string, array{int}> */
	public static function invalidScoreProvider(): array {
		return [
			'zero score' => [0],
			'negative score' => [-1],
			'too large score' => [100_001],
		];
	}

	/** @dataProvider invalidStreakProvider */
	public function testSubmitScoreReturnsBadRequestForInvalidStreak(int $streak): void {
		$user = $this->createMock(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$user->method('getDisplayName')->willReturn('Alice');
		$this->userSession->method('getUser')->willReturn($user);

		$response = $this->controller->submitScore(50, $streak);

		$this->assertEquals(Http::STATUS_BAD_REQUEST, $response->getStatus());
	}

	/** @return array<string, array{int}> */
	public static function invalidStreakProvider(): array {
		return [
			'negative streak' => [-1],
			'too large streak' => [100_001],
		];
	}

	public function testSubmitScoreCallsMapperForValidInput(): void {
		$user = $this->createMock(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$user->method('getDisplayName')->willReturn('Alice');
		$this->userSession->method('getUser')->willReturn($user);

		$this->mapper->expects($this->once())
			->method('upsertScore')
			->with('alice', 'Alice', 250, 5);

		$response = $this->controller->submitScore(250, 5);

		$this->assertEquals(Http::STATUS_OK, $response->getStatus());
		$this->assertTrue($response->getData()['ok']);
	}

	public function testSubmitScoreUsesZeroStreakByDefault(): void {
		$user = $this->createMock(IUser::class);
		$user->method('getUID')->willReturn('bob');
		$user->method('getDisplayName')->willReturn('Bob');
		$this->userSession->method('getUser')->willReturn($user);

		$this->mapper->expects($this->once())
			->method('upsertScore')
			->with('bob', 'Bob', 100, 0);

		$this->controller->submitScore(100);
	}

	public function testSubmitScoreAcceptsBoundaryValues(): void {
		$user = $this->createMock(IUser::class);
		$user->method('getUID')->willReturn('carol');
		$user->method('getDisplayName')->willReturn('Carol');
		$this->userSession->method('getUser')->willReturn($user);

		$this->mapper->method('upsertScore');

		// Minimum valid score
		$response = $this->controller->submitScore(1, 0);
		$this->assertEquals(Http::STATUS_OK, $response->getStatus());

		// Maximum valid score
		$response = $this->controller->submitScore(100_000, 100_000);
		$this->assertEquals(Http::STATUS_OK, $response->getStatus());
	}
}

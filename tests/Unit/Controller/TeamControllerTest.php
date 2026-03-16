<?php

/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

declare(strict_types=1);

namespace OCA\WhoIsWho\Tests\Unit\Controller;

use OCA\WhoIsWho\Controller\TeamController;
use OCP\Http\Client\IClientService;
use OCP\ICacheFactory;
use OCP\IRequest;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class TeamControllerTest extends TestCase {
	private TeamController $controller;
	/** @var MockObject&IRequest */
	private MockObject $request;
	/** @var MockObject&IClientService */
	private MockObject $clientService;
	/** @var MockObject&ICacheFactory */
	private MockObject $cacheFactory;

	protected function setUp(): void {
		parent::setUp();

		$this->request = $this->createMock(IRequest::class);
		$this->clientService = $this->createMock(IClientService::class);
		$this->cacheFactory = $this->createMock(ICacheFactory::class);
		// Disable the distributed cache so the constructor does not call createDistributed
		$this->cacheFactory->method('isAvailable')->willReturn(false);

		$this->controller = new TeamController(
			$this->request,
			$this->clientService,
			$this->cacheFactory,
		);
	}

	// ── parseTeamPage (private, accessed via reflection) ─────────────────────

	/**
	 * Helper: invoke the private parseTeamPage method via reflection.
	 *
	 * @param string $html
	 * @return array<int, array<string, string>>
	 */
	private function parseTeamPage(string $html): array {
		$method = new \ReflectionMethod(TeamController::class, 'parseTeamPage');
		/** @var array<int, array<string, string>> */
		return $method->invoke($this->controller, $html);
	}

	public function testParseTeamPageExtractsMembersWithPhotoNameTitleAndDepartment(): void {
		$html = <<<'HTML'
			<h2>Engineering</h2>
			<div style="background-image:url(https://nextcloud.com/photos/alice.jpg)"></div>
			<h4>Alice Smith</h4>
			<h5>Software Engineer</h5>
		HTML;

		$members = $this->parseTeamPage($html);

		$this->assertCount(1, $members);
		$this->assertSame('Alice Smith', $members[0]['name']);
		$this->assertSame('Software Engineer', $members[0]['title']);
		$this->assertSame('Engineering', $members[0]['department']);
		$this->assertSame('https://nextcloud.com/photos/alice.jpg', $members[0]['photo']);
		$this->assertSame(1, $members[0]['id']);
	}

	public function testParseTeamPageSkipsPlaceholderPhotos(): void {
		$placeholder = 'https://nextcloud.com/c/themes/nextcloud-theme/dist/img/person.jpg';
		$html = <<<HTML
			<h2>Design</h2>
			<div style="background-image:url({$placeholder})"></div>
			<h4>Ghost Person</h4>
			<h5>Designer</h5>
		HTML;

		$members = $this->parseTeamPage($html);

		$this->assertCount(0, $members);
	}

	public function testParseTeamPageSkipsEntriesWithNoPhoto(): void {
		$html = <<<'HTML'
			<h2>Marketing</h2>
			<h4>No Photo Person</h4>
			<h5>Marketer</h5>
		HTML;

		$members = $this->parseTeamPage($html);

		$this->assertCount(0, $members);
	}

	public function testParseTeamPageDeduplicatesByName(): void {
		$html = <<<'HTML'
			<h2>Engineering</h2>
			<div style="background-image:url(https://nextcloud.com/photo1.jpg)"></div>
			<h4>Alice Smith</h4>
			<h5>Engineer</h5>
			<div style="background-image:url(https://nextcloud.com/photo2.jpg)"></div>
			<h4>Alice Smith</h4>
			<h5>Senior Engineer</h5>
		HTML;

		$members = $this->parseTeamPage($html);

		$this->assertCount(1, $members);
		$this->assertSame('Alice Smith', $members[0]['name']);
	}

	public function testParseTeamPageExtractsMembersFromMultipleDepartments(): void {
		$html = <<<'HTML'
			<h2>Engineering</h2>
			<div style="background-image:url(https://nextcloud.com/photo-alice.jpg)"></div>
			<h4>Alice</h4>
			<h5>Engineer</h5>
			<h2>Design</h2>
			<div style="background-image:url(https://nextcloud.com/photo-bob.jpg)"></div>
			<h4>Bob</h4>
			<h5>Designer</h5>
		HTML;

		$members = $this->parseTeamPage($html);

		$this->assertCount(2, $members);
		$names = array_column($members, 'name');
		$this->assertContains('Alice', $names);
		$this->assertContains('Bob', $names);

		$departments = array_column($members, 'department');
		$this->assertContains('Engineering', $departments);
		$this->assertContains('Design', $departments);
	}

	public function testParseTeamPageHandlesDataBgAttribute(): void {
		$html = <<<'HTML'
			<h2>Sales</h2>
			<div data-bg="https://nextcloud.com/photos/carol.jpg"></div>
			<h4>Carol</h4>
			<h5>Sales Rep</h5>
		HTML;

		$members = $this->parseTeamPage($html);

		$this->assertCount(1, $members);
		$this->assertSame('Carol', $members[0]['name']);
		$this->assertSame('https://nextcloud.com/photos/carol.jpg', $members[0]['photo']);
	}

	public function testParseTeamPageIgnoresNonNextcloudPhotoUrls(): void {
		$html = <<<'HTML'
			<h2>Community</h2>
			<div style="background-image:url(https://example.com/external-photo.jpg)"></div>
			<h4>Dave</h4>
			<h5>Community Manager</h5>
		HTML;

		$members = $this->parseTeamPage($html);

		// External URLs are not nextcloud.com — member should be skipped
		$this->assertCount(0, $members);
	}

	public function testParseTeamPageReturnsEmptyArrayForEmptyHtml(): void {
		$members = $this->parseTeamPage('');
		$this->assertIsArray($members);
		$this->assertCount(0, $members);
	}

	public function testParseTeamPageDecodesHtmlEntitiesInNames(): void {
		$html = <<<'HTML'
			<h2>Engineering</h2>
			<div style="background-image:url(https://nextcloud.com/photo.jpg)"></div>
			<h4>Jos&eacute; Gonz&aacute;lez</h4>
			<h5>Engineer</h5>
		HTML;

		$members = $this->parseTeamPage($html);

		$this->assertCount(1, $members);
		$this->assertSame('José González', $members[0]['name']);
	}
}

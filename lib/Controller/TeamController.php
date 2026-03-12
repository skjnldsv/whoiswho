<?php

/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

declare(strict_types=1);

namespace OCA\WhoIsWho\Controller;

use OCA\WhoIsWho\AppInfo\Application;
use OCP\AppFramework\Http\Attribute\ApiRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\DataResponse;
use OCP\AppFramework\OCSController;
use OCP\Http\Client\IClientService;
use OCP\IRequest;

class TeamController extends OCSController {
	public function __construct(
		IRequest $request,
		private IClientService $clientService,
	) {
		parent::__construct(Application::APP_ID, $request);
	}

	#[NoAdminRequired]
	#[ApiRoute(verb: 'GET', url: '/team')]
	public function index(): DataResponse {
		$client = $this->clientService->newClient();
		try {
			$response = $client->get('https://nextcloud.com/team/', [
				'timeout' => 20,
				'headers' => ['User-Agent' => 'Nextcloud/WhoIsWho-App'],
			]);
			$html = (string)$response->getBody();
		} catch (\Exception $e) {
			return new DataResponse(['error' => 'Failed to fetch team page: ' . $e->getMessage()], 503);
		}

		$members = $this->parseTeamPage($html);
		return new DataResponse($members);
	}

	private function parseTeamPage(string $html): array {
		$members = [];
		$placeholderPhoto = 'https://nextcloud.com/c/themes/nextcloud-theme/dist/img/person.jpg';

		// Extract department headings (h2) and their offsets
		$departments = [];
		if (preg_match_all('/<h2[^>]*>(.*?)<\/h2>/si', $html, $h2matches, PREG_OFFSET_CAPTURE)) {
			foreach ($h2matches[1] as $i => $m) {
				$rawName = strip_tags($m[0]);
				$name = trim(html_entity_decode($rawName, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
				if ($name !== '') {
					$departments[] = [
						'name' => $name,
						'index' => (int)$h2matches[0][$i][1],
					];
				}
			}
		}

		for ($i = 0; $i < count($departments); $i++) {
			$start = $departments[$i]['index'];
			$end = isset($departments[$i + 1]) ? $departments[$i + 1]['index'] : strlen($html);
			$section = substr($html, $start, $end - $start);
			$dept = $departments[$i]['name'];

			// Photos: data-bg="..." or background-image:url(...)
			$images = [];
			if (preg_match_all('/(?:data-bg=["\']([^"\']+)["\']|background-image:\s*url\(([^)]+)\))/i', $section, $imgMatches)) {
				foreach ($imgMatches[1] as $j => $v) {
					$url = $v !== '' ? $v : $imgMatches[2][$j];
					$url = trim($url, " \t\n\r\0\x0B\"'");
					if ($url !== '') {
						$images[] = $url;
					}
				}
			}

			// Names: h4 tags
			$names = [];
			if (preg_match_all('/<h4[^>]*>(.*?)<\/h4>/si', $section, $nameMatches)) {
				foreach ($nameMatches[1] as $raw) {
					$name = trim(html_entity_decode(strip_tags($raw), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
					if ($name !== '') {
						$names[] = $name;
					}
				}
			}

			// Titles: h5 tags
			$titles = [];
			if (preg_match_all('/<h5[^>]*>(.*?)<\/h5>/si', $section, $titleMatches)) {
				foreach ($titleMatches[1] as $raw) {
					$title = trim(html_entity_decode(strip_tags($raw), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
					$titles[] = $title;
				}
			}

			for ($j = 0; $j < count($names); $j++) {
				$photo = $images[$j] ?? '';
				// Skip placeholder images
				if ($photo === $placeholderPhoto || $photo === '') {
					continue;
				}
				$members[] = [
					'id' => count($members) + 1,
					'name' => $names[$j],
					'title' => $titles[$j] ?? '',
					'department' => $dept,
					'photo' => $photo,
				];
			}
		}

		// Deduplicate by name
		$seen = [];
		$unique = [];
		foreach ($members as $member) {
			if (!isset($seen[$member['name']])) {
				$seen[$member['name']] = true;
				$unique[] = $member;
			}
		}

		return $unique;
	}
}

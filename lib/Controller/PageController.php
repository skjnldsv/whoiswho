<?php

/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

namespace OCA\WhoIsWho\Controller;

use OCA\WhoIsWho\AppInfo\Application;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\ContentSecurityPolicy;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\IRequest;
use OCP\Util;

class PageController extends Controller {
	public function __construct(IRequest $request) {
		parent::__construct(Application::APP_ID, $request);
	}

	/**
	 * @NoAdminRequired
	 * @NoCSRFRequired
	 *
	 * Render default template
	 */
	public function index() {
		Util::addScript(Application::APP_ID, 'whoiswho-main');
		Util::addStyle(Application::APP_ID, 'whoiswho-main');

		$response = new TemplateResponse(Application::APP_ID, 'main');

		$csp = new ContentSecurityPolicy();
		$csp->addAllowedImageDomain('https://nextcloud.com');
		$response->setContentSecurityPolicy($csp);

		return $response;
	}
}

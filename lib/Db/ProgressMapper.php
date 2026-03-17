<?php

/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

declare(strict_types=1);

namespace OCA\WhoIsWho\Db;

use OCP\AppFramework\Db\DoesNotExistException;
use OCP\AppFramework\Db\QBMapper;
use OCP\IDBConnection;

/**
 * @template-extends QBMapper<ProgressEntry>
 */
class ProgressMapper extends QBMapper {
	public function __construct(IDBConnection $db) {
		parent::__construct($db, 'whoiswho_progress', ProgressEntry::class);
	}

	/**
	 * Find the progress entry for a user, or return null if none exists yet.
	 */
	public function findByUserId(string $userId): ?ProgressEntry {
		$qb = $this->db->getQueryBuilder();
		$qb->select('*')
			->from($this->tableName)
			->where($qb->expr()->eq('user_id', $qb->createNamedParameter($userId)));
		try {
			/** @var ProgressEntry */
			return $this->findEntity($qb);
		} catch (DoesNotExistException) {
			return null;
		}
	}

	/**
	 * Insert or update the progress JSON for a user.
	 */
	public function upsert(string $userId, string $progressJson): void {
		$existing = $this->findByUserId($userId);
		if ($existing !== null) {
			$existing->setProgressJson($progressJson);
			$existing->setUpdatedAt(time());
			$this->update($existing);
		} else {
			$entry = new ProgressEntry();
			$entry->setUserId($userId);
			$entry->setProgressJson($progressJson);
			$entry->setUpdatedAt(time());
			$this->insert($entry);
		}
	}
}

<?php

/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

declare(strict_types=1);

namespace OCA\WhoIsWho\Db;

use OCP\AppFramework\Db\QBMapper;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\IDBConnection;

/**
 * @template-extends QBMapper<GameProgressEntry>
 */
class GameProgressMapper extends QBMapper {
	public function __construct(IDBConnection $db) {
		parent::__construct($db, 'whoiswho_game_progress', GameProgressEntry::class);
	}

	public function findByUserId(string $userId): ?GameProgressEntry {
		$qb = $this->db->getQueryBuilder();
		$qb->select('*')
			->from($this->tableName)
			->where($qb->expr()->eq('user_id', $qb->createNamedParameter($userId)));
		$result = $qb->executeQuery();
		$row = $result->fetchAssociative();
		$result->closeCursor();

		if ($row === false) {
			return null;
		}

		return $this->mapRowToEntity($row);
	}

	public function upsertProgress(string $userId, array $progressData): void {
		$json = json_encode($progressData, JSON_THROW_ON_ERROR);
		$now = time();

		$existing = $this->findByUserId($userId);
		if ($existing === null) {
			try {
				$qb = $this->db->getQueryBuilder();
				$qb->insert($this->tableName)
					->values([
						'user_id' => $qb->createNamedParameter($userId),
						'progress_json' => $qb->createNamedParameter($json),
						'updated_at' => $qb->createNamedParameter($now, IQueryBuilder::PARAM_INT),
					])
					->executeStatement();
				return;
			} catch (\Exception) {
				// Concurrent insert — fall through to update
			}
		}

		$qb = $this->db->getQueryBuilder();
		$qb->update($this->tableName)
			->set('progress_json', $qb->createNamedParameter($json))
			->set('updated_at', $qb->createNamedParameter($now, IQueryBuilder::PARAM_INT))
			->where($qb->expr()->eq('user_id', $qb->createNamedParameter($userId)))
			->executeStatement();
	}

	public function getProgressData(string $userId): array {
		$entry = $this->findByUserId($userId);
		if ($entry === null) {
			return [];
		}
		return json_decode($entry->getProgressJson(), true) ?? [];
	}
}

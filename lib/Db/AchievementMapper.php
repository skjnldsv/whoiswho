<?php

/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

declare(strict_types=1);

namespace OCA\WhoIsWho\Db;

use OCP\AppFramework\Db\QBMapper;
use OCP\IDBConnection;

/**
 * @template-extends QBMapper<AchievementEntry>
 */
class AchievementMapper extends QBMapper {
	public function __construct(IDBConnection $db) {
		parent::__construct($db, 'whoiswho_achievements', AchievementEntry::class);
	}

	/** @return string[] List of achievement IDs unlocked by this user */
	public function getUnlockedIds(string $userId): array {
		$qb = $this->db->getQueryBuilder();
		$qb->select('achievement_id')
			->from($this->tableName)
			->where($qb->expr()->eq('user_id', $qb->createNamedParameter($userId)));
		$result = $qb->executeQuery();
		$rows = $result->fetchAllAssociative();
		$result->closeCursor();
		return array_column($rows, 'achievement_id');
	}

	/**
	 * Insert an achievement unlock record, ignoring duplicates.
	 */
	public function unlock(string $userId, string $achievementId): void {
		// Guard against a race-condition duplicate insert
		try {
			$qb = $this->db->getQueryBuilder();
			$qb->insert($this->tableName)
				->values([
					'user_id' => $qb->createNamedParameter($userId),
					'achievement_id' => $qb->createNamedParameter($achievementId),
					'unlocked_at' => $qb->createNamedParameter(time()),
				])
				->executeStatement();
		} catch (\Exception) {
			// Already unlocked — silently ignore
		}
	}
}

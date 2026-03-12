<?php

/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

declare(strict_types=1);

namespace OCA\WhoisWho\Db;

use OCP\AppFramework\Db\QBMapper;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\IDBConnection;

/**
 * @template-extends QBMapper<LeaderboardEntry>
 */
class LeaderboardMapper extends QBMapper {
	public function __construct(IDBConnection $db) {
		parent::__construct($db, 'whoiswho_leaderboard', LeaderboardEntry::class);
	}

	/** @return array<array-key, array<string, mixed>> */
	public function getTopAllTime(int $limit = 20): array {
		$qb = $this->db->getQueryBuilder();
		$qb->select('user_id', 'display_name', 'total_score', 'updated_at')
			->from($this->tableName)
			->orderBy('total_score', 'DESC')
			->setMaxResults($limit);
		$result = $qb->executeQuery();
		$rows = $result->fetchAllAssociative();
		$result->closeCursor();
		return $rows;
	}

	/** @return array<array-key, array<string, mixed>> */
	public function getTopWeekly(int $limit = 20): array {
		$currentWeek = $this->getCurrentWeekLabel();
		$qb = $this->db->getQueryBuilder();
		$qb->select('user_id', 'display_name', 'week_score', 'week_label')
			->from($this->tableName)
			->where($qb->expr()->eq('week_label', $qb->createNamedParameter($currentWeek)))
			->orderBy('week_score', 'DESC')
			->setMaxResults($limit);
		$result = $qb->executeQuery();
		$rows = $result->fetchAllAssociative();
		$result->closeCursor();
		return $rows;
	}

	public function upsertScore(string $userId, string $displayName, int $scoreToAdd): void {
		$currentWeek = $this->getCurrentWeekLabel();
		$now = time();

		// Find existing entry
		$qb = $this->db->getQueryBuilder();
		$qb->select('id', 'total_score', 'week_label', 'week_score')
			->from($this->tableName)
			->where($qb->expr()->eq('user_id', $qb->createNamedParameter($userId)));
		$result = $qb->executeQuery();
		$existing = $result->fetchAssociative();
		$result->closeCursor();

		if ($existing === false) {
			// First entry for this user
			$qb = $this->db->getQueryBuilder();
			$qb->insert($this->tableName)
				->values([
					'user_id' => $qb->createNamedParameter($userId),
					'display_name' => $qb->createNamedParameter($displayName),
					'total_score' => $qb->createNamedParameter($scoreToAdd, IQueryBuilder::PARAM_INT),
					'week_label' => $qb->createNamedParameter($currentWeek),
					'week_score' => $qb->createNamedParameter($scoreToAdd, IQueryBuilder::PARAM_INT),
					'updated_at' => $qb->createNamedParameter($now, IQueryBuilder::PARAM_INT),
				])
				->executeStatement();
		} else {
			// Accumulate: if same week add week_score, otherwise reset it
			$weekScore = ($existing['week_label'] === $currentWeek)
				? (int)$existing['week_score'] + $scoreToAdd
				: $scoreToAdd;
			$totalScore = (int)$existing['total_score'] + $scoreToAdd;

			$qb = $this->db->getQueryBuilder();
			$qb->update($this->tableName)
				->set('display_name', $qb->createNamedParameter($displayName))
				->set('total_score', $qb->createNamedParameter($totalScore, IQueryBuilder::PARAM_INT))
				->set('week_label', $qb->createNamedParameter($currentWeek))
				->set('week_score', $qb->createNamedParameter($weekScore, IQueryBuilder::PARAM_INT))
				->set('updated_at', $qb->createNamedParameter($now, IQueryBuilder::PARAM_INT))
				->where($qb->expr()->eq('user_id', $qb->createNamedParameter($userId)))
				->executeStatement();
		}
	}

	private function getCurrentWeekLabel(): string {
		// e.g. "2026-10" (ISO year + week number)
		return (new \DateTime('now', new \DateTimeZone('UTC')))->format('o-W');
	}
}

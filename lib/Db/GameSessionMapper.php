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
 * @template-extends QBMapper<GameSessionEntry>
 */
class GameSessionMapper extends QBMapper {
	public function __construct(IDBConnection $db) {
		parent::__construct($db, 'whoiswho_game_sessions', GameSessionEntry::class);
	}

	public function findActiveSession(string $userId): ?GameSessionEntry {
		$qb = $this->db->getQueryBuilder();
		$qb->select('*')
			->from($this->tableName)
			->where($qb->expr()->eq('user_id', $qb->createNamedParameter($userId)))
			->andWhere($qb->expr()->eq('active', $qb->createNamedParameter(true, IQueryBuilder::PARAM_BOOL)))
			->orderBy('created_at', 'DESC')
			->setMaxResults(1);
		$result = $qb->executeQuery();
		$row = $result->fetchAssociative();
		$result->closeCursor();

		if ($row === false) {
			return null;
		}

		return $this->mapRowToEntity($row);
	}

	public function deactivateAllSessions(string $userId): void {
		$qb = $this->db->getQueryBuilder();
		$qb->update($this->tableName)
			->set('active', $qb->createNamedParameter(false, IQueryBuilder::PARAM_BOOL))
			->set('updated_at', $qb->createNamedParameter(time(), IQueryBuilder::PARAM_INT))
			->where($qb->expr()->eq('user_id', $qb->createNamedParameter($userId)))
			->andWhere($qb->expr()->eq('active', $qb->createNamedParameter(true, IQueryBuilder::PARAM_BOOL)))
			->executeStatement();
	}

	public function createSession(string $userId, int $lives): GameSessionEntry {
		$now = time();
		$session = new GameSessionEntry();
		$session->setUserId($userId);
		$session->setLives($lives);
		$session->setStreak(0);
		$session->setBestStreak(0);
		$session->setXpEarned(0);
		$session->setAnswered(0);
		$session->setCorrect(0);
		$session->setWrong(0);
		$session->setNewlyMasteredJson('[]');
		$session->setActive(true);
		$session->setCreatedAt($now);
		$session->setUpdatedAt($now);
		return $this->insert($session);
	}
}

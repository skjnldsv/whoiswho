<?php

/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

declare(strict_types=1);

namespace OCA\WhoIsWho\Migration;

use Closure;
use OCP\DB\ISchemaWrapper;
use OCP\DB\Types;
use OCP\Migration\IOutput;
use OCP\Migration\SimpleMigrationStep;

/**
 * Migration to add server-side game progress and session tables.
 * This moves game logic from the frontend to the backend to prevent cheating.
 */
class Version000001Date20260312100000 extends SimpleMigrationStep {
	public function changeSchema(IOutput $output, Closure $schemaClosure, array $options): ?ISchemaWrapper {
		/** @var ISchemaWrapper $schema */
		$schema = $schemaClosure();

		// Per-user game progress (replaces browser IndexedDB storage)
		if (!$schema->hasTable('whoiswho_game_progress')) {
			$table = $schema->createTable('whoiswho_game_progress');
			$table->addColumn('id', Types::BIGINT, [
				'autoincrement' => true,
				'notnull' => true,
				'length' => 20,
			]);
			$table->addColumn('user_id', Types::STRING, [
				'notnull' => true,
				'length' => 64,
			]);
			$table->addColumn('progress_json', Types::TEXT, [
				'notnull' => true,
				'default' => '{}',
			]);
			$table->addColumn('updated_at', Types::BIGINT, [
				'notnull' => true,
				'default' => 0,
			]);
			$table->setPrimaryKey(['id']);
			$table->addUniqueIndex(['user_id'], 'whoiswho_gp_uid');
		}

		// Active game sessions (tracks current challenge, lives, streaks)
		if (!$schema->hasTable('whoiswho_game_sessions')) {
			$table = $schema->createTable('whoiswho_game_sessions');
			$table->addColumn('id', Types::BIGINT, [
				'autoincrement' => true,
				'notnull' => true,
				'length' => 20,
			]);
			$table->addColumn('user_id', Types::STRING, [
				'notnull' => true,
				'length' => 64,
			]);
			$table->addColumn('lives', Types::INTEGER, [
				'notnull' => true,
				'default' => 3,
			]);
			$table->addColumn('streak', Types::INTEGER, [
				'notnull' => true,
				'default' => 0,
			]);
			$table->addColumn('best_streak', Types::INTEGER, [
				'notnull' => true,
				'default' => 0,
			]);
			$table->addColumn('xp_earned', Types::INTEGER, [
				'notnull' => true,
				'default' => 0,
			]);
			$table->addColumn('answered', Types::INTEGER, [
				'notnull' => true,
				'default' => 0,
			]);
			$table->addColumn('correct', Types::INTEGER, [
				'notnull' => true,
				'default' => 0,
			]);
			$table->addColumn('wrong', Types::INTEGER, [
				'notnull' => true,
				'default' => 0,
			]);
			$table->addColumn('current_person_id', Types::INTEGER, [
				'notnull' => false,
			]);
			$table->addColumn('current_challenge_type', Types::STRING, [
				'notnull' => false,
				'length' => 20,
			]);
			$table->addColumn('current_correct_answer', Types::STRING, [
				'notnull' => false,
				'length' => 255,
			]);
			$table->addColumn('current_time_limit', Types::INTEGER, [
				'notnull' => true,
				'default' => 0,
			]);
			$table->addColumn('challenge_started_at', Types::BIGINT, [
				'notnull' => true,
				'default' => 0,
			]);
			$table->addColumn('last_person_id', Types::INTEGER, [
				'notnull' => false,
			]);
			$table->addColumn('newly_mastered_json', Types::TEXT, [
				'notnull' => true,
				'default' => '[]',
			]);
			$table->addColumn('active', Types::BOOLEAN, [
				'notnull' => true,
				'default' => true,
			]);
			$table->addColumn('created_at', Types::BIGINT, [
				'notnull' => true,
				'default' => 0,
			]);
			$table->addColumn('updated_at', Types::BIGINT, [
				'notnull' => true,
				'default' => 0,
			]);
			$table->setPrimaryKey(['id']);
			$table->addIndex(['user_id', 'active'], 'whoiswho_gs_uid_active');
		}

		return $schema;
	}
}

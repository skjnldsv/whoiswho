<?php

/**
 * SPDX-FileCopyrightText: 2026 John Molakvoæ <skjnldsv@protonmail.com>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

declare(strict_types=1);

namespace OCA\WhoIsWho\Service;

use OCA\WhoIsWho\Db\GameProgressMapper;
use OCA\WhoIsWho\Db\GameSessionEntry;
use OCA\WhoIsWho\Db\GameSessionMapper;

/**
 * Server-side game logic — ports the frontend composables to PHP so that
 * question generation, answer validation, scoring, and streak handling are
 * all authoritative on the backend.
 */
class GameService {

	// ── Lives ──────────────────────────────────────────────────────────────
	public const MAX_LIVES = 3;

	// ── Spaced-repetition intervals (seconds) ──────────────────────────────
	/** Review intervals by stage index (in seconds, converted from frontend ms). */
	private const INTERVALS = [0, 0, 30, 120, 600];
	private const WRONG_RETRY_INTERVAL = 5;
	private const CLOSE_RETRY_INTERVAL = 30;

	// ── XP ─────────────────────────────────────────────────────────────────
	private const HINT_COST_FIRST = 10;
	private const HINT_COST_SECOND = 15;
	private const CLOSE_ANSWER_XP_DIVISOR = 4;
	private const XP_PER_LEVEL = 100;
	private const FAST_ANSWER_BONUS_XP = 2;
	private const FAST_ANSWER_THRESHOLD = 0.3;

	// ── Challenge pool ─────────────────────────────────────────────────────
	private const ACTIVE_POOL_SIZE = 6;
	private const OPTION_COUNT = 4;

	// ── Close-answer detection ─────────────────────────────────────────────
	private const CLOSE_ANSWER_THRESHOLD = 2;

	// ── Second-hint reveal tuning ──────────────────────────────────────────
	private const REVEAL_MIN_COUNT = 2;
	private const REVEAL_FRACTION = 1 / 3;

	// ── Answer timers (seconds) ────────────────────────────────────────────
	private const ANSWER_TIME_LIMITS = [
		'meet' => 0,
		'recognize' => 5,
		'pick-face' => 5,
		'recall' => 10,
		'type' => 15,
	];

	// ── Streak bonus ────────────────────────────────────────────────────────
	private const STREAK_BONUS_INTERVAL = 5;
	private const STREAK_BONUS_XP = 5;

	// ── XP per challenge type ──────────────────────────────────────────────
	private const XP_PER_STAGE = [
		'meet' => 5,
		'recognize' => 15,
		'pick-face' => 15,
		'recall' => 25,
		'type' => 40,
	];

	// ── Stage to challenge type mapping ────────────────────────────────────
	private const STAGE_TO_TYPE = ['meet', 'recognize', 'recognize', 'recall', 'type'];

	// ── Placeholder ────────────────────────────────────────────────────────
	private const PLACEHOLDER_PHOTO = 'https://nextcloud.com/c/themes/nextcloud-theme/dist/img/person.jpg';

	public function __construct(
		private GameProgressMapper $progressMapper,
		private GameSessionMapper $sessionMapper,
	) {
	}

	// ══════════════════════════════════════════════════════════════════════
	// Session management
	// ══════════════════════════════════════════════════════════════════════

	/**
	 * Start a new game session for the user.
	 *
	 * @return array{session: array, progress: array}
	 */
	public function startSession(string $userId, array $allMembers): array {
		// Deactivate any existing sessions
		$this->sessionMapper->deactivateAllSessions($userId);

		$progress = $this->loadProgress($userId);

		// Restore persisted lives if a session was interrupted
		$lives = ($progress['sessionActive'] ?? false)
			? ($progress['currentLives'] ?? self::MAX_LIVES)
			: self::MAX_LIVES;

		$session = $this->sessionMapper->createSession($userId, $lives);

		// Mark progress as session active
		$progress['sessionActive'] = true;
		$progress['sessionsPlayed'] = ($progress['sessionsPlayed'] ?? 0) + 1;
		$progress['lastPlayed'] = time();
		$progress['currentLives'] = $lives;
		$this->saveProgress($userId, $progress);

		return [
			'session' => $this->sessionToArray($session),
			'progress' => $this->sanitizeProgress($progress),
		];
	}

	/**
	 * End the current session and return the summary.
	 *
	 * @return array Session summary
	 */
	public function endSession(string $userId): array {
		$session = $this->sessionMapper->findActiveSession($userId);
		if ($session === null) {
			return ['error' => 'No active session'];
		}

		$session->setActive(false);
		$session->setUpdatedAt(time());
		$this->sessionMapper->update($session);

		// Reset session-specific progress state
		$progress = $this->loadProgress($userId);
		$progress['sessionActive'] = false;
		$progress['currentStreak'] = 0;
		$this->saveProgress($userId, $progress);

		return [
			'session' => $this->sessionToArray($session),
			'progress' => $this->sanitizeProgress($progress),
		];
	}

	// ══════════════════════════════════════════════════════════════════════
	// Challenge generation
	// ══════════════════════════════════════════════════════════════════════

	/**
	 * Generate the next challenge for the current session.
	 * The correct answer is stored server-side and never sent to the client.
	 *
	 * @return array Challenge data (without correctAnswer)
	 */
	public function getNextChallenge(string $userId, array $allMembers): array {
		$session = $this->sessionMapper->findActiveSession($userId);
		if ($session === null) {
			return ['error' => 'No active session'];
		}

		if ($session->getLives() <= 0) {
			return ['gameOver' => true];
		}

		$progress = $this->loadProgress($userId);

		// Filter to valid members
		$validMembers = $this->filterValidMembers($allMembers);
		if (empty($validMembers)) {
			return ['gameOver' => true];
		}

		// Pick next person using spaced repetition
		$person = $this->pickNextPerson($progress, $validMembers, $session->getLastPersonId());
		if ($person === null) {
			return ['gameOver' => true];
		}

		// Build challenge
		$challenge = $this->buildChallenge($person, $progress, $validMembers);

		// Store current challenge info in session (server-side only)
		$now = time();
		$session->setCurrentPersonId((int)$person['id']);
		$session->setCurrentChallengeType($challenge['type']);
		$session->setCurrentCorrectAnswer($person['name']);
		$session->setCurrentTimeLimit($challenge['timeLimit']);
		$session->setChallengeStartedAt($now);
		$session->setLastPersonId((int)$person['id']);
		$session->setUpdatedAt($now);
		$this->sessionMapper->update($session);

		// Return challenge WITHOUT the correct answer
		$clientChallenge = $challenge;
		unset($clientChallenge['correctAnswer']);

		return [
			'challenge' => $clientChallenge,
			'session' => $this->sessionToArray($session),
		];
	}

	/**
	 * Submit an answer for the current challenge.
	 *
	 * @return array Result with correct answer revealed
	 */
	public function submitAnswer(string $userId, string $answer, array $allMembers): array {
		$session = $this->sessionMapper->findActiveSession($userId);
		if ($session === null) {
			return ['error' => 'No active session'];
		}

		$correctAnswer = $session->getCurrentCorrectAnswer();
		if ($correctAnswer === null) {
			return ['error' => 'No active challenge'];
		}

		$challengeType = $session->getCurrentChallengeType() ?? 'meet';
		$personId = $session->getCurrentPersonId() ?? 0;
		$isMeet = $challengeType === 'meet';

		// Normalize and compare
		$normalizedAnswer = $this->normalizeText($answer);
		$normalizedCorrect = $this->normalizeText($correctAnswer);
		$isCorrect = $isMeet || $normalizedAnswer === $normalizedCorrect;
		$isClose = !$isCorrect && !$isMeet
			&& strlen($normalizedAnswer) > 0
			&& levenshtein($normalizedAnswer, $normalizedCorrect) <= self::CLOSE_ANSWER_THRESHOLD;

		// Calculate response time
		$responseTime = $session->getChallengeStartedAt() > 0
			? time() - $session->getChallengeStartedAt()
			: 0;

		$progress = $this->loadProgress($userId);
		$xpAwarded = 0;
		$leveledUp = false;
		$streakBonus = 0;
		$gameOver = false;

		// Update per-person response time stats
		$pp = &$this->getPersonProgressRef($progress, $personId);
		$pp['lastResponseTime'] = $responseTime;
		$totalAnswers = ($pp['totalCorrect'] ?? 0) + ($pp['totalWrong'] ?? 0) + 1;
		$pp['avgResponseTime'] = ($pp['avgResponseTime'] ?? 0) === 0
			? $responseTime
			: (int)round((($pp['avgResponseTime'] ?? 0) * ($totalAnswers - 1) + $responseTime) / $totalAnswers);

		if ($isCorrect) {
			$result = $this->recordCorrect($progress, $personId, $challengeType, $session->getStreak());
			$xpAwarded = $result['xp'];
			$leveledUp = $result['leveledUp'];

			$session->setAnswered($session->getAnswered() + 1);
			$session->setCorrect($session->getCorrect() + 1);
			$session->setStreak($session->getStreak() + 1);
			$session->setXpEarned($session->getXpEarned() + $xpAwarded);

			// Fast-answer bonus
			$timeLimit = $session->getCurrentTimeLimit();
			if ($timeLimit > 0 && $responseTime > 0 && $responseTime < $timeLimit * self::FAST_ANSWER_THRESHOLD) {
				$this->applyXp($progress, self::FAST_ANSWER_BONUS_XP);
				$session->setXpEarned($session->getXpEarned() + self::FAST_ANSWER_BONUS_XP);
				$xpAwarded += self::FAST_ANSWER_BONUS_XP;
			}

			// Streak bonus
			$currentStreak = $session->getStreak();
			if ($currentStreak > 0 && $currentStreak % self::STREAK_BONUS_INTERVAL === 0) {
				$this->applyXp($progress, self::STREAK_BONUS_XP);
				$session->setXpEarned($session->getXpEarned() + self::STREAK_BONUS_XP);
				$streakBonus = self::STREAK_BONUS_XP;
				$xpAwarded += self::STREAK_BONUS_XP;
			}

			if ($currentStreak > $session->getBestStreak()) {
				$session->setBestStreak($currentStreak);
			}

			// Check if person reached mastered status
			$updatedPp = $this->getPersonProgress($progress, $personId);
			if (($updatedPp['stage'] ?? 0) === 4) {
				$mastered = json_decode($session->getNewlyMasteredJson(), true) ?? [];
				$mastered[] = $correctAnswer;
				$session->setNewlyMasteredJson(json_encode($mastered));
			}
		} elseif ($isClose) {
			$result = $this->recordClose($progress, $personId, $challengeType);
			$xpAwarded = $result['xp'];
			$session->setAnswered($session->getAnswered() + 1);
			$session->setWrong($session->getWrong() + 1);
			$session->setStreak(0);
		} else {
			$this->recordWrong($progress, $personId);
			$session->setAnswered($session->getAnswered() + 1);
			$session->setWrong($session->getWrong() + 1);
			$session->setStreak(0);

			$session->setLives($session->getLives() - 1);
			$progress['currentLives'] = $session->getLives();
			if ($session->getLives() <= 0) {
				$gameOver = true;
				$session->setActive(false);
				$progress['sessionActive'] = false;
				$progress['currentStreak'] = 0;
			}
		}

		// Clear current challenge
		$session->setCurrentPersonId(null);
		$session->setCurrentChallengeType(null);
		$session->setCurrentCorrectAnswer(null);
		$session->setUpdatedAt(time());
		$this->sessionMapper->update($session);
		$this->saveProgress($userId, $progress);

		return [
			'correct' => $isCorrect,
			'close' => $isClose,
			'correctAnswer' => $correctAnswer,
			'xp' => $xpAwarded,
			'leveledUp' => $leveledUp,
			'streakBonus' => $streakBonus,
			'responseTime' => $responseTime,
			'gameOver' => $gameOver,
			'session' => $this->sessionToArray($session),
			'progress' => $this->sanitizeProgress($progress),
		];
	}

	/**
	 * Skip the current challenge (I don't know).
	 *
	 * @return array Result
	 */
	public function skipChallenge(string $userId): array {
		$session = $this->sessionMapper->findActiveSession($userId);
		if ($session === null) {
			return ['error' => 'No active session'];
		}

		$correctAnswer = $session->getCurrentCorrectAnswer();
		if ($correctAnswer === null) {
			return ['error' => 'No active challenge'];
		}

		$personId = $session->getCurrentPersonId() ?? 0;
		$progress = $this->loadProgress($userId);

		$this->recordWrong($progress, $personId);
		$session->setAnswered($session->getAnswered() + 1);
		$session->setWrong($session->getWrong() + 1);
		$session->setStreak(0);

		// Clear current challenge
		$session->setCurrentPersonId(null);
		$session->setCurrentChallengeType(null);
		$session->setCurrentCorrectAnswer(null);
		$session->setUpdatedAt(time());
		$this->sessionMapper->update($session);
		$this->saveProgress($userId, $progress);

		return [
			'correctAnswer' => $correctAnswer,
			'session' => $this->sessionToArray($session),
			'progress' => $this->sanitizeProgress($progress),
		];
	}

	/**
	 * Use a hint (first or second level).
	 *
	 * @param int $level 1 or 2
	 * @return array Hint data
	 */
	public function useHint(string $userId, int $level, array $allMembers): array {
		$session = $this->sessionMapper->findActiveSession($userId);
		if ($session === null) {
			return ['error' => 'No active session'];
		}

		$personId = $session->getCurrentPersonId();
		if ($personId === null) {
			return ['error' => 'No active challenge'];
		}

		$progress = $this->loadProgress($userId);
		$challengeType = $session->getCurrentChallengeType() ?? 'meet';

		if ($level === 1) {
			$cost = self::HINT_COST_FIRST;
			if (($progress['xp'] ?? 0) < $cost) {
				return ['error' => 'Not enough XP'];
			}

			$this->applyXp($progress, -$cost);
			$session->setXpEarned($session->getXpEarned() - $cost);
			$this->saveProgress($userId, $progress);
			$session->setUpdatedAt(time());
			$this->sessionMapper->update($session);

			// Find person in allMembers
			$person = $this->findMemberById($allMembers, $personId);
			$hint = $person !== null
				? ($person['title'] . ' — ' . $person['department'])
				: '';

			return [
				'hint' => $hint,
				'session' => $this->sessionToArray($session),
				'progress' => $this->sanitizeProgress($progress),
			];
		}

		if ($level === 2) {
			$cost = self::HINT_COST_SECOND;
			if (($progress['xp'] ?? 0) < $cost) {
				return ['error' => 'Not enough XP'];
			}

			$this->applyXp($progress, -$cost);
			$session->setXpEarned($session->getXpEarned() - $cost);
			$this->saveProgress($userId, $progress);
			$session->setUpdatedAt(time());
			$this->sessionMapper->update($session);

			$result = ['session' => $this->sessionToArray($session), 'progress' => $this->sanitizeProgress($progress)];

			if ($challengeType === 'recall' || $challengeType === 'type') {
				$name = $session->getCurrentCorrectAnswer() ?? '';
				$mask = $this->generateMaskedName($name);
				$result['revealedMask'] = $this->revealMoreLetters($name, $mask);
			} else {
				$result['eliminatedOption'] = $this->getEliminateOption($session, $allMembers);
			}

			return $result;
		}

		return ['error' => 'Invalid hint level'];
	}

	/**
	 * Get the current game progress for a user.
	 *
	 * @return array Progress data (sanitized for client)
	 */
	public function getProgress(string $userId): array {
		$progress = $this->loadProgress($userId);
		$session = $this->sessionMapper->findActiveSession($userId);

		return [
			'progress' => $this->sanitizeProgress($progress),
			'session' => $session !== null ? $this->sessionToArray($session) : null,
		];
	}

	// ══════════════════════════════════════════════════════════════════════
	// Spaced repetition algorithm (ported from useSpacedRepetition.ts)
	// ══════════════════════════════════════════════════════════════════════

	/**
	 * Pick the next person to show based on spaced-repetition rules.
	 *
	 * Priority order:
	 * 1. Overdue active members (with more errors first)
	 * 2. New unseen members (when pool has room)
	 * 3. Active members soonest due
	 * 4. Mastered members due for review
	 * 5. New unseen members (pool is full but all active are not yet due)
	 * 6. Least-recently seen overall
	 */
	private function pickNextPerson(array &$progress, array $members, ?int $lastPersonId): ?array {
		if (empty($members)) {
			return null;
		}

		$now = time();
		$unseen = [];
		$dueForReview = [];
		$active = [];

		foreach ($members as $m) {
			$pp = $progress['people'][(int)$m['id']] ?? null;
			if ($pp === null || ($pp['stage'] ?? 0) === 0) {
				$unseen[] = $m;
			} elseif (($pp['stage'] ?? 0) >= 4) {
				if ($now >= ($pp['nextReview'] ?? 0)) {
					$dueForReview[] = ['member' => $m, 'priority' => $now - ($pp['nextReview'] ?? 0)];
				}
			} else {
				$active[] = ['member' => $m, 'pp' => $pp];
			}
		}

		$preferNotLast = function (array $arr) use ($lastPersonId): array {
			$filtered = array_filter($arr, fn($m) => (int)$m['id'] !== $lastPersonId);
			return !empty($filtered) ? array_values($filtered) : $arr;
		};

		// 1. Overdue active members
		$overdue = array_filter($active, fn($a) => $now >= ($a['pp']['nextReview'] ?? 0));
		$overdue = array_values($overdue);
		usort($overdue, fn($a, $b) => ($a['pp']['nextReview'] ?? 0) - ($b['pp']['nextReview'] ?? 0));

		if (!empty($overdue)) {
			$withErrors = array_values(array_filter($overdue, fn($a) => ($a['pp']['totalWrong'] ?? 0) > ($a['pp']['totalCorrect'] ?? 0)));
			if (!empty($withErrors)) {
				$pool = $preferNotLast(array_map(fn($a) => $a['member'], $withErrors));
				return $pool[array_rand($pool)];
			}
			$pool = $preferNotLast(array_map(fn($a) => $a['member'], $overdue));
			return $pool[0];
		}

		// 2. Introduce new members when pool has room
		if (count($active) < self::ACTIVE_POOL_SIZE && !empty($unseen)) {
			$pool = $preferNotLast($unseen);
			return $pool[array_rand($pool)];
		}

		// 3. Active member soonest due
		if (!empty($active)) {
			usort($active, fn($a, $b) => ($a['pp']['nextReview'] ?? 0) - ($b['pp']['nextReview'] ?? 0));
			$pool = $preferNotLast(array_map(fn($a) => $a['member'], $active));
			return $pool[0];
		}

		// 4. Mastered members due for review
		if (!empty($dueForReview)) {
			usort($dueForReview, fn($a, $b) => $b['priority'] - $a['priority']);
			$pool = $preferNotLast(array_map(fn($a) => $a['member'], $dueForReview));
			return $pool[0];
		}

		// 5. Introduce new members (pool full but all active not due)
		if (!empty($unseen)) {
			$pool = $preferNotLast($unseen);
			return $pool[array_rand($pool)];
		}

		// 6. Fallback: least-recently seen
		$allWithProgress = [];
		foreach ($members as $m) {
			$pp = $progress['people'][(int)$m['id']] ?? null;
			if ($pp !== null) {
				$allWithProgress[] = ['member' => $m, 'pp' => $pp];
			}
		}
		usort($allWithProgress, fn($a, $b) => ($a['pp']['lastSeen'] ?? 0) - ($b['pp']['lastSeen'] ?? 0));

		return !empty($allWithProgress) ? $allWithProgress[0]['member'] : $members[0];
	}

	/**
	 * Compute the next review timestamp for a given stage.
	 */
	private function nextReviewAt(int $stage): int {
		$interval = self::INTERVALS[min($stage, count(self::INTERVALS) - 1)] ?? 0;
		return time() + $interval;
	}

	// ══════════════════════════════════════════════════════════════════════
	// Challenge builder (ported from useChallengeBuilder.ts)
	// ══════════════════════════════════════════════════════════════════════

	/**
	 * Build a challenge for the given person based on their current stage.
	 */
	private function buildChallenge(array $person, array &$progress, array $allMembers): array {
		$pp = $this->getPersonProgress($progress, (int)$person['id']);
		$stageIndex = min($pp['stage'] ?? 0, 4);
		$type = self::STAGE_TO_TYPE[$stageIndex];

		// At recognize stage, randomly alternate between name-pick and face-pick
		if ($type === 'recognize' && count($allMembers) >= 4) {
			$type = random_int(0, 1) === 0 ? 'recognize' : 'pick-face';
		}

		$challenge = [
			'type' => $type,
			'person' => $this->sanitizePerson($person),
			'correctAnswer' => $person['name'],
			'timeLimit' => self::ANSWER_TIME_LIMITS[$type] ?? 0,
		];

		if ($type === 'recognize') {
			$challenge['options'] = $this->getRandomOptions($person, $allMembers);
		} elseif ($type === 'pick-face') {
			$challenge['photoOptions'] = $this->getRandomPhotoOptions($person, $allMembers);
		} elseif ($type === 'recall') {
			$challenge['maskedName'] = $this->generateMaskedName($person['name']);
		}

		return $challenge;
	}

	/**
	 * Generate a masked version of a name (first letter of each word visible).
	 */
	private function generateMaskedName(string $name): string {
		$parts = explode(' ', $name);
		$masked = array_map(function (string $part): string {
			if (mb_strlen($part) <= 2) {
				return $part;
			}
			$first = mb_substr($part, 0, 1);
			$rest = mb_substr($part, 1);
			return $first . preg_replace('/[a-zA-ZÀ-ÿ]/u', '_', $rest);
		}, $parts);
		return implode(' ', $masked);
	}

	/**
	 * Pick N-1 random wrong name options plus the correct answer, shuffled.
	 */
	private function getRandomOptions(array $correct, array $allMembers, int $count = self::OPTION_COUNT): array {
		$others = array_filter($allMembers, fn($m) =>
			(int)$m['id'] !== (int)$correct['id']
			&& ($m['photo'] ?? '') !== self::PLACEHOLDER_PHOTO
			&& !empty($m['name']));
		$others = array_values($others);
		shuffle($others);
		$wrongNames = array_map(fn($m) => $m['name'], array_slice($others, 0, $count - 1));
		$options = array_merge($wrongNames, [$correct['name']]);
		shuffle($options);
		return $options;
	}

	/**
	 * Pick N-1 random wrong photo options plus the correct person, shuffled.
	 */
	private function getRandomPhotoOptions(array $correct, array $allMembers, int $count = self::OPTION_COUNT): array {
		$others = array_filter($allMembers, fn($m) =>
			(int)$m['id'] !== (int)$correct['id']
			&& ($m['photo'] ?? '') !== self::PLACEHOLDER_PHOTO
			&& !empty($m['name']));
		$others = array_values($others);
		shuffle($others);
		$wrongMembers = array_map(
			fn($m) => $this->sanitizePerson($m),
			array_slice($others, 0, $count - 1)
		);
		$options = array_merge($wrongMembers, [$this->sanitizePerson($correct)]);
		shuffle($options);
		return $options;
	}

	// ══════════════════════════════════════════════════════════════════════
	// Scoring (ported from useScoring.ts)
	// ══════════════════════════════════════════════════════════════════════

	/**
	 * Record a correct answer: advance stage, update streaks, award XP.
	 */
	private function recordCorrect(array &$progress, int $personId, string $challengeType, int $sessionStreak): array {
		$pp = &$this->getPersonProgressRef($progress, $personId);
		$now = time();

		$pp['lastSeen'] = $now;
		$pp['totalCorrect'] = ($pp['totalCorrect'] ?? 0) + 1;
		$pp['correctStreak'] = ($pp['correctStreak'] ?? 0) + 1;
		$pp['stage'] = min(($pp['stage'] ?? 0) + 1, 4);
		$pp['nextReview'] = $this->nextReviewAt($pp['stage']);

		$progress['totalAnswered'] = ($progress['totalAnswered'] ?? 0) + 1;
		$progress['totalCorrect'] = ($progress['totalCorrect'] ?? 0) + 1;

		$xp = self::XP_PER_STAGE[$challengeType] ?? 0;
		$result = $this->applyXp($progress, $xp);

		$newStreak = $sessionStreak + 1;
		if ($newStreak > ($progress['bestStreak'] ?? 0)) {
			$progress['bestStreak'] = $newStreak;
		}
		$progress['currentStreak'] = $newStreak;

		return ['xp' => $xp, 'leveledUp' => $result['leveledUp'], 'newStage' => $pp['stage']];
	}

	/**
	 * Record a close answer: partial XP, no stage change, retry soon.
	 */
	private function recordClose(array &$progress, int $personId, string $challengeType): array {
		$pp = &$this->getPersonProgressRef($progress, $personId);
		$now = time();

		$pp['lastSeen'] = $now;
		$pp['totalWrong'] = ($pp['totalWrong'] ?? 0) + 1;
		$pp['correctStreak'] = 0;
		$pp['nextReview'] = $now + self::CLOSE_RETRY_INTERVAL;

		$progress['totalAnswered'] = ($progress['totalAnswered'] ?? 0) + 1;
		$progress['currentStreak'] = 0;

		$partialXp = (int)ceil((self::XP_PER_STAGE[$challengeType] ?? 0) / self::CLOSE_ANSWER_XP_DIVISOR);
		$this->applyXp($progress, $partialXp);

		return ['xp' => $partialXp];
	}

	/**
	 * Record a wrong answer: regress stage.
	 */
	private function recordWrong(array &$progress, int $personId): void {
		$pp = &$this->getPersonProgressRef($progress, $personId);
		$now = time();

		$pp['lastSeen'] = $now;
		$pp['totalWrong'] = ($pp['totalWrong'] ?? 0) + 1;
		$pp['correctStreak'] = 0;
		$pp['stage'] = max(($pp['stage'] ?? 1) - 1, 1);
		$pp['nextReview'] = $now + self::WRONG_RETRY_INTERVAL;

		$progress['totalAnswered'] = ($progress['totalAnswered'] ?? 0) + 1;
		$progress['currentStreak'] = 0;
	}

	/**
	 * Apply XP to the progress and handle level-ups.
	 */
	private function applyXp(array &$progress, int $xpDelta): array {
		$progress['xp'] = max(0, ($progress['xp'] ?? 0) + $xpDelta);

		$leveledUp = false;
		$level = $progress['level'] ?? 1;
		$xpForLevel = $level * self::XP_PER_LEVEL;
		if ($progress['xp'] >= $xpForLevel) {
			$progress['level'] = $level + 1;
			$leveledUp = true;
		}

		return ['leveledUp' => $leveledUp, 'newLevel' => $progress['level'] ?? 1];
	}

	// ══════════════════════════════════════════════════════════════════════
	// Hint helpers
	// ══════════════════════════════════════════════════════════════════════

	/**
	 * Reveal ~1/3 of remaining hidden letters in a masked name.
	 */
	private function revealMoreLetters(string $name, string $baseMask): string {
		$hiddenIndices = [];
		$len = mb_strlen($baseMask);
		for ($i = 0; $i < $len; $i++) {
			if (mb_substr($baseMask, $i, 1) === '_') {
				$hiddenIndices[] = $i;
			}
		}
		if (empty($hiddenIndices)) {
			return $baseMask;
		}

		$revealCount = max(self::REVEAL_MIN_COUNT, (int)ceil(count($hiddenIndices) * self::REVEAL_FRACTION));
		shuffle($hiddenIndices);
		$toReveal = array_slice($hiddenIndices, 0, $revealCount);

		$chars = preg_split('//u', $baseMask, -1, PREG_SPLIT_NO_EMPTY);
		$nameChars = preg_split('//u', $name, -1, PREG_SPLIT_NO_EMPTY);
		foreach ($toReveal as $idx) {
			if (isset($nameChars[$idx])) {
				$chars[$idx] = $nameChars[$idx];
			}
		}
		return implode('', $chars);
	}

	/**
	 * Get a wrong option to eliminate for recognize/pick-face hints.
	 */
	private function getEliminateOption(GameSessionEntry $session, array $allMembers): ?string {
		$correctAnswer = $session->getCurrentCorrectAnswer();
		// Return a random wrong member name that isn't the correct answer
		$validMembers = $this->filterValidMembers($allMembers);
		$wrong = array_filter($validMembers, fn($m) => $m['name'] !== $correctAnswer);
		$wrong = array_values($wrong);
		if (empty($wrong)) {
			return null;
		}
		return $wrong[array_rand($wrong)]['name'];
	}

	// ══════════════════════════════════════════════════════════════════════
	// String utilities (ported from utils/strings.ts)
	// ══════════════════════════════════════════════════════════════════════

	/**
	 * Strip diacritics for accent-agnostic text comparison.
	 * E.g. "Jose" matches "José".
	 */
	private function normalizeText(string $s): string {
		$s = trim(mb_strtolower($s));
		// Decompose unicode, then strip combining marks
		$s = \Normalizer::normalize($s, \Normalizer::FORM_D);
		return preg_replace('/[\x{0300}-\x{036f}]/u', '', $s);
	}

	// ══════════════════════════════════════════════════════════════════════
	// Storage helpers
	// ══════════════════════════════════════════════════════════════════════

	/**
	 * Load game progress from the database, returning a default if none exists.
	 */
	private function loadProgress(string $userId): array {
		$data = $this->progressMapper->getProgressData($userId);
		return array_merge($this->defaultProgress(), $data);
	}

	/**
	 * Save game progress to the database.
	 */
	private function saveProgress(string $userId, array $progress): void {
		$this->progressMapper->upsertProgress($userId, $progress);
	}

	/**
	 * Default progress structure matching the frontend GameProgress interface.
	 */
	private function defaultProgress(): array {
		return [
			'people' => [],
			'xp' => 0,
			'level' => 1,
			'totalAnswered' => 0,
			'totalCorrect' => 0,
			'bestStreak' => 0,
			'currentStreak' => 0,
			'sessionsPlayed' => 0,
			'lastPlayed' => 0,
			'currentLives' => self::MAX_LIVES,
			'sessionActive' => false,
		];
	}

	/**
	 * Get or create person progress within the progress array.
	 */
	private function getPersonProgress(array &$progress, int $personId): array {
		if (!isset($progress['people'][$personId])) {
			$progress['people'][$personId] = [
				'personId' => $personId,
				'stage' => 0,
				'correctStreak' => 0,
				'totalCorrect' => 0,
				'totalWrong' => 0,
				'lastSeen' => 0,
				'nextReview' => 0,
				'avgResponseTime' => 0,
				'lastResponseTime' => 0,
			];
		}
		return $progress['people'][$personId];
	}

	/**
	 * Get a reference to person progress for in-place mutation.
	 */
	private function &getPersonProgressRef(array &$progress, int $personId): array {
		if (!isset($progress['people'][$personId])) {
			$progress['people'][$personId] = [
				'personId' => $personId,
				'stage' => 0,
				'correctStreak' => 0,
				'totalCorrect' => 0,
				'totalWrong' => 0,
				'lastSeen' => 0,
				'nextReview' => 0,
				'avgResponseTime' => 0,
				'lastResponseTime' => 0,
			];
		}
		return $progress['people'][$personId];
	}

	// ══════════════════════════════════════════════════════════════════════
	// Data helpers
	// ══════════════════════════════════════════════════════════════════════

	/**
	 * Filter team members to only those with valid photos and names.
	 */
	private function filterValidMembers(array $members): array {
		return array_values(array_filter($members, fn($m) =>
			!empty($m['photo'])
			&& !empty($m['name'])
			&& ($m['photo'] ?? '') !== self::PLACEHOLDER_PHOTO));
	}

	/**
	 * Find a member by ID from the members array.
	 */
	private function findMemberById(array $members, int $id): ?array {
		foreach ($members as $m) {
			if ((int)$m['id'] === $id) {
				return $m;
			}
		}
		return null;
	}

	/**
	 * Remove sensitive data from a person for client response.
	 */
	private function sanitizePerson(array $person): array {
		return [
			'id' => (int)$person['id'],
			'name' => $person['name'],
			'title' => $person['title'] ?? '',
			'department' => $person['department'] ?? '',
			'photo' => $person['photo'] ?? '',
		];
	}

	/**
	 * Sanitize progress for client (remove internal-only fields if needed).
	 */
	private function sanitizeProgress(array $progress): array {
		return [
			'xp' => $progress['xp'] ?? 0,
			'level' => $progress['level'] ?? 1,
			'totalAnswered' => $progress['totalAnswered'] ?? 0,
			'totalCorrect' => $progress['totalCorrect'] ?? 0,
			'bestStreak' => $progress['bestStreak'] ?? 0,
			'currentStreak' => $progress['currentStreak'] ?? 0,
			'sessionsPlayed' => $progress['sessionsPlayed'] ?? 0,
			'lastPlayed' => $progress['lastPlayed'] ?? 0,
			'currentLives' => $progress['currentLives'] ?? self::MAX_LIVES,
			'sessionActive' => $progress['sessionActive'] ?? false,
			'people' => $progress['people'] ?? [],
		];
	}

	/**
	 * Convert a session entity to an array for API response.
	 */
	private function sessionToArray(GameSessionEntry $session): array {
		return [
			'id' => $session->getId(),
			'lives' => $session->getLives(),
			'streak' => $session->getStreak(),
			'bestStreak' => $session->getBestStreak(),
			'xpEarned' => $session->getXpEarned(),
			'answered' => $session->getAnswered(),
			'correct' => $session->getCorrect(),
			'wrong' => $session->getWrong(),
			'newlyMastered' => json_decode($session->getNewlyMasteredJson(), true) ?? [],
			'active' => $session->getActive(),
			'hasChallenge' => $session->getCurrentPersonId() !== null,
		];
	}
}

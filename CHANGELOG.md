# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).


## [1.2.0] - 2026-03-17

### Added

- **Backend progress persistence**: full game progress (XP, level, learning stages per person, streaks, play history) is now stored server-side per user so progress is preserved across browsers and devices
  - `GET /apps/whoiswho/progress` — fetch the authenticated user's stored progress
  - `PUT /apps/whoiswho/progress` — persist the current progress blob
  - `DELETE /apps/whoiswho/progress` — erase the user's server-side progress
- On startup the app merges the local browser copy with the server copy, taking the most advanced learning stage for each person so no progress is ever lost


## [1.1.1] - 2026-03-13

### Added

- Sub-prompt on recall challenge explaining the masked-name format
- Sub-prompt on type challenge to distinguish it from recall

### Fixed

- 2×2 photo-grid keyboard navigation now uses correct row/column logic
- Main panels scrolling: removed height caps and overflow constraints that prevented scrolling
- Restored `#content overflow-y: auto` so page scrolling works correctly inside Nextcloud
- Game mechanics: mastery detection, session cleanup, and state consistency
- Comeback-champion achievement now uses `sessionStats.lowestLives` for correct detection
- Removed redundant comeback-champion achievement duplicate
- Recall challenge time limit corrected from 10 s to 15 s
- Score is now submitted incrementally after each answer, preventing score loss on crash

## [1.1.0] - 2026-03-13

### Added

- **Achievement system** with 37 unlockable achievements across 7 categories:
  - **Learning**: milestone achievements for mastering people (first, 5, 10, 25, 50, all)
  - **Streak**: consecutive-correct-answer bonuses (5, 10, 25, 50 streak)
  - **Speed**: rewards for answering within tight time limits (lightning, quick-draw)
  - **Progression**: XP and level milestones (100, 500, 1 000, 5 000 XP; levels 5, 10)
  - **Dedication**: play-count and day-streak rewards (7-day streak, 30 sessions, ...)
  - **Accuracy**: error-free session achievements
  - **Special**: time-of-day and novelty unlocks (night-owl, early-bird, weekend warrior, ...)
- **Achievements screen**: dedicated view listing all achievements with locked/unlocked state and progress counts
- **Backend achievement persistence**: achievements are stored server-side per user so progress is preserved across browsers and devices
  - `GET /apps/whoiswho/achievements` — fetch the authenticated user's unlocked achievement IDs
  - `POST /apps/whoiswho/achievements/unlock` — unlock a specific achievement
- **Best-streak leaderboard column**: the weekly and all-time leaderboards now include each user's all-time best streak

### Changed

- Leaderboard now surfaces `best_streak` alongside total and weekly scores

## [1.0.0] - 2026-03-12

### Added

- **Four-stage spaced repetition learning system** to progressively memorise team members:
  - **Stage 1 – Meet**: View a person's photo, name, and role before being tested
  - **Stage 2 – Recognize**: Pick the correct name from four options, or pick the matching face from a photo grid
  - **Stage 3 – Recall**: Fill in the missing letters of the name (partial reveal)
  - **Stage 4 – Master**: Type the full name from memory
- **Spaced repetition scheduling**: reviews are spaced at 30 s → 2 min → 10 min intervals so difficult faces appear more often
- **Active learning pool** of up to 6 people at a time to keep sessions focused
- **Lives system**: 3 lives per session — wrong answers cost a life; the session ends when all lives are lost
- **Streak bonuses**: consecutive correct answers build a streak and award bonus XP
- **Close-answer detection**: typos within a Levenshtein distance of 2 are counted as "close" and award partial XP without losing a life
- **Two-level hint system**:
  - First hint: reveals the person's title and department (costs 10 XP)
  - Second hint: reveals a fraction of the hidden letters, or eliminates a wrong option in multiple-choice (costs 15 XP)
- **XP and levelling**: earn XP for every correct answer (amount varies by challenge stage); level up every 100 XP
- **Weekly and all-time leaderboard**: submit your session score and compare with other Nextcloud users
- **Session summary screen**: review your XP earned, correct/wrong counts, and best streak after each session
- **Auto-advance**: results screen auto-advances after 3 s; meet cards auto-advance after 800 ms
- **Nextcloud theme support**: respects the user's dark/light colour scheme
- **Backend API** (OCS endpoints):
  - `GET /apps/whoiswho/team` — team members with photo, name, title, and department
  - `GET /apps/whoiswho/leaderboard` — weekly and all-time scores
  - `POST /apps/whoiswho/leaderboard/score` — submit a session score
- **Persistent progress**: learning progress and XP are stored in `localStorage` so sessions resume where you left off
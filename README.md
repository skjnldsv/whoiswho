# Who Is Who

[![PHPUnit](https://github.com/skjnldsv/whoiswho/workflows/PHPUnit/badge.svg)](https://github.com/skjnldsv/whoiswho/actions?query=workflow%3APHPUnit)
[![Node](https://github.com/skjnldsv/whoiswho/workflows/Node/badge.svg)](https://github.com/skjnldsv/whoiswho/actions?query=workflow%3ANode)
[![Lint](https://github.com/skjnldsv/whoiswho/workflows/Lint/badge.svg)](https://github.com/skjnldsv/whoiswho/actions?query=workflow%3ALint)

A Duolingo-style memory game to learn the names and faces of your Nextcloud team members.

---

## How It Works

The game uses **spaced repetition** to help you memorise team members through four progressive stages:

| Stage | Name | XP | Description |
|-------|------|----|-------------|
| 1 | **Meet** | 5 XP | See a person's photo, name, and role |
| 2 | **Recognize** | 15 XP | Pick the correct name from four options (or pick the right face) |
| 3 | **Recall** | 25 XP | Fill in the missing letters of the name |
| 4 | **Master** | 40 XP | Type the full name from memory |

Wrong answers regress a person back one stage and show them again sooner. Members you struggle with appear more often.

### XP, Streaks, and Lives

**XP (experience points)**
- Earned for every correct answer; the harder the stage, the more XP.
- A *close* answer (edit distance of 1–2 characters, e.g. a typo) earns ¼ of the full XP and does not advance or regress the stage.
- Hints cost XP: first hint (title & department) −10 XP; second hint (reveal letters or eliminate a wrong option) −15 XP.
- **Speed bonus** — answer within the first 30% of the time limit to earn +2 XP on top of the stage XP.
- Every 100 XP completes a level.

**Streaks 🔥**
- Your streak counts *consecutive correct* answers in the current session.
- Any outright wrong answer, time-out, skip, or close answer resets the streak to zero.
- **Streak milestone bonus** — every 5 correct answers in a row earns +5 XP.
- Streaks are **session-only**: they start fresh at zero when you begin a new session and cannot be resumed.

**Lives ❤️**
- You start each session with **3 lives**.
- Only outright wrong answers and time-outs cost a life. Skipping ("I don't know") and close answers do **not** cost a life.
- **Life refill**: earn an extra life (up to the maximum of 3) for every 20 correct answers in a row.

**Countdown timers ⏱️**
- Each challenge except *Meet* has a time limit: Recognize / Pick-face 5 s, Recall 10 s, Type 15 s.
- Running out of time counts as a wrong answer and costs a life.

### Features

- 🧠 Spaced repetition scheduling (30 s → 2 min → 10 min between reviews)
- 🎯 Four challenge types including photo recognition
- ❤️ 3 lives per session with **life refills** (every 20 correct in a row restores a life)
- ⚡ Speed bonus (+2 XP) for fast answers; streak milestone bonus (+5 XP every 5 in a row)
- ⏱️ Countdown timers per challenge type (5 s / 10 s / 15 s)
- 💡 Two-level hint system (costs XP)
- 🏆 Weekly and all-time leaderboard
- �� Session statistics and level-up progression
- 🌙 Respects Nextcloud dark/light themes

---

## Installation

Navigate to your Nextcloud apps directory:

```bash
cd nextcloud/apps
```

Clone this repository into a folder named **whoiswho**¹:

```bash
git clone https://github.com/skjnldsv/whoiswho.git whoiswho
```

Install backend dependencies:

```bash
make composer
```

¹ *The directory name must match the app ID defined in `appinfo/info.xml`.*

---

## Development

### Frontend

The frontend is built with [Vue.js](https://vuejs.org/) and [TypeScript](https://www.typescriptlang.org/).

**Setup:**

```bash
make dev-setup
```

**Build:**

```bash
make build-js
```

**Watch mode** (auto-rebuild on file changes):

```bash
make watch-js
```

**Lint:**

```bash
npm run lint
npm run stylelint
```

### Backend

The backend is a standard Nextcloud app written in PHP. It exposes two OCS API endpoints:

- `GET /apps/whoiswho/team` — returns team members with photo, name, title, and department
- `GET /apps/whoiswho/leaderboard` — returns weekly and all-time scores
- `POST /apps/whoiswho/leaderboard/score` — submit a score for the current session

### Architecture

```
src/
├── constants.ts              # All magic numbers / tuneable values
├── App.vue                   # Root component and screen router
├── composables/
│   ├── useGameEngine.ts      # Central orchestrator (session state, API fetch)
│   ├── useSpacedRepetition.ts # Person-selection algorithm
│   ├── useChallengeBuilder.ts # Challenge construction per stage
│   ├── useScoring.ts         # XP, level-ups, and progress recording
│   ├── useLeaderboard.ts     # Leaderboard fetch and submit
│   └── useStorage.ts         # localStorage persistence
├── components/
│   ├── GameScreen.vue        # In-game layout (progress bar, card, input)
│   ├── StartScreen.vue       # Welcome / resume screen
│   ├── ResultsScreen.vue     # Session summary
│   ├── LeaderboardScreen.vue # Full leaderboard view
│   ├── PersonCard.vue        # Photo card with flip animation
│   ├── ChallengeInput.vue    # Handles all challenge input types
│   └── ProgressBar.vue       # Level / XP / lives bar
└── utils/
    └── strings.ts            # Text utilities (normalize, Levenshtein, shuffle)
```

---

## License

[AGPL-3.0-or-later](COPYING)

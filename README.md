# Who Is Who

[![PHPUnit](https://github.com/skjnldsv/whoiswho/workflows/PHPUnit/badge.svg)](https://github.com/skjnldsv/whoiswho/actions?query=workflow%3APHPUnit)
[![Node](https://github.com/skjnldsv/whoiswho/workflows/Node/badge.svg)](https://github.com/skjnldsv/whoiswho/actions?query=workflow%3ANode)
[![Lint](https://github.com/skjnldsv/whoiswho/workflows/Lint/badge.svg)](https://github.com/skjnldsv/whoiswho/actions?query=workflow%3ALint)

A Duolingo-style memory game to learn the names and faces of your Nextcloud team members.

---

## How It Works

The game uses **spaced repetition** to help you memorise team members through four progressive stages:

| Stage | Name | Description |
|-------|------|-------------|
| 1 | **Meet** | See a person's photo, name, and role |
| 2 | **Recognize** | Pick the correct name from four options (or pick the right face) |
| 3 | **Recall** | Fill in the missing letters of the name |
| 4 | **Master** | Type the full name from memory |

Each correct answer earns XP. Wrong answers cost a life — you have **3 lives** per session. Members you struggle with appear more often.

### Features

- 🧠 Spaced repetition scheduling (30 s → 2 min → 10 min between reviews)
- 🎯 Four challenge types including photo recognition
- ❤️ Lives system with streak bonuses
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

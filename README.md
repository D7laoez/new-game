# 🎮 Party Game Collection (1-4 Players Same Screen)

> **"One device + 1 to 4 friends + hundreds of laughs."**

A production-ready local multiplayer mini-game platform engineered for mobile phones, iPads, and tablets. Friends and family sit together around one screen and immediately compete in fast-paced mini-games.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite)](https://vitejs.dev/)
[![Tests](https://img.shields.io/badge/Tests-32%20Passed-2ED573?logo=vitest)](https://vitest.dev/)
[![Playable Games](https://img.shields.io/badge/Playable%20Games-15%20Ready-FFA502)](#)
[![Offline](https://img.shields.io/badge/Offline-100%25-FF4757)](#)

---

## 🌟 Highlights

- **Same-Device Multiplayer (1, 2, 3, or 4 Players):** Ergonomic screen partitioning for smartphone portrait and iPad/tablet landscape layouts.
- **Zero-Latency Procedural Audio:** Built-in Web Audio API synthesizer generates retro arcade tones, beeps, countdowns, and fanfare completely offline without downloading audio files.
- **Haptic Vibration:** Uses device vibration patterns on compatible touchscreens.
- **Extensible Architecture:** Designed as a scalable platform. Adding new mini-games requires only registering a new module implementing `IMiniGame`.
- **Centralized Scoring & Tournaments:** Dynamic point distribution, tie resolution, round leaderboards, and grand winner podium celebration with confetti.
- **Game Library & Discovery:** Search, category filters, favorite bookmarking (❤️), recently played tracking, and game preview cards with controls & rules.

---

## 🕹️ 15 Fully Playable Mini-Games (Phase 1 & Phase 2)

| # | Game | Category | Players | Description | Controls |
| :- | :--- | :--- | :--- | :--- | :--- |
| **01** | **Quick Tap** ⚡ | `REACTION` | 1–4 | Wait for the light to turn GREEN, then tap instantly! False starts penalize. | Tap Zone |
| **02** | **Rapid Tap** 🔥 | `SPEED` | 1–4 | 5-second tapping frenzy. Mash your button to fill your power gauge! | Rapid Mash |
| **03** | **Tug of War** 🪢 | `COMPETITION` | 2–4 | Tug the rope into your mud pit by mashing in rhythm with your team. | Rapid Mash |
| **04** | **Pattern Memory** 🔮 | `MEMORY` | 1–4 | Simon-style audio-visual sequence repetition. One mistake eliminates you! | Color Pads |
| **05** | **Coin Rush** 🪙 | `COMPETITION` | 1–4 | 2D Canvas arena. Collect coins and gems, but watch out for explosive bombs! | Arena Tap |
| **06** | **Color Clash** 🎨 | `REACTION` | 1–4 | Target color is announced. Tap the matching color button faster than your rivals! | Color Buttons |
| **07** | **Bomb Pass** 💣 | `PARTY` | 2–4 | A ticking bomb is passed around. Pass it before the unpredictable detonation! | Tap to Pass |
| **08** | **Memory Match** 🃏 | `MEMORY` | 1–4 | Flip hidden cards on your grid to find matching pairs and score points. | Card Flip |
| **09** | **Perfect Timing** 🎯 | `REACTION` | 1–4 | A moving indicator sweeps across a target zone. Tap at the exact bullseye moment! | Timing Tap |
| **10** | **Dodge Arena** ☄️ | `COMPETITION` | 1–4 | Drag your character to dodge falling meteors. Survive the longest to win! | Touch & Drag |
| **11** | **Quick Math** ➕ | `PUZZLE` | 1–4 | Solve arithmetic problems in split seconds. Quick answers earn bonus points! | Answer Buttons |
| **12** | **Target Shoot** 🏹 | `SPEED` | 1–4 | Targets pop up rapidly! Hit normal targets and golden stars, avoid bombs. | Target Tap |
| **13** | **Color Memory** 🌈 | `MEMORY` | 1–4 | Memorize the progressive sequence of color flashes and reproduce it accurately. | Color Sequence |
| **14** | **Balance** ⚖️ | `PARTY` | 1–4 | Keep your rolling orb balanced against random gusts of simulated wind. | Left/Right Tilt |
| **15** | **Fastest Finger** 👆 | `REACTION` | 1–4 | Giant buzzer strikes at an unpredictable millisecond. First to strike wins! | Buzzer Strike |

*The catalog includes 55 total planned mini-games categorized across Reaction, Speed, Memory, Competition, Puzzle, Party, and Drawing.*

---

## 🏗️ Architecture

```
src/
├── catalog/
│   └── gameCatalog.ts       # Metadata, controls, player limits & definitions for 55 mini-games
├── core/
│   ├── MiniGame.ts          # BaseMiniGame abstract class & lifecycle
│   ├── MiniGameManager.ts   # Registry, loader, compatibility & round picker
│   └── RoundManager.ts      # Session flow (Party, Tournament, Single)
├── games/
│   ├── QuickTapGame.ts      # Game 01 - Reaction test
│   ├── RapidTapGame.ts      # Game 02 - Speed button mash
│   ├── TugOfWarGame.ts      # Game 03 - Team tugging battle
│   ├── PatternMemoryGame.ts # Game 04 - Simon musical sequence
│   ├── CoinRushGame.ts      # Game 05 - 2D canvas coin collector
│   ├── ColorClashGame.ts    # Game 06 - Target color reaction
│   ├── BombPassGame.ts      # Game 07 - Ticking bomb hot potato
│   ├── MemoryMatchGame.ts   # Game 08 - Card pair matching
│   ├── PerfectTimingGame.ts # Game 09 - Precision timing bar
│   ├── DodgeArenaGame.ts    # Game 10 - 2D meteor dodge arena
│   ├── QuickMathGame.ts     # Game 11 - Speed mental arithmetic
│   ├── TargetShootGame.ts   # Game 12 - Rapid pop-up target shooter
│   ├── ColorMemoryGame.ts   # Game 13 - Progressive color memory
│   ├── BalanceGame.ts       # Game 14 - Physical balance tray
│   └── FastestFingerGame.ts # Game 15 - Sudden lightning buzzer
├── services/
│   ├── AudioManager.ts      # Procedural Web Audio API sound generator
│   ├── HapticManager.ts     # Safe device vibration wrapper
│   ├── PlayerManager.ts     # 4 player identities, avatars, names & colors
│   ├── ScoreManager.ts      # Point allocations, ties, and leaderboard
│   └── StorageService.ts    # LocalStorage persistence layer
├── styles/
│   └── main.css             # Fluid responsive layout for portrait & landscape
├── types/
│   └── index.ts             # Comprehensive TypeScript contracts
└── ui/
    ├── Modals.ts            # Player setup, library, preview, results, podium
    └── PartyApp.ts          # Top-level view & screen coordinator
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn

### Installation
```bash
git clone https://github.com/D7laoez/new-game.git
cd new-game
npm install
```

### Run Locally (Development)
```bash
npm run dev
```
Open your browser at `http://localhost:3000`. You can also open the local network IP on your phone or iPad to play directly with friends!

### Run Automated Tests
```bash
npm test
```
*Executes all 32 automated tests across storage, players, scoring, game catalog, compatibility filtering, and lifecycle management.*

### Production Build
```bash
npm run build
```

---

## 📱 Mobile & Tablet Controls

- **Multi-Touch Support:** Pointer events track simultaneous touch points across all 4 quadrants without interference.
- **Ergonomics:** Massive tap buttons positioned in comfortable thumb zones.
- **Orientation:** Automatically adapts between smartphone portrait and tablet landscape orientations.

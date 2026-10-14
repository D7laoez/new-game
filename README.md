# 🎮 Party Game Collection (1-4 Players Same Screen)

> **"One device + 1 to 4 friends + hundreds of laughs."**

A production-ready local multiplayer mini-game platform engineered for mobile phones, iPads, and tablets. Friends and family sit together around one screen and immediately compete in fast-paced mini-games.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite)](https://vitejs.dev/)
[![Tests](https://img.shields.io/badge/Tests-10%20Passed-2ED573?logo=vitest)](https://vitest.dev/)
[![Offline](https://img.shields.io/badge/Offline-100%25-FF4757)](#)

---

## 🌟 Highlights

- **Same-Device Multiplayer (1, 2, 3, or 4 Players):** Ergonomic screen partitioning for smartphone portrait and iPad/tablet landscape layouts.
- **Zero-Latency Procedural Audio:** Built-in Web Audio API synthesizer generates retro arcade tones, beeps, countdowns, and fanfare completely offline without downloading audio files.
- **Haptic Vibration:** Uses device vibration patterns on compatible touchscreens.
- **Extensible Architecture:** Designed as a scalable platform. Adding new mini-games requires only registering a new module implementing `IMiniGame`.
- **Centralized Scoring & Tournaments:** Dynamic point distribution, tie resolution, round leaderboards, and grand winner podium celebration with confetti.

---

## 🕹️ First 5 Fully Playable Mini-Games (Phase 1)

| Game | Category | Players | Description |
| :--- | :--- | :--- | :--- |
| **Quick Tap** ⚡ | `REACTION` | 1–4 | Wait for the light to turn GREEN, then tap instantly! False starts penalize. |
| **Rapid Tap** 🔥 | `SPEED` | 1–4 | 5-second tapping frenzy. Mash your button to fill your power gauge! |
| **Tug of War** 🪢 | `COMPETITION` | 2–4 | Tug the rope into your mud pit by mashing in rhythm with your team. |
| **Pattern Memory** 🔮 | `MEMORY` | 1–4 | Simon-style audio-visual sequence repetition. One mistake eliminates you! |
| **Coin Rush** 🪙 | `COMPETITION` | 1–4 | 2D Canvas arena. Collect coins and gems, but watch out for explosive bombs! |

*The catalog includes 55 planned mini-games categorized across Reaction, Speed, Memory, Competition, Puzzle, Party, and Drawing.*

---

## 🏗️ Architecture

```
src/
├── catalog/
│   └── gameCatalog.ts       # Metadata & definitions for 55 mini-games
├── core/
│   ├── MiniGame.ts          # BaseMiniGame abstract class & lifecycle
│   ├── MiniGameManager.ts   # Registry, loader, and round picker
│   └── RoundManager.ts      # Session flow (Party, Tournament, Single)
├── games/
│   ├── QuickTapGame.ts      # Reaction test game
│   ├── RapidTapGame.ts      # Button mashing speed game
│   ├── TugOfWarGame.ts      # Two-sided tugging battle
│   ├── PatternMemoryGame.ts # Musical Simon sequence game
│   └── CoinRushGame.ts      # Real-time 2D canvas coin collector
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
    ├── Modals.ts            # Player setup, library, settings, results, podium
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

### Production Build
```bash
npm run build
```

---

## ➕ Adding a New Mini-Game (e.g. Game #6)

1. Create `src/games/YourGame.ts` extending `BaseMiniGame`:
   ```ts
   import { BaseMiniGame } from '../core/MiniGame.ts';
   import { GAME_CATALOG } from '../catalog/gameCatalog.ts';

   export class YourGame extends BaseMiniGame {
     readonly metadata = GAME_CATALOG.find(g => g.id === 'your-game-id')!;
     protected onInit(): void { /* build UI */ }
     protected onStart(): void { /* start game timer */ }
     handleInput(playerId: PlayerId, action: string): void { /* handle taps */ }
   }
   ```
2. Register the game in `src/core/MiniGameManager.ts`:
   ```ts
   this.registerGame('your-game-id', () => new YourGame());
   ```
3. Set `implemented: true` in `src/catalog/gameCatalog.ts`.

---

## 📱 Mobile & Tablet Controls

- **Multi-Touch Support:** Pointer events track simultaneous touch points across all 4 quadrants without interference.
- **Ergonomics:** Massive tap buttons (no tiny buttons) positioned in comfortable thumb zones.
- **Orientation:** Automatically adapts between smartphone portrait and tablet landscape orientations.

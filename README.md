# 🎮 Party Game Collection (1-4 Players Same Screen)

> **"One device + 1 to 4 friends + hundreds of laughs."**

A production-ready local multiplayer mini-game platform engineered for mobile phones, iPads, and tablets. Friends and family sit together around one screen and immediately compete in fast-paced mini-games.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite)](https://vitejs.dev/)
[![Tests](https://img.shields.io/badge/Tests-79%20Passed-2ED573?logo=vitest)](https://vitest.dev/)
[![Playable Games](https://img.shields.io/badge/Playable%20Games-45%20Ready-FFA502)](#)
[![Offline PWA](https://img.shields.io/badge/PWA%20Offline-100%25-FF4757)](#)

---

## 🌟 Highlights

- **Same-Device Multiplayer (1, 2, 3, or 4 Players):** Ergonomic screen partitioning for smartphone portrait and iPad/tablet landscape layouts.
- **45 Genuinely Playable Mini-Games:** Spanning Reflex, Speed, Memory, Competition, Puzzle, Skill, Brain, Timing, and Party.
- **Zero-Latency Procedural Audio:** Built-in Web Audio API synthesizer generates retro arcade tones, beeps, whooshes, buzzer alerts, and explosions completely offline without external audio files.
- **Haptic Vibration:** Uses device vibration patterns on compatible touchscreens.
- **Bilingual Interface (English & Arabic):** Full dynamic switching (`dir="rtl"`) with high-legibility typography.
- **Progressive Web App (PWA):** Offline Service Worker caching (`/sw.js`) and web app manifest for home-screen installation.
- **Extensible Architecture:** Designed as a scalable platform. Adding new mini-games requires only registering a new module implementing `IMiniGame`.
- **Tournament / Cup System:** Bronze (5R), Silver (7R), Gold (10R), Ultimate (15R), and Custom Party cups with live leaderboard, rank change indicators, and comeback alerts.
- **Lifetime Statistics & Achievements:** Persistent stats (games played/won, streaks, fastest reaction times in ms) and 10 achievement badges with animated toast notifications.

---

## 🕹️ 45 Fully Playable Mini-Games

| # | Game | Category | Players | Description | Controls |
| :- | :--- | :--- | :--- | :--- | :--- |
| **01** | **Quick Tap** ⚡ | `REACTION` | 1–4 | Wait for the light to turn GREEN, then tap instantly! | Tap Zone |
| **02** | **Rapid Tap** 🔥 | `SPEED` | 1–4 | 5-second tapping frenzy. Mash your button to fill your gauge! | Rapid Mash |
| **03** | **Tug of War** 🪢 | `COMPETITION` | 2–4 | Tug the rope into your mud pit by mashing in rhythm with your team. | Rapid Mash |
| **04** | **Pattern Memory** 🔮 | `MEMORY` | 1–4 | Simon-style audio-visual sequence repetition. | Color Pads |
| **05** | **Coin Rush** 🪙 | `COMPETITION` | 1–4 | Collect coins and gems, but watch out for explosive bombs! | Arena Tap |
| **06** | **Color Clash** 🎨 | `REACTION` | 1–4 | Target color is announced. Tap the matching color button first! | Color Buttons |
| **07** | **Bomb Pass** 💣 | `PARTY` | 2–4 | Pass the ticking bomb before the unpredictable detonation! | Tap to Pass |
| **08** | **Memory Match** 🃏 | `MEMORY` | 1–4 | Flip hidden cards on your grid to find matching pairs. | Card Flip |
| **09** | **Perfect Timing** 🎯 | `REACTION` | 1–4 | A moving indicator sweeps across a target zone. Tap at the exact bullseye! | Timing Tap |
| **10** | **Dodge Arena** ☄️ | `COMPETITION` | 1–4 | Drag your character to dodge falling meteors. Survive the longest! | Touch & Drag |
| **11** | **Quick Math** ➕ | `PUZZLE` | 1–4 | Solve arithmetic problems in split seconds. | Answer Buttons |
| **12** | **Target Shoot** 🏹 | `SPEED` | 1–4 | Targets pop up rapidly! Hit normal targets, avoid bombs. | Target Tap |
| **13** | **Color Memory** 🌈 | `MEMORY` | 1–4 | Memorize the progressive sequence of color flashes and reproduce it. | Color Sequence |
| **14** | **Balance** ⚖️ | `PARTY` | 1–4 | Keep your rolling orb balanced against random gusts of simulated wind. | Left/Right Tilt |
| **15** | **Fastest Finger** 👆 | `REACTION` | 1–4 | Giant buzzer strikes at an unpredictable millisecond. | Buzzer Strike |
| **16** | **Whack It** 🔨 | `SPEED` | 1–4 | Whack golden moles popping out of holes, dodge prickly cacti. | Mole Tap |
| **17** | **Stop The Bar** ⏱️ | `REACTION` | 1–4 | Stop the sweeping power bar exactly inside the green bullseye window. | Stop Button |
| **18** | **Number Rush** 🔢 | `SPEED` | 1–4 | Tap ascending numbers 1 through 9 faster than your opponents. | Ascending Grid |
| **19** | **Safe Tile** 🟩 | `MEMORY` | 1–4 | Step on the flashing safe stepping stones across the dangerous bridge. | Step Buttons |
| **20** | **Balloon Pop** 🎈 | `SPEED` | 1–4 | Pop floating balloons of your player color, avoid poison skull balloons. | Balloon Pop |
| **21** | **Follow The Arrow** 🧭 | `REACTION` | 1–4 | Follow the sudden directional compass prompt with your 4-way D-Pad. | 4-Way D-Pad |
| **22** | **Don't Press It** 🛑 | `PARTY` | 1–4 | Resist false alarms! Only slam the buzzer when the green signal flashes. | Buzzer Slam |
| **23** | **Treasure Dig** 💎 | `COMPETITION` | 1–4 | Dig underground tiles to unearth hidden diamonds and gold chests. | Tile Dig |
| **24** | **Race to 100** 🏃 | `COMPETITION` | 1–4 | Alternate left and right running shoes in rhythm to sprint 100 meters. | Dual Shoe Mash |
| **25** | **Shape Snap** ✨ | `REACTION` | 1–4 | Lightning card snap. When shapes match, be the first to smash SNAP! | Snap Buzzer |
| **26** | **Lane Switch** 🏎️ | `REFLEX` | 1–4 | Switch across 3 highway lanes to avoid barriers and oil drums. | Left / Right |
| **27** | **Color Conveyor** 📦 | `SPEED` | 1–4 | Sort moving conveyor items into red, blue, green, and yellow zones. | 4 Color Sort |
| **28** | **Tiny Bowling** 🎳 | `SKILL` | 1–4 | Lock your aiming trajectory, charge rolling power, and bowl strikes. | Aim & Roll |
| **29** | **Memory Sequence Duel** 🧠 | `MEMORY` | 1–4 | Watch the escalating Simon sequence and reproduce it step by step. | Color Pads |
| **30** | **Reaction Grid** ⚡ | `REFLEX` | 1–4 | Tap targets as they flash randomly across a 9-cell grid. Tracks reaction ms. | 9-Cell Tap |
| **31** | **Tiny Golf** ⛳ | `SKILL` | 1–4 | Aim your shot, regulate swing power, and sink the ball in the cup. | Aim & Putt |
| **32** | **Word Scramble** 🔤 | `PUZZLE` | 1–4 | Rearrange scrambled letters into valid words using hints. | Letter Deck |
| **33** | **Catch the Fruit** 🧺 | `SPEED` | 1–4 | Move your basket horizontally to catch fruits and dodge bombs. | Basket Move |
| **34** | **Sum Sprint** ➕ | `BRAIN` | 1–4 | Rapid-fire mental math problems with multiple-choice answers. | Math Options |
| **35** | **Perfect Landing** 🛸 | `TIMING` | 1–4 | Fire thrusters at the exact moment to land your lander in the green zone. | Land Thruster |
| **36** | **Maze Escape** 🧭 | `PUZZLE` | 1–4 | Navigate a stone maze using directional controls to reach the goal. | D-Pad Move |
| **37** | **Paper Plane Flight** ✈️ | `SKILL` | 1–4 | Set flight angle and launch power to soar through obstacle gates. | Angle & Launch |
| **38** | **Shape Sort Factory** 🏭 | `PUZZLE` | 1–4 | Sort incoming shapes into matching destination bins rapidly. | Shape Bins |
| **39** | **Ice Slide** 🧊 | `BRAIN` | 1–4 | Slide on frictionless ice, bounce off rocks, and navigate to the flag. | Slide D-Pad |
| **40** | **Mini Curling** 🥌 | `SKILL` | 1–4 | Slide curling stones onto the icy target house and place closest to bullseye. | Aim & Slide |
| **41** | **Word Chain** 🔗 | `BRAIN` | 1–4 | Enter offline dictionary words starting with the previous word's last letter. | Keypad Type |
| **42** | **Safecracker** 🔐 | `BRAIN` | 1–4 | Deduce the secret 3-digit combination using position and digit clues. | Keypad Deduce |
| **43** | **Fishing Frenzy** 🎣 | `TIMING` | 1–4 | Watch your bobber and reel in instantly when the fish strikes! | Reel In |
| **44** | **Bridge Builder** 🌉 | `PUZZLE` | 1–4 | Place wooden planks across the river to connect both sides. | Plank Place |
| **45** | **Light Trail Duel** ⚡ | `REFLEX` | 1–4 | Steer light cycles on a grid, leave glowing trails, and out-survive opponents. | Steer Arrows |

---

## 🏗️ Architecture

```
src/
├── catalog/
│   └── gameCatalog.ts       # 45 implemented mini-games + future roadmap
├── core/
│   ├── MiniGame.ts          # BaseMiniGame abstract class & animation loop
│   ├── MiniGameManager.ts   # Game registry, loader, compatibility & round picker
│   └── RoundManager.ts      # Party, Cup Tournament, and Solo session flows
├── games/                   # 45 self-contained mini-game modules
├── services/
│   ├── AchievementManager.ts# 10 unlockable achievement badges
│   ├── AudioManager.ts      # Web Audio procedural sound synthesizer
│   ├── HapticManager.ts     # Safe device vibration wrapper
│   ├── I18nService.ts       # Bilingual English/Arabic dictionary & RTL support
│   ├── PlayerManager.ts     # 1-4 players, custom names, avatars & colors
│   ├── ScoreManager.ts      # Point allocations, ties, and leaderboard
│   ├── StatsService.ts      # LocalStorage persistent game and tournament stats
│   └── StorageService.ts    # JSON-safe LocalStorage wrapper
├── styles/
│   └── main.css             # Fluid responsive layout for portrait & landscape
├── types/
│   └── index.ts             # Strict TypeScript types
└── ui/
    ├── Modals.ts            # Player setup, library, cups, stats & achievements
    └── PartyApp.ts          # Top-level view coordinator & language toggle
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Development
```bash
npm install
npm run dev
```
The server will start at: `http://localhost:3000/`

### Automated Testing
```bash
npm test
```
Runs 79 comprehensive tests covering all services, scoring algorithms, and all 45 mini-games.

### Production Build & Type-Check
```bash
npx tsc --noEmit
npm run build
```
Creates an optimized offline production build in `dist/`.

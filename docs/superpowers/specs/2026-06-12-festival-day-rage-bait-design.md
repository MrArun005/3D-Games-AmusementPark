# Festival Day — Rage-Bait Edition (Design Spec)

**Date:** 2026-06-12
**Project:** Fableland / Mysuru Dasara night fair (`C:\Users\malliar\Desktop\amusement-park`)
**Status:** Approved design, ready for implementation plan

## Goal

Turn the existing free-roam fair into a replayable **score-attack "festival day"** with a
**heckling loudspeaker announcer** and **rage-bait** mini-games, climaxing in a **fireworks
finale** with a sarcastic rank. Delivers gameplay depth (score/combo goal), atmosphere
(announcer + day arc + finale) and visual payoff (fireworks) in one coherent layer.

The festival is **additive**: if the player never starts a festival, the game stays the
current sandbox. Starting a festival adds a score/combo/clock overlay and the finale.

**Out of scope (deferred):** real online multiplayer, AI rivals, and a live leaderboard.
The scoring model leaves a clean slot to add rival score-lines later.

## Core loop

1. Player presses **Start Festival** (button on the onboarding card + a key, e.g. `G`).
2. The run begins: time is forced to dusk and advances briskly to **midnight over ~7 real
   minutes** (the free time-selector is disabled during a run). `phase: 'running'`.
3. Player earns **festival points** by doing things already in the game (rides, mini-games,
   shops), with a **combo multiplier** that climbs as long as they keep scoring.
4. At midnight → `phase: 'finale'`: cinematic + fireworks + score card + rank.
5. **Play Again** resets for a better run; **Free Roam** exits to the sandbox.

### Scoring model

| Action | Base points |
| --- | --- |
| Complete a ride | `100 × ride.cost` (coaster pays most) |
| Shooting gallery hit | balloon +50, duck +120, cocky golden duck +300 |
| Ring landed on a bottle | +150 |
| Buy food / balloon | +30 ("treat yourself") |

**Combo multiplier — the central hook.**
- Every scoring action multiplies its base by the current combo and then **increments the
  combo** (×1 → ×2 → ×3 …, no cap) and **refills the combo timer (~12 s)**.
- If the combo timer reaches zero → **combo resets to ×1**, with a deflating SFX + a heckle.
- Combo milestones (×5, ×10 …) trigger a hype line + chime.

`festivalScore += base × combo` is applied at the moment of the action, so chaining quickly
is dramatically more valuable than dawdling — this is the dopamine/rage engine.

`bestScore` is persisted in `localStorage`.

## The heckling announcer

Event-driven PA system. No offline text-to-speech, so delivery = a **loudspeaker chime**
(synthesized) + an **on-screen caption banner** styled like a tannoy announcement.

- **`lib/announcer.ts`** — line pools keyed by event, plus `pickLine(event, ctx)` and a
  controller with **cooldown** (min ~2.5 s between lines) and **priority** so important
  events (combo lost, milestone, finale) interrupt filler.
- **Events:** `score` (hype, escalates with combo), `miss` (taunt), `comboLost`,
  `comboMilestone`, `rideComplete`, `gameWin`, `gameLose`, `idle` (no action for ~25 s:
  "Fell asleep, champ?"), `finale`.
- **Flavor (Indian fair):** "Arre, SO close!", "Bombaat shot!", "Is that all, hero?",
  "The crowd is unimpressed…", "Ayyo, combo gone!", "Now THAT'S a Dasara!".
- Caption renders in `FestivalHUD` for ~3 s; chime plays via `lib/audio.ts`.

## Mini-game rage twists

**Shooting gallery**
- Ducks occasionally **juke**: dip behind the counter for ~0.5 s on a random timer, more
  often as the round goes on. Firing on a juking duck = a miss.
- A **cocky golden duck** appears periodically, moves erratically, worth +300, and triggers
  a taunt if missed.
- **Near-miss detection:** if the centre ray passes within a small radius of a live target
  but doesn't hit, emit a `miss` heckle ("SO close!") — no points, but it stings.
- Consecutive hits feed the festival combo.

**Ring toss**
- **Power meter oscillates** (ping-pongs up and down) instead of a simple ramp, so the
  release must be timed — overshooting is easy and rage-inducing.
- A small **landing wobble** (deterministic per-throw jitter) nudges where the ring lands.
- **Rim-out near-miss:** landing just outside a bottle's catch radius emits a `miss` heckle.

Both twists must stay **brutal-but-fair** — visible tells (the juke wind-up, the meter
position) so a skilled player can still win. Difficulty is tuned, not random-screw.

## Finale

At midnight (`phase: 'finale'`):
- Player input frozen; camera glides to a cinematic vantage at the plaza/bandstand
  (reuse the Photo-Mode camera glide).
- **`components/festival/Fireworks.tsx`**: instanced particle bursts over the giant wheel —
  pooled points that launch, explode into colored sparks, and fade; **boom** SFX + a crowd
  "wow" murmur swell. Runs ~8 s.
- **`components/ui/FinaleScreen.tsx`**: final score, best score, and a **sarcastic rank**:
  `<1000` "Tourist", `<3000` "Tryhard", `<6000` "Mela Star", `≥6000` "Dasara Legend".
  Announcer sign-off line. Buttons: **Play Again** (reset run) / **Free Roam** (exit).

## Architecture

New, focused units (mirroring the existing `lib/minigame.ts` + overlay pattern):

| File | Responsibility |
| --- | --- |
| `lib/festival.ts` | `useFestival` zustand store: `active, phase, score, combo, comboTimer, timeLeft, bestScore`; actions `start, addScore(base), tickCombo, resetCombo, tick(dt), toFinale, reset`. Keeps the main store lean. |
| `lib/announcer.ts` | Taunt/hype line pools + `pickLine` + cooldown/priority controller; pushes the current caption into `useFestival` (or its own tiny store). |
| `components/festival/FestivalController.tsx` | `useFrame`: drives the day clock during a run, ticks `timeLeft` + combo timer, triggers `toFinale` at midnight. No mesh. |
| `components/festival/Fireworks.tsx` | Instanced particle fireworks for the finale. |
| `components/ui/FestivalHUD.tsx` | Score, combo meter (draining timer bar + ×N), announcer caption banner. Mounted in `HUD`. |
| `components/ui/FinaleScreen.tsx` | Score/rank/play-again card. |

Integration into existing code (small hooks, no rewrites):
- `RideBase.useRideMachine` completion → `useFestival.addScore(100 × cost)` + announcer `rideComplete`.
- `lib/minigame.ts` (`useShooting`, `useRingToss`) hit/landing → `addScore` + combo + announcer events.
- Shop buy actions in `useGameStore` → `addScore(30)`.
- `lib/audio.ts` → new SFX: announcer chime, combo-up, combo-lost, firework boom, crowd-wow.
- `ShootingGallery` / `RingToss` → the rage twists above.
- `state/useGameStore` → `setTimeMode`/`advanceTime` cooperate with the festival clock during a run (festival owns time while active).

## Testing

Headless Playwright (existing `scripts/check-*.js`, driving `msedge`, `window.__park`):
- Expose `window.__park.festival`.
- `startFestival` → ride a ride → score increases by `100×cost × combo`; combo increments.
- Let the combo timer lapse → combo resets to ×1.
- Win a shooting/ring round → score + combo update; trigger a near-miss → caption appears.
- Fast-forward the clock → `phase: 'finale'`, fireworks render, rank computed, best saved.
- Screenshots: festival HUD (score+combo), a heckle caption, the finale fireworks + score card.
- `tsc --noEmit` clean; zero console errors.

## Acceptance criteria

- Starting a festival overlays score/combo/clock without breaking sandbox free-roam.
- Score accrues from rides, both mini-games, and shop buys, multiplied by a live combo that
  resets on timeout.
- The announcer reacts to scoring, misses, combo loss/milestones, idle, and the finale, with
  cooldown so it never spams.
- Both mini-games have visible, fair rage twists (duck juke + cocky duck + near-miss;
  oscillating power + wobble + rim-out).
- Midnight triggers a fireworks finale and a score card with a persisted best + sarcastic rank.
- 60 fps held on Medium; no console errors.

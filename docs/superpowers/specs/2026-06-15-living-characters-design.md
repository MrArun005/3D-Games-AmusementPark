# Living Characters — Design Spec

**Status:** Draft for review · 2026-06-15
**Project:** Fableland (3D-Games-AmusementPark)

## 1. Goal

Turn the park's people into believable, GTA‑style civilian humans who have a
**purpose** and actually **use the park** — they pick goals, walk to rides,
queue in lines that drain, board and visibly ride, eat at stalls, play games,
and move on. The player ("me") becomes a **customizable** human that persists
between sessions and rides alongside the crowd.

This replaces today's reality, where:

- Every human (player + crowd) is one reused scanned model (`CesiumMan.glb`).
- The walking crowd (`Crowd.tsx`) only *wanders near* ride/stall fronts — it
  never rides, eats, or plays.
- The ride queues (`FairCrowd.tsx`) are **fake**: static stick-figures that
  never advance or board.
- Rides are **single-occupant** from the player's view; gondolas/horses/carts
  ride empty.

## 2. Non-goals

- **Photoreal humans.** Not achievable with 20+ animated people in a browser.
  Target is *stylized-but-clearly-human* civilians (low-poly GTA / cartoon
  realism), varied bodies and outfits.
- **Pathfinding/navmesh.** We keep the existing physics‑free straight‑line
  steering with simple obstacle avoidance. No A*.
- **Networked / multiplayer characters.** Single-player only.
- **Per-frame React state.** Forbidden — same golden rule the codebase already
  enforces. NPC transforms, queues, and ride occupancy live in refs / mutable
  module state and never trigger React renders.

## 3. Guiding constraints (from the existing codebase)

- **No per-frame React.** Animated/continuous state goes in `lib/refs.ts`-style
  mutable objects or zustand fields mutated in place; React only renders on
  discrete changes (HUD, menus).
- **Data-driven world.** Rides/stalls are data in `lib/spawn.ts`. New per-ride
  data (seats, queue path) extends that file, not scattered constants.
- **Quality-aware.** Crowd count already scales with the `quality` setting
  (`low/medium/high`). New systems must respect it and keep the LOD that
  freezes far-away animation.
- **Asset budget.** The repo ethos is "no paid assets." The user has explicitly
  overridden this for human variety, but we still prefer **CC0, no-account**
  assets and keep total added weight to a few MB.

## 4. Phasing

Built looks-first so there's an immediate visible payoff, with the hardest work
(seat occupancy) last, layered on the new characters with no rework.

| Phase | Deliverable | Risk |
|---|---|---|
| **1 — Characters & You** | Crowd + player become varied GTA-style humans; "Create your character" onboarding + pause-menu editor; choices persist in localStorage. Behavior unchanged. | Low (asset fetch is the only unknown) |
| **2 — Purpose** | NPCs pick goals (ride / eat / play / stroll), walk to them, join real queues that **drain**, visibly eat & play, then pick a new goal. | Medium |
| **3 — Boarding** | NPCs board and **sit in real ride seats** (gondolas, horses, carts fill up); when the player boards, NPCs fill the seats beside them. | High |

Each phase is independently shippable and visually verifiable in the running
game.

---

## 5. Phase 1 — Characters & You

### 5.1 Asset acquisition (first task, de-risk)

- Fetch a **CC0 modular human pack** with **one shared skeleton** and shared
  animation clips including at minimum `idle`, `walk`, and a `sit` pose
  (run/cheer/talk are bonuses). Primary candidate: Quaternius "Ultimate
  Animated Character Pack" (CC0, no account).
- Store under `public/models/characters/`. Verify in a throwaway script that
  the GLB loads, exposes the expected clips, and that `SkeletonUtils.clone`
  produces independent instances (same pattern as today's `Crowd.tsx`).
- **Fallback (flagged immediately if the primary fails):** (a) Mixamo humans —
  requires the user's Adobe login to download; or (b) procedural civilian
  humans built in code. We surface the blocker, we do not silently swap.
- **Acceptance:** a one-off check renders 3 distinct humans with a playing walk
  clip. If unmet, stop and escalate the asset decision.

### 5.2 Character variant system

- `lib/characters.ts`:
  - `CharacterConfig` = `{ body, outfit, outfitColor, skin, hair, hairColor,
    scale, accessory? }` (indices/colors into curated palettes).
  - `buildCharacter(config, gltf)` → a configured `THREE.Object3D` clone:
    `SkeletonUtils.clone` the shared scene, swap/show the chosen body+outfit
    meshes, tint materials (cloned per instance so they don't bleed), apply
    scale. Mirrors today's per-clone material-clone approach in `Crowd.tsx`.
  - `randomConfig(rng)` → deterministic varied NPC configs (seeded `mulberry32`
    so the crowd never reshuffles between renders, like the current crowd).
  - Curated palettes reuse `lib/palette.ts` `BAZAAR` tints for cohesion.

### 5.3 The player ("me") avatar

- `state/useAvatarStore.ts` (zustand + localStorage):
  - Holds the player's `CharacterConfig`; `hasOnboarded` flag.
  - `load()` on boot; `save(config)` persists to `localStorage`
    (`fableland-avatar`).
- `PlayerAvatar.tsx` rebuilt on the new rig, driven by `useAvatarStore`. Walk
  clip sped up by movement speed and paused when idle — same logic as today.
  Still third-person only, hidden while a ride owns the camera.
- `components/ui/CharacterCreator.tsx`:
  - **Onboarding:** shown over the canvas on first load (`!hasOnboarded`) — pick
    body/outfit/color/skin/hair (+ optional name), Start enters the park.
    Slots in next to the existing `Onboarding.tsx` controls card.
  - **Re-edit:** reachable from `PauseMenu.tsx`.
  - Live preview: a tiny dedicated R3F canvas (or a rotating preview in-scene)
    showing the configured character. No per-frame React — preview animates via
    its own `useFrame`.
- Optional name: a small floating label above the third-person body (reuse the
  `makeTextTexture` canvas-texture approach), default off to avoid clutter.

### 5.4 Crowd swap

- `Crowd.tsx` swaps `CesiumMan` → the new pack. Each NPC built from a
  `randomConfig`. Keep: ref-driven steering, fountain avoidance, idle/linger,
  balloon prop, the distance LOD that pauses far animation, and quality-based
  count. Net change is the *source model + variety*, not the motion system.

### 5.5 Phase 1 acceptance

- Onboarding appears first run; choosing and starting persists across reload.
- Crowd is visibly varied humans (not clones of one model).
- Player avatar matches the saved config in third person and photo mode.
- Frame rate at `high` quality is no worse than today (verify with the existing
  crowd count; if the pack is heavier, lower `high` count or add a mid LOD).

---

## 6. Phase 2 — Purpose

### 6.1 NPC brain

- `lib/npc.ts` — per-agent state machine. Goal lifecycle:

  ```
  ROAMING → SEEKING(target) → QUEUING(ride|stall) → BOARDING* → RIDING*
          → EATING(stall) → PLAYING(game) → DONE → (pick next goal)
  ```
  (`BOARDING`/`RIDING` are Phase 3; in Phase 2 a queued NPC that reaches the
  front simply "rides" via a timed hide-then-return placeholder so queues drain
  and the loop is exercised end-to-end.)

- Lightweight **needs** (`fun`, `hunger`, `energy`) drift over time; the next
  goal is a weighted pick favoring the most-pressing need among reachable
  rides/food/games, with a base chance to just stroll. No global scheduler —
  each agent decides for itself, matching the decentralized current crowd.

- Steering reuses today's straight-line move toward a target with fountain
  avoidance; arrival thresholds and idle/linger carry over.

### 6.2 Real queues

- `lib/queue.ts` — a queue per ride and per game stall. A queue is an ordered
  list of **slot positions** along an approach path (extends each ride's data
  in `spawn.ts` with a `queuePath`/anchor). Operations: `join(agentId)`,
  `advance()` (shuffle forward as the front leaves), `frontReady()`.
- NPCs in `QUEUING` interpolate toward their assigned slot and face the counter
  (the look the current `FairCrowd` faked, now real).
- `FairCrowd.tsx` (static fake queues) is **removed/retired**; its visual role
  is replaced by real queued NPCs. Any purely decorative standees that remain
  useful (e.g. carts) keep using `Person.tsx`.

### 6.3 Eating & playing

- `EATING`: at a food stall, the NPC pauses, shows a held-food prop (reuse the
  balloon/prop pattern), then leaves satisfied (`hunger` reset).
- `PLAYING`: at a game stall, the NPC plays the raised-arm "throw/shoot" pose
  for a few seconds (reuse `FairCrowd`'s `play` arm pose), then leaves.

### 6.4 Phase 2 acceptance

- Standing near a ride, you can watch a queue **form and drain** over time.
- NPCs visibly walk to food stalls, "eat," and to game stalls, "play."
- No NPC gets permanently stuck (watchdog: if a goal exceeds a max duration,
  abandon it and re-pick). Crowd never all funnels to one ride (need weighting +
  per-ride soft capacity).

---

## 7. Phase 3 — Boarding (seat occupancy)

### 7.1 Generalize the ride machine

- Today `useRideMachine` drives one cycle for **the player**. Generalize to a
  **ride session** with a set of **occupants** (the player and/or NPCs):
  - Each ride exposes a `seats: THREE.Object3D[]` — local seat anchors on the
    moving parts (Ferris gondolas, carousel horses, coaster carts, teacup seats,
    drop-tower seats, bumper cars, Columbus benches). Several rides already build
    these seat meshes; we add named anchors to attach riders to.
  - `lib/rideController.ts` — per ride: `requestSeats(n)`, assigns seat indices,
    runs the existing `IDLE→BOARDING→RUNNING→UNLOADING` cycle for the whole
    session, releases occupants to the exit on UNLOAD.
- Dispatcher: when a ride is `IDLE` and its queue has riders (or a departure
  timer fires), pull up to `seats.length` from the queue → `BOARDING` (walk to
  seat / snap) → parent each NPC root to its seat anchor + play `sit` clip →
  run cycle → on UNLOAD, unparent, place at exit, set goal `DONE`.

### 7.2 Player rides with company

- When the player boards (existing E-to-board path), the dispatcher fills the
  remaining seats from the front of that ride's queue, so the player rides
  alongside real NPCs. The player's camera handoff is unchanged.

### 7.3 Visible occupancy when you're not riding

- Rides run their NPC sessions independently of the player (subject to a soft
  global concurrency cap for performance — e.g. at most N rides running NPC
  sessions at once on `low`/`medium`). You can stand and watch a full Ferris
  wheel turn.

### 7.4 Phase 3 acceptance

- Each ride visibly carries NPC riders in its seats through a full cycle.
- Boarding a ride yourself seats NPCs in the other seats.
- Releasing at the exit returns NPCs to the `ROAMING` goal loop cleanly.
- Performance respects quality: the running-ride cap and animation LOD keep
  frame rate within Phase 1's bar.

---

## 8. Data flow summary

```
useAvatarStore (localStorage)
   └── PlayerAvatar (Phase 1)
lib/characters.ts (buildCharacter / randomConfig)
   ├── PlayerAvatar
   └── Crowd  (NPC visuals)
lib/npc.ts (per-agent goal FSM + needs)        [Phase 2]
   ├── reads lib/spawn.ts (rides/stalls/targets)
   ├── drives Crowd agent steering
   └── lib/queue.ts (join/advance/frontReady)  [Phase 2]
          └── lib/rideController.ts             [Phase 3]
                 ├── reads ride seat anchors
                 └── runs generalized useRideMachine session
```

All continuous state (positions, queue slots, seat assignments, ride session
timers) lives in refs / mutable module state. zustand holds only discrete UI/
game state (avatar config, quality, pause, ride phase for HUD).

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| CC0 pack unavailable / lacks a sit clip | Verify in §5.1 spike before building; flag and fall back to Mixamo (user login) or procedural |
| Heavier models tank frame rate | Quality-scaled count + animation LOD (exists); add mid LOD / lower `high` count if needed |
| Generalizing the single-occupant ride machine breaks player riding | Phase 3 only; keep the player path working first, add occupants behind it; the player-boards path stays the source of truth |
| NPCs stuck in a goal/queue | Per-goal watchdog timeout → abandon & re-pick; per-ride soft capacity to avoid funneling |
| Queue/seat math drifts per ride | Seat anchors + queue paths are per-ride data in `spawn.ts`, tuned and screenshot-verified one ride at a time |

## 10. Testing & verification

- Reuse the existing `scripts/check-*.js` Playwright-screenshot harness: add
  `check-characters.js` (Phase 1), `check-purpose.js` (Phase 2), and
  `check-boarding.js` (Phase 3) that boot the game and capture the new behavior.
- Manual smoke per phase against the acceptance criteria above.
- `npm run build` (type check) must stay green at every phase.
```

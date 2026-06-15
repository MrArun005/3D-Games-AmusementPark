# Physics & Game Feel — Design Spec

**Status:** Approved shape ("go A to Z", 2026-06-15). Decisions locked below.
**Project:** Fableland (3D-Games-AmusementPark)

## Goal

Make the park feel like a real, physical place and tighten moment-to-moment game feel: a solid world you collide with, props that react to you, rides whose forces you feel, and a responsive player controller. Built on Rapier (already in the project), quality-gated, and structured so a future multiplayer layer can make physics server-authoritative without a rewrite.

## Build order (each chunk independently shippable, riskiest last)

- **A — Solid world**: colliders on everything you currently clip through (NPCs, trees, lamps), so the player and props can't pass through the world.
- **B — Better movement feel**: momentum/friction, jump arc, step-up over kerbs/stairs/slopes, sprint, landing.
- **C — Pushable props**: dynamic Rapier objects (balls, cans, crates, balloons) you kick/bump; thrown rings/balls for the carnival games.
- **D — Real ride physics**: force-driven drop/swing/spin with G-forces felt through the camera.

## Locked decisions

1. **NPCs are SOLID but KINEMATIC**, not ragdolls. The player (and props) collide with an NPC's capsule and the NPC steers around the player; NPCs are never knocked over or physically simulated. This keeps the existing physics-free steering, holds frame rate with 16–24 NPCs, and still reads as "real." Full shove-them-over ragdoll is an explicit non-goal (revisit post-multiplayer if wanted).
2. **Rides keep the rider seated; forces are FELT through the camera** (G-lean, shake) plus true motion curves (real free-fall, real pendulum), rather than flinging an unbuckled rigid body around. Restraint = better experience (no nausea, no tunneling bugs).
3. **Single-player authority for now.** All physics runs client-side. To stay multiplayer-ready, gameplay-affecting physics state (prop transforms, ride phase/seat occupancy) is kept in clearly-owned modules (refs/stores) that a future server could drive — no physics logic buried in render code.

## Non-goals

- Ragdoll NPCs or ragdoll player.
- Networked/authoritative physics (that's the later multiplayer project; this one is designed to *accommodate* it, not implement it).
- Destructible structures.
- Vehicle driving beyond the existing bumper cars.

## Constraints (from the codebase)

- **No per-frame React state.** Physics bodies/handles live in refs/`lib` modules; `useFrame` mutates them; React renders only on discrete state.
- **Quality-aware.** Dynamic body counts + collider complexity scale with the `quality` setting; `low` stays cheap. A hard cap on simultaneously-awake dynamic bodies.
- **Rapier is the one physics engine.** Use `@react-three/rapier` consistently; prefer simple primitive colliders (capsule/cuboid/ball) over trimesh for moving things.
- **Additive & reversible.** Each chunk adds colliders/bodies/controller behaviour behind existing structure; no gameplay rewrite.

## Current physics state (audited 2026-06-15)

- **Has physics:** Player (capsule body), Ground, Fence, Fountain, CircusTent, all `structures/*` (gate, booth, food/balloon stalls, restroom), GameStalls, VendorCarts, AutoRickshaw, FloodLights, Balloons, and all rides (BumperCars already uses dynamic bodies).
- **Walk-through (no colliders) — Chunk A targets:** `Crowd` (NPCs), `FairCrowd` (queue NPCs), `Person` (posed NPCs at carts), `Trees`, `Lamps`. (`GroundDetail`, `Bunting`, `StringLights`, `SkyDome`, `Pathways`, `SpeechBubbles` are correctly non-colliding decorative.)

---

## Chunk A — Solid world

**Approach:** Add fixed/kinematic colliders to the walk-through objects so the player and props collide with them.

- **Trees** (`Trees.tsx`, ~100 instanced): a fixed **cylinder collider per trunk** (foliage stays non-colliding so you can brush leaves). Use instanced colliders or a fixed RigidBody with N cylinder colliders generated from the same placement data — do NOT add 100 dynamic bodies.
- **Lamps** (`Lamps.tsx`, 22): a thin fixed cylinder collider per post.
- **NPCs** (`Crowd.tsx`): each visible NPC gets a **kinematic-position capsule collider** that tracks its steering transform every frame; the player collides with it. NPC steering already avoids the fountain — extend the same cheap avoidance so NPCs also steer around the player (read `playerPos`). Cap colliders to the visible (quality) count. `FairCrowd`/`Person` posed NPCs get static capsule colliders.
- **Player vs NPC:** the player's existing capsule already collides with fixed/kinematic colliders, so once NPCs have kinematic capsules the player can't walk through them.

**Acceptance:** You cannot walk through trees, lamp posts, or people; NPCs nudge around you; frame rate at `high` holds (kinematic colliders are cheap — no solver churn). No regressions to ride boarding (the ride trigger AABB logic is unaffected).

## Chunk B — Better movement feel

**Approach:** Improve the existing kinematic-velocity capsule controller in `Player.tsx`.

- **Momentum/friction:** keep the frame-rate-independent accel but add slightly snappier stop friction and a small coyote-time + jump buffer for responsive jumps.
- **Jump arc:** tune gravity scale / jump velocity for a satisfying arc; add a short landing settle (camera dip).
- **Step-up:** cast forward+down so the player smoothly mounts kerbs/steps/low slopes instead of being blocked (a max step height ~0.4 m).
- **Sprint:** retain; add gentle FOV kick on sprint for speed feedback.
- **Slopes:** project movement along ground normal so walking up the (gentle) terrain/ramps feels natural.

**Acceptance:** Walking feels responsive; you can mount the plaza kerb and ride-platform steps; jumps feel arced with a landing beat; sprint has subtle FOV feedback. No clipping/launch bugs on the new solid colliders.

## Chunk C — Pushable props

**Approach:** Introduce a small, capped pool of dynamic Rapier bodies.

- **`lib/props.ts`** placement data + a `Props` component spawning dynamic bodies: a few **balls, cans, crates, beach-balls/balloons** near the plaza and game stalls. Simple ball/cuboid colliders, `ccd` on small fast ones.
- **Kick/bump:** the player capsule pushing into a dynamic body imparts velocity naturally (Rapier handles it); optionally a small impulse on contact for a satisfying kick.
- **Thrown objects:** Ring Toss / Shooting Gallery throw a real dynamic ring/ball with an arc that lands/bounces, replacing (or augmenting) the current scripted result.
- **Budget:** hard cap (e.g. 12/20/30 awake dynamic bodies by quality); bodies sleep when settled; out-of-bounds props respawn.

**Acceptance:** You can kick a ball and it rolls and settles; props bump and scatter and don't tunnel through the ground/walls; thrown game objects fly a real arc; frame rate respects the cap.

## Chunk D — Real ride physics

**Approach:** Replace scripted seat motion with **force/curve-driven motion**, rider stays seated, camera conveys G-forces. One ride at a time, behind the existing `useRideMachine` lifecycle.

- **Drop Tower:** true free-fall (gravity) on drop + eased lift + damped catch; camera weightlessness (FOV + slight rise) at the top of the fall.
- **Columbus / swing:** real pendulum integration (angular accel from gravity), camera leans into the swing.
- **Teacups / spinners:** centrifugal lean — camera rolls outward with spin speed.
- **Ferris/Carousel:** smooth real angular motion (already close) + subtle sway.
- **Coaster:** keep the existing gravity-on-track speed model; add G-lean (banking already exists) + airtime camera at crests.
- Forces are conveyed via the shared ride camera (extend `applyRideCamera` with a G-vector → camera offset/roll/FOV). Rider body stays kinematically locked to the seat (decision #2).

**Acceptance:** Drop Tower feels like real free-fall; swing/teacups lean you; no nausea-inducing snapping; rides still start/stop via the existing E-to-board lifecycle and return you to the exit.

---

## Performance budget

- Kinematic colliders (NPCs, trees, lamps) are cheap — no solver islands. Trees/lamps are static.
- Dynamic bodies (Chunk C) hard-capped per quality; sleep aggressively.
- Ride physics (Chunk D) is a handful of bodies/curves per active ride.
- Target: no measurable frame-rate regression at `high` vs today; `low` strips dynamic props and uses fewer NPC colliders.

## Multiplayer-readiness notes (no implementation now)

- Prop transforms, ride phase, and seat occupancy live in dedicated modules (`lib/props.ts`, ride controllers) — a future server can own and broadcast them.
- NPC steering is deterministic per seed; could later be server-driven.
- The player controller reads inputs → intended velocity in one place, so a future netcode layer can intercept/reconcile.

## Verification

Per chunk: `npm run build` + `npm run typecheck` + `npm test` green, plus a `scripts/check-*.js` screenshot/interaction check where it makes sense. Manual smoke against each chunk's acceptance criteria (the user drives the running game).

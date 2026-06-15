# Physics Chunk A — Solid World — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the things you currently walk through — trees, lamp posts, and people — solid, so the player (and later, props) collide with them.

**Architecture:** Static objects (trees, lamps, posed/queue NPCs) get **fixed** Rapier colliders generated from their existing placement data. The wandering crowd gets **kinematic-position** capsule colliders created imperatively via `useRapier()` and moved to follow each NPC's steering transform every frame; the crowd steering also gains a cheap "avoid the player" push so NPCs walk around you instead of into you.

**Tech Stack:** `@react-three/rapier` (`RigidBody`, `CylinderCollider`, `CapsuleCollider`, and the raw `useRapier()` world/rapier API — same as `Player.tsx`).

**Spec:** [`docs/superpowers/specs/2026-06-15-physics-and-game-feel-design.md`](../specs/2026-06-15-physics-and-game-feel-design.md) Chunk A.

**Note on tests:** This repo's unit runner (vitest) covers pure logic only; collider/physics behaviour is verified by `npm run typecheck` + `npm run build` passing and **manual smoke in the running game** (walk into a tree/lamp/person). There is no unit test for "player collides with X" — do not invent one. Each task's gate is typecheck+build green; the final task adds a screenshot check.

## File Structure
- Modify: `components/world/Trees.tsx` — add fixed trunk colliders
- Modify: `components/world/Lamps.tsx` — add fixed post colliders
- Modify: `components/world/FairCrowd.tsx` — add fixed capsule colliders under the queue standers
- Modify: `components/world/Person.tsx` — add a fixed capsule collider
- Modify: `components/world/Crowd.tsx` — kinematic capsules per NPC + avoid-player steering

---

## Task 1: Solid tree trunks

**Files:** Modify `components/world/Trees.tsx`

The component already computes a `trees` array (`{x, z, s, shade}`) via `useMemo`. Add fixed cylinder colliders for the trunks from that same array. The trunk visual is `cylinderGeometry args={[0.18, 0.26, 1.6, 7]}` at `position={[t.x, 0.8*t.s, t.z]} scale={t.s}` — so a trunk is ~1.6·s tall, ~0.26·s radius, centred at y=0.8·s. Rapier `CylinderCollider` takes `args={[halfHeight, radius]}`.

- [ ] **Step 1: Add the imports**

At the top of `components/world/Trees.tsx`, add:
```ts
import { RigidBody, CylinderCollider } from '@react-three/rapier'
```

- [ ] **Step 2: Add a fixed-collider RigidBody inside the returned `<group>`**

Inside the top-level `<group>` (e.g. right after the opening `<group>` tag, before the trunk `<Instances>`), add:
```tsx
<RigidBody type="fixed" colliders={false}>
  {trees.map((t, i) => (
    <CylinderCollider
      key={i}
      args={[0.8 * t.s, 0.28 * t.s]}
      position={[t.x, 0.8 * t.s, t.z]}
    />
  ))}
</RigidBody>
```
(Half-height 0.8·s ≈ the 1.6·s trunk; radius 0.28·s ≈ the wide base — slightly generous so you don't clip the bark.)

- [ ] **Step 3: Verify**

Run: `npm run typecheck > /tmp/tc.log 2>&1; echo "exit $?"; tail -3 /tmp/tc.log` → exit 0
Run: `npm run build > /tmp/bd.log 2>&1; echo "exit $?"; tail -3 /tmp/bd.log` → exit 0

- [ ] **Step 4: Commit**
```bash
git add components/world/Trees.tsx
git commit -m "feat(physics): solid tree trunks (fixed cylinder colliders)"
```

---

## Task 2: Solid lamp posts

**Files:** Modify `components/world/Lamps.tsx`

The post visual is `cylinderGeometry args={[0.06, 0.09, 3.2, 7]}` at `position={[x, 1.6, z]}` for each `[x, z]` in `positions` (= `LAMP_POSITIONS`). Add fixed cylinder colliders.

- [ ] **Step 1: Add the import**

In `components/world/Lamps.tsx` add:
```ts
import { RigidBody, CylinderCollider } from '@react-three/rapier'
```

- [ ] **Step 2: Add fixed colliders inside the returned `<group>`**

Right after the opening `<group>` tag, add:
```tsx
<RigidBody type="fixed" colliders={false}>
  {positions.map(([x, z], i) => (
    <CylinderCollider key={i} args={[1.6, 0.12]} position={[x, 1.6, z]} />
  ))}
</RigidBody>
```
(Half-height 1.6 ≈ the 3.2-tall post; radius 0.12 ≈ a touch wider than the 0.09 post so you bump it cleanly.)

- [ ] **Step 3: Verify**

Run: `npm run typecheck > /tmp/tc.log 2>&1; echo "exit $?"; tail -3 /tmp/tc.log` → exit 0
Run: `npm run build > /tmp/bd.log 2>&1; echo "exit $?"; tail -3 /tmp/bd.log` → exit 0

- [ ] **Step 4: Commit**
```bash
git add components/world/Lamps.tsx
git commit -m "feat(physics): solid lamp posts (fixed cylinder colliders)"
```

---

## Task 3: Solid posed & queue NPCs (FairCrowd + Person)

**Files:** Modify `components/world/FairCrowd.tsx`, `components/world/Person.tsx`

These are stationary people (queues at ride counters; posed people at carts). Give each a fixed capsule collider so the player can't walk through them. They don't move, so fixed colliders are correct and cheap.

### Person.tsx
`Person` renders one posed figure at `position` (a `[x,y,z]`) with `rotation-y={yaw}`; the body is centred around y≈1.0 and is ~1.7 tall.

- [ ] **Step 1: Add import + collider to `Person.tsx`**

Add import:
```ts
import { RigidBody, CapsuleCollider } from '@react-three/rapier'
```
Wrap nothing else — just add, as the FIRST child inside the existing top-level `<group position={position} rotation-y={yaw}>`:
```tsx
<RigidBody type="fixed" colliders={false}>
  <CapsuleCollider args={[0.5, 0.32]} position={[0, 0.85, 0]} />
</RigidBody>
```
(Capsule: half-height 0.5 + radius 0.32 ⇒ ~1.64 tall, centred at y≈0.85.)

### FairCrowd.tsx
`FairCrowd` builds a `people` array of `{x, z, yaw, saree, s, ...}` standers (instanced visuals). Add one fixed RigidBody containing a capsule collider per person, scaled by `s`.

- [ ] **Step 2: Add import to `FairCrowd.tsx`**
```ts
import { RigidBody, CapsuleCollider } from '@react-three/rapier'
```

- [ ] **Step 3: Add colliders in the returned JSX**

Inside the top-level returned `<group>`, add (alongside the instanced meshes):
```tsx
<RigidBody type="fixed" colliders={false}>
  {people.map((p, i) => (
    <CapsuleCollider key={i} args={[0.5 * p.s, 0.32 * p.s]} position={[p.x, 0.85 * p.s, p.z]} />
  ))}
</RigidBody>
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck > /tmp/tc.log 2>&1; echo "exit $?"; tail -3 /tmp/tc.log` → exit 0
Run: `npm run build > /tmp/bd.log 2>&1; echo "exit $?"; tail -3 /tmp/bd.log` → exit 0

- [ ] **Step 5: Commit**
```bash
git add components/world/FairCrowd.tsx components/world/Person.tsx
git commit -m "feat(physics): solid posed & queue NPCs (fixed capsule colliders)"
```

---

## Task 4: Solid wandering crowd + avoid-player steering

**Files:** Modify `components/world/Crowd.tsx`

The crowd is physics-free: NPC visual roots are moved by steering math in `useFrame`. Give each visible NPC a **kinematic-position capsule collider** (created imperatively via `useRapier()`), moved to follow the NPC each frame, so the player collides with people. Also add a cheap avoid-player push so NPCs walk around you (mirroring the existing fountain-avoidance block).

- [ ] **Step 1: Add imports**

In `components/world/Crowd.tsx` add:
```ts
import { useRapier, type RapierRigidBody } from '@react-three/rapier'
```
(`useEffect`, `useRef`, `THREE`, `useFrame` are already imported.)

- [ ] **Step 2: Create kinematic bodies for the crowd**

Inside the `Crowd` component, after the `npcs` `useMemo`, add the Rapier world handle and a bodies ref, and an effect that creates one kinematic capsule per possible NPC (`MAX`) and removes them on unmount:
```ts
const { world, rapier } = useRapier()
const bodies = useRef<RapierRigidBody[]>([])

useEffect(() => {
  const created: RapierRigidBody[] = []
  for (let i = 0; i < npcs.length; i++) {
    const n = npcs[i]
    const body = world.createRigidBody(
      rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(n.x, 0.9, n.z),
    )
    // capsule ~1.7 tall: halfHeight 0.55 + radius 0.3
    world.createCollider(rapier.ColliderDesc.capsule(0.55, 0.3), body)
    created.push(body)
  }
  bodies.current = created
  return () => {
    created.forEach((b) => world.removeRigidBody(b))
    bodies.current = []
  }
}, [npcs, world, rapier])
```

- [ ] **Step 3: Add avoid-player steering + drive the bodies each frame**

In the existing `useFrame`, the per-NPC loop already computes movement and ends with the LOD/animation block. Make two changes inside `for (let i = 0; i < count; i++) { ... }`:

(a) After the fountain-avoidance block (inside the `else { ... }` walking branch, right after the fountain `if (distO < FOUNTAIN_AVOID_R) {...}`), add a player-avoidance push:
```ts
        // steer around the player so NPCs don't walk into the (solid) body
        const pdx = n.x - px
        const pdz = n.z - pz
        const pd = Math.hypot(pdx, pdz)
        const PLAYER_AVOID_R = 2.2
        if (pd < PLAYER_AVOID_R && pd > 0.001) {
          const push = (PLAYER_AVOID_R - pd) * 1.5 * dt
          n.x += (pdx / pd) * push
          n.z += (pdz / pd) * push
        }
```

(b) After `n.root.position.set(n.x, 0, n.z)` (where the visual is placed), drive this NPC's kinematic body to match:
```ts
      const body = bodies.current[i]
      if (body) body.setNextKinematicTranslation({ x: n.x, y: 0.9, z: n.z })
```

- [ ] **Step 4: Park the colliders of hidden NPCs**

NPCs beyond the current quality `count` are invisible; their bodies must not block the player. After the `for` loop (just before `crowdAgents.length = count`), add:
```ts
    for (let i = count; i < bodies.current.length; i++) {
      bodies.current[i].setNextKinematicTranslation({ x: 0, y: -50, z: 0 }) // park far below
    }
```

- [ ] **Step 5: Verify**

Run: `npm run typecheck > /tmp/tc.log 2>&1; echo "exit $?"; tail -3 /tmp/tc.log` → exit 0
Run: `npm run build > /tmp/bd.log 2>&1; echo "exit $?"; tail -3 /tmp/bd.log` → exit 0
Run: `npm test > /tmp/t.log 2>&1; echo "exit $?"; tail -2 /tmp/t.log` → exit 0 (7 tests, unaffected)

- [ ] **Step 6: Commit**
```bash
git add components/world/Crowd.tsx
git commit -m "feat(physics): wandering NPCs are solid (kinematic capsules) + avoid the player"
```

---

## Task 5: Verification + smoke check

**Files:** Create `scripts/check-solid.js`

- [ ] **Step 1: Write the check script**

Create `scripts/check-solid.js`, modeled on an existing `scripts/check-*.js` (reuse its playwright-core boot/connect boilerplate + `window.__park` readiness wait). Against a running dev server at http://localhost:3000, it should: enter the park, drive the player (via `window.__park.rig` / `window.__park.store` and key presses) straight toward a known tree/lamp/NPC cluster, and capture `scripts/shot-solid.png`. Keep it robust (warn + continue if a control isn't found). Do not commit PNGs.

- [ ] **Step 2: Run the full gate set (real exit codes)**

- `npm test > /tmp/t.log 2>&1; echo "exit $?"; tail -2 /tmp/t.log` → 0
- `npm run typecheck > /tmp/tc.log 2>&1; echo "exit $?"; tail -3 /tmp/tc.log` → 0
- `npm run build > /tmp/bd.log 2>&1; echo "exit $?"; tail -3 /tmp/bd.log` → 0

- [ ] **Step 3: Commit**
```bash
git add scripts/check-solid.js
git commit -m "test(physics): solid-world smoke check script"
```

---

## Chunk A acceptance (from spec)

- [ ] You cannot walk through trees, lamp posts, queue/posed people, or wandering NPCs.
- [ ] Wandering NPCs steer around you instead of into you.
- [ ] Ride boarding still works (the trigger-AABB logic is untouched).
- [ ] `npm test`, `npm run typecheck`, `npm run build` all green; frame rate at `high` holds (all new colliders are fixed or kinematic — no dynamic-solver cost).

Chunks B (movement feel), C (pushable props), D (ride physics) follow with their own plans.

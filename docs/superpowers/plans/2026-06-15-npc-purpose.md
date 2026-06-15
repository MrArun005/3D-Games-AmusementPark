# NPC Purpose (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Give the wandering crowd real purpose — each NPC picks a goal (ride / food / game / stroll), walks there, joins a **real queue that drains** at rides & games, visibly eats at food stalls, then picks a new goal.

**Architecture:** Two new pure modules — `lib/queue.ts` (a FIFO station queue mapped to physical slot positions) and `lib/npc.ts` (station data + a weighted goal picker + the per-agent goal/phase machine) — both unit-tested with vitest. `components/world/Crowd.tsx` is extended: each NPC gains a `goal` + `phase` and its steering target comes from the brain instead of random wandering; arrival transitions drive queueing/eating/playing. Real boarding is a placeholder timer here (Phase 3 makes NPCs sit in seats). The fake static queues in `FairCrowd` are retired.

**Tech Stack:** TypeScript, vitest (pure logic), React Three Fiber (the existing crowd `useFrame`).

**Spec:** [`docs/superpowers/specs/2026-06-15-living-characters-design.md`](../specs/2026-06-15-living-characters-design.md) §6 (Phase 2 — Purpose).

## Context: current crowd (post-physics)
`components/world/Crowd.tsx` builds `npcs[]` (each `{x,z,tx,tz,speed,idle,yaw,s,root,mixer,walkAction,idleAction}`), gives each a kinematic capsule collider that follows it, and in `useFrame` steers toward `(tx,tz)`, on arrival (`d<1`) picks a random `CROWD_TARGET` and lingers, with fountain + player avoidance and an animation LOD. Phase 2 replaces the *random target* with *goal-driven targets* and adds per-NPC phases; the steering/avoidance/LOD/collider code is kept.

## File Structure
- Create: `lib/queue.ts` — `StationQueue` (FIFO + slot positions) + `lib/queue.test.ts`
- Create: `lib/npc.ts` — `STATIONS`, `pickGoal`, goal/phase types + `lib/npc.test.ts`
- Modify: `components/world/Crowd.tsx` — brain-driven targets + phase machine
- Modify: `components/Scene.tsx` — remove `<FairCrowd />` (fake queues retired)
- Delete: `components/world/FairCrowd.tsx`

---

## Task 1: Station queue (`lib/queue.ts`)

**Files:** Create `lib/queue.ts`, `lib/queue.test.ts`

- [ ] **Step 1: Write the failing test** — `lib/queue.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { StationQueue } from '@/lib/queue'

const slots = [{ x: 0, z: 0 }, { x: 0, z: 1 }, { x: 0, z: 2 }]

describe('StationQueue', () => {
  it('joins up to capacity and reports place positions', () => {
    const q = new StationQueue(slots)
    expect(q.join(10)).toBe(true)
    expect(q.join(11)).toBe(true)
    expect(q.slotFor(10)).toEqual({ x: 0, z: 0 }) // front
    expect(q.slotFor(11)).toEqual({ x: 0, z: 1 })
    expect(q.length).toBe(2)
  })
  it('rejects joins beyond capacity', () => {
    const q = new StationQueue(slots)
    q.join(1); q.join(2); q.join(3)
    expect(q.join(4)).toBe(false)
    expect(q.length).toBe(3)
  })
  it('frontReady true only for the agent at slot 0', () => {
    const q = new StationQueue(slots)
    q.join(7); q.join(8)
    expect(q.frontReady(7)).toBe(true)
    expect(q.frontReady(8)).toBe(false)
  })
  it('leaveFront removes the head and shuffles others forward', () => {
    const q = new StationQueue(slots)
    q.join(7); q.join(8)
    expect(q.leaveFront()).toBe(7)
    expect(q.slotFor(8)).toEqual({ x: 0, z: 0 }) // 8 advances to front
    expect(q.has(7)).toBe(false)
  })
  it('remove pulls an agent out of the middle', () => {
    const q = new StationQueue(slots)
    q.join(1); q.join(2); q.join(3)
    q.remove(2)
    expect(q.slotFor(3)).toEqual({ x: 0, z: 1 })
    expect(q.length).toBe(2)
  })
})
```

- [ ] **Step 2: Run `npm test`** → FAIL (no `lib/queue.ts`).

- [ ] **Step 3: Implement `lib/queue.ts`**:
```ts
export interface QueueSlot { x: number; z: number }

/**
 * A FIFO line of agent ids at a station (ride/game). Position k in line maps to
 * physical `slots[k]`; agents past the last slot stack at the final slot. Pure
 * data structure — the crowd reads `slotFor` to steer and calls `leaveFront`
 * when the head boards.
 */
export class StationQueue {
  private waiting: number[] = []
  constructor(public readonly slots: QueueSlot[]) {}

  get length(): number {
    return this.waiting.length
  }
  has(agentId: number): boolean {
    return this.waiting.includes(agentId)
  }
  /** Join the back of the line; false if the line is at capacity. */
  join(agentId: number): boolean {
    if (this.waiting.length >= this.slots.length) return false
    if (!this.waiting.includes(agentId)) this.waiting.push(agentId)
    return true
  }
  /** The slot this agent should stand in (its place in line), or null. */
  slotFor(agentId: number): QueueSlot | null {
    const i = this.waiting.indexOf(agentId)
    if (i < 0) return null
    return this.slots[Math.min(i, this.slots.length - 1)]
  }
  /** True only when this agent is at the front (place 0). */
  frontReady(agentId: number): boolean {
    return this.waiting[0] === agentId
  }
  /** Remove + return the head (it has boarded), or null if empty. */
  leaveFront(): number | null {
    return this.waiting.shift() ?? null
  }
  /** Pull an agent out of the line (e.g. it abandoned the goal). */
  remove(agentId: number): void {
    const i = this.waiting.indexOf(agentId)
    if (i >= 0) this.waiting.splice(i, 1)
  }
}
```

- [ ] **Step 4: Run `npm test`** → PASS (queue tests + existing 7).

- [ ] **Step 5: Commit**
```bash
git add lib/queue.ts lib/queue.test.ts
git commit -m "feat(npc): StationQueue — FIFO line mapped to physical slots (tested)"
```

---

## Task 2: Stations + goal picker (`lib/npc.ts`)

**Files:** Create `lib/npc.ts`, `lib/npc.test.ts`

`lib/spawn.ts` exports `RIDE_LIST` (each `{id,name,cost,position:[x,y,z],trigger:{offset:[x,y,z],half}}`), `STALLS` (food: `{id,position:[x,y,z],...}`), `GAME_STALLS` (`{id,position:[x,y,z],...}`), and `mulberry32`.

- [ ] **Step 1: Write the failing test** — `lib/npc.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { STATIONS, pickGoal, type Goal } from '@/lib/npc'
import { mulberry32 } from '@/lib/spawn'

describe('STATIONS', () => {
  it('has ride, food and game stations with queue slots for rides/games', () => {
    expect(STATIONS.some((s) => s.kind === 'ride')).toBe(true)
    expect(STATIONS.some((s) => s.kind === 'food')).toBe(true)
    expect(STATIONS.some((s) => s.kind === 'game')).toBe(true)
    for (const s of STATIONS) {
      if (s.kind === 'ride' || s.kind === 'game') expect(s.slots.length).toBeGreaterThan(0)
    }
  })
})

describe('pickGoal', () => {
  it('is deterministic for a seed and returns a real station or a stroll', () => {
    const g1 = pickGoal(mulberry32(5))
    const g2 = pickGoal(mulberry32(5))
    expect(g1).toEqual(g2)
  })
  it('always returns finite target coordinates', () => {
    for (let s = 0; s < 100; s++) {
      const g: Goal = pickGoal(mulberry32(s))
      expect(Number.isFinite(g.x)).toBe(true)
      expect(Number.isFinite(g.z)).toBe(true)
      expect(['ride', 'food', 'game', 'stroll']).toContain(g.kind)
    }
  })
})
```

- [ ] **Step 2: Run `npm test`** → FAIL.

- [ ] **Step 3: Implement `lib/npc.ts`**:
```ts
import { RIDE_LIST, STALLS, GAME_STALLS, WAYPOINTS, mulberry32 } from '@/lib/spawn'

export type StationKind = 'ride' | 'food' | 'game'
export interface QueueSlotPos { x: number; z: number }
export interface Station {
  kind: StationKind
  id: string
  /** Where the NPC heads to use the station (counter / stall front). */
  x: number
  z: number
  /** Queue slot positions (rides & games); empty for food (walk-up). */
  slots: QueueSlotPos[]
}

/** Build a snaking queue of `n` slots leading from a counter back toward the plaza. */
function buildSlots(cx: number, cz: number, n: number): QueueSlotPos[] {
  const len = Math.hypot(cx, cz) || 1
  const dx = -cx / len // counter -> plaza centre
  const dz = -cz / len
  const px = -dz // perpendicular for a little zig-zag
  const pz = dx
  const out: QueueSlotPos[] = []
  for (let k = 0; k < n; k++) {
    const dist = 2.5 + k * 1.15
    const zig = k % 2 ? 0.35 : -0.35
    out.push({ x: cx + dx * dist + px * zig, z: cz + dz * dist + pz * zig })
  }
  return out
}

export const STATIONS: Station[] = [
  ...RIDE_LIST.map((r): Station => {
    const cx = r.position[0] + r.trigger.offset[0]
    const cz = r.position[2] + r.trigger.offset[2]
    return { kind: 'ride', id: r.id, x: cx, z: cz, slots: buildSlots(cx, cz, 6) }
  }),
  ...STALLS.map((s): Station => ({
    kind: 'food', id: s.id, x: s.position[0], z: s.position[2] + 2, slots: [],
  })),
  ...GAME_STALLS.map((s): Station => {
    const cx = s.position[0]
    const cz = s.position[2] + 2
    return { kind: 'game', id: s.id, x: cx, z: cz, slots: buildSlots(cx, cz, 4) }
  }),
]

export type GoalKind = StationKind | 'stroll'
export interface Goal {
  kind: GoalKind
  /** station id, or 'stroll' */
  id: string
  x: number
  z: number
}

/** Weighted pick: rides are the main draw, then food/games, with some strolling. */
export function pickGoal(rnd: () => number): Goal {
  const roll = rnd()
  let kind: GoalKind
  if (roll < 0.5) kind = 'ride'
  else if (roll < 0.7) kind = 'food'
  else if (roll < 0.85) kind = 'game'
  else kind = 'stroll'

  if (kind === 'stroll') {
    const wp = WAYPOINTS[Math.floor(rnd() * WAYPOINTS.length)]
    return { kind, id: 'stroll', x: wp[0], z: wp[1] }
  }
  const pool = STATIONS.filter((s) => s.kind === kind)
  const st = pool[Math.floor(rnd() * pool.length)]
  return { kind, id: st.id, x: st.x, z: st.z }
}

/** Station lookup by id (rides & games carry queues). */
export const STATION_BY_ID: Record<string, Station> = Object.fromEntries(
  STATIONS.map((s) => [s.id, s]),
)
```

- [ ] **Step 4: Run `npm test`** → PASS.

- [ ] **Step 5: Commit**
```bash
git add lib/npc.ts lib/npc.test.ts
git commit -m "feat(npc): stations + weighted goal picker (tested)"
```

---

## Task 3: Brain-driven crowd (`components/world/Crowd.tsx`)

**Files:** Modify `components/world/Crowd.tsx`

Give each NPC a goal + phase and drive its target from the brain. Keep the walking steering, avoidance, animation LOD, and kinematic-body code unchanged.

- [ ] **Step 1: Imports + per-NPC brain state**

Add imports:
```ts
import { pickGoal, STATION_BY_ID, type Goal } from '@/lib/npc'
import { StationQueue } from '@/lib/queue'
```
Extend the `Npc` interface with brain fields:
```ts
  goal: Goal
  phase: 'seeking' | 'queuing' | 'busy'
  timer: number // seconds left in the current busy/queue action
```
In the `npcs` `useMemo`, initialise each NPC with a starting goal and phase (replace the `tx/tz` seed with the goal target):
```ts
      const goal = pickGoal(rnd)
```
and in the pushed object set `tx: goal.x, tz: goal.z, goal, phase: 'seeking', timer: 0` (keep the other fields).

- [ ] **Step 2: One queue per ride/game station (module or ref)**

Near the top of the component, build the queues once:
```ts
const queues = useMemo(() => {
  const m = new Map<string, StationQueue>()
  for (const s of Object.values(STATION_BY_ID)) {
    if (s.kind === 'ride' || s.kind === 'game') m.set(s.id, new StationQueue(s.slots))
  }
  return m
}, [])
```

- [ ] **Step 3: Replace the arrival/wander block with the goal machine**

In `useFrame`, the current arrival branch is `else if (d < 1) { ...pick random CROWD_TARGET, linger... }`. Replace that whole branch with goal handling (use a slightly larger arrival radius for stations). The walking `else { ... }` branch (steer toward tx/tz + avoidance) stays. New arrival logic:
```ts
      } else if (n.phase === 'busy') {
        n.timer -= dt
        if (n.timer <= 0) {
          // done eating / playing / (placeholder) riding -> pick the next goal
          n.goal = pickGoal(rndRef.current)
          n.tx = n.goal.x
          n.tz = n.goal.z
          n.phase = 'seeking'
        }
      } else if (d < 1.4) {
        const q = queues.get(n.goal.id)
        if ((n.goal.kind === 'ride' || n.goal.kind === 'game') && q) {
          if (n.phase !== 'queuing') {
            if (!q.join(i)) {
              // line full -> give up, pick a new goal
              n.goal = pickGoal(rndRef.current)
              n.tx = n.goal.x; n.tz = n.goal.z
            } else {
              n.phase = 'queuing'
            }
          }
          if (n.phase === 'queuing') {
            const slot = q.slotFor(i)
            if (slot) { n.tx = slot.x; n.tz = slot.z }
            if (q.frontReady(i)) {
              // (placeholder) board: leave the line and "use" the station
              q.leaveFront()
              n.phase = 'busy'
              n.timer = n.goal.kind === 'ride' ? 6 : 4
            }
          }
        } else {
          // food / stroll: just dwell, then move on
          n.phase = 'busy'
          n.timer = n.goal.kind === 'food' ? 4 : 1.5
        }
      }
```
Notes:
- `i` is the loop index (stable per NPC) — used as the agent id in queues.
- Add a `rndRef` for goal re-picks so they stay deterministic-ish and don't call `Math.random` inconsistently: near the other refs add `const rndRef = useRef(mulberry32(555))` (import `mulberry32` is already imported via spawn). Use `rndRef.current` as shown.
- Walking sets `walking = true` only in the steer branch (unchanged), so `walking` is false while queuing-at-slot once arrived — that's fine (idle anim plays). While queuing but still moving to a slot, the NPC is in the steer branch (d>1.4) so it walks. Good.

- [ ] **Step 4: Drop the now-unused random-target imports**

`CROWD_TARGETS` is no longer used for arrival. If it's now unused, remove it from the import from `@/lib/crowd` (keep `crowdAgents`). Leave `WAYPOINTS` import only if still referenced (the initial spawn still uses it — keep).

- [ ] **Step 5: Verify**
- `npm run typecheck > /tmp/tc.log 2>&1; echo "exit $?"; tail -4 /tmp/tc.log` → 0
- `npm run build > /tmp/bd.log 2>&1; echo "exit $?"; tail -3 /tmp/bd.log` → 0
- `npm test > /tmp/t.log 2>&1; echo "exit $?"; tail -2 /tmp/t.log` → 0

- [ ] **Step 6: Visual smoke** (`npm run dev`): stand near a ride and watch NPCs walk up, **form a line that drains** as the front "rides" and reappears; NPCs visit food/game stalls and dwell, then move on. No NPC stuck permanently.

- [ ] **Step 7: Commit**
```bash
git add components/world/Crowd.tsx
git commit -m "feat(npc): goal-driven crowd — rides/food/games with real draining queues"
```

---

## Task 4: Retire the fake static queues (`FairCrowd`)

**Files:** Modify `components/Scene.tsx`; Delete `components/world/FairCrowd.tsx`

The wandering crowd now forms real queues, so the fake static queue standers are redundant.

- [ ] **Step 1:** In `components/Scene.tsx`, remove the `import FairCrowd from '@/components/world/FairCrowd'` line and the `<FairCrowd />` element.
- [ ] **Step 2:** `git rm components/world/FairCrowd.tsx`
- [ ] **Step 3: Verify** no dangling references: `grep -rn "FairCrowd" components app lib state` → nothing.
- `npm run typecheck` → 0, `npm run build` → 0, `npm test` → 0 (real exit codes as above).
- [ ] **Step 4: Commit**
```bash
git add components/Scene.tsx
git commit -m "feat(npc): retire fake static queues (FairCrowd) — real queues replace them"
```

---

## Task 5: Verification + smoke script

**Files:** Create `scripts/check-purpose.js`

- [ ] **Step 1:** Model on an existing `scripts/check-*.js`. Against a running dev server, position the camera near a ride counter, wait several seconds, and capture `scripts/shot-purpose.png` showing a queue. Robust if controls absent. Do not commit PNGs.
- [ ] **Step 2: Full gates** (real exit codes): `npm test` → 0 (queue + npc + existing), `npm run typecheck` → 0, `npm run build` → 0.
- [ ] **Step 3: Commit**
```bash
git add scripts/check-purpose.js
git commit -m "test(npc): purpose/queue smoke check script"
```

---

## Phase 2 acceptance (from spec §6.4)
- [ ] Standing near a ride, you can watch a queue **form and drain** over time.
- [ ] NPCs visibly walk to food stalls and dwell ("eat"), and to game stalls and dwell ("play").
- [ ] No NPC gets permanently stuck (full lines → re-pick a goal; busy timers always expire).
- [ ] `npm test`, `npm run typecheck`, `npm run build` all green.

Phase 3 (Boarding) then makes the front-of-queue NPC actually sit in a ride seat (replacing the placeholder `busy` timer) and fills seats beside the player.

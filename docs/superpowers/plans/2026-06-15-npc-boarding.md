# NPC Boarding (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let NPCs actually **board and ride** — the front of a ride's queue takes a seat and rides, the ride visibly fills with people, and when **you** board, the other seats fill with NPC riders so you never ride alone.

**Architecture:** A shared `lib/rideOccupancy.ts` (zustand) holds a fixed seat array per ride; `claimSeat`/`releaseSeat`/`seatsOf` manage it. The two continuously-spinning multi-seat rides — **Ferris Wheel** (8 cabin group refs) and **Carousel** (8 horse group refs) — render a cheap static seated figure (`RideRider`) in each occupied seat (the seat anchors already move/counter-rotate, so riders ride along). The crowd's front-of-queue NPC claims a seat (board-and-hide for the ride duration, then disembark at the exit); the player's E-to-board path fills the remaining seats with `company` riders via the shared ride machine. Other rides keep the Phase-2 board-and-hide placeholder (no visible seat occupancy) — a documented fast-follow.

**Tech Stack:** zustand (occupancy), React Three Fiber, the existing `useRideMachine`/`Crowd`/`StationQueue`.

**Spec:** [`docs/superpowers/specs/2026-06-15-living-characters-design.md`](../specs/2026-06-15-living-characters-design.md) §7 (Phase 3 — Boarding).

## Seat-bearing rides (this plan)
- `ferris` — 8 seats (cabin groups, `cabins.current[]`, at gondola body local `y≈-1.12`).
- `carousel` — 8 seats (horse groups, `horses.current[]`, rider sits on the saddle local `y≈0.55`).
Others (`coaster`, `teacups`, `droptower`, `bumper`, `columbus`) → `RIDE_SEATS[id]` undefined ⇒ Crowd uses the Phase-2 placeholder boarding (unchanged).

## File Structure
- Create: `lib/rideOccupancy.ts` (+ `lib/rideOccupancy.test.ts`)
- Create: `components/world/RideRider.tsx` (static seated figure)
- Modify: `components/rides/FerrisWheel.tsx` (render riders in occupied cabins)
- Modify: `components/rides/Carousel.tsx` (render riders on occupied horses)
- Modify: `components/world/Crowd.tsx` (front-of-queue NPC claims a seat; disembarks at exit)
- Modify: `components/rides/RideBase.tsx` (player company: fill/clear seats on board/unload)

---

## Task 1: Ride occupancy store (`lib/rideOccupancy.ts`)

**Files:** Create `lib/rideOccupancy.ts`, `lib/rideOccupancy.test.ts`

- [ ] **Step 1: Write the failing test** — `lib/rideOccupancy.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useRideOccupancy, RIDE_SEATS } from '@/lib/rideOccupancy'

beforeEach(() => useRideOccupancy.getState().reset())

describe('ride occupancy', () => {
  it('knows seat counts for ferris and carousel, none for others', () => {
    expect(RIDE_SEATS.ferris).toBe(8)
    expect(RIDE_SEATS.carousel).toBe(8)
    expect(RIDE_SEATS.coaster).toBeUndefined()
  })
  it('claims the lowest free seat and rejects when full', () => {
    const { claimSeat } = useRideOccupancy.getState()
    const seats: number[] = []
    for (let i = 0; i < 8; i++) seats.push(claimSeat('ferris', 'npc', 0)!)
    expect(seats).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    expect(claimSeat('ferris', 'npc', 0)).toBeNull() // full
  })
  it('releases a seat so it can be reclaimed', () => {
    const { claimSeat, releaseSeat, seatsOf } = useRideOccupancy.getState()
    const s = claimSeat('carousel', 'npc', 2)!
    expect(seatsOf('carousel')[s]).not.toBeNull()
    releaseSeat('carousel', s)
    expect(seatsOf('carousel')[s]).toBeNull()
  })
  it('clearCompany frees only company seats, leaving npc riders', () => {
    const { claimSeat, clearCompany, seatsOf } = useRideOccupancy.getState()
    const a = claimSeat('ferris', 'npc', 1)!
    const b = claimSeat('ferris', 'company', 2)!
    clearCompany('ferris')
    expect(seatsOf('ferris')[a]).not.toBeNull()
    expect(seatsOf('ferris')[b]).toBeNull()
  })
})
```

- [ ] **Step 2: Run `npm test`** → FAIL (no module).

- [ ] **Step 3: Implement `lib/rideOccupancy.ts`**:
```ts
import { create } from 'zustand'

/** Seats per ride that visibly carry riders. Rides absent here use placeholder boarding. */
export const RIDE_SEATS: Record<string, number> = { ferris: 8, carousel: 8 }

export type RiderSource = 'npc' | 'company'
export interface Rider { source: RiderSource; variant: number }

interface OccupancyState {
  /** rideId -> array of (Rider | null), length RIDE_SEATS[rideId]. */
  seats: Record<string, (Rider | null)[]>
  /** Claim the lowest free seat; returns its index, or null if full / not a seated ride. */
  claimSeat: (rideId: string, source: RiderSource, variant: number) => number | null
  releaseSeat: (rideId: string, seat: number) => void
  /** Release all 'company' riders for a ride (player got off). */
  clearCompany: (rideId: string) => void
  seatsOf: (rideId: string) => (Rider | null)[]
  reset: () => void
}

const emptyFor = (rideId: string): (Rider | null)[] =>
  Array.from({ length: RIDE_SEATS[rideId] ?? 0 }, () => null)

const initial = (): Record<string, (Rider | null)[]> =>
  Object.fromEntries(Object.keys(RIDE_SEATS).map((id) => [id, emptyFor(id)]))

export const useRideOccupancy = create<OccupancyState>((set, get) => ({
  seats: initial(),
  claimSeat: (rideId, source, variant) => {
    const arr = get().seats[rideId]
    if (!arr) return null
    const i = arr.indexOf(null)
    if (i < 0) return null
    const next = arr.slice()
    next[i] = { source, variant }
    set((s) => ({ seats: { ...s.seats, [rideId]: next } }))
    return i
  },
  releaseSeat: (rideId, seat) => {
    const arr = get().seats[rideId]
    if (!arr || !arr[seat]) return
    const next = arr.slice()
    next[seat] = null
    set((s) => ({ seats: { ...s.seats, [rideId]: next } }))
  },
  clearCompany: (rideId) => {
    const arr = get().seats[rideId]
    if (!arr) return
    set((s) => ({ seats: { ...s.seats, [rideId]: arr.map((r) => (r?.source === 'company' ? null : r)) } }))
  },
  seatsOf: (rideId) => get().seats[rideId] ?? [],
  reset: () => set({ seats: initial() }),
}))
```

- [ ] **Step 4: Run `npm test`** → PASS. **Step 5: Commit**
```bash
git add lib/rideOccupancy.ts lib/rideOccupancy.test.ts
git commit -m "feat(boarding): ride seat-occupancy store (claim/release/company) with tests"
```

---

## Task 2: Seated rider figure (`components/world/RideRider.tsx`)

**Files:** Create `components/world/RideRider.tsx`

A cheap STATIC seated person (no skinning/animation) for ride seats. Reuse the palette for varied clothing.

- [ ] **Step 1: Implement** `components/world/RideRider.tsx`:
```tsx
'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { BAZAAR } from '@/lib/palette'

const CLOTHES = [BAZAAR.magenta, BAZAAR.marigold, BAZAAR.parrotGreen, BAZAAR.turquoise, BAZAAR.purple, BAZAAR.skyBlue, BAZAAR.chilliRed, BAZAAR.yellow]
const SKIN = [BAZAAR.skin1, BAZAAR.skin2, BAZAAR.skin3]

/**
 * A small static seated figure for ride seats: torso, head, thighs forward,
 * shins down — reads as a person sitting. `variant` picks deterministic colours.
 * Purely visual (no physics/animation); cheap enough for ~16 on screen.
 */
export default function RideRider({ variant = 0 }: { variant?: number }) {
  const { cloth, skin } = useMemo(
    () => ({ cloth: CLOTHES[variant % CLOTHES.length], skin: SKIN[variant % SKIN.length] }),
    [variant],
  )
  return (
    <group>
      {/* torso */}
      <mesh position={[0, 0.32, 0]} castShadow>
        <capsuleGeometry args={[0.16, 0.32, 4, 8]} />
        <meshStandardMaterial color={cloth} roughness={0.8} />
      </mesh>
      {/* head */}
      <mesh position={[0, 0.7, 0]} castShadow>
        <sphereGeometry args={[0.13, 12, 10]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
      {/* thighs forward */}
      <mesh position={[0, 0.12, 0.16]} rotation-x={-1.3}>
        <capsuleGeometry args={[0.08, 0.3, 4, 8]} />
        <meshStandardMaterial color={cloth} roughness={0.85} />
      </mesh>
      {/* shins down */}
      <mesh position={[0, -0.1, 0.34]}>
        <capsuleGeometry args={[0.07, 0.3, 4, 8]} />
        <meshStandardMaterial color="#3b332b" roughness={0.9} />
      </mesh>
    </group>
  )
}
```

- [ ] **Step 2: Verify** `npm run typecheck` → 0; `npm run build` → 0. **Step 3: Commit**
```bash
git add components/world/RideRider.tsx
git commit -m "feat(boarding): static seated RideRider figure"
```

---

## Task 3: Riders in the Ferris Wheel cabins

**Files:** Modify `components/rides/FerrisWheel.tsx`

Each cabin group (`angles.map(...)`) renders a `RideRider` when its seat is occupied. Subscribe to occupancy so the cabin re-renders on board/release (infrequent).

- [ ] **Step 1:** Add imports:
```ts
import RideRider from '@/components/world/RideRider'
import { useRideOccupancy } from '@/lib/rideOccupancy'
```
- [ ] **Step 2:** Inside the component, subscribe to this ride's seats:
```ts
const seats = useRideOccupancy((s) => s.seats.ferris)
```
- [ ] **Step 3:** In the cabin JSX (the `angles.map((a, i) => (<group ... >`), add a rider as the last child of each cabin group, seated in the gondola body (body is at local y≈-1.12):
```tsx
            {seats[i] && (
              <group position={[0, -1.32, 0]}>
                <RideRider variant={seats[i]!.variant} />
              </group>
            )}
```
- [ ] **Step 4:** Verify `npm run typecheck` → 0, `npm run build` → 0. **Commit**
```bash
git add components/rides/FerrisWheel.tsx
git commit -m "feat(boarding): Ferris Wheel cabins show seated riders by occupancy"
```

---

## Task 4: Riders on the Carousel horses

**Files:** Modify `components/rides/Carousel.tsx`

- [ ] **Step 1:** Add the same two imports (`RideRider`, `useRideOccupancy`).
- [ ] **Step 2:** Subscribe: `const seats = useRideOccupancy((s) => s.seats.carousel)`.
- [ ] **Step 3:** In the horse JSX (the per-horse `<group ref={(el) => (horses.current[i] = el)} ...>`), add a rider sitting on the saddle as the last child (saddle sits around local `y≈0.55` on the horse body — READ the file to confirm the saddle/body local Y and place the rider just above it):
```tsx
            {seats[i] && (
              <group position={[0, 0.6, 0]}>
                <RideRider variant={seats[i]!.variant} />
              </group>
            )}
```
Adjust the `0.6` to sit cleanly on the saddle after reading the horse local layout.
- [ ] **Step 4:** Verify `npm run typecheck` → 0, `npm run build` → 0. **Commit**
```bash
git add components/rides/Carousel.tsx
git commit -m "feat(boarding): Carousel horses show seated riders by occupancy"
```

---

## Task 5: NPCs claim seats and ride (Crowd integration)

**Files:** Modify `components/world/Crowd.tsx`

Replace the Phase-2 placeholder boarding for **seated rides** with real seat claiming. When the front-of-queue NPC at a ride with `RIDE_SEATS[id]` reaches the front, it claims a seat; if it gets one it boards-and-hides for the ride duration, then releases the seat and reappears at the ride exit.

- [ ] **Step 1:** Add imports:
```ts
import { useRideOccupancy, RIDE_SEATS } from '@/lib/rideOccupancy'
import { RIDES } from '@/lib/spawn'
```
- [ ] **Step 2:** Track each NPC's claimed seat. Extend the `Npc` interface with `seat: number | null` and init `seat: null` in the `npcs` useMemo.
- [ ] **Step 3:** In the goal machine (Task 3 of Phase 2), where a ride/game front-of-queue NPC currently does `q.leaveFront(); n.phase = 'busy'; n.timer = ...`, change the RIDE branch (only when `RIDE_SEATS[n.goal.id]` is defined) to claim a seat:
```ts
            if (q.frontReady(i)) {
              const occ = useRideOccupancy.getState()
              if (RIDE_SEATS[n.goal.id] !== undefined) {
                const seat = occ.claimSeat(n.goal.id, 'npc', Math.floor(rndRef.current() * 8))
                if (seat === null) {
                  // ride full of riders right now — wait one beat, stay at front
                } else {
                  q.leaveFront()
                  n.seat = seat
                  n.phase = 'busy'
                  n.timer = RIDES[n.goal.id as keyof typeof RIDES].duration
                  n.root.visible = false // board: hide the walking body; the ride shows the seated rider
                }
              } else {
                // non-seated ride: Phase-2 placeholder (board & hide briefly)
                q.leaveFront()
                n.phase = 'busy'
                n.timer = 6
              }
            }
```
- [ ] **Step 4:** When a seated NPC's `busy` timer expires (in the `phase === 'busy'` branch), release the seat, reveal the body at the ride exit, and pick a new goal:
```ts
      } else if (n.phase === 'busy') {
        n.timer -= dt
        if (n.timer <= 0) {
          if (n.seat !== null) {
            useRideOccupancy.getState().releaseSeat(n.goal.id, n.seat)
            n.seat = null
            const exit = RIDES[n.goal.id as keyof typeof RIDES]?.exit
            if (exit) { n.x = exit[0]; n.z = exit[2] }
            n.root.visible = true
          }
          n.goal = pickGoal(rndRef.current)
          n.tx = n.goal.x
          n.tz = n.goal.z
          n.phase = 'seeking'
        }
      }
```
Note: `n.root.visible` is also set by the quality-LOD effect (`i < count`); on disembark, set it back to `i < count` rather than unconditional true — use `n.root.visible = i < count`. Apply that in the code above.
- [ ] **Step 5:** Verify `npm run typecheck` → 0, `npm run build` → 0, `npm test` → 0. **Visual smoke:** NPCs queue at the Ferris wheel/carousel, vanish from the path as they board, **appear seated and riding**, then return to the exit and walk off.
- [ ] **Step 6: Commit**
```bash
git add components/world/Crowd.tsx
git commit -m "feat(boarding): NPCs claim a seat and ride the Ferris wheel / carousel"
```

---

## Task 6: Ride with company (player fills the other seats)

**Files:** Modify `components/rides/RideBase.tsx`

When the player boards a seated ride, fill the remaining seats with `company` riders; clear them when the player gets off.

- [ ] **Step 1:** In `RideBase.tsx` add import:
```ts
import { useRideOccupancy, RIDE_SEATS } from '@/lib/rideOccupancy'
```
- [ ] **Step 2:** In `useRideMachine`, the `idle` case detects `st.activeRide === spec.id` and transitions to `boarding`. There, fill company seats:
```ts
      case 'idle':
        if (st.activeRide === spec.id) {
          phase.current = 'boarding'
          elapsed.current = 0
          rideLook.yaw = 0
          rideLook.pitch = 0
          if (RIDE_SEATS[spec.id] !== undefined) {
            const occ = useRideOccupancy.getState()
            const n = RIDE_SEATS[spec.id]
            // leave seat 0 as "the player's" view seat; fill a few others
            for (let s = 1; s < n; s++) {
              if (Math.random() < 0.7) occ.claimSeat(spec.id, 'company', s)
            }
          }
          st.setRidePhase('boarding')
        }
        break
```
- [ ] **Step 3:** In the `unloading` case, where it returns to `idle` and teleports the player to the exit, clear company riders:
```ts
      case 'unloading':
        if (elapsed.current >= UNLOAD_TIME) {
          phase.current = 'idle'
          elapsed.current = 0
          if (RIDE_SEATS[spec.id] !== undefined) useRideOccupancy.getState().clearCompany(spec.id)
          st.completeRide(spec.id)
          useFestival.getState().addScore(100 * spec.cost)
          st.setActiveRide(null)
          st.setRidePhase('idle')
          playerRig.body?.setTranslation({ x: spec.exit[0], y: spec.exit[1], z: spec.exit[2] }, true)
          playerRig.body?.setLinvel({ x: 0, y: 0, z: 0 }, true)
        }
        break
```
(Keep the rest of the `useRideMachine` exactly as-is.)
- [ ] **Step 4:** Verify `npm run typecheck` → 0, `npm run build` → 0, `npm test` → 0. **Visual smoke:** board the Ferris wheel/carousel → other cabins/horses have riders beside you; on exit they clear.
- [ ] **Step 5: Commit**
```bash
git add components/rides/RideBase.tsx
git commit -m "feat(boarding): ride with company — player's ride fills neighbouring seats"
```

---

## Task 7: Verification + smoke script

**Files:** Create `scripts/check-boarding.js` (mirror existing check scripts; capture a Ferris wheel turning with seated riders → `scripts/shot-boarding.png`; do not commit PNGs).

- [ ] **Step 1:** Write the script (robust; leaves capture to a running server / human).
- [ ] **Step 2: Full gates** (real exit codes): `npm test` → 0, `npm run typecheck` → 0, `npm run build` → 0.
- [ ] **Step 3: Commit**
```bash
git add scripts/check-boarding.js
git commit -m "test(boarding): Ferris/carousel occupancy smoke check"
```

---

## Phase 3 acceptance (from spec §7.4, scoped to the seated rides)
- [ ] The Ferris wheel and carousel visibly carry NPC riders pulled from their queues, through a full ride, then release them to the exit.
- [ ] Boarding the Ferris wheel/carousel yourself fills neighbouring seats with NPC riders; they clear when you get off.
- [ ] Non-seated rides still work (Phase-2 placeholder boarding; unchanged lifecycle).
- [ ] `npm test`, `npm run typecheck`, `npm run build` all green.

**Fast-follow (not this plan):** extend `RIDE_SEATS` + seated-rider rendering to Drop Tower, Columbus, Teacups, and the coaster train (each needs its seat anchors wired the same way).

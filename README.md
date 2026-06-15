# 🎡 Fableland — a fully functional 3D amusement park

An explorable 3D amusement park in the browser: walk the plaza, claim tickets
at the booth, and ride six fully working attractions — each with a real
`IDLE → BOARDING → RUNNING → UNLOADING` state machine, its own ride camera,
ticket cost and animation cycle.

Built with **Next.js 15 (App Router) + React Three Fiber + Rapier physics +
zustand + Tailwind**. No paid assets — every mesh is procedural geometry and
all signs/sounds are generated at runtime (canvas textures + WebAudio synth).

## Setup

```bash
npm install --legacy-peer-deps   # leva's peer range lags React 19
npm run dev                      # http://localhost:3000
npm run build                    # production build + type check
```

## Controls

| Input | Action |
| --- | --- |
| **WASD** / left stick | Move |
| **Mouse** (click to lock) | Look |
| **Shift** / RB | Sprint |
| **Space** / A button | Jump |
| **E** | Board a ride / claim daily tickets at the booth |
| **V** | Toggle first ↔ third person |
| **M** | Mute |
| **Esc** | Release pointer / pause menu |
| **Arrow keys** | Drive your bumper car (during that ride) |
| **A / D** | Spin your teacup faster (during that ride) |

You start with 20 tickets. The ticket booth near the gate grants a free
allowance of 20 tickets **once per in-game day** (a day lasts ~8 real
minutes — speed it up with the leva dev panel in `npm run dev`).

## The rides

| Ride | Cost | Mechanic |
| --- | --- | --- |
| Ferris Wheel | 3 | Z-axis wheel, 8 counter-rotated gondolas stay upright; camera rides gondola 0 |
| Roller Coaster | 5 | Closed CatmullRom track (hill, drop, vertical loop), tube-extruded rail, 3-cart train with gravity speed + banking; first-person front cart |
| Carousel | 2 | Rotating platform, 8 phase-offset bobbing horses, striped 12-wedge canopy |
| Spinning Teacups | 2 | Three nested rotations (platform → turntables → cups), player-influenced spin |
| Drop Tower | 4 | Eased rise → pause → free-fall → damped bounce; seat camera over the park |
| Bumper Cars | 4 | 6 dynamic Rapier cars, AI wander + player arrow-key driving, overhead camera |

## Architecture

```
app/page.tsx            mounts <ParkCanvas> (R3F, ssr:false) + <HUD> (Tailwind DOM)
components/Scene.tsx    scene graph: sky/lights + <Physics> world + rides + player
state/useGameStore.ts   zustand: tickets, clock, ride machine state, quality…
components/rides/RideBase.tsx
                        shared state machine (useRideMachine) + boarding sensor
components/Player/      Rapier capsule + pointer-lock look + head-bob camera
lib/curves.ts           coaster CatmullRom track + gravity speed model
lib/audio.ts            synthesized murmur / carousel music / coaster rattle
lib/spawn.ts            all placement data (rides, booth, waypoints, PRNG)
```

Key conventions:

- **No per-frame React state.** Everything animated lives in refs / mutated
  store fields; `useFrame` callbacks only touch refs and `getState()`.
- **Transient player position**: `playerPos` is mutated in place so the
  minimap (10 Hz canvas redraw) never re-renders React.
- **Instancing** for trees (~100), fence posts (72), lamps (22), crowd (40)
  and coaster ties/supports.
- **Day/night**: one store clock drives drei `Sky`, sun light, fog colour,
  lamp emissives and ride neon. Bloom (High quality) makes the neon glow.
- **Quality setting** (pause menu): pixel ratio, shadows, crowd count, bloom.

## Performance notes

- One shadow-casting light; shadows off entirely on Low.
- All geometries/materials are created once in `useMemo`; zero allocations
  in render loops beyond reused scratch vectors.
- Audio is a single lazily-created `AudioContext` (first click), disposed on
  unmount; mute is instant via a master gain node.

# 3D-Games-AmusementPark

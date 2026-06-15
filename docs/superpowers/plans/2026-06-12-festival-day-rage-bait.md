# Festival Day — Rage-Bait Edition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a replayable score-attack "festival day" with a heckling announcer, rage-bait mini-game twists, and a fireworks finale, layered on top of the existing free-roam fair.

**Architecture:** A self-contained `useFestival` zustand store holds run state (score, combo, clock). A `FestivalController` drives the clock + combo timer and triggers the finale. Small hooks in existing ride/mini-game/shop code feed `addScore`. An event-driven announcer pushes captions + chimes. New UI (HUD overlay, finale screen) and a fireworks component complete the loop. The festival is additive — sandbox still works untouched.

**Tech Stack:** Next.js 15, React Three Fiber, zustand, Tailwind, WebAudio (synth SFX). Spec: `docs/superpowers/specs/2026-06-12-festival-day-rage-bait-design.md`.

**Project conventions (read first):**
- No git repo, no unit tests. **Per-task checkpoint = `npx tsc --noEmit` clean + a headless `scripts/check-*.js` run via `node` (uses `playwright-core` + `msedge`) printing expected state, with zero `page errors`.**
- Run all commands from `C:\Users\malliar\Desktop\amusement-park`.
- The dev server must be running (`npm run dev`) on a known port; checks default to `http://localhost:3001` (override with `PARK_URL`).
- Dev build exposes `window.__park = { store, rig, shooting, ringtoss, look, agents }` (in `components/GameSystems.tsx`); this plan adds `festival`.
- zustand stores are mutated via `useX.getState()` in `useFrame`/event handlers — never per-frame React state.

---

### Task 1: Festival store (`lib/festival.ts`)

**Files:**
- Create: `lib/festival.ts`
- Test: `scripts/check-festival.js`

- [ ] **Step 1: Write the failing headless check**

Create `scripts/check-festival.js`:

```js
const { chromium } = require('playwright-core')
const URL = process.env.PARK_URL || 'http://localhost:3001'
;(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } })
  const errs = []; page.on('pageerror', e => errs.push(e.message))
  await page.goto(URL, { waitUntil: 'load', timeout: 180000 })
  await page.waitForFunction(() => !!window.__park && !!window.__park.festival, null, { timeout: 180000 })
  const F = () => page.evaluate(() => window.__park.festival.getState())
  const call = (fn, ...a) => page.evaluate(([f, args]) => window.__park.festival.getState()[f](...args), [fn, a])
  const r = (l, v) => console.log(l + ':', JSON.stringify(v))

  await call('start')
  r('phase', (await F()).phase)                       // running
  await call('addScore', 100)
  let s = await F(); r('score1', s.score); r('combo1', s.combo) // 100, 1
  await call('addScore', 100)
  s = await F(); r('score2', s.score); r('combo2', s.combo)     // 300 (100*1 + 100*2), 2
  await call('tick', 13)                              // exceed COMBO_WINDOW
  s = await F(); r('comboAfterTimeout', s.combo)      // 1
  await call('toFinale')
  r('phaseFinale', (await F()).phase)                 // finale
  console.log('errors:', errs.length ? errs.join(' | ') : '(none)')
  await b.close()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/check-festival.js`
Expected: FAIL — `window.__park.festival` never becomes defined (timeout), because the store and the `__park` exposure don't exist yet.

- [ ] **Step 3: Implement `lib/festival.ts`**

```ts
import { create } from 'zustand'

export type FestivalPhase = 'idle' | 'running' | 'finale'

export const DAY_SECONDS = 7 * 60 // ~7 real minutes dusk -> midnight
export const COMBO_WINDOW = 12 // seconds before an unfed combo resets
const START_HOUR = 18
const END_HOUR = 24
const BEST_KEY = 'fableland-festival-best'

interface FestivalState {
  phase: FestivalPhase
  score: number
  combo: number
  comboTimer: number // seconds left on the current combo (0 = none)
  timeLeft: number // seconds left in the festival day
  best: number
  caption: string | null
  start: () => void
  /** Apply `base` points × current combo, then grow the combo + refill its timer. */
  addScore: (base: number) => void
  tick: (dt: number) => void
  setCaption: (text: string) => void
  clearCaption: () => void
  toFinale: () => void
  reset: () => void
}

export const useFestival = create<FestivalState>((set, get) => ({
  phase: 'idle',
  score: 0,
  combo: 1,
  comboTimer: 0,
  timeLeft: DAY_SECONDS,
  best: 0,
  caption: null,

  start: () =>
    set({ phase: 'running', score: 0, combo: 1, comboTimer: 0, timeLeft: DAY_SECONDS, caption: null }),

  addScore: (base) => {
    const s = get()
    if (s.phase !== 'running') return
    const combo = s.comboTimer > 0 ? s.combo + 1 : 1
    set({ score: s.score + base * combo, combo, comboTimer: COMBO_WINDOW })
  },

  tick: (dt) => {
    const s = get()
    if (s.phase !== 'running') return
    let combo = s.combo
    let comboTimer = s.comboTimer
    if (comboTimer > 0) {
      comboTimer = Math.max(0, comboTimer - dt)
      if (comboTimer === 0) combo = 1
    }
    const timeLeft = Math.max(0, s.timeLeft - dt)
    set({ comboTimer, combo, timeLeft })
    if (timeLeft === 0) get().toFinale()
  },

  setCaption: (text) => set({ caption: text }),
  clearCaption: () => set({ caption: null }),

  toFinale: () => {
    const s = get()
    if (s.phase === 'finale') return
    const best = Math.max(s.best, s.score)
    if (typeof window !== 'undefined') localStorage.setItem(BEST_KEY, String(best))
    set({ phase: 'finale', best })
  },

  reset: () =>
    set({ phase: 'idle', score: 0, combo: 1, comboTimer: 0, timeLeft: DAY_SECONDS, caption: null }),
}))

// load persisted best on the client
if (typeof window !== 'undefined') {
  const stored = Number(localStorage.getItem(BEST_KEY) || 0)
  if (stored > 0) useFestival.setState({ best: stored })
}

/** In-game hour (18→24) for the current run, driving the sky/lighting. */
export const festivalHour = (timeLeft: number): number =>
  START_HOUR + (END_HOUR - START_HOUR) * (1 - timeLeft / DAY_SECONDS)
```

- [ ] **Step 4: Expose the store on `window.__park`**

Modify `components/GameSystems.tsx`. Add the import near the other lib imports:

```ts
import { useFestival } from '@/lib/festival'
```

Find the debug hook line (currently):

```ts
      ;(window as unknown as { __park?: object }).__park = { store: useGameStore, rig: playerRig, shooting: useShooting, ringtoss: useRingToss, look, agents: crowdAgents }
```

Replace it with:

```ts
      ;(window as unknown as { __park?: object }).__park = { store: useGameStore, rig: playerRig, shooting: useShooting, ringtoss: useRingToss, look, agents: crowdAgents, festival: useFestival }
```

- [ ] **Step 5: Run tsc + the check to verify it passes**

Run: `npx tsc --noEmit`
Expected: no output (clean).

Run: `node scripts/check-festival.js`
Expected:
```
phase: "running"
score1: 100
combo1: 1
score2: 300
combo2: 2
comboAfterTimeout: 1
phaseFinale: "finale"
errors: (none)
```

---

### Task 2: Festival controller (`components/festival/FestivalController.tsx`)

Drives the day clock + combo/idle timers during a run and triggers the finale. No mesh.

**Files:**
- Create: `components/festival/FestivalController.tsx`
- Modify: `components/Scene.tsx` (mount it)
- Modify: `lib/announcer.ts` is NOT needed yet — idle uses a placeholder caption via `setCaption` until Task 4 replaces it.

- [ ] **Step 1: Implement the controller**

Create `components/festival/FestivalController.tsx`:

```tsx
'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from '@/state/useGameStore'
import { useFestival, festivalHour } from '@/lib/festival'

/**
 * Frame systems for an active festival run: advance the in-game clock dusk→
 * midnight, tick the combo + day timers, and trigger the finale. While a run
 * is active the festival OWNS the clock (the time-of-day selector is ignored).
 */
export default function FestivalController() {
  const prevScore = useRef(0)
  const idle = useRef(0)

  useFrame((_, rawDt) => {
    const f = useFestival.getState()
    if (f.phase !== 'running') {
      prevScore.current = f.score
      idle.current = 0
      return
    }
    const dt = Math.min(rawDt, 0.1)
    f.tick(dt)

    // festival drives the sky: write timeOfDay directly each frame
    useGameStore.setState({ timeOfDay: festivalHour(f.timeLeft) })

    // idle nag: 25 s with no points → a heckle (replaced by announcer in Task 4)
    if (f.score !== prevScore.current) {
      prevScore.current = f.score
      idle.current = 0
    } else {
      idle.current += dt
      if (idle.current > 25) {
        idle.current = 0
        useFestival.getState().setCaption('Fell asleep, champ? 😴')
      }
    }
  })

  return null
}
```

- [ ] **Step 2: Mount it in `components/Scene.tsx`**

Add the import after the `PhotoCamera` import:

```tsx
import FestivalController from '@/components/festival/FestivalController'
```

Add the element right after `<PhotoCamera />`:

```tsx
      <PhotoCamera />
      <FestivalController />
```

- [ ] **Step 3: Add the clock-driving check to `scripts/check-festival.js`**

Append before the final `console.log('errors'...)` line:

```js
  await call('reset'); await call('start')
  await page.waitForTimeout(1500) // controller ticks the clock
  const tod = await page.evaluate(() => window.__park.store.getState().timeOfDay)
  console.log('timeOfDay during run (expect 18-24):', tod.toFixed(2))
```

- [ ] **Step 4: Run tsc + check**

Run: `npx tsc --noEmit` → clean.
Run: `node scripts/check-festival.js`
Expected: previous lines plus `timeOfDay during run (expect 18-24): 18.xx` and `errors: (none)`.

---

### Task 3: Scoring hooks (rides, mini-games, shops)

Feed `useFestival.addScore` from existing completion points. `addScore` is a no-op unless a run is active, so these are safe in sandbox too.

**Files:**
- Modify: `components/rides/RideBase.tsx` (ride completion)
- Modify: `lib/minigame.ts` (`useShooting.fire`, `useRingToss.resolve`)
- Modify: `state/useGameStore.ts` (`buyFood`, `buyBalloon`)
- Modify: `lib/spawn.ts` — none.

- [ ] **Step 1: Ride completion → score**

In `components/rides/RideBase.tsx`, add the import:

```ts
import { useFestival } from '@/lib/festival'
```

Find the `unloading` case in `useRideMachine` where it calls `st.completeRide(spec.id)`. Immediately after that line add:

```ts
          useFestival.getState().addScore(100 * spec.cost)
```

- [ ] **Step 2: Shooting hits → score**

In `lib/minigame.ts`, add the import at top:

```ts
import { useFestival } from '@/lib/festival'
```

Find `useShooting`'s `fire` action. Inside it, after `set({ ammo, score: s.score + points, hits })`, add:

```ts
    if (points > 0) useFestival.getState().addScore(points >= 3 ? 120 : 50)
```

(Balloon = 1 pt → +50; duck = 3 pt → +120. The cocky duck in Task 6 passes a higher `points` and is handled there.)

- [ ] **Step 3: Ring landed → score**

In `lib/minigame.ts`, find `useRingToss`'s `resolve`. After `if (landed) parkAudio.pop()`, add:

```ts
    if (landed) useFestival.getState().addScore(150)
```

- [ ] **Step 4: Shop buys → score**

In `state/useGameStore.ts`, add the import:

```ts
import { useFestival } from '@/lib/festival'
```

In `buyFood`, after `set({ heldFood: { name, emoji }, shopMenu: null })`, add:

```ts
    useFestival.getState().addScore(30)
```

In `buyBalloon`, after `set({ balloon: color, shopMenu: null })`, add:

```ts
    useFestival.getState().addScore(30)
```

> Note: importing `useFestival` into `useGameStore` and `useFestival` importing nothing from `useGameStore` keeps the dependency one-directional (no cycle). `lib/festival.ts` must NOT import `useGameStore`.

- [ ] **Step 5: Add the scoring check**

Append to `scripts/check-festival.js` before the errors line:

```js
  // ride scoring: start a run, teleport into the ferris trigger, board, finish
  await call('reset'); await call('start')
  await page.evaluate(() => window.__park.rig.body.setTranslation({ x: -24, y: 1.5, z: -11 }, true))
  await page.waitForTimeout(1200)
  const before = (await F()).score
  await page.keyboard.press('KeyE')
  await page.waitForTimeout(1000)
  console.log('boarded ride during festival; activeRide:', JSON.stringify(await page.evaluate(() => window.__park.store.getState().activeRide)))
  console.log('score before ride payout:', before)
```

- [ ] **Step 6: Run tsc + check**

Run: `npx tsc --noEmit` → clean.
Run: `node scripts/check-festival.js`
Expected: all prior lines, `activeRide: "ferris"`, `errors: (none)`. (Full payout asserts after the ride completes; the controller-driven completion is verified in Task 10's full run.)

---

### Task 4: Announcer (`lib/announcer.ts`) + chime SFX

**Files:**
- Create: `lib/announcer.ts`
- Modify: `lib/audio.ts` (add `chime`, `comboUp`, `comboLost`)
- Modify: `components/festival/FestivalController.tsx` (use `announce('idle')`)
- Modify: `lib/festival.ts` (`addScore` fires combo SFX/announce via callback — see Step 4)

- [ ] **Step 1: Add SFX to `lib/audio.ts`**

In `class ParkAudio`, after the existing `fanfare(win: boolean)` method, add:

```ts
  /** Short PA tannoy chime before an announcement. */
  chime(): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    const t = ctx.currentTime
    for (const [f, dt] of [[880, 0], [1174, 0.12]] as [number, number][]) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t + dt)
      g.gain.exponentialRampToValueAtTime(0.2, t + dt + 0.02)
      g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.4)
      o.connect(g)
      g.connect(master)
      o.start(t + dt)
      o.stop(t + dt + 0.42)
    }
  }

  /** Rising blip when the combo grows. */
  comboUp(level: number): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.value = 520 + Math.min(level, 12) * 60
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.18, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
    o.connect(g)
    g.connect(master)
    o.start(t)
    o.stop(t + 0.2)
  }

  /** Deflating downward sweep when the combo is lost. */
  comboLost(): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(440, t)
    o.frequency.exponentialRampToValueAtTime(120, t + 0.5)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.16, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
    o.connect(g)
    g.connect(master)
    o.start(t)
    o.stop(t + 0.52)
  }
```

- [ ] **Step 2: Implement `lib/announcer.ts`**

```ts
import { useFestival } from '@/lib/festival'
import { parkAudio } from '@/lib/audio'

export type AnnounceEvent =
  | 'score' | 'bigScore' | 'miss' | 'comboLost' | 'comboMilestone'
  | 'rideComplete' | 'gameWin' | 'gameLose' | 'idle' | 'finale'

const LINES: Record<AnnounceEvent, string[]> = {
  score: ['Nice one!', 'Keep it going!', 'Show-off!'],
  bigScore: ['BOMBAAT!', 'Now THAT’s a Dasara!', 'The crowd goes wild!'],
  miss: ['Arre, SO close!', 'Ayyo, missed!', 'Is that all, hero?', 'My grandmother aims better!'],
  comboLost: ['Ayyo, combo gone!', 'You snooze, you lose!', 'Streak? What streak?'],
  comboMilestone: ['You’re ON FIRE!', 'Unstoppable!', 'The crowd can’t believe it!'],
  rideComplete: ['Enjoyed the ride?', 'Round and round!', 'Next!'],
  gameWin: ['Winner winner!', 'Champion shot!', 'Take a bow!'],
  gameLose: ['Better luck next time… not.', 'The crowd is unimpressed…', 'Try harder, champ.'],
  idle: ['Fell asleep, champ? 😴', 'The fair’s THIS way!', 'Are we boring you?'],
  finale: ['That’s a wrap — feast your eyes!', 'The grand finale!', 'Dasara dhamaka!'],
}

const PRIORITY: Record<AnnounceEvent, number> = {
  finale: 5, comboLost: 4, comboMilestone: 4, gameWin: 3, gameLose: 3,
  bigScore: 3, rideComplete: 2, miss: 2, idle: 1, score: 1,
}

const COOLDOWN_MS = 2500
let lastAt = -Infinity
let lastPriority = 0
let clearToken = 0

/** Push a heckle/hype caption (with a PA chime), respecting cooldown + priority. */
export function announce(ev: AnnounceEvent): void {
  if (typeof performance === 'undefined') return
  const now = performance.now()
  const prio = PRIORITY[ev]
  if (now - lastAt < COOLDOWN_MS && prio <= lastPriority) return
  lastAt = now
  lastPriority = prio
  const pool = LINES[ev]
  const line = pool[Math.floor(Math.random() * pool.length)]
  useFestival.getState().setCaption(line)
  parkAudio.chime()
  const token = ++clearToken
  window.setTimeout(() => {
    if (token === clearToken) useFestival.getState().clearCaption()
  }, 3000)
}
```

- [ ] **Step 3: Combo SFX + announce inside `addScore`**

In `lib/festival.ts`, the store must trigger combo audio/heckles without importing the announcer (to avoid a cycle — announcer imports the store). Use lazy dynamic access via module-level callback registration. Replace `addScore` with:

```ts
  addScore: (base) => {
    const s = get()
    if (s.phase !== 'running') return
    const combo = s.comboTimer > 0 ? s.combo + 1 : 1
    set({ score: s.score + base * combo, combo, comboTimer: COMBO_WINDOW })
    festivalEvents.onScore?.(combo)
  },
```

And in `tick`, where the combo resets, fire a loss event. Replace the reset branch:

```ts
    if (comboTimer > 0) {
      comboTimer = Math.max(0, comboTimer - dt)
      if (comboTimer === 0) {
        combo = 1
        festivalEvents.onComboLost?.()
      }
    }
```

Add near the top of `lib/festival.ts` (after imports):

```ts
/** Side-effect hooks wired by the announcer/audio layer to avoid an import cycle. */
export const festivalEvents: { onScore?: (combo: number) => void; onComboLost?: () => void } = {}
```

- [ ] **Step 4: Wire the hooks in the announcer module**

At the bottom of `lib/announcer.ts`, add:

```ts
import { festivalEvents } from '@/lib/festival'

festivalEvents.onScore = (combo: number) => {
  parkAudio.comboUp(combo)
  if (combo >= 5 && combo % 5 === 0) announce('comboMilestone')
  else if (combo >= 4) announce('bigScore')
  else announce('score')
}
festivalEvents.onComboLost = () => {
  parkAudio.comboLost()
  announce('comboLost')
}
```

The announcer module must be imported once so these run. In `components/festival/FestivalController.tsx` add at top:

```ts
import { announce } from '@/lib/announcer'
```

and replace the idle `setCaption` line with:

```ts
        announce('idle')
```

- [ ] **Step 5: Add announcer check**

Append to `scripts/check-festival.js`:

```js
  await call('reset'); await call('start')
  await call('addScore', 100); await call('addScore', 100); await call('addScore', 100)
  await page.waitForTimeout(200)
  console.log('caption after scoring:', JSON.stringify((await F()).caption))
```

- [ ] **Step 6: Run tsc + check**

Run: `npx tsc --noEmit` → clean.
Run: `node scripts/check-festival.js`
Expected: `caption after scoring:` shows a non-null heckle string; `errors: (none)`.

---

### Task 5: Festival HUD + Start button (`components/ui/FestivalHUD.tsx`)

**Files:**
- Create: `components/ui/FestivalHUD.tsx`
- Modify: `components/ui/HUD.tsx` (mount it)
- Modify: `components/GameSystems.tsx` (key `G` starts a run)

- [ ] **Step 1: Implement the HUD overlay**

Create `components/ui/FestivalHUD.tsx`:

```tsx
'use client'

import { useFestival, COMBO_WINDOW } from '@/lib/festival'

/** Score, combo meter, day clock and the announcer caption during a run; a
 *  Start button when idle. Pure overlay (parent HUD owns pointer-events). */
export default function FestivalHUD() {
  const phase = useFestival((s) => s.phase)
  const score = useFestival((s) => s.score)
  const combo = useFestival((s) => s.combo)
  const comboTimer = useFestival((s) => s.comboTimer)
  const timeLeft = useFestival((s) => s.timeLeft)
  const caption = useFestival((s) => s.caption)
  const start = useFestival((s) => s.start)

  if (phase === 'idle') {
    return (
      <button
        onClick={start}
        className="pointer-events-auto absolute right-4 top-16 rounded-xl border-2 border-[#f2a900] bg-[#c8102e] px-5 py-2.5 font-[Georgia,'Times_New_Roman',serif] text-sm font-bold uppercase tracking-widest text-[#ffd23f] shadow-lg transition hover:bg-[#8e0c20]"
      >
        ▶ Start Festival
      </button>
    )
  }

  if (phase === 'finale') return null // FinaleScreen takes over

  const mins = Math.floor(timeLeft / 60)
  const secs = Math.floor(timeLeft % 60)
  const comboPct = Math.round((comboTimer / COMBO_WINDOW) * 100)

  return (
    <>
      <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-xl border-2 border-[#f2a900] bg-[#8e0c20]/90 px-6 py-2 text-center font-[Georgia,'Times_New_Roman',serif] text-[#ffd23f] shadow-xl">
        <div className="text-2xl font-bold tabular-nums">{score.toLocaleString()}</div>
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#fff3dc]/80">
          Festival Score · {mins}:{String(secs).padStart(2, '0')} left
        </div>
        {combo > 1 && (
          <div className="mt-1">
            <span className="text-lg font-extrabold text-[#ffd23f]">×{combo}</span>
            <div className="mx-auto mt-0.5 h-1.5 w-32 overflow-hidden rounded-full bg-black/40">
              <div className="h-full bg-[#ffd23f] transition-[width] duration-100" style={{ width: `${comboPct}%` }} />
            </div>
          </div>
        )}
      </div>

      {caption && (
        <div className="absolute left-1/2 top-28 -translate-x-1/2 animate-pulse rounded-lg border-2 border-[#f2a900] bg-[#1a2238]/90 px-5 py-2 font-[Georgia,'Times_New_Roman',serif] text-base font-semibold text-[#ffd23f] shadow-xl">
          📣 {caption}
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: Mount in `components/ui/HUD.tsx`**

Add the import with the other UI imports:

```tsx
import FestivalHUD from './FestivalHUD'
```

Add `<FestivalHUD />` next to `<ShopMenu />` in the returned overlay tree:

```tsx
      <ShopMenu />
      <FestivalHUD />
```

- [ ] **Step 3: Key `G` starts a run**

In `components/GameSystems.tsx`, inside the `onKey` handler (after the `KeyP` photo-mode block), add:

```ts
      if (e.code === 'KeyG' && useFestival.getState().phase === 'idle' && !st.activeRide && !st.activeStall && !st.shopMenu && !st.photoMode) {
        useFestival.getState().start()
      }
```

- [ ] **Step 4: Add HUD check**

Append to `scripts/check-festival.js`:

```js
  await call('reset')
  await page.waitForTimeout(200)
  console.log('start button present:', await page.locator('text=Start Festival').count())
  await call('start'); await call('addScore', 200)
  await page.waitForTimeout(200)
  console.log('score visible in HUD:', await page.locator('text=/Festival Score/').count())
  await page.screenshot({ path: 'scripts/shot-festival-hud.png' })
```

- [ ] **Step 5: Run tsc + check**

Run: `npx tsc --noEmit` → clean.
Run: `node scripts/check-festival.js`
Expected: `start button present: 1`, `score visible in HUD: 1`, `errors: (none)`. Open `scripts/shot-festival-hud.png` — score + combo meter visible top-center.

---

### Task 6: Shooting-gallery rage twists

Duck juke, cocky golden duck, and near-miss heckles. The cocky duck is a 4th duck target worth more.

**Files:**
- Modify: `components/stalls/ShootingGallery.tsx`

- [ ] **Step 1: Add imports + a cocky target**

In `components/stalls/ShootingGallery.tsx` add the announcer import:

```ts
import { announce } from '@/lib/announcer'
```

In the `targets` `useMemo`, after the duck loop, add one cocky duck (worth 6 game-points → big festival score):

```ts
    // a cocky golden duck: erratic, high value, taunts when missed
    t.push({ kind: 'duck', home: [0, 2.15, 0.15], points: 6, rail: 1.9, phase: 2.1 })
```

- [ ] **Step 2: Duck juke + erratic cocky motion**

In the per-frame target animation loop, replace the duck slide branch:

```ts
      if (tg.kind === 'duck' && tg.rail != null) {
        m.position.x = tg.home[0] + Math.sin(t * 1.3 + (tg.phase ?? 0)) * tg.rail
      }
```

with:

```ts
      if (tg.kind === 'duck' && tg.rail != null) {
        const fast = tg.points >= 6 ? 2.6 : 1.3 // cocky duck darts faster
        m.position.x = tg.home[0] + Math.sin(t * fast + (tg.phase ?? 0)) * tg.rail
        // juke: dip behind the counter on a per-duck rhythm (a visible tell —
        // it sinks for ~0.4 s); firing while dipped registers no hit
        const dip = Math.sin(t * 0.9 + (tg.phase ?? 0) * 3) > 0.86
        m.position.y = tg.home[1] - (dip && !popped.current[i] ? 0.9 : 0)
      }
```

- [ ] **Step 3: Near-miss heckle + cocky scoring**

In the `onDown` handler, after the existing hit block, replace the closing of the hit/miss logic. The current code is:

```ts
      if (first) {
        const idx = meshes.current.indexOf(first.object as THREE.Mesh)
        if (idx >= 0 && !popped.current[idx]) {
          popped.current[idx] = true
          points = targets[idx].points
          if (targets[idx].kind === 'balloon') parkAudio.pop()
          else parkAudio.clank()
        }
      }
      g.fire(points)
```

Replace with:

```ts
      if (first) {
        const idx = meshes.current.indexOf(first.object as THREE.Mesh)
        if (idx >= 0 && !popped.current[idx]) {
          popped.current[idx] = true
          points = targets[idx].points
          if (targets[idx].kind === 'balloon') parkAudio.pop()
          else parkAudio.clank()
          if (points >= 6) {
            useFestival.getState().addScore(300) // cocky duck bonus
            announce('gameWin')
          }
        }
      } else {
        // near-miss: ray passed close to a live target but hit nothing
        announce('miss')
      }
      g.fire(points)
```

Add the festival import if not present:

```ts
import { useFestival } from '@/lib/festival'
```

(Balloon/duck base festival points already flow through `useShooting.fire` from Task 3 Step 2; the cocky duck adds its bonus here.)

- [ ] **Step 4: Add the cocky-duck check**

Append to `scripts/check-festival.js`:

```js
  // shooting near-miss + cocky duck: start festival, play, fire wildly upward (miss)
  await call('reset'); await call('start')
  await page.evaluate(() => window.__park.rig.body.setTranslation({ x: -6.4, y: 1.5, z: 30.3 }, true))
  await page.waitForTimeout(1100)
  await page.keyboard.press('KeyE'); await page.waitForTimeout(700)
  await page.evaluate(() => { window.__park.look.pitch = 1.2 }) // aim at the sky → guaranteed miss
  await page.mouse.down(); await page.mouse.up()
  await page.waitForTimeout(300)
  console.log('caption after miss:', JSON.stringify((await F()).caption))
  await page.evaluate(() => window.__park.shooting.getState().end())
```

- [ ] **Step 5: Run tsc + check**

Run: `npx tsc --noEmit` → clean.
Run: `node scripts/check-festival.js`
Expected: `caption after miss:` is a non-null miss taunt; `errors: (none)`.

---

### Task 7: Ring-toss rage twists

Oscillating power meter + landing wobble + rim-out near-miss heckle.

**Files:**
- Modify: `components/stalls/RingToss.tsx`

- [ ] **Step 1: Add imports**

```ts
import { announce } from '@/lib/announcer'
```

- [ ] **Step 2: Oscillating power**

In `RingToss.tsx`, find the charge ramp inside `useFrame`:

```ts
    if (me && charging.current && !g.result) {
      power.current = Math.min(1, power.current + dt * 0.85)
      g.setPower(power.current)
    }
```

Replace with a triangle-wave oscillation (ping-pongs 0→1→0), so release timing matters:

```ts
    if (me && charging.current && !g.result) {
      // power ping-pongs instead of ramping — overshoot is easy (rage-bait),
      // but the meter is visible so a skilled player can time the release
      chargeT.current += dt * 0.9
      power.current = 1 - Math.abs((chargeT.current % 2) - 1)
      g.setPower(power.current)
    }
```

Add a ref near the other refs (`const power = useRef(0)` is already there):

```ts
  const chargeT = useRef(0)
```

And reset it on charge start — in the `onDown` handler where `power.current = 0` is set, add:

```ts
      chargeT.current = 0
```

- [ ] **Step 3: Landing wobble**

In the `onUp` handler, after computing `_land` and before the nearest-peg loop, add a small deterministic jitter based on the (already varying) power:

```ts
      // a gust nudges the landing slightly — same magnitude both axes
      const wob = (power.current - 0.5) * 0.5
      _land.x += wob * RIGHT.x + wob * 0.6 * _fwd.x
      _land.z += wob * RIGHT.z + wob * 0.6 * _fwd.z
```

- [ ] **Step 4: Rim-out near-miss heckle**

In `onUp`, after the `flight.current = { ... }` assignment, add:

```ts
      if (best < 0) announce('miss')
```

- [ ] **Step 5: Add ring-toss check**

Append to `scripts/check-festival.js`:

```js
  // ring toss: start festival, play, throw with a brief charge → likely rim-out
  await call('reset'); await call('start')
  await page.evaluate(() => window.__park.rig.body.setTranslation({ x: 22.97, y: 1.5, z: 24.79 }, true))
  await page.waitForTimeout(1100)
  await page.keyboard.press('KeyE'); await page.waitForTimeout(700)
  await page.mouse.down(); await page.waitForTimeout(120); await page.mouse.up()
  await page.waitForTimeout(1200)
  console.log('ringtoss ringsLeft after a throw:', JSON.stringify(await page.evaluate(() => window.__park.ringtoss.getState().ringsLeft)))
```

- [ ] **Step 6: Run tsc + check**

Run: `npx tsc --noEmit` → clean.
Run: `node scripts/check-festival.js`
Expected: `ringtoss ringsLeft after a throw: 4` (one ring consumed); `errors: (none)`.

---

### Task 8: Fireworks (`components/festival/Fireworks.tsx`) + finale SFX

**Files:**
- Create: `components/festival/Fireworks.tsx`
- Modify: `lib/audio.ts` (add `boom`, `crowdWow`)
- Modify: `components/Scene.tsx` (mount `<Fireworks />`)

- [ ] **Step 1: Add finale SFX to `lib/audio.ts`**

After the `comboLost()` method add:

```ts
  /** Firework boom: a low body + bright crackle tail. */
  boom(): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master || !this.noiseBuf) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(90, t)
    o.frequency.exponentialRampToValueAtTime(40, t + 0.3)
    const og = ctx.createGain()
    og.gain.setValueAtTime(0.5, t)
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
    o.connect(og); og.connect(master); o.start(t); o.stop(t + 0.42)
    const n = ctx.createBufferSource()
    n.buffer = this.noiseBuf
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'; hp.frequency.value = 2000
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.25, t + 0.05)
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
    n.connect(hp); hp.connect(ng); ng.connect(master); n.start(t + 0.05); n.stop(t + 0.55)
  }

  /** A swelling crowd "woooow". */
  crowdWow(): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master || !this.noiseBuf) return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 2
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.22, t + 0.4)
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.6)
    src.connect(bp); bp.connect(g); g.connect(master); src.start(t); src.stop(t + 1.7)
  }
```

- [ ] **Step 2: Implement `components/festival/Fireworks.tsx`**

```tsx
'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useFestival } from '@/lib/festival'
import { parkAudio } from '@/lib/audio'
import { BAZAAR } from '@/lib/palette'

const ROCKETS = 6
const SPARKS = 40 // per rocket
const TOTAL = ROCKETS * SPARKS
const GRAVITY = 6
const _dummy = new THREE.Object3D()
const COLORS = [BAZAAR.magenta, BAZAAR.marigold, BAZAAR.turquoise, BAZAAR.yellow, BAZAAR.chilliRed, BAZAAR.skyBlue]

interface Rocket {
  origin: THREE.Vector3
  color: THREE.Color
  vels: THREE.Vector3[]
  t: number // seconds since burst; <0 = waiting to launch
  delay: number
}

/** Pooled instanced fireworks over the giant wheel during the finale. Each
 *  rocket bursts SPARKS instances outward; they arc under gravity and fade. */
export default function Fireworks() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  const wasFinale = useRef(false)

  const rockets = useMemo<Rocket[]>(() => {
    const rng = () => Math.random()
    return Array.from({ length: ROCKETS }, (_, r) => {
      const vels = Array.from({ length: SPARKS }, () => {
        const a = rng() * Math.PI * 2
        const e = rng() * Math.PI - Math.PI / 2
        const sp = 3 + rng() * 4
        return new THREE.Vector3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)).multiplyScalar(sp)
      })
      return {
        origin: new THREE.Vector3(-30 + (rng() - 0.5) * 16, 16 + rng() * 6, -16 + (rng() - 0.5) * 10),
        color: new THREE.Color(COLORS[r % COLORS.length]),
        vels,
        t: -1,
        delay: r * 1.1 + rng() * 0.5,
      }
    })
  }, [])

  const elapsed = useRef(0)

  useFrame((_, rawDt) => {
    const m = mesh.current
    if (!m) return
    const finale = useFestival.getState().phase === 'finale'
    m.visible = finale
    if (!finale) {
      if (wasFinale.current) elapsed.current = 0
      wasFinale.current = false
      return
    }
    if (!wasFinale.current) {
      // (re)start the show
      elapsed.current = 0
      rockets.forEach((r) => (r.t = -1))
      parkAudio.crowdWow()
    }
    wasFinale.current = true
    const dt = Math.min(rawDt, 0.05)
    elapsed.current += dt

    let idx = 0
    for (const r of rockets) {
      if (r.t < 0 && elapsed.current >= r.delay) {
        r.t = 0
        parkAudio.boom()
      }
      for (let s = 0; s < SPARKS; s++) {
        if (r.t < 0) {
          _dummy.position.set(0, -1000, 0) // parked off-screen
        } else {
          const v = r.vels[s]
          _dummy.position.set(
            r.origin.x + v.x * r.t,
            r.origin.y + v.y * r.t - 0.5 * GRAVITY * r.t * r.t,
            r.origin.z + v.z * r.t
          )
        }
        _dummy.scale.setScalar(r.t >= 0 ? Math.max(0, 1 - r.t / 2.2) : 0)
        _dummy.updateMatrix()
        m.setMatrixAt(idx, _dummy.matrix)
        m.setColorAt(idx, r.color)
        idx++
      }
      if (r.t >= 0) {
        r.t += dt
        if (r.t > 2.4) {
          r.t = -1 // relaunch this rocket for a continuous show
          r.delay = elapsed.current + 0.5 + Math.random()
        }
      }
    }
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, TOTAL]} frustumCulled={false} visible={false}>
      <sphereGeometry args={[0.18, 6, 5]} />
      <meshBasicMaterial ref={mat} toneMapped={false} />
    </instancedMesh>
  )
}
```

- [ ] **Step 3: Mount in `components/Scene.tsx`**

Add the import:

```tsx
import Fireworks from '@/components/festival/Fireworks'
```

Add inside the scene (outside `<Physics>` is fine, e.g. right after `<FestivalController />` won't work since that's outside the JSX return list — place it next to other always-on visuals inside the `<Physics>` block, after `<SpeechBubbles />`):

```tsx
        <Fireworks />
```

- [ ] **Step 4: Add fireworks check**

Append to `scripts/check-festival.js`:

```js
  await call('reset'); await call('start'); await call('toFinale')
  await page.evaluate(() => window.__park.store.getState().setTimeMode('night'))
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'scripts/shot-finale-fireworks.png' })
  console.log('phase at finale:', (await F()).phase)
```

- [ ] **Step 5: Run tsc + check**

Run: `npx tsc --noEmit` → clean.
Run: `node scripts/check-festival.js`
Expected: `phase at finale: finale`, `errors: (none)`. Open `scripts/shot-finale-fireworks.png` — colored spark bursts over the wheel.

---

### Task 9: Finale screen (`components/ui/FinaleScreen.tsx`)

**Files:**
- Create: `components/ui/FinaleScreen.tsx`
- Modify: `components/ui/HUD.tsx` (mount it)

- [ ] **Step 1: Implement the finale screen**

```tsx
'use client'

import { useFestival } from '@/lib/festival'
import { requestPointerLock } from '@/lib/refs'

function rank(score: number): string {
  if (score >= 6000) return 'Dasara Legend'
  if (score >= 3000) return 'Mela Star'
  if (score >= 1000) return 'Tryhard'
  return 'Tourist'
}

/** Score card shown at midnight: final score, best, sarcastic rank, replay. */
export default function FinaleScreen() {
  const phase = useFestival((s) => s.phase)
  const score = useFestival((s) => s.score)
  const best = useFestival((s) => s.best)
  const start = useFestival((s) => s.start)
  const reset = useFestival((s) => s.reset)

  if (phase !== 'finale') return null
  const isBest = score >= best && score > 0

  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/55 backdrop-blur-sm">
      <div className="w-[26rem] max-w-[92vw] overflow-hidden rounded-lg border-4 border-[#8e0c20] bg-[#fff3dc] text-center font-[Georgia,'Times_New_Roman',serif] text-[#8e0c20] shadow-2xl">
        <div className="h-4 bg-[repeating-linear-gradient(45deg,#c8102e_0_12px,#fff3dc_12px_24px)]" />
        <div className="p-6">
          <div className="text-xs font-bold uppercase tracking-[0.35em] text-[#c8102e]">Festival Over</div>
          <h1 className="mt-1 text-4xl font-extrabold uppercase tracking-[0.1em]">{rank(score)}</h1>
          <div className="mx-auto mt-2 h-0.5 w-32 bg-[#f2a900]" />
          <div className="mt-4 text-5xl font-bold tabular-nums text-[#c8102e]">{score.toLocaleString()}</div>
          <div className="mt-1 text-sm text-[#8e0c20]/70">
            {isBest ? '🏆 New best!' : `Best: ${best.toLocaleString()}`}
          </div>
          <div className="mt-6 flex gap-2">
            <button
              onClick={() => { start() }}
              className="flex-1 rounded-md border-2 border-[#f2a900] bg-[#c8102e] py-3 font-bold uppercase tracking-widest text-[#ffd23f] transition hover:bg-[#8e0c20]"
            >
              ▶ Play Again
            </button>
            <button
              onClick={() => { reset(); requestPointerLock() }}
              className="flex-1 rounded-md border-2 border-[#8e0c20]/40 bg-[#fff3dc] py-3 font-semibold text-[#8e0c20] transition hover:border-[#8e0c20]"
            >
              Free Roam
            </button>
          </div>
        </div>
        <div className="h-4 bg-[repeating-linear-gradient(45deg,#c8102e_0_12px,#fff3dc_12px_24px)]" />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Mount in `components/ui/HUD.tsx`**

Add the import and mount next to `<FestivalHUD />`:

```tsx
import FinaleScreen from './FinaleScreen'
```
```tsx
      <FestivalHUD />
      <FinaleScreen />
```

> Note: `HUD.tsx` returns `<PhotoOverlay />` early when `photoMode` is true. The finale never coincides with photo mode (P is blocked appropriately), so no extra guard is needed.

- [ ] **Step 3: Add finale-screen check**

Append to `scripts/check-festival.js`:

```js
  await call('reset'); await call('start')
  await page.evaluate(() => window.__park.festival.setState({ score: 4200 }))
  await call('toFinale')
  await page.waitForTimeout(300)
  console.log('finale rank shown (expect Mela Star):', await page.locator('text=Mela Star').count())
  console.log('play again button:', await page.locator('text=Play Again').count())
  await page.screenshot({ path: 'scripts/shot-finale-card.png' })
```

- [ ] **Step 4: Run tsc + check**

Run: `npx tsc --noEmit` → clean.
Run: `node scripts/check-festival.js`
Expected: `finale rank shown (expect Mela Star): 1`, `play again button: 1`, `errors: (none)`. `shot-finale-card.png` shows the rank + score card.

---

### Task 10: Full end-to-end run + onboarding mention

**Files:**
- Modify: `components/ui/Onboarding.tsx` (mention the festival + key)
- Test: `scripts/check-festival-e2e.js`

- [ ] **Step 1: Mention the festival on the onboarding card**

In `components/ui/Onboarding.tsx`, inside the controls grid, add one more entry alongside the existing `<span>` rows:

```tsx
          <span><b className="text-[#c8102e]">G</b> — start festival</span>
```

- [ ] **Step 2: Write the end-to-end check**

Create `scripts/check-festival-e2e.js`:

```js
const { chromium } = require('playwright-core')
const URL = process.env.PARK_URL || 'http://localhost:3001'
;(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } })
  const errs = []; page.on('pageerror', e => errs.push(e.message))
  await page.goto(URL, { waitUntil: 'load', timeout: 180000 })
  await page.waitForFunction(() => !!window.__park && !!window.__park.festival, null, { timeout: 180000 })
  const enter = page.locator('text=Enter the Park'); if (await enter.count()) await enter.click()
  const F = () => page.evaluate(() => window.__park.festival.getState())

  // start a festival, ride the ferris wheel, confirm score lands after the cycle
  await page.evaluate(() => window.__park.festival.getState().start())
  await page.evaluate(() => window.__park.rig.body.setTranslation({ x: -24, y: 1.5, z: -11 }, true))
  await page.waitForTimeout(1200)
  await page.keyboard.press('KeyE')
  // ferris duration ~24s + board/unload; poll up to 40s for score to rise
  let scored = 0
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(1000)
    scored = (await F()).score
    if (scored > 0) break
  }
  console.log('score after a full ride:', scored)            // > 0 (>= 300: ferris cost 3 ×100)
  console.log('combo:', (await F()).combo)
  // fast-forward to finale and confirm rank persists
  await page.evaluate(() => window.__park.festival.setState({ score: 6500 }))
  await page.evaluate(() => window.__park.festival.getState().toFinale())
  await page.waitForTimeout(400)
  console.log('finale phase:', (await F()).phase, 'best:', (await F()).best)
  console.log('legend rank:', await page.locator('text=Dasara Legend').count())
  console.log('errors:', errs.length ? errs.join(' | ') : '(none)')
  await b.close()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
```

- [ ] **Step 3: Run tsc + both checks**

Run: `npx tsc --noEmit` → clean.
Run: `node scripts/check-festival.js` → all prior expectations, `errors: (none)`.
Run: `node scripts/check-festival-e2e.js`
Expected:
```
score after a full ride: 300            (or higher if combo built)
combo: 1                                 (or higher)
finale phase: finale best: 6500
legend rank: 1
errors: (none)
```

- [ ] **Step 4: Manual smoke (optional but recommended)**

In a browser at the dev URL: press **G**, ride something, win a game (watch the combo climb and the announcer heckle), let the clock reach midnight (or `window.__park.festival.getState().toFinale()`), confirm fireworks + score card, click **Play Again**.

---

## Self-Review

**Spec coverage:**
- Core loop / start / ~7-min clock / finale → Tasks 1, 2, 5, 9. ✓
- Scoring model (ride/game/shop, combo ×, timeout reset) → Tasks 1, 3. ✓
- Announcer (events, cooldown, priority, chime, captions) → Task 4. ✓
- Shooting rage twists (juke, cocky duck, near-miss) → Task 6. ✓
- Ring-toss rage twists (oscillating power, wobble, rim-out) → Task 7. ✓
- Finale (fireworks, booms, crowd wow, score card, ranks, play again/free roam) → Tasks 8, 9. ✓
- HUD (score, combo meter, captions, start button) → Task 5. ✓
- Festival owns the clock during a run → Task 2. ✓
- Testing via tsc + headless checks → every task. ✓
- Rivals deferred → not in any task (correct). ✓

**Placeholder scan:** No TBD/TODO; all steps contain concrete code or exact commands. ✓

**Type/name consistency:** `useFestival` actions (`start`, `addScore`, `tick`, `setCaption`, `clearCaption`, `toFinale`, `reset`), `festivalEvents.onScore/onComboLost`, `festivalHour`, `COMBO_WINDOW`, `DAY_SECONDS` are defined in Task 1/4 and used consistently in Tasks 2,5,8,9. `announce(event)` signature matches all call sites. Cocky duck uses the existing `Target` shape (`kind:'duck'`, `points:6`) consumed by Task 6's animation + scoring. ✓

**No import cycles:** `lib/festival.ts` imports nothing from `useGameStore`/announcer; the announcer & game code import the festival store; `festivalEvents` callback indirection breaks the festival→announcer edge. ✓

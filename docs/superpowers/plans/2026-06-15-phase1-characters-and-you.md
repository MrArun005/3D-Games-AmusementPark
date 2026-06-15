# Phase 1 — Characters & You — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single reused human model with varied modern-civilian ("GTA-style") humans, and give the player a customizable avatar that persists across sessions — with behavior otherwise unchanged.

**Architecture:** A set of 6 CC0 modern-civilian human GLBs (Quaternius Animated Men/Women, CC0) is loaded via drei `useGLTF` and cloned per person with `SkeletonUtils.clone` (same pattern as today's `Crowd.tsx`). `lib/characters.ts` turns a small `CharacterConfig` (which model + accent tint + scale) into a configured clone; `randomConfig` produces deterministic crowd variety; `useAvatarStore` persists the player's config to localStorage. A `CharacterCreator` modal (first-run + pause-menu re-edit) drives it, with a tiny live-preview canvas.

**Tech Stack:** Next.js 15 + React Three Fiber + drei + three-stdlib `SkeletonUtils` + zustand; vitest added for unit-testing pure logic.

**Spec:** [`docs/superpowers/specs/2026-06-15-living-characters-design.md`](../specs/2026-06-15-living-characters-design.md) §5.

## Asset facts (from Task 1, completed)

6 GLBs in `public/models/characters/`, each a **SINGLE** skinned mesh (one armature, `SKINS=1`), CC0:

| File | Mesh | Sex |
|---|---|---|
| `civilian_casual.glb` | `BaseHuman` | m |
| `civilian_man.glb` | `BaseHuman` | m |
| `civilian_longsleeve.glb` | `BaseHuman` | m |
| `civilian_suit.glb` | `BaseHuman` | m |
| `civilian_woman.glb` | `Female` | f |
| `civilian_woman2.glb` | `BaseHuman.000` | f |

Animation clips are prefixed `HumanArmature|` and named `<Sex>_<Action>` — men use `Man_Idle`/`Man_Walk`/`Man_Run`/`Man_Sitting`/…, women use `Female_Idle`/`Female_Walk`/… So clips are matched **by suffix** (`/Idle$/`, `/Walk$/`), never by exact name. Variety comes from: model choice (6), a light accent tint, and scale. (No modular part-meshes; the body is one mesh, so per-part skin/hair/outfit channels are NOT available.)

---

## File Structure

**Create:**
- `lib/characters.ts` — `CharacterConfig`, `CHARACTER_MODELS`, `CHARACTER_URLS`, `ACCENT_COLORS`, `findClip`, `buildCharacter`, `randomConfig`, `defaultConfig`
- `lib/characters.test.ts` — unit tests for `randomConfig` determinism + config bounds + `findClip`
- `state/useAvatarStore.ts` — zustand store + localStorage persistence of the player's config
- `state/useAvatarStore.test.ts` — unit tests for load/save round-trip + default
- `components/CharacterPreview.tsx` — small standalone R3F canvas rendering one `CharacterConfig`
- `components/ui/CharacterCreator.tsx` — first-run + re-edit modal (model picker + accent + scale + name + live preview)
- `scripts/check-characters.js` — Playwright screenshot check
- `vitest.config.ts` — minimal vitest config

**Modify:**
- `package.json` — add `vitest` devDependency + `test` script
- `components/Player/PlayerAvatar.tsx` — build from `useAvatarStore` config on the chosen civilian model
- `components/world/Crowd.tsx` — build each NPC from `randomConfig` across the 6 civilian models
- `components/ui/HUD.tsx` — mount `<CharacterCreator />` in place of `<Onboarding />`
- `components/ui/PauseMenu.tsx` — add an "Edit character" button that opens the creator

**Delete:**
- `components/ui/Onboarding.tsx` — superseded by `CharacterCreator` (its controls hint is absorbed)

**Already done (Task 1):** `scripts/inspect-glb.mjs`, `public/models/characters/*.glb`, `@gltf-transform/core` devDep.

---

## Task 1: Asset spike — DONE

Civilian CC0 human pack acquired and committed (see "Asset facts" above). No further action; proceed to Task 2.

---

## Task 2: Test harness + character config/variety logic

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `lib/characters.ts`
- Test: `lib/characters.test.ts`

- [ ] **Step 1: Add vitest**

Run: `npm install -D vitest --legacy-peer-deps`
Then add to `package.json` `scripts`: `"test": "vitest run"` (place after `"typecheck"`).

- [ ] **Step 2: Minimal vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, '.') } },
  test: { environment: 'node', include: ['lib/**/*.test.ts', 'state/**/*.test.ts'] },
})
```

- [ ] **Step 3: Write the failing test**

Create `lib/characters.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  randomConfig, defaultConfig, findClip,
  CHARACTER_MODELS, ACCENT_COLORS, type CharacterConfig,
} from '@/lib/characters'
import { mulberry32 } from '@/lib/spawn'

const inBounds = (c: CharacterConfig) => {
  expect(c.model).toBeGreaterThanOrEqual(0)
  expect(c.model).toBeLessThan(CHARACTER_MODELS.length)
  expect(c.accent).toBeGreaterThanOrEqual(0)
  expect(c.accent).toBeLessThan(ACCENT_COLORS.length)
  expect(c.scale).toBeGreaterThan(0.5)
  expect(c.scale).toBeLessThan(1.6)
}

describe('randomConfig', () => {
  it('is deterministic for a given seed', () => {
    expect(randomConfig(mulberry32(42))).toEqual(randomConfig(mulberry32(42)))
  })
  it('produces in-bounds configs for many seeds', () => {
    for (let s = 0; s < 200; s++) inBounds(randomConfig(mulberry32(s)))
  })
  it('defaultConfig is in bounds', () => inBounds(defaultConfig()))
})

describe('findClip', () => {
  const clips = [
    new THREE.AnimationClip('HumanArmature|Man_Idle', 1, []),
    new THREE.AnimationClip('HumanArmature|Man_Walk', 1, []),
    new THREE.AnimationClip('HumanArmature|Female_Walk', 1, []),
  ]
  it('matches by suffix regardless of sex prefix', () => {
    expect(findClip(clips, 'Idle')?.name).toBe('HumanArmature|Man_Idle')
    expect(findClip([clips[2]], 'Walk')?.name).toBe('HumanArmature|Female_Walk')
  })
  it('returns undefined when no clip matches', () => {
    expect(findClip(clips, 'Sitting')).toBeUndefined()
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `lib/characters.ts` has no exports yet.

- [ ] **Step 5: Implement `lib/characters.ts` (config + variety; visual builder stubbed)**

Create `lib/characters.ts`:

```ts
import * as THREE from 'three'
import { SkeletonUtils } from 'three-stdlib'
import { BAZAAR } from '@/lib/palette'

export interface CharacterModel { url: string; label: string; sex: 'm' | 'f' }

/** The 6 CC0 civilian models (single skinned mesh each). Order is the picker order. */
export const CHARACTER_MODELS: CharacterModel[] = [
  { url: '/models/characters/civilian_casual.glb', label: 'Casual', sex: 'm' },
  { url: '/models/characters/civilian_man.glb', label: 'Everyday', sex: 'm' },
  { url: '/models/characters/civilian_longsleeve.glb', label: 'Long-sleeve', sex: 'm' },
  { url: '/models/characters/civilian_suit.glb', label: 'Suit', sex: 'm' },
  { url: '/models/characters/civilian_woman.glb', label: 'Woman', sex: 'f' },
  { url: '/models/characters/civilian_woman2.glb', label: 'Woman II', sex: 'f' },
]

export const CHARACTER_URLS: string[] = CHARACTER_MODELS.map((m) => m.url)

/**
 * Accent tints layered LIGHTLY over the base look for subtle per-person variety.
 * Index 0 is "none" (white = identity multiply) and is the default.
 */
export const ACCENT_COLORS: string[] = [
  '#ffffff', BAZAAR.magenta, BAZAAR.marigold, BAZAAR.parrotGreen, BAZAAR.turquoise,
  BAZAAR.purple, BAZAAR.chilliRed, BAZAAR.skyBlue, '#e8e2d2', '#cdd6e0',
]

export interface CharacterConfig {
  model: number   // index into CHARACTER_MODELS
  accent: number  // index into ACCENT_COLORS (0 = no tint)
  scale: number   // 0.9..1.2 typical
  name?: string
}

export const defaultConfig = (): CharacterConfig => ({ model: 0, accent: 0, scale: 1 })

/** Deterministic varied NPC config from a seeded PRNG (see mulberry32 in spawn.ts). */
export function randomConfig(rnd: () => number): CharacterConfig {
  return {
    model: Math.floor(rnd() * CHARACTER_MODELS.length),
    accent: Math.floor(rnd() * ACCENT_COLORS.length),
    scale: 0.9 + rnd() * 0.3,
  }
}

/** Find a clip by action suffix — handles "HumanArmature|Man_Idle"/"...Female_Walk". */
export function findClip(
  animations: THREE.AnimationClip[],
  action: 'Idle' | 'Walk' | 'Run' | 'Sitting',
): THREE.AnimationClip | undefined {
  const re = new RegExp(action + '$', 'i')
  return animations.find((a) => re.test(a.name))
}

/** Build a configured, independent clone. Implemented for real in Task 3. */
export function buildCharacter(_source: THREE.Object3D, _config: CharacterConfig): THREE.Object3D {
  throw new Error('buildCharacter not implemented yet (Task 3)')
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts lib/characters.ts lib/characters.test.ts
git commit -m "feat(characters): config + deterministic variety + clip lookup, with tests"
```

---

## Task 3: Implement `buildCharacter`

**Files:**
- Modify: `lib/characters.ts`

No unit test (produces a three.js object graph — verified visually in Tasks 5/8). The asset is a single skinned mesh, so the only material adjustment is a light overall accent tint; variety otherwise comes from model choice + scale.

- [ ] **Step 1: Replace the `buildCharacter` stub**

In `lib/characters.ts`, implement:

```ts
export function buildCharacter(source: THREE.Object3D, config: CharacterConfig): THREE.Object3D {
  const root = SkeletonUtils.clone(source)
  const tint = config.accent > 0
    ? new THREE.Color('#ffffff').lerp(new THREE.Color(ACCENT_COLORS[config.accent]), 0.28)
    : null
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.castShadow = true
    m.frustumCulled = false // skinned bounds lag the body; never pop out (matches Crowd/PlayerAvatar)
    // Clone the material so per-instance tints never bleed across clones.
    const mat = (m.material as THREE.MeshStandardMaterial).clone()
    if (tint) mat.color.multiply(tint)
    m.material = mat
  })
  root.scale.setScalar(config.scale)
  return root
}
```

- [ ] **Step 2: Type-check**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/characters.ts
git commit -m "feat(characters): implement buildCharacter (clone + accent tint + scale)"
```

---

## Task 4: Avatar store (persisted player config)

**Files:**
- Create: `state/useAvatarStore.ts`
- Test: `state/useAvatarStore.test.ts`

- [ ] **Step 1: Write the failing test**

Create `state/useAvatarStore.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  })
})

describe('avatar persistence', () => {
  it('round-trips a config through save/load', async () => {
    const { saveAvatar, loadAvatar } = await import('@/state/useAvatarStore')
    const cfg = { model: 3, accent: 2, scale: 1.1, name: 'Arun' }
    saveAvatar(cfg)
    expect(loadAvatar()).toEqual(cfg)
  })
  it('loadAvatar returns null when nothing is stored', async () => {
    const { loadAvatar } = await import('@/state/useAvatarStore')
    expect(loadAvatar()).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `state/useAvatarStore.ts` does not exist.

- [ ] **Step 3: Implement the store**

Create `state/useAvatarStore.ts`:

```ts
import { create } from 'zustand'
import { defaultConfig, type CharacterConfig } from '@/lib/characters'

const KEY = 'fableland-avatar'

export function loadAvatar(): CharacterConfig | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as CharacterConfig) : null
  } catch {
    return null
  }
}

export function saveAvatar(cfg: CharacterConfig): void {
  try { localStorage.setItem(KEY, JSON.stringify(cfg)) } catch { /* private mode: ignore */ }
}

interface AvatarState {
  config: CharacterConfig
  hasOnboarded: boolean
  /** revision counter — bump to force avatar/preview rebuilds without per-frame state */
  rev: number
  setConfig: (cfg: CharacterConfig) => void
  finishOnboarding: (cfg: CharacterConfig) => void
}

const initial = loadAvatar()

export const useAvatarStore = create<AvatarState>((set) => ({
  config: initial ?? defaultConfig(),
  hasOnboarded: initial !== null,
  rev: 0,
  setConfig: (cfg) => { saveAvatar(cfg); set((s) => ({ config: cfg, rev: s.rev + 1 })) },
  finishOnboarding: (cfg) => { saveAvatar(cfg); set((s) => ({ config: cfg, hasOnboarded: true, rev: s.rev + 1 })) },
}))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all tests across both files).

- [ ] **Step 5: Commit**

```bash
git add state/useAvatarStore.ts state/useAvatarStore.test.ts
git commit -m "feat(characters): persisted avatar store (localStorage round-trip + tests)"
```

---

## Task 5: Character live-preview component

**Files:**
- Create: `components/CharacterPreview.tsx`

- [ ] **Step 1: Implement the preview canvas**

Create `components/CharacterPreview.tsx`:

```tsx
'use client'

import { Suspense, useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import {
  buildCharacter, findClip, CHARACTER_MODELS, CHARACTER_URLS, type CharacterConfig,
} from '@/lib/characters'

function Model({ config }: { config: CharacterConfig }) {
  const url = CHARACTER_MODELS[config.model].url
  const { scene, animations } = useGLTF(url)
  const built = useMemo(() => buildCharacter(scene, config), [scene, config])
  const group = useRef<THREE.Group>(null)
  const { actions, mixer } = useAnimations(animations, group)
  useEffect(() => {
    const idle = findClip(animations, 'Idle') ?? animations[0]
    const a = idle ? actions[idle.name] : Object.values(actions)[0]
    a?.reset().play()
    return () => { mixer.stopAllAction() }
  }, [actions, animations, mixer, built])
  useFrame((_, dt) => { if (group.current) group.current.rotation.y += dt * 0.6 })
  return <group ref={group}><primitive object={built} /></group>
}

/** A small turntable preview of one character config; used inside CharacterCreator. */
export default function CharacterPreview({ config }: { config: CharacterConfig }) {
  return (
    <Canvas camera={{ fov: 35, position: [0, 1.4, 3.4] }} style={{ width: '100%', height: '100%' }}>
      <color attach="background" args={['#241a2e']} />
      <hemisphereLight intensity={1.1} />
      <directionalLight position={[3, 5, 2]} intensity={1.4} />
      <Suspense fallback={null}>
        <group position={[0, -0.9, 0]}><Model config={config} /></group>
      </Suspense>
    </Canvas>
  )
}

CHARACTER_URLS.forEach((u) => useGLTF.preload(u))
```

- [ ] **Step 2: Type-check**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/CharacterPreview.tsx
git commit -m "feat(characters): live turntable preview component"
```

---

## Task 6: CharacterCreator modal (first-run + re-edit) and HUD wiring

**Files:**
- Create: `components/ui/CharacterCreator.tsx`
- Modify: `components/ui/HUD.tsx`
- Delete: `components/ui/Onboarding.tsx`

- [ ] **Step 1: Implement the creator**

Create `components/ui/CharacterCreator.tsx` (circus-card style matching the old `Onboarding`):

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useAvatarStore } from '@/state/useAvatarStore'
import { requestPointerLock } from '@/lib/refs'
import { CHARACTER_MODELS, ACCENT_COLORS, defaultConfig, type CharacterConfig } from '@/lib/characters'
import CharacterPreview from '@/components/CharacterPreview'

/** Cross-component flag (no per-frame state) for "open the editor from the pause menu". */
export const creatorControl = { open: () => {} }

function Swatch({ colors, value, onChange }: { colors: string[]; value: number; onChange: (i: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {colors.map((c, i) => (
        <button key={c + i} onClick={() => onChange(i)}
          className={`h-7 w-7 rounded-full border-2 transition ${i === value ? 'border-[#ffd23f] scale-110' : 'border-black/20'}`}
          style={{ background: c === '#ffffff' ? 'repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%)' : c }}
          title={c === '#ffffff' ? 'No tint' : c} />
      ))}
    </div>
  )
}

function Stepper({ label, value, count, display, onChange }: { label: string; value: number; count: number; display: string; onChange: (i: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-semibold">{label}</span>
      <div className="flex items-center gap-2">
        <button onClick={() => onChange((value - 1 + count) % count)} className="h-7 w-7 rounded-full border-2 border-[#8e0c20]/40 font-bold">‹</button>
        <span className="w-24 text-center text-sm">{display}</span>
        <button onClick={() => onChange((value + 1) % count)} className="h-7 w-7 rounded-full border-2 border-[#8e0c20]/40 font-bold">›</button>
      </div>
    </div>
  )
}

export default function CharacterCreator() {
  const hasOnboarded = useAvatarStore((s) => s.hasOnboarded)
  const saved = useAvatarStore((s) => s.config)
  const finishOnboarding = useAvatarStore((s) => s.finishOnboarding)
  const setConfig = useAvatarStore((s) => s.setConfig)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<CharacterConfig>(saved ?? defaultConfig())

  useEffect(() => { creatorControl.open = () => { setDraft(useAvatarStore.getState().config); setEditing(true) } }, [])

  const open = !hasOnboarded || editing
  if (!open) return null
  const set = (patch: Partial<CharacterConfig>) => setDraft((d) => ({ ...d, ...patch }))

  const confirm = () => {
    if (hasOnboarded) { setConfig(draft); setEditing(false) }
    else finishOnboarding(draft)
    requestPointerLock()
  }

  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="flex w-[46rem] max-w-[95vw] overflow-hidden rounded-lg border-4 border-[#8e0c20] bg-[#fff3dc] font-[Georgia,'Times_New_Roman',serif] text-[#8e0c20] shadow-2xl">
        <div className="h-[26rem] w-[18rem] shrink-0 bg-[#241a2e]"><CharacterPreview config={draft} /></div>
        <div className="flex-1 p-6">
          <h1 className="text-center text-2xl font-extrabold uppercase tracking-[0.12em]">{hasOnboarded ? 'Edit Your Look' : 'Create Your Character'}</h1>
          <div className="mx-auto mt-2 h-0.5 w-32 bg-[#f2a900]" />
          <div className="mt-4 space-y-3">
            <Stepper label="Character" value={draft.model} count={CHARACTER_MODELS.length}
              display={CHARACTER_MODELS[draft.model].label} onChange={(i) => set({ model: i })} />
            <div><div className="mb-1 text-sm font-semibold">Accent</div><Swatch colors={ACCENT_COLORS} value={draft.accent} onChange={(i) => set({ accent: i })} /></div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Height</span>
              <input type="range" min={0.9} max={1.2} step={0.01} value={draft.scale}
                onChange={(e) => set({ scale: Number(e.target.value) })} className="w-40" />
            </div>
            <input value={draft.name ?? ''} onChange={(e) => set({ name: e.target.value.slice(0, 16) })} placeholder="Name (optional)"
              className="w-full rounded-md border-2 border-[#8e0c20]/40 bg-white/60 px-3 py-1.5 text-sm" />
          </div>
          {!hasOnboarded && (
            <p className="mt-3 text-center text-xs italic text-[#8e0c20]/70">WASD move · Mouse look · E ride/buy · V view · Esc pause</p>
          )}
          <button onClick={confirm} className="mt-4 w-full rounded-md border-2 border-[#f2a900] bg-[#c8102e] py-3 font-bold uppercase tracking-widest text-[#ffd23f] shadow-md transition hover:bg-[#8e0c20]">
            {hasOnboarded ? 'Save' : 'Enter the Park'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Swap it into the HUD**

In `components/ui/HUD.tsx`: replace `import Onboarding from './Onboarding'` with `import CharacterCreator from './CharacterCreator'`, and replace the `<Onboarding />` element (line ~162) with `<CharacterCreator />`.

- [ ] **Step 3: Delete the superseded onboarding**

Run: `git rm components/ui/Onboarding.tsx`

- [ ] **Step 4: Type-check**

Run: `npm run typecheck`
Expected: no errors (no remaining references to `Onboarding`).

- [ ] **Step 5: Commit**

```bash
git add components/ui/CharacterCreator.tsx components/ui/HUD.tsx
git commit -m "feat(characters): character creator modal (first-run + re-edit), replaces Onboarding"
```

---

## Task 7: Swap the player avatar onto the civilian model

**Files:**
- Modify: `components/Player/PlayerAvatar.tsx`

- [ ] **Step 1: Rebuild PlayerAvatar from the avatar config**

Replace the body of `components/Player/PlayerAvatar.tsx` with the version below. Behavior is unchanged (third-person only, hidden on rides, walk clip sped up by speed, faces velocity); it now loads the player's chosen civilian model and rebuilds when the config revision changes:

```tsx
'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import { useGameStore } from '@/state/useGameStore'
import { useAvatarStore } from '@/state/useAvatarStore'
import { buildCharacter, findClip, CHARACTER_MODELS, CHARACTER_URLS } from '@/lib/characters'
import { look, playerRig } from '@/lib/refs'

/**
 * Third-person body built from the player's saved CharacterConfig on a civilian
 * model. Rebuilds when the avatar config revision changes. Visible only in third
 * person and never while a ride owns the camera. Walk clip sped up by movement.
 */
export default function PlayerAvatar() {
  const config = useAvatarStore((s) => s.config)
  const rev = useAvatarStore((s) => s.rev)
  const { scene, animations } = useGLTF(CHARACTER_MODELS[config.model].url)
  const built = useMemo(() => buildCharacter(scene, config), [scene, config, rev])
  const group = useRef<THREE.Group>(null)
  const { actions, mixer } = useAnimations(animations, group)
  const walk = useRef<THREE.AnimationAction | null>(null)

  useEffect(() => {
    const clip = findClip(animations, 'Walk') ?? animations[0]
    const a = clip ? actions[clip.name] : null
    if (a) { a.play(); walk.current = a }
    return () => { mixer.stopAllAction() }
  }, [actions, animations, mixer, built])

  useFrame(() => {
    const g = group.current
    if (!g) return
    const st = useGameStore.getState()
    g.visible = st.view === 'third' && !st.activeRide

    const v = playerRig.body?.linvel()
    const speed = v ? Math.hypot(v.x, v.z) : 0
    const a = walk.current
    if (a) {
      if (speed > 0.4) { a.paused = false; a.timeScale = THREE.MathUtils.clamp(speed / 2.2, 0.7, 2.4) }
      else a.paused = true
    }
    if (v && speed > 0.4) g.rotation.y = Math.atan2(v.x, v.z)
    else g.rotation.y = look.yaw + Math.PI
  })

  return (
    <group ref={group} position={[0, -0.95, 0]}>
      <primitive object={built} />
    </group>
  )
}

CHARACTER_URLS.forEach((u) => useGLTF.preload(u))
```

> If the civilian model's feet don't meet the capsule base, adjust the `position={[0, -0.95, 0]}` y-offset (verify in Step 3). Quaternius humans are ~1.8 m and feet-at-origin, so −0.95 should be close.

- [ ] **Step 2: Type-check**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Visual smoke**

Run `npm run dev`, enter the park, press `V`. Expected: your chosen character appears, walks with movement, stands still when idle, faces travel direction. Tune y-offset/scale if feet float or sink.

- [ ] **Step 4: Commit**

```bash
git add components/Player/PlayerAvatar.tsx
git commit -m "feat(characters): player avatar uses the customizable civilian character"
```

---

## Task 8: Swap the crowd onto the civilian models with variety

**Files:**
- Modify: `components/world/Crowd.tsx`

Only the model source + per-NPC build change. Steering, LOD, lingering, balloon prop, and quality-count logic stay exactly as they are.

- [ ] **Step 1: Load all 6 models and build NPCs from randomConfig**

In `components/world/Crowd.tsx`:
1. Replace the model/tints imports with:
   ```ts
   import { buildCharacter, randomConfig, findClip, CHARACTER_MODELS, CHARACTER_URLS } from '@/lib/characters'
   ```
   Remove the now-unused `BAZAAR` import and the local `CLOTH_TINTS` array, and remove the old single `MODEL` constant and its `useGLTF(MODEL)` call.
2. Load all models at the top of the component (drei accepts an array and returns results in order):
   ```ts
   const gltfs = useGLTF(CHARACTER_URLS)
   ```
3. Inside the `npcs` `useMemo` (which must depend on `[gltfs]`), build each NPC from its own config + chosen model:
   ```ts
   const cfg = randomConfig(rnd)
   const { scene, animations } = gltfs[cfg.model]
   const root = buildCharacter(scene, cfg)
   const s = cfg.scale
   ```
   Keep the balloon-prop block and the pushed `Npc` fields. Build the mixer/action from that model's animations:
   ```ts
   const mixer = new THREE.AnimationMixer(root)
   const clip = findClip(animations, 'Walk') ?? animations[0]
   const action = mixer.clipAction(clip)
   action.play()
   action.time = rnd() * 2 // desync strides
   ```
4. Replace the bottom preload line `useGLTF.preload(MODEL)` with:
   ```ts
   CHARACTER_URLS.forEach((u) => useGLTF.preload(u))
   ```

- [ ] **Step 2: Type-check**

Run: `npm run typecheck`
Expected: no errors (no remaining `CLOTH_TINTS`/`BAZAAR`/`MODEL` references).

- [ ] **Step 3: Visual smoke**

Run `npm run dev`. Expected: the wandering crowd is varied civilian humans (different models/tints/heights), still walking between waypoints, far ones frozen by the LOD.

- [ ] **Step 4: Commit**

```bash
git add components/world/Crowd.tsx
git commit -m "feat(characters): wandering crowd is varied modern-civilian humans"
```

---

## Task 9: "Edit character" entry in the pause menu

**Files:**
- Modify: `components/ui/PauseMenu.tsx`

- [ ] **Step 1: Add the button**

In `components/ui/PauseMenu.tsx`:
1. Add import: `import { creatorControl } from '@/components/ui/CharacterCreator'`.
2. Add a handler near `resume`:
   ```ts
   const editCharacter = () => { setPaused(false); creatorControl.open() }
   ```
3. Add a button directly under the "Resume the Show" button:
   ```tsx
   <button
     onClick={editCharacter}
     className="mt-3 w-full rounded-md border-2 border-[#f2a900] bg-[#fff3dc] py-2.5 font-bold uppercase tracking-widest text-[#8e0c20] shadow-md transition hover:bg-[#f2a900]/20"
   >
     🎭 Edit character
   </button>
   ```

- [ ] **Step 2: Type-check**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Visual smoke**

Run `npm run dev`, press `Esc`, click "Edit character". Expected: the creator opens with your current look; Save applies it and re-locks the pointer.

- [ ] **Step 4: Commit**

```bash
git add components/ui/PauseMenu.tsx
git commit -m "feat(characters): edit your character from the pause menu"
```

---

## Task 10: Screenshot check + final verification

**Files:**
- Create: `scripts/check-characters.js`

- [ ] **Step 1: Write the check script**

Create `scripts/check-characters.js`, modeled on an existing `scripts/check-*.js` (reuse its Playwright boot/connect boilerplate — open the dev URL, wait for the canvas, drive keys). It must:
1. Capture the first-run CharacterCreator → `scripts/shot-creator.png`.
2. Click "Enter the Park", press `v`, wait, capture third-person → `scripts/shot-hero.png`.
3. Capture a wide shot of the varied crowd → `scripts/shot-crowd-humans.png`.

- [ ] **Step 2: Run the full verification suite**

Run each and confirm:
- `npm test` → all unit tests PASS
- `npm run typecheck` → no errors
- `npm run build` → succeeds
- `node scripts/check-characters.js` (dev server running) → produces the three screenshots; eyeball for varied civilians + the creator + a recognizable hero.

- [ ] **Step 3: Commit**

```bash
git add scripts/check-characters.js scripts/shot-creator.png scripts/shot-hero.png scripts/shot-crowd-humans.png
git commit -m "test(characters): screenshot check for creator + hero + varied crowd"
```

---

## Phase 1 Done — acceptance (from spec §5.5)

- [ ] First run shows the character creator; choosing + entering persists across reload.
- [ ] The crowd is visibly varied civilian humans, not clones of one model.
- [ ] The player avatar matches the saved config in third person and photo mode.
- [ ] Frame rate at `high` quality is no worse than before (if heavier, lower the `high` crowd count in `Crowd.tsx` `COUNT_BY_Q`).
- [ ] `npm test`, `npm run typecheck`, and `npm run build` are all green.

Phases 2 (Purpose), 3 (Boarding), and 4 (whole-park realism pass) get their own plans when we reach them.
```

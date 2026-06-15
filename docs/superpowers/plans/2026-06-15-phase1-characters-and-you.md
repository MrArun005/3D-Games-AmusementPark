# Phase 1 — Characters & You — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single reused human model with varied GTA-style civilian humans on one shared rig, and give the player a customizable avatar that persists across sessions — with behavior otherwise unchanged.

**Architecture:** A CC0 modular human pack is loaded once and cloned per person (same `SkeletonUtils.clone` pattern as today's `Crowd.tsx`). `lib/characters.ts` turns a small `CharacterConfig` into a configured clone; `randomConfig` produces deterministic crowd variety; `useAvatarStore` persists the player's config to localStorage. A `CharacterCreator` modal (first-run + pause-menu re-edit) drives it, with a tiny live-preview canvas.

**Tech Stack:** Next.js 15 + React Three Fiber + drei + three-stdlib `SkeletonUtils` + zustand; vitest added for unit-testing pure logic.

**Spec:** [`docs/superpowers/specs/2026-06-15-living-characters-design.md`](../specs/2026-06-15-living-characters-design.md) §5.

---

## File Structure

**Create:**
- `public/models/characters/` — the CC0 GLB asset(s) (Task 1)
- `scripts/inspect-glb.mjs` — node script that prints a GLB's meshes + animation clips (Task 1, verification)
- `lib/characters.ts` — `CharacterConfig`, palettes, `CHARACTER_ASSET` descriptor, `buildCharacter`, `randomConfig`
- `lib/characters.test.ts` — unit tests for `randomConfig` determinism + config bounds
- `state/useAvatarStore.ts` — zustand store + localStorage persistence of the player's config
- `state/useAvatarStore.test.ts` — unit tests for load/save round-trip + default
- `components/CharacterPreview.tsx` — small standalone R3F canvas rendering one `CharacterConfig`
- `components/ui/CharacterCreator.tsx` — first-run + re-edit modal (character pickers + live preview + controls playbill)
- `scripts/check-characters.js` — Playwright screenshot check (crowd variety + creator + third-person avatar)
- `vitest.config.ts` — minimal vitest config

**Modify:**
- `package.json` — add `vitest` devDependency + `test` script
- `components/Player/PlayerAvatar.tsx` — build from `useAvatarStore` config on the new rig
- `components/world/Crowd.tsx` — build each NPC from `randomConfig` on the new rig
- `components/ui/HUD.tsx` — mount `<CharacterCreator />` in place of `<Onboarding />`
- `components/ui/PauseMenu.tsx` — add an "Edit character" button that opens the creator

**Delete:**
- `components/ui/Onboarding.tsx` — superseded by `CharacterCreator` (its controls playbill is absorbed)

---

## Task 1: Asset spike — acquire & verify a CC0 human pack

**Files:**
- Create: `scripts/inspect-glb.mjs`
- Create: `public/models/characters/` (the downloaded `.glb`(s))

**This is a verify-or-escalate gate.** Phase 1 needs only a rig with an `idle`-ish and a `walk`-ish clip plus a way to produce visual variety (separate swappable body/outfit meshes, OR a single skinned mesh whose material we tint). It does NOT need a `sit` clip (that is Phase 3).

- [ ] **Step 1: Write the GLB inspector**

Create `scripts/inspect-glb.mjs`:

```js
// Prints mesh names + animation clip names for a GLB so we can wire characters.ts.
// Usage: node scripts/inspect-glb.mjs public/models/characters/<file>.glb
import { readFileSync } from 'node:fs'
import { NodeIO } from '@gltf-transform/core'

const path = process.argv[2]
if (!path) { console.error('usage: node scripts/inspect-glb.mjs <file.glb>'); process.exit(1) }
const io = new NodeIO()
const doc = await io.read(path)
const root = doc.getRoot()
console.log('MESHES:')
for (const m of root.listMeshes()) console.log('  -', JSON.stringify(m.getName()))
console.log('ANIMATIONS:')
for (const a of root.listAnimations()) console.log('  -', JSON.stringify(a.getName()))
console.log('SKINS:', root.listSkins().length)
```

- [ ] **Step 2: Install the inspector dependency**

Run: `npm install -D @gltf-transform/core --legacy-peer-deps`
Expected: installs without error.

- [ ] **Step 3: Acquire a CC0 pack**

Try in order; stop at the first that yields a rigged human GLB with at least an idle + walk clip:
1. **Quaternius "Ultimate Animated Character Pack"** (CC0, no account) — quaternius.com / its itch.io page. Prefer the glTF/GLB distribution. Modular: separate body/outfit/hair part meshes sharing one skeleton.
2. **KayKit Character pack** (CC0) if Quaternius is unavailable.
3. **Fallback A — Mixamo:** STOP and tell the user — Mixamo needs their Adobe login. Provide a fetch list (1 base human + `Idle`, `Walking` animations as GLB).
4. **Fallback B — procedural:** STOP and tell the user the pack route failed; propose the procedural-humans fallback from the spec §9.

Save the chosen file(s) under `public/models/characters/`.

- [ ] **Step 4: Inspect and record the structure**

Run: `node scripts/inspect-glb.mjs public/models/characters/<file>.glb`
Expected: a non-empty MESHES list, an ANIMATIONS list containing an idle-like and a walk-like clip, and `SKINS: >=1`.

Record the **exact** mesh names and clip names — Task 3 wires them into `CHARACTER_ASSET`. Note whether the pack is **modular** (multiple part meshes to show/hide) or **single** (one skinned mesh to tint).

- [ ] **Step 5: Commit**

```bash
git add scripts/inspect-glb.mjs public/models/characters package.json package-lock.json
git commit -m "feat(characters): add CC0 human pack + GLB inspector (asset spike)"
```

**Gate:** If no pack with idle+walk could be acquired, do NOT proceed — surface the blocker and the chosen fallback to the user.

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
import { randomConfig, BODIES, OUTFIT_COLORS, defaultConfig, type CharacterConfig } from '@/lib/characters'
import { mulberry32 } from '@/lib/spawn'

const inBounds = (c: CharacterConfig) => {
  expect(c.body).toBeGreaterThanOrEqual(0)
  expect(c.body).toBeLessThan(BODIES.length)
  expect(c.outfitColor).toBeGreaterThanOrEqual(0)
  expect(c.outfitColor).toBeLessThan(OUTFIT_COLORS.length)
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
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `lib/characters.ts` has no exports yet.

- [ ] **Step 5: Implement `lib/characters.ts` (config + variety; visual builder stubbed)**

Create `lib/characters.ts`. The `CHARACTER_ASSET` descriptor is filled with the **real names recorded in Task 1** — replace the placeholder strings below with those exact names, and set `modular` accordingly:

```ts
import * as THREE from 'three'
import { SkeletonUtils } from 'three-stdlib'
import { BAZAAR } from '@/lib/palette'

/** Descriptor for the chosen CC0 pack — names come from `scripts/inspect-glb.mjs` (Task 1). */
export const CHARACTER_ASSET = {
  url: '/models/characters/<FILE>.glb',
  /** true: separate part meshes shown/hidden per config; false: one skinned mesh, tint only. */
  modular: true as boolean,
  clips: { idle: '<IDLE_CLIP>', walk: '<WALK_CLIP>' },
  /** modular only — mesh-name groups to choose between (one shown per group). */
  bodyMeshes: ['<BODY_A>', '<BODY_B>'] as string[],
  hairMeshes: ['<HAIR_A>', '<HAIR_B>'] as string[],
  /** mesh names whose material gets the outfit tint. */
  outfitMeshes: ['<TORSO>', '<LEGS>'] as string[],
}

export const OUTFIT_COLORS = [
  BAZAAR.magenta, BAZAAR.marigold, BAZAAR.parrotGreen, BAZAAR.turquoise,
  BAZAAR.purple, BAZAAR.chilliRed, BAZAAR.yellow, BAZAAR.skyBlue,
  '#e8e2d2', '#cdd6e0', '#3b332b', '#7a5230',
]
export const SKIN_TONES = [BAZAAR.skin1, BAZAAR.skin2, BAZAAR.skin3, '#c98a5e', '#e0ac82']
export const HAIR_COLORS = ['#1c1410', '#2b1c12', '#0f0c0a', '#5a3a22', '#7a7a7a']
/** Index into the pack's body variants (modular) or 0 (single-mesh). */
export const BODIES = CHARACTER_ASSET.modular ? CHARACTER_ASSET.bodyMeshes : ['default']
export const HAIRS = CHARACTER_ASSET.modular ? CHARACTER_ASSET.hairMeshes : ['default']

export interface CharacterConfig {
  body: number        // index into BODIES
  hair: number        // index into HAIRS
  outfitColor: number // index into OUTFIT_COLORS
  skin: number        // index into SKIN_TONES
  hairColor: number   // index into HAIR_COLORS
  scale: number       // 0.85..1.25 typical
  name?: string
}

export const defaultConfig = (): CharacterConfig => ({
  body: 0, hair: 0, outfitColor: 1, skin: 0, hairColor: 0, scale: 1,
})

/** Deterministic varied NPC config from a seeded PRNG (see mulberry32 in spawn.ts). */
export function randomConfig(rnd: () => number): CharacterConfig {
  const pick = (n: number) => Math.floor(rnd() * n)
  return {
    body: pick(BODIES.length),
    hair: pick(HAIRS.length),
    outfitColor: pick(OUTFIT_COLORS.length),
    skin: pick(SKIN_TONES.length),
    hairColor: pick(HAIR_COLORS.length),
    scale: 0.85 + rnd() * 0.35,
  }
}

/**
 * Build a configured, independent clone of the loaded pack scene.
 * Implemented for real in Task 3 once the pack structure is confirmed.
 */
export function buildCharacter(_source: THREE.Object3D, _config: CharacterConfig): THREE.Object3D {
  throw new Error('buildCharacter not implemented yet (Task 3)')
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts lib/characters.ts lib/characters.test.ts
git commit -m "feat(characters): config + deterministic variety (randomConfig) with tests"
```

---

## Task 3: Implement `buildCharacter`

**Files:**
- Modify: `lib/characters.ts`

No unit test (it produces a three.js object graph — verified visually in Task 5/8 via the preview and screenshots). Implementation depends on `CHARACTER_ASSET.modular` from Task 1.

- [ ] **Step 1: Replace the `buildCharacter` stub**

In `lib/characters.ts`, implement:

```ts
export function buildCharacter(source: THREE.Object3D, config: CharacterConfig): THREE.Object3D {
  const root = SkeletonUtils.clone(source)
  const outfit = new THREE.Color(OUTFIT_COLORS[config.outfitColor])
  const skin = new THREE.Color(SKIN_TONES[config.skin])
  const hairCol = new THREE.Color(HAIR_COLORS[config.hairColor])

  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.castShadow = true
    m.frustumCulled = false // skinned bounds lag the body; never pop out (matches Crowd/PlayerAvatar)

    if (CHARACTER_ASSET.modular) {
      // Show only the chosen body + hair variant within each group; hide the rest.
      if (CHARACTER_ASSET.bodyMeshes.includes(m.name)) m.visible = m.name === BODIES[config.body]
      if (CHARACTER_ASSET.hairMeshes.includes(m.name)) m.visible = m.name === HAIRS[config.hair]
    }

    // Clone the material so per-instance tints don't bleed across clones.
    const src = m.material as THREE.MeshStandardMaterial
    const mat = src.clone()
    if (CHARACTER_ASSET.outfitMeshes.includes(m.name)) {
      mat.color = CHARACTER_ASSET.modular ? outfit.clone() : new THREE.Color('#ffffff').lerp(outfit, 0.35)
    } else if (/hair/i.test(m.name)) {
      mat.color = hairCol.clone()
    } else if (/head|face|skin|body/i.test(m.name)) {
      mat.color = CHARACTER_ASSET.modular ? skin.clone() : new THREE.Color('#ffffff').lerp(skin, 0.25)
    }
    m.material = mat
  })

  root.scale.setScalar(config.scale)
  return root
}
```

> After Task 1, adjust the mesh-name matching (`/hair/i`, `/head|.../i`) to the pack's real naming if it differs from these heuristics — the names were recorded in Task 1 Step 4.

- [ ] **Step 2: Type-check**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/characters.ts
git commit -m "feat(characters): implement buildCharacter (clone + variant + tint)"
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

// jsdom-free localStorage shim
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
    const cfg = { body: 1, hair: 0, outfitColor: 3, skin: 2, hairColor: 1, scale: 1.1, name: 'Arun' }
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
import { buildCharacter, CHARACTER_ASSET, type CharacterConfig } from '@/lib/characters'

function Model({ config }: { config: CharacterConfig }) {
  const { scene, animations } = useGLTF(CHARACTER_ASSET.url)
  const built = useMemo(() => buildCharacter(scene, config), [scene, config])
  const group = useRef<THREE.Group>(null)
  const { actions } = useAnimations(animations, group)
  useEffect(() => {
    const a = actions[CHARACTER_ASSET.clips.idle] ?? Object.values(actions)[0]
    a?.reset().play()
  }, [actions])
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

useGLTF.preload(CHARACTER_ASSET.url)
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

Create `components/ui/CharacterCreator.tsx`. It opens when not yet onboarded, or when `editing` is requested from the pause menu. Visual style matches the existing `Onboarding` card (circus palette, striped bars):

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useAvatarStore } from '@/state/useAvatarStore'
import { requestPointerLock } from '@/lib/refs'
import {
  OUTFIT_COLORS, SKIN_TONES, HAIR_COLORS, BODIES, HAIRS, defaultConfig, type CharacterConfig,
} from '@/lib/characters'
import CharacterPreview from '@/components/CharacterPreview'

/** Cross-component flag (no per-frame state) for "open the editor from the pause menu". */
export const creatorControl = { open: () => {} }

function Swatch({ colors, value, onChange }: { colors: string[]; value: number; onChange: (i: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {colors.map((c, i) => (
        <button key={c + i} onClick={() => onChange(i)}
          className={`h-7 w-7 rounded-full border-2 transition ${i === value ? 'border-[#ffd23f] scale-110' : 'border-black/20'}`}
          style={{ background: c }} />
      ))}
    </div>
  )
}

function Stepper({ label, value, count, onChange }: { label: string; value: number; count: number; onChange: (i: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-semibold">{label}</span>
      <div className="flex items-center gap-2">
        <button onClick={() => onChange((value - 1 + count) % count)} className="h-7 w-7 rounded-full border-2 border-[#8e0c20]/40 font-bold">‹</button>
        <span className="w-8 text-center tabular-nums">{value + 1}/{count}</span>
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
            <Stepper label="Body" value={draft.body} count={BODIES.length} onChange={(i) => set({ body: i })} />
            <Stepper label="Hair style" value={draft.hair} count={HAIRS.length} onChange={(i) => set({ hair: i })} />
            <div><div className="mb-1 text-sm font-semibold">Outfit</div><Swatch colors={OUTFIT_COLORS} value={draft.outfitColor} onChange={(i) => set({ outfitColor: i })} /></div>
            <div><div className="mb-1 text-sm font-semibold">Skin</div><Swatch colors={SKIN_TONES} value={draft.skin} onChange={(i) => set({ skin: i })} /></div>
            <div><div className="mb-1 text-sm font-semibold">Hair colour</div><Swatch colors={HAIR_COLORS} value={draft.hairColor} onChange={(i) => set({ hairColor: i })} /></div>
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

In `components/ui/HUD.tsx`: replace the import `import Onboarding from './Onboarding'` with `import CharacterCreator from './CharacterCreator'`, and replace the `<Onboarding />` element (line ~162) with `<CharacterCreator />`.

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

## Task 7: Swap the player avatar onto the new rig

**Files:**
- Modify: `components/Player/PlayerAvatar.tsx`

- [ ] **Step 1: Rebuild PlayerAvatar from the avatar config**

Replace the body of `components/Player/PlayerAvatar.tsx` with the version below. It keeps the existing behavior (third-person only, hidden on rides, walk clip sped up by speed, faces velocity) but builds from `useAvatarStore` config on the new pack and rebuilds when `rev` changes:

```tsx
'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import { useGameStore } from '@/state/useGameStore'
import { useAvatarStore } from '@/state/useAvatarStore'
import { buildCharacter, CHARACTER_ASSET } from '@/lib/characters'
import { look, playerRig } from '@/lib/refs'

/**
 * Third-person body built from the player's saved CharacterConfig on the shared
 * CC0 rig. Rebuilds when the avatar config revision changes. Visible only in
 * third person and never while a ride owns the camera.
 */
export default function PlayerAvatar() {
  const { scene, animations } = useGLTF(CHARACTER_ASSET.url)
  const config = useAvatarStore((s) => s.config)
  const rev = useAvatarStore((s) => s.rev)
  const built = useMemo(() => buildCharacter(scene, config), [scene, config, rev])
  const group = useRef<THREE.Group>(null)
  const { actions } = useAnimations(animations, group)
  const walk = useRef<THREE.AnimationAction | null>(null)

  useEffect(() => {
    const a = actions[CHARACTER_ASSET.clips.walk] ?? Object.values(actions)[0]
    if (a) { a.play(); walk.current = a }
  }, [actions, built])

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

useGLTF.preload(CHARACTER_ASSET.url)
```

> If Task 1's pack sits feet-at-origin at a different height than CesiumMan, adjust the `position={[0, -0.95, 0]}` offset so the feet meet the capsule base (verify in Step 3).

- [ ] **Step 2: Type-check**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Visual smoke**

Run `npm run dev`, enter the park, press `V` for third person. Expected: your chosen character appears, walks with movement, stands still when idle, faces travel direction. Tune the y-offset/scale if feet float or sink.

- [ ] **Step 4: Commit**

```bash
git add components/Player/PlayerAvatar.tsx
git commit -m "feat(characters): player avatar uses the customizable CC0 character"
```

---

## Task 8: Swap the crowd onto the new rig with variety

**Files:**
- Modify: `components/world/Crowd.tsx`

Only the model source + per-NPC build change. The steering, LOD, lingering, balloon prop, and quality-count logic stay exactly as they are.

- [ ] **Step 1: Repoint the model + build NPCs from randomConfig**

In `components/world/Crowd.tsx`:
1. Replace the import block for the model/tints with:
   ```ts
   import { buildCharacter, randomConfig, CHARACTER_ASSET } from '@/lib/characters'
   ```
   and remove the now-unused `BAZAAR` import and the local `CLOTH_TINTS` array.
2. Replace `const MODEL = '/models/CesiumMan.glb'` with `const MODEL = CHARACTER_ASSET.url`.
3. Inside the `npcs` `useMemo`, replace the per-clone clone+tint+scale block (the `SkeletonUtils.clone(scene)` through the material-tint `traverse`) with:
   ```ts
   const cfg = randomConfig(rnd)
   const root = buildCharacter(scene, cfg)
   const s = cfg.scale
   ```
   (Keep the balloon-prop block, the mixer/action setup, and the pushed `Npc` fields unchanged — `root` and `s` are now produced above.)
4. Replace `const action = mixer.clipAction(animations[0])` with:
   ```ts
   const clip = THREE.AnimationClip.findByName(animations, CHARACTER_ASSET.clips.walk) ?? animations[0]
   const action = mixer.clipAction(clip)
   ```

- [ ] **Step 2: Type-check**

Run: `npm run typecheck`
Expected: no errors (no remaining `CLOTH_TINTS`/`BAZAAR` references).

- [ ] **Step 3: Visual smoke**

Run `npm run dev`. Expected: the wandering crowd is now visibly varied humans (different bodies/outfits/skin/hair), still walking between waypoints with the walk cycle, far ones frozen by the LOD.

- [ ] **Step 4: Commit**

```bash
git add components/world/Crowd.tsx
git commit -m "feat(characters): wandering crowd is varied GTA-style humans"
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

Create `scripts/check-characters.js`, modeled on the existing `scripts/check-*.js` (reuse their Playwright boot/launch boilerplate — open the dev URL, wait for the canvas, drive keys). It must:
1. Capture the first-run CharacterCreator (`shot-creator.png`).
2. Click "Enter the Park", then press `V`, and capture third-person (`shot-hero.png`).
3. Capture a wide shot of the varied crowd (`shot-crowd-humans.png`).

```js
// Mirror an existing scripts/check-*.js for the launch/connect boilerplate, then:
//   await page.screenshot({ path: 'scripts/shot-creator.png' })
//   // click Enter the Park (button text), press 'v', wait, screenshot shot-hero.png
//   // walk to a crowded spot, screenshot shot-crowd-humans.png
```

- [ ] **Step 2: Run the full verification suite**

Run each and confirm:
- `npm test` → all unit tests PASS
- `npm run typecheck` → no errors
- `npm run build` → succeeds
- `node scripts/check-characters.js` (with dev server running) → produces the three screenshots; eyeball them for varied humans + the creator + a recognizable hero.

- [ ] **Step 3: Commit**

```bash
git add scripts/check-characters.js scripts/shot-creator.png scripts/shot-hero.png scripts/shot-crowd-humans.png
git commit -m "test(characters): screenshot check for creator + hero + varied crowd"
```

---

## Phase 1 Done — acceptance (from spec §5.5)

- [ ] First run shows the character creator; choosing + entering persists across reload.
- [ ] The crowd is visibly varied humans, not clones of one model.
- [ ] The player avatar matches the saved config in third person and photo mode.
- [ ] Frame rate at `high` quality is no worse than before (if the pack is heavier, lower the `high` crowd count in `Crowd.tsx` `COUNT_BY_Q` or add a mid LOD).
- [ ] `npm test`, `npm run typecheck`, and `npm run build` are all green.

Phases 2 (Purpose) and 3 (Boarding) get their own plans when we reach them.
```

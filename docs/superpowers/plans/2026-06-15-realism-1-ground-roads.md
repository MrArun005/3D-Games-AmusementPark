# Realism Chunk 1 — Ground, Roads & Rendering Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the flat procedural ground and paths with PBR-textured surfaces (normal + roughness relief), and install a rendering foundation (soft shadows + ambient occlusion) that every later chunk benefits from.

**Architecture:** A CC0 PBR texture set (albedo/normal/roughness) per surface lives under `public/textures/`. A `usePbrMaterial` hook (drei `useTexture`, which suspends under the existing `<Suspense>`) builds a tiling `MeshStandardMaterial` with correct color spaces. `Ground` and `Pathways` consume it. The renderer gets `PCFSoftShadowMap`; an SSAO pass (quality-gated) adds contact AO.

**Tech Stack:** R3F + drei `useTexture` + three `MeshStandardMaterial` + `@react-three/postprocessing` (SSAO).

**Spec:** [`docs/superpowers/specs/2026-06-15-park-realism-design.md`](../specs/2026-06-15-park-realism-design.md).

## File Structure

**Create:**
- `public/textures/grass/`, `public/textures/paving/`, `public/textures/dirt/` — CC0 PBR maps (Task 1)
- `scripts/fetch-texture.mjs` — downloads + unzips an ambientCG set into a target dir (Task 1)
- `lib/pbr.ts` — `PBR_SETS` descriptor + `usePbrMaterial` hook
- `scripts/check-realism.js` — before/after screenshot check

**Modify:**
- `components/world/Ground.tsx` — PBR grass material
- `components/world/Pathways.tsx` — PBR paving material + curbs
- `components/ParkCanvas.tsx` — soft shadows + SSAO pass (quality-gated)

---

## Task 1: PBR texture asset spike (CC0, ambientCG)

**Files:** Create `scripts/fetch-texture.mjs`; populate `public/textures/{grass,paving,dirt}/`.

ambientCG is CC0 with direct ZIP URLs, e.g. `https://ambientcg.com/get?file=Grass004_1K-JPG.zip`. Each ZIP contains `<Name>_1K_Color.jpg`, `<Name>_1K_NormalGL.jpg`, `<Name>_1K_Roughness.jpg` (+ others).

- [ ] **Step 1: Write the fetch helper** — `scripts/fetch-texture.mjs`:

```js
// Usage: node scripts/fetch-texture.mjs <ambientCG-file> <destDir>
// e.g.   node scripts/fetch-texture.mjs Grass004_1K-JPG.zip public/textures/grass
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'
const [file, dest] = process.argv.slice(2)
if (!file || !dest) { console.error('usage: fetch-texture.mjs <file.zip> <destDir>'); process.exit(1) }
mkdirSync(dest, { recursive: true })
const zip = `${dest}/_dl.zip`
execSync(`curl -L -o "${zip}" "https://ambientcg.com/get?file=${file}"`, { stdio: 'inherit' })
execSync(`unzip -o "${zip}" -d "${dest}"`, { stdio: 'inherit' })
rmSync(zip)
console.log('done:', dest)
```

- [ ] **Step 2: Fetch three sets** (pick natural-looking CC0 sets; names below are examples — confirm they download, else choose a sibling like `Grass001`/`PavingStones070`/`Ground054`):
```bash
node scripts/fetch-texture.mjs Grass004_1K-JPG.zip public/textures/grass
node scripts/fetch-texture.mjs PavingStones070_1K-JPG.zip public/textures/paving
node scripts/fetch-texture.mjs Ground054_1K-JPG.zip public/textures/dirt
```
If `ambientcg.com/get` is not directly fetchable, fall back to Poly Haven texture URLs; if neither works, report BLOCKED with what you tried (do NOT fabricate files).

- [ ] **Step 3: Record exact filenames** in each dir (the `_Color`, `_NormalGL`, `_Roughness` jpgs). These feed `PBR_SETS` in Task 2. Delete unused maps (displacement/metalness/AO) to keep the repo lean — keep only Color, NormalGL, Roughness.

- [ ] **Step 4: Commit**
```bash
git add scripts/fetch-texture.mjs public/textures
git commit -m "feat(realism): add CC0 PBR texture sets (grass/paving/dirt) + fetch helper"
```

**Gate:** if no CC0 PBR set could be downloaded directly, stop and report BLOCKED.

---

## Task 2: `usePbrMaterial` hook + PBR_SETS

**Files:** Create `lib/pbr.ts`.

- [ ] **Step 1: Implement** `lib/pbr.ts` (fill the filenames from Task 1 Step 3):

```ts
import { useMemo } from 'react'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'

export interface PbrSet { dir: string; color: string; normal: string; rough: string }

/** Filenames are the exact ones downloaded in Realism Task 1. */
export const PBR_SETS: Record<'grass' | 'paving' | 'dirt', PbrSet> = {
  grass:  { dir: '/textures/grass',  color: '<Grass_Color>.jpg',  normal: '<Grass_NormalGL>.jpg',  rough: '<Grass_Roughness>.jpg' },
  paving: { dir: '/textures/paving', color: '<Paving_Color>.jpg', normal: '<Paving_NormalGL>.jpg', rough: '<Paving_Roughness>.jpg' },
  dirt:   { dir: '/textures/dirt',   color: '<Dirt_Color>.jpg',   normal: '<Dirt_NormalGL>.jpg',   rough: '<Dirt_Roughness>.jpg' },
}

/**
 * Build a tiling PBR MeshStandardMaterial from a CC0 set. Albedo is sRGB; the
 * normal/roughness data maps stay linear. Textures are cloned per-call so the
 * `repeat` of one surface never mutates another sharing the same files.
 */
export function usePbrMaterial(
  set: PbrSet,
  repeat: [number, number],
  extra?: THREE.MeshStandardMaterialParameters,
): THREE.MeshStandardMaterial {
  const [map, normalMap, roughnessMap] = useTexture([
    `${set.dir}/${set.color}`, `${set.dir}/${set.normal}`, `${set.dir}/${set.rough}`,
  ])
  return useMemo(() => {
    const m = map.clone(), n = normalMap.clone(), r = roughnessMap.clone()
    for (const t of [m, n, r]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(repeat[0], repeat[1])
      t.anisotropy = 8
      t.needsUpdate = true
    }
    m.colorSpace = THREE.SRGBColorSpace
    return new THREE.MeshStandardMaterial({ map: m, normalMap: n, roughnessMap: r, ...extra })
  }, [map, normalMap, roughnessMap, repeat, extra])
}
```

- [ ] **Step 2: Type-check** — `npm run typecheck` clean. **Tests** — `npm test` still 7 PASS.
- [ ] **Step 3: Commit**
```bash
git add lib/pbr.ts
git commit -m "feat(realism): usePbrMaterial hook + PBR_SETS descriptor"
```

---

## Task 3: Rendering foundation (soft shadows + SSAO)

**Files:** Modify `components/ParkCanvas.tsx`.

- [ ] **Step 1: Soft shadows** — in the `<Canvas onCreated={({ gl }) => {...}}>` callback, after the existing `playerRig.canvas = gl.domElement`, add:
```ts
gl.shadowMap.type = THREE.PCFSoftShadowMap
```
Add `import * as THREE from 'three'` if not present.

- [ ] **Step 2: SSAO in PostFX** — extend the existing `PostFX` component so AO runs on `medium` + `high` (bloom stays `high`-only). Replace `PostFX` with:
```tsx
function PostFX() {
  const quality = useGameStore((s) => s.quality)
  if (quality === 'low') return null
  return (
    <EffectComposer enableNormalPass>
      <SSAO intensity={18} radius={0.12} luminanceInfluence={0.5} color="black" />
      {quality === 'high' ? <Bloom mipmapBlur intensity={0.8} luminanceThreshold={1.05} /> : <></>}
    </EffectComposer>
  )
}
```
Add `SSAO` to the existing `@react-three/postprocessing` import. If `SSAO` requires props/types that differ in the installed version, adjust to that version's API but keep an AO effect on medium+high.

- [ ] **Step 2b:** If `enableNormalPass`/`SSAO` is unavailable in the installed `@react-three/postprocessing`, install the `n8ao` package (`npm i n8ao --legacy-peer-deps`) and use `<N8AO />` instead. Report which path you took.

- [ ] **Step 3: Verify** — `npm run typecheck` clean; `npm run build` succeeds.
- [ ] **Step 4: Commit**
```bash
git add components/ParkCanvas.tsx package.json package-lock.json
git commit -m "feat(realism): soft shadows + SSAO foundation (quality-gated)"
```

---

## Task 4: PBR ground

**Files:** Modify `components/world/Ground.tsx`.

- [ ] **Step 1:** Replace the grass mesh material. Keep the collider and `circleGeometry`. New body:
```tsx
'use client'

import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { usePbrMaterial, PBR_SETS } from '@/lib/pbr'

export default function Ground() {
  const grass = usePbrMaterial(PBR_SETS.grass, [40, 40], { roughness: 1 })
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[70, 0.5, 70]} position={[0, -0.5, 0]} />
      <mesh rotation-x={-Math.PI / 2} receiveShadow material={grass}>
        <circleGeometry args={[64, 48]} />
      </mesh>
    </RigidBody>
  )
}
```
(`makeGrassTexture` import is removed here; leave the function in `lib/textures.ts` — other code may use it.)

- [ ] **Step 2:** `npm run typecheck` clean; `npm run build` succeeds.
- [ ] **Step 3: Visual smoke** (`npm run dev`): grass shows surface relief under the sun (visible normal-map shading), tiling not obviously repetitive. Adjust the `[40,40]` repeat if blades look too large/small.
- [ ] **Step 4: Commit**
```bash
git add components/world/Ground.tsx
git commit -m "feat(realism): PBR grass terrain"
```

---

## Task 5: PBR paths + curbs

**Files:** Modify `components/world/Pathways.tsx`.

- [ ] **Step 1:** Swap the three flat path materials (plaza disc, ring, strips) to the PBR paving material. Keep all geometry, positions, Y-offsets, the strip layout `useMemo`, and the red-brick edging Instances. Concretely:
  1. Add import: `import { usePbrMaterial, PBR_SETS } from '@/lib/pbr'`. Remove the `makeCobbleTexture` import and the `plazaTex/ringTex/stripMats` texture `useMemo` block.
  2. Build three materials with appropriately scaled repeats (paving stones ~1.2 m): plaza `usePbrMaterial(PBR_SETS.paving, [10,10])`; ring `usePbrMaterial(PBR_SETS.paving, [24,2])`; and for strips, since each strip has its own length, use ONE shared paving material `const pathMat = usePbrMaterial(PBR_SETS.paving, [1,1])` and set per-strip repeat by cloning is unnecessary — instead apply the shared material and accept uniform tiling (simpler; relief still reads). Assign `material={plazaMat}` / `material={ringMat}` / `material={pathMat}` to the meshes.
  3. Keep the red-brick edging exactly as-is.
- [ ] **Step 2: Curbs** — add a thin raised paving-colored border ring around the plaza disc for a "real path edge" read:
```tsx
<mesh rotation-x={-Math.PI / 2} position={[0, 0.05, 0]} receiveShadow castShadow>
  <ringGeometry args={[11.7, 12.2, 48]} />
  <meshStandardMaterial color="#9a948a" roughness={1} />
</mesh>
```
- [ ] **Step 3:** `npm run typecheck` clean; `npm run build` succeeds.
- [ ] **Step 4: Visual smoke**: paths show stone relief; plaza/ring tiling looks plausible; curb reads as a raised edge.
- [ ] **Step 5: Commit**
```bash
git add components/world/Pathways.tsx
git commit -m "feat(realism): PBR paved paths + plaza curb"
```

---

## Task 6: Screenshot check + verification

**Files:** Create `scripts/check-realism.js`.

- [ ] **Step 1:** Model on an existing `scripts/check-*.js`. Against a running dev server (http://localhost:3000): clear localStorage so onboarding can be skipped/entered, enter the park, then capture a wide daytime shot of ground+paths → `scripts/shot-realism-ground.png`, and an overhead/plaza shot → `scripts/shot-realism-plaza.png`. Robust if modal absent. Do not commit PNGs.
- [ ] **Step 2: Gates** — `npm test` (7 PASS), `npm run typecheck` (clean), `npm run build` (succeeds). If a dev server is already running, run the check; otherwise leave capture to the human.
- [ ] **Step 3: Commit**
```bash
git add scripts/check-realism.js
git commit -m "test(realism): ground/paths screenshot check"
```

---

## Chunk 1 acceptance

- [ ] Ground and paths visibly catch light with surface relief (normal maps working), not flat color.
- [ ] Soft shadows + contact AO ground the objects (on medium/high); `low` unchanged/cheap.
- [ ] `npm test`, `npm run typecheck`, `npm run build` green.
- [ ] No frame-rate regression at `high` (1K textures, shared materials).

Chunks 2–5 (lighting/atmosphere, structure materials, detail/vegetation, water/finishing) get their own plans next.

# Park Realism Pass — Design Spec

**Status:** Auto-decided (user directive: "make auto decisions… drag as much as possible to human reality about all the amusement park components, from the roads to every object") · 2026-06-15
**Project:** Fableland (3D-Games-AmusementPark)

## Goal

Raise the whole park from flat-colored procedural shapes toward believable, "human-reality" fidelity — ground, roads, structures, props, lighting, water — while keeping it a smooth browser experience.

## Honest scope boundary

Browser WebGL with a live crowd cannot do film-CGI. The realistic, achievable target is **PBR (physically-based rendering) realism**: textured surfaces with normal + roughness + ambient-occlusion maps, soft shadows, ambient occlusion, filmic tone-mapping, and denser detail. That is a large believability jump from today's flat single-color materials and relief-less canvas textures.

## Current state (verified by code)

- **Ground:** one `circleGeometry` with a procedural canvas grass texture, `roughness=1`, no normal map. ([`components/world/Ground.tsx`](../../components/world/Ground.tsx))
- **Roads/paths:** flat plaza disc + ring + radial boxes with a procedural cobble canvas texture, no relief. ([`components/world/Pathways.tsx`](../../components/world/Pathways.tsx))
- **Textures:** all painted at runtime in [`lib/textures.ts`](../../lib/textures.ts) — albedo only, no normal/roughness/AO. This is the core reason surfaces look flat.
- **Lighting:** sun + hemisphere + ambient + dusk fog + 2048 shadow map; decent but no AO, no tone-mapping; bloom only on `high`. ([`components/world/Lighting.tsx`](../../components/world/Lighting.tsx), [`components/ParkCanvas.tsx`](../../components/ParkCanvas.tsx))
- **Structures/props:** solid-color `meshStandardMaterial` boxes/cones (rides, stalls, fences, tents).

## Asset strategy

Same no-account, CC0, direct-download approach that worked for characters. Primary source **ambientCG** (CC0, direct ZIP URLs like `https://ambientcg.com/get?file=Grass004_1K-JPG.zip`) and Poly Haven (CC0) as backup. PBR sets stored under `public/textures/<name>/` with `albedo`, `normal`, `roughness`, and `ao` maps. A spike verifies a direct URL works before downstream wiring (as with characters). Fallback if direct download fails: improve the procedural canvas textures and synthesize normal maps from them in code.

## Rendering foundation (applied once, benefits everything)

- **Tone mapping:** `ACESFilmicToneMapping` + `outputColorSpace = SRGB` on the renderer for a photographic response curve.
- **Soft shadows:** `PCFSoftShadowMap`.
- **Ambient occlusion:** add `N8AO` or postprocessing `SSAO` (on `medium`/`high`) so contact shadows ground objects.
- **Correct color space** on all albedo textures (SRGB) vs data maps (linear) — a common realism bug.
- All gated by the existing `quality` setting; `low` stays cheap.

## Chunks (impact order — each is its own plan, built + smoke-tested before the next)

1. **Ground & roads (PBR) + rendering foundation** — textured grass terrain with normal/roughness/AO, real paved/cobble paths with relief and curbs, tone-mapping + soft shadows + AO. A reusable `loadPbrMaterial` helper. *(Highest visible impact; this plan: [`2026-06-15-realism-1-ground-roads.md`](../plans/2026-06-15-realism-1-ground-roads.md).)*
2. **Lighting & atmosphere** — softer/warmer key light, sky/fog depth, evening glow, calibrated bloom, subtle exposure shifts across the day cycle.
3. **Structure materials** — PBR metal/wood/fabric/painted-steel on rides, stalls, fences, tents, gate; replace solid colors with material maps.
4. **Detail & vegetation** — denser varied trees/plants, benches, bins, signage, cables, ground litter/decals; breaks up empty space.
5. **Water & finishing** — realistic fountain water (flow/refraction-ish), reflections where cheap, final SSAO/tone-mapping calibration.

## Constraints carried from the codebase

- **No per-frame React.** Textures/materials created once in `useMemo`; nothing per-frame in render.
- **Quality-aware.** Heavy effects (AO, high-res textures, bloom) scale with `quality`; `low` must stay light.
- **Reversible & additive.** Each chunk swaps materials/adds maps behind the existing structure; no rewrite of geometry/gameplay.
- **Performance bar.** Frame rate at `high` must not regress meaningfully; 1K textures (not 4K), shared materials, mipmaps + anisotropy.

## Verification

Per chunk: `npm run build` + `npm run typecheck` green, and a `scripts/check-*.js` screenshot for before/after eyeballing. Visual sign-off by the user (this is subjective fidelity work).

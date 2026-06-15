# Godot Vertical Slice — Design Spec

**Status:** Approved direction (2026-06-15) — "Go Godot, I'll install it."
**Project:** Fableland → Godot rebuild (engine move, "beyond the browser")

## Why this exists

The browser (Three.js/R3F) version is a complete, playable reference but is capped at browser fidelity. We're moving to **Godot 4.x** for the higher ceiling. Rather than rewrite all 14 modules blind, this slice **proves the path** with the smallest runnable thing, and answers three questions before we commit weeks:

1. **Workflow** — does "Claude authors text files, Arun drives the Godot editor" actually work for us?
2. **Fidelity** — is the visual/feel jump over the browser real and worth it?
3. **Tooling** — is Godot installed and the open→play loop smooth?

If yes → commit to the full rebuild. If no → we've spent one slice, not weeks.

## What this is NOT (non-goals for the slice)
- No NPCs, crowds, queues, or boarding.
- No other rides, stalls, shops, mini-games, HUD, day/night cycle, or character creator.
- No pushable props or full physics tuning.
- No web/native *export* yet (just run from the editor).
Those follow only if the slice validates the move.

## Locked decisions
1. **Godot 4.x**, **GDScript** (no C#/.NET toolchain — instant run, native idioms, most text-authorable).
2. **Scenes built in GDScript code**, not hand-authored `.tscn`. Godot's `.tscn` text format relies on fragile auto-generated UIDs that are error-prone to write without the editor; constructing the node tree in `_ready()` is robust for Claude-without-the-editor and equally runnable. The one exception is a trivial root `Main.tscn` (a single Node3D with `Main.gd` attached) so Godot has a main scene to launch.
3. **Reuse existing assets.** Copy the civilian character GLB, the HDRI, and the grass PBR textures from the browser project's `public/` into the Godot project's `assets/`. Godot imports GLB/GLTF, `.hdr`, and JPG natively.
4. **Arun drives the editor** (install Godot, open project, press Play, import/move a file when directed); Claude authors all `project.godot` / scenes / scripts and guides each step.

## Project location & structure

A new top-level `godot/` folder in this repo (kept beside the browser app; the browser version stays intact):

```
godot/
  project.godot            # Godot 4.x project config: name, main scene, renderer, input map
  scenes/Main.tscn         # trivial root: one Node3D with Main.gd attached
  scripts/Main.gd          # builds the world in _ready(): environment, light, ground, ferris, player
  scripts/Player.gd        # first/third-person CharacterBody3D controller
  scripts/FerrisWheel.gd   # continuously-spinning wheel + upright gondolas
  assets/characters/*.glb  # copied from browser public/models/characters
  assets/hdri/*.hdr        # copied from public/hdri
  assets/textures/grass/*  # copied from public/textures/grass
  README.md                # how to open + run (for Arun)
```

## Slice contents

### 1. World & environment (`Main.gd`)
- A `WorldEnvironment` with a `Sky` whose material is a `PanoramaSkyMaterial` using the HDRI → gives image-based lighting + a real sky backdrop (the Godot equivalent of our R3F `<Environment>`). Set ambient/reflected light to use the sky.
- A `DirectionalLight3D` as the sun, shadows enabled (PCF soft), warm-ish daytime angle.
- Renderer: **Forward+** (set in `project.godot`) for the better lighting/material pipeline.
- `_ready()` instantiates the ground, the Ferris wheel, and the player, and positions a default camera until the player camera takes over.

### 2. Ground (`Main.gd`)
- A large `MeshInstance3D` (PlaneMesh ~140×140) with a `StandardMaterial3D`: albedo = grass color map, normal map, roughness map (our PBR set), UV-tiled ~40×.
- A `StaticBody3D` + `CollisionShape3D` (WorldBoundaryShape3D or a thin box) so the player stands on it.

### 3. Player controller (`Player.gd`)
- `CharacterBody3D` with a `CapsuleCollider` (~1.8 m), gravity, `move_and_slide()`.
- WASD movement in the camera-yaw frame; **Space** = jump (grounded check via `is_on_floor()`); **Shift** = sprint.
- Mouse-look: capture the mouse (`Input.MOUSE_MODE_CAPTURED`), yaw on the body, pitch on a `SpringArm3D`/camera pivot, pitch clamped; **Esc** releases the mouse.
- Third-person: the civilian GLB loaded (`load("res://assets/characters/civilian_man.glb").instantiate()`) as a child, scaled to ~1.7 m, with its walk/idle animation played via the GLB's `AnimationPlayer` (the same clips we used in the browser). **V** toggles first/third person. (If wiring the GLB animation proves fiddly in the slice, a capsule placeholder is an acceptable fallback — the controller feel is what we're validating.)
- Input map defined in `project.godot` (move_forward/back/left/right, jump, sprint, toggle_view).

### 4. Ferris wheel (`FerrisWheel.gd`)
- A hub `Node3D` that rotates continuously around its Z (or X) axis at a slow constant rate.
- 8 gondola `Node3D`s placed around the rim radius; each frame each gondola counter-rotates by `-hub.rotation` so it stays upright (mirrors the browser logic).
- Simple procedural geometry (cylinders/boxes/spheres via `BoxMesh`/`CylinderMesh`/`SphereMesh` in code) with `StandardMaterial3D` colors — a recognizable wheel, not the fully-detailed browser model. Positioned off to one side so the player can walk up to it.

## Asset pipeline
- Copy (not move) from the browser project into `godot/assets/`:
  - `public/models/characters/civilian_man.glb` (+ maybe 1–2 others) → `assets/characters/`
  - `public/hdri/kloofendal_48d_partly_cloudy_puresky_1k.hdr` → `assets/hdri/`
  - `public/textures/grass/Grass004_1K-JPG_*.jpg` → `assets/textures/grass/`
- On first open, Godot generates `.import` files for these automatically (Arun just opens the project; no manual import needed for GLB/HDR/JPG).

## Workflow & how Arun runs it
1. Install Godot 4.x (godotengine.org, ~100 MB, no account).
2. Open Godot → "Import" → select `godot/project.godot` → open. Godot imports the assets (a few seconds).
3. Press **▶ (Play)**. The game window opens: walk with WASD + mouse, jump, sprint, toggle view with V, and see the Ferris wheel turning under the HDRI sky on PBR grass.
4. Report back how it looks/feels; we iterate via more script edits.

## Acceptance criteria
- [ ] `godot/project.godot` opens in Godot 4.x without errors; assets import cleanly.
- [ ] Pressing Play gives a walkable scene: WASD + mouse-look + jump + sprint, no falling through the ground.
- [ ] The Ferris wheel turns continuously with upright gondolas.
- [ ] The HDRI sky + sun light the scene; the ground shows PBR grass relief.
- [ ] It's visibly a step up from / at least on par with the browser version's feel, enough to judge the move.

## Risks
| Risk | Mitigation |
|---|---|
| Claude can't run/see Godot | Arun runs Play + reports; scripts written carefully + conservatively; errors fed back verbatim for fix |
| GLB animation wiring fiddly without editor | Capsule placeholder fallback for the avatar; validate controller feel first, polish avatar after |
| `.tscn` UID fragility | Build scene in GDScript code; only a one-node root `.tscn` |
| Godot version drift (4.2 vs 4.3 API) | Arun reports his exact Godot version; scripts target stable 4.x APIs; fix any version-specific calls on report |

## After the slice
If it validates: a full rebuild plan, module by module, reusing the browser version as the behavior reference and these assets — its own spec → plans, same as the browser build.

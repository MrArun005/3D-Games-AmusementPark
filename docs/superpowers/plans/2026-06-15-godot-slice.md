# Godot Vertical Slice — Implementation Plan

> **For agentic workers:** Executed INLINE by Claude (authoring text files); verification is Arun pressing Play in Godot (no Godot CLI in Claude's env, so no automated gates). Steps use checkbox (`- [ ]`).

**Goal:** A runnable Godot 4.x project — walkable player + PBR-grass ground + HDRI sky + one turning Ferris wheel, reusing the browser project's assets — that proves the engine move.

**Architecture:** A `godot/` folder. `project.godot` sets the Forward+ renderer, the main scene, and the input map. `Main.tscn` is a one-node root running `Main.gd`, which builds the world (environment/sky, sun, ground, Ferris wheel, player) in code. `Player.gd` is a `CharacterBody3D` first/third-person controller; `FerrisWheel.gd` spins a hub with upright gondolas. Assets are copied from `public/`.

**Tech Stack:** Godot 4.x, GDScript, our existing GLB/HDRI/JPG assets.

**Spec:** [`docs/superpowers/specs/2026-06-15-godot-vertical-slice-design.md`](../specs/2026-06-15-godot-vertical-slice-design.md).

---

## File manifest (Claude authors all of these)

- `godot/project.godot` — Godot 4.x config: app name, `run/main_scene = Main.tscn`, `rendering/renderer = forward_plus`, mouse-capture, and the input map (`move_forward/back/left/right`, `jump`, `sprint`, `toggle_view`).
- `godot/scenes/Main.tscn` — minimal text scene: one `Node3D` named `Main` with `Main.gd` attached. (Only hand-authored `.tscn`; trivial enough to be safe.)
- `godot/scripts/Main.gd` — `_ready()` builds: `WorldEnvironment` (PanoramaSky from the HDRI + ambient/reflection from sky), `DirectionalLight3D` (sun + soft shadows), ground (`PlaneMesh` + `StandardMaterial3D` with grass albedo/normal/roughness, UV scale ~40, + `StaticBody3D`/`CollisionShape3D`), a `FerrisWheel` instance off to one side, and a `Player` instance at spawn.
- `godot/scripts/Player.gd` — `CharacterBody3D`: gravity + `move_and_slide`, WASD in yaw frame, jump on `is_on_floor`, sprint, mouse-look (captured mouse; yaw on body, pitch on a camera pivot, clamped), `Esc` releases mouse, `V` toggles first/third person. Loads the civilian GLB as the third-person body (capsule fallback if the GLB/anim wiring misbehaves).
- `godot/scripts/FerrisWheel.gd` — builds a hub + 8 gondolas (procedural meshes) in `_ready()`; `_process` spins the hub slowly and counter-rotates each gondola to stay upright.
- `godot/assets/...` — copied GLB (civilian_man, +1–2), HDRI, grass PBR jpgs.
- `godot/README.md` — open + run instructions for Arun.

## Build order (Claude, inline)
- [ ] **1. Confirm Arun's exact Godot version** (Project Manager title bar or Help→About, e.g. "4.3.stable") so scripts target the right API. Record it; fix any version-specific calls on report.
- [ ] **2. Copy assets** into `godot/assets/` (bash `cp` from `public/`).
- [ ] **3. Author `project.godot`** (config + input map + Forward+).
- [ ] **4. Author `Main.tscn`** (one-node root with `Main.gd`).
- [ ] **5. Author `FerrisWheel.gd`** (self-contained; easiest to reason about first).
- [ ] **6. Author `Player.gd`** (controller).
- [ ] **7. Author `Main.gd`** (wires world + ground + sun/sky + instances Player & FerrisWheel).
- [ ] **8. Author `godot/README.md`** (run steps).
- [ ] **9. Commit** the `godot/` folder.
- [ ] **10. Hand Arun the open+Play steps;** collect his report (errors verbatim / how it looks); iterate.

## Arun's run + acceptance checklist
- [ ] Godot 4.x → Import → `godot/project.godot` → Open; assets import without red errors.
- [ ] Press ▶: a window opens to a lit scene (HDRI sky, sun, grass ground).
- [ ] WASD walks, mouse looks, Space jumps, Shift sprints, V toggles view; no falling through the floor; Esc frees the mouse.
- [ ] The Ferris wheel turns continuously with upright gondolas.
- [ ] Report: any console errors (paste verbatim) + a sentence on how it looks/feels vs the browser.

## Notes / risks
- Claude cannot run Godot here — all GDScript is authored conservatively against stable Godot 4.x APIs; **the first Play is the test.** Errors get pasted back and fixed fast.
- If the GLB third-person avatar is troublesome, ship the slice with a capsule avatar and wire the GLB after — the controller feel + fidelity are what the slice validates.
- This is additive: it lives in `godot/`, the browser app is untouched.

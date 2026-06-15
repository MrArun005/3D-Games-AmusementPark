# Fableland — Godot 4.x vertical slice

The first piece of the "beyond the browser" rebuild. Proves the engine move with
a walkable scene + one Ferris wheel, reusing the browser project's assets.

## How to open & run

1. Open **Godot 4.x**.
2. In the Project Manager: **Import** → browse to this `godot/` folder → select
   **`project.godot`** → **Import & Edit**. Godot imports the assets (GLB, HDRI,
   textures) automatically — give it a few seconds the first time.
3. Press **▶ (Play)** at the top-right, or **F5**.

## Controls

| Input | Action |
| --- | --- |
| **WASD** | Move |
| **Mouse** | Look |
| **Shift** | Sprint |
| **Space** | Jump |
| **V** | Toggle first / third person |
| **Esc** | Release the mouse (click the window to re-capture) |

## What you should see

A grass field (PBR-textured) under an HDRI sky with a sun + shadows, and a
Ferris wheel turning off to your left, its gondolas staying upright. Walk up to
it. Press **V** to see your character (the civilian model from the browser build).

## If something's wrong

Copy the **exact** error text from Godot's bottom **Output** / **Debugger**
panel and send it back — these scripts were written without a Godot install to
test against, so the first run is the real test. Also tell me your exact Godot
version (**Help → About**, e.g. `4.3.stable`) so I can match the API.

## What this is (and isn't)

This is a *slice* — player + ground + sky + one ride. No crowds, queues,
other rides, HUD, or menus yet. Those come once this proves the move is worth it.
The browser version in this repo stays the working reference.

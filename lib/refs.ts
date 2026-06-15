import type { RapierRigidBody } from '@react-three/rapier'

/** Imperative cross-component handles. Mutated freely — never drives React renders. */
export const playerRig: { body: RapierRigidBody | null; canvas: HTMLCanvasElement | null } = {
  body: null,
  canvas: null,
}

/** Mouse-look state, written by Player, read by the minimap and camera code. */
export const look = { yaw: 0, pitch: 0 }

/** Free-look offset while riding (drag the mouse): applied on top of the ride camera. */
export const rideLook = { yaw: 0, pitch: 0 }

/** Fed by the roller coaster every frame so the audio engine can rattle. */
export const coasterTelemetry = { speed: 0, x: 32, y: 2, z: -8 }

export function requestPointerLock(): void {
  playerRig.canvas?.requestPointerLock()
}

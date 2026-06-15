'use client'

import { useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useGameStore, type RidePhase } from '@/state/useGameStore'
import { playerRig, rideLook } from '@/lib/refs'
import { useFestival } from '@/lib/festival'
import { useRideOccupancy, RIDE_SEATS } from '@/lib/rideOccupancy'
import { makeStripesTexture, makeTextTexture } from '@/lib/textures'
import { PALETTE } from '@/lib/palette'
import type { RideSpec } from '@/lib/spawn'

export const BOARD_TIME = 2.2
export const UNLOAD_TIME = 1.8

const _camM = new THREE.Matrix4()
const _qBase = new THREE.Quaternion()
const _qYaw = new THREE.Quaternion()
const _qPitch = new THREE.Quaternion()
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const X_AXIS = new THREE.Vector3(1, 0, 0)
const Z_AXIS = new THREE.Vector3(0, 0, 1)
const _qRoll = new THREE.Quaternion()

/**
 * Shared ride camera: moves to `pos` (hard-locked or eased), frames `target`,
 * then applies the player's drag-to-look offsets in camera-local space — so
 * every ride supports a full 360° look-around while the base view still
 * follows the ride's motion.
 *
 * The optional `g` parameter feeds in ride-force cues — a small camera roll
 * (lean), an FOV nudge and a tiny positional jitter — so the player FEELS the
 * ride's motion without the seated body ever being physically flung. Every cue
 * is deliberately subtle (this path is nausea-sensitive). The FOV nudge is
 * absolute against a 75° base and self-heals: the player controller eases the
 * perspective FOV back toward 75 the moment walking resumes after the ride.
 */
export function applyRideCamera(
  camera: THREE.Camera,
  pos: THREE.Vector3,
  target: THREE.Vector3,
  dt: number,
  hard = false,
  g?: { roll?: number; fov?: number; shake?: number }
): void {
  if (hard) camera.position.copy(pos)
  else camera.position.lerp(pos, 1 - Math.pow(0.0001, dt))
  _camM.lookAt(camera.position, target, Y_AXIS)
  _qBase.setFromRotationMatrix(_camM)
  _qYaw.setFromAxisAngle(Y_AXIS, rideLook.yaw)
  _qPitch.setFromAxisAngle(X_AXIS, rideLook.pitch)
  camera.quaternion.copy(_qBase).multiply(_qYaw).multiply(_qPitch)

  if (g) {
    if (g.roll) {
      _qRoll.setFromAxisAngle(Z_AXIS, g.roll)
      camera.quaternion.multiply(_qRoll)
    }
    if (g.shake) {
      // Time-free deterministic jitter keyed off the live position — no RNG,
      // so it stays frame-rate stable and replays identically.
      camera.position.x += Math.sin(pos.y * 53.1) * g.shake
      camera.position.y += Math.sin(pos.y * 71.7) * g.shake
    }
    const cam = camera as THREE.PerspectiveCamera
    if (cam.isPerspectiveCamera) {
      const targetFov = 75 + (g.fov ?? 0)
      cam.fov += (targetFov - cam.fov) * (1 - Math.pow(0.0001, dt * 4))
      cam.updateProjectionMatrix()
    }
  }
}


/**
 * Shared ride lifecycle: IDLE -> BOARDING -> RUNNING -> UNLOADING -> IDLE.
 * Rides animate off the returned refs (frame-rate data, no React state).
 * Unloading teleports the player back to the ride exit and restores control.
 */
export function useRideMachine(spec: RideSpec): {
  phase: RefObject<RidePhase>
  elapsed: RefObject<number>
} {
  const phase = useRef<RidePhase>('idle')
  const elapsed = useRef(0)

  useFrame((_, dt) => {
    const st = useGameStore.getState()
    if (st.paused) return
    elapsed.current += dt

    // Boarding-zone detection by plain math (physics sensor events proved
    // unreliable for the player body): is the player inside the trigger AABB?
    if (!st.activeRide) {
      const p = st.playerPos
      const inside =
        Math.abs(p.x - (spec.position[0] + spec.trigger.offset[0])) <= spec.trigger.half[0] &&
        Math.abs(p.z - (spec.position[2] + spec.trigger.offset[2])) <= spec.trigger.half[2] &&
        Math.abs(p.y - (spec.position[1] + spec.trigger.offset[1])) <= spec.trigger.half[1] + 1
      if (inside && st.nearbyRide !== spec.id) st.setNearbyRide(spec.id)
      else if (!inside && st.nearbyRide === spec.id) st.setNearbyRide(null)
    }

    switch (phase.current) {
      case 'idle':
        if (st.activeRide === spec.id) {
          phase.current = 'boarding'
          elapsed.current = 0
          // Fresh ride, fresh view: free-look starts centred on the ride's own framing.
          rideLook.yaw = 0
          rideLook.pitch = 0
          if (RIDE_SEATS[spec.id] !== undefined) {
            const occ = useRideOccupancy.getState()
            const n = RIDE_SEATS[spec.id]
            for (let s = 1; s < n; s++) {
              if (Math.random() < 0.7) occ.claimSeat(spec.id, 'company', s)
            }
          }
          st.setRidePhase('boarding')
        }
        break
      case 'boarding':
        if (elapsed.current >= BOARD_TIME) {
          phase.current = 'running'
          elapsed.current = 0
          st.setRidePhase('running')
        }
        break
      case 'running':
        if (elapsed.current >= spec.duration || st.exitRequested) {
          phase.current = 'unloading'
          elapsed.current = 0
          st.clearExit()
          st.setRidePhase('unloading')
        }
        break
      case 'unloading':
        if (elapsed.current >= UNLOAD_TIME) {
          phase.current = 'idle'
          if (RIDE_SEATS[spec.id] !== undefined) useRideOccupancy.getState().clearCompany(spec.id)
          elapsed.current = 0
          st.completeRide(spec.id)
          useFestival.getState().addScore(100 * spec.cost)
          st.setActiveRide(null)
          st.setRidePhase('idle')
          playerRig.body?.setTranslation({ x: spec.exit[0], y: spec.exit[1], z: spec.exit[2] }, true)
          playerRig.body?.setLinvel({ x: 0, y: 0, z: 0 }, true)
        }
        break
    }
  })
  return { phase, elapsed }
}

/**
 * Boarding sensor + a proper ticket counter: striped podium, ride-name board
 * and a "PRESS E" price plate, all rotated to face the plaza approach.
 * Standing anywhere in the (generous) sensor arms the HUD prompt.
 */
export function RideTrigger({ spec }: { spec: RideSpec }) {
  const nameTex = useMemo(() => makeTextTexture(spec.name), [spec])
  const priceTex = useMemo(
    () => makeTextTexture(`${spec.cost} TICKETS · PRESS E`, '#8e0c20', '#ffd23f'),
    [spec]
  )
  const stripes = useMemo(() => makeStripesTexture(PALETTE.red, PALETTE.cream, 10), [])
  const { offset } = spec.trigger
  // Face the counter toward the plaza: +Z of the stand points at the world origin.
  const yaw = useMemo(() => {
    const wx = spec.position[0] + offset[0]
    const wz = spec.position[2] + offset[2]
    return Math.atan2(-wx, -wz)
  }, [spec, offset])

  return (
    <group position={spec.position}>
      <group position={[offset[0], 0, offset[2]]} rotation-y={yaw}>
        {/* striped ticket-counter podium — big enough to walk right up to */}
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[1.35, 0.55, 0.45]} position={[0, 0.55, 0]} />
        </RigidBody>
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[2.7, 1.1, 0.85]} />
          <meshStandardMaterial map={stripes} />
        </mesh>
        <mesh position={[0, 1.13, 0]}>
          <boxGeometry args={[2.9, 0.08, 1.0]} />
          <meshStandardMaterial color={PALETTE.wood} />
        </mesh>
        <mesh position={[0, 1.13, 0.51]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.04, 0.04, 2.9, 8]} />
          <meshStandardMaterial color={PALETTE.gold} metalness={0.6} roughness={0.3} />
        </mesh>

        {/* sign posts + boards (billboard-sized, readable from the path) */}
        {[-1.7, 1.7].map((x) => (
          <mesh key={x} position={[x, 2.2, -0.3]} castShadow>
            <cylinderGeometry args={[0.07, 0.09, 4.4, 8]} />
            <meshStandardMaterial color={PALETTE.navy} />
          </mesh>
        ))}
        <mesh position={[0, 3.85, -0.3]} castShadow>
          <planeGeometry args={[5, 1.25]} />
          <meshStandardMaterial map={nameTex} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 2.75, -0.3]}>
          <planeGeometry args={[4, 1]} />
          <meshStandardMaterial map={priceTex} side={THREE.DoubleSide} />
        </mesh>
        {[-1.7, 1.7].map((x) => (
          <mesh key={x} position={[x, 4.5, -0.3]}>
            <sphereGeometry args={[0.12, 10, 8]} />
            <meshStandardMaterial color={PALETTE.gold} metalness={0.6} roughness={0.3} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

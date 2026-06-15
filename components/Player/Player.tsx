'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { CapsuleCollider, RigidBody, useRapier, type RapierRigidBody } from '@react-three/rapier'
import { useGameStore } from '@/state/useGameStore'
import { look, playerRig, rideLook } from '@/lib/refs'
import { PLAYER_SPAWN } from '@/lib/spawn'
import { keys, readGamepad } from './useControls'
import PlayerAvatar from './PlayerAvatar'
import { Suspense } from 'react'

const WALK = 4.5
const SPRINT = 8
const JUMP_VELOCITY = 6.6
/** Exponential-approach rates: ~full speed in 0.25 s on the ground, slightly slower mid-air. */
const GROUND_ACCEL = 5
const AIR_ACCEL = 2.5
/** Stronger decel when there's no input on the ground, so stopping feels crisp. */
const STOP_FRICTION = 11
/** Jump grace: still jump just after leaving an edge / if pressed just before landing. */
const COYOTE = 0.12
const JUMP_BUFFER = 0.12
/** Camera FOV — base and the sprint kick it lerps toward while sprinting. */
const FOV_BASE = 75
const FOV_SPRINT = 82
const _fwd = new THREE.Vector3()
const _right = new THREE.Vector3()
const _move = new THREE.Vector3()
const _camTarget = new THREE.Vector3()
const _linvel = { x: 0, y: 0, z: 0 }

/**
 * Rapier capsule character: WASD/stick movement in the yaw frame, jump via a
 * short downward ray (grounded check), first- or third-person camera with a
 * subtle head-bob. While a ride is active the ride owns the camera and the
 * capsule is parked in place.
 */
export default function Player() {
  const body = useRef<RapierRigidBody>(null)
  const { camera, gl } = useThree()
  const { world, rapier } = useRapier()
  const groundRay = useRef<InstanceType<typeof rapier.Ray> | null>(null)
  const bobPhase = useRef(0)
  // Game-feel state (mutated per frame, never React state).
  const lastGrounded = useRef(-99) // clock time we were last on the ground (coyote)
  const jumpBufferedAt = useRef(-99) // clock time the jump key was last pressed (buffer)
  const jumpHeldPrev = useRef(false) // for press-edge detection (no auto-bhop on hold)
  const wasGrounded = useRef(true) // to detect the landing frame
  const landDip = useRef(0) // transient camera dip on landing, decays to 0

  // The userData PROP doesn't reliably reach the raw rapier body, and ride
  // sensors identify the player by it — set it imperatively too.
  useEffect(() => {
    if (body.current) body.current.userData = { tag: 'player' }
  }, [])

  useEffect(() => {
    const canvas = gl.domElement
    playerRig.canvas = canvas
    const onClick = () => {
      const st = useGameStore.getState()
      if (!st.paused && !st.activeRide && !st.activeStall && !st.shopMenu && !st.photoMode && document.pointerLockElement !== canvas) {
        canvas.requestPointerLock()
      }
    }
    let dragging = false
    const onDown = (e: MouseEvent) => {
      if (e.target === canvas && useGameStore.getState().activeRide) dragging = true
    }
    const onUp = () => {
      dragging = false
    }
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement === canvas) {
        look.yaw -= e.movementX * 0.0022
        look.pitch = THREE.MathUtils.clamp(look.pitch - e.movementY * 0.0022, -1.45, 1.45)
      } else if (dragging && useGameStore.getState().activeRide) {
        // Riding: pointer stays unlocked (overlay buttons stay clickable), so a
        // mouse drag pans the free-look offset instead — full 360° around.
        rideLook.yaw -= e.movementX * 0.005
        rideLook.pitch = THREE.MathUtils.clamp(rideLook.pitch - e.movementY * 0.005, -1.35, 1.35)
      }
    }
    // Esc releases pointer lock -> treat as pause (unless a ride owns the camera).
    const onLockChange = () => {
      const st = useGameStore.getState()
      // releasing the pointer pauses — unless a ride/stall/shop deliberately freed it
      if (!document.pointerLockElement && !st.activeRide && !st.activeStall && !st.shopMenu && !st.photoMode && !st.paused) {
        st.setPaused(true)
      }
    }
    canvas.addEventListener('click', onClick)
    canvas.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    document.addEventListener('mousemove', onMove)
    document.addEventListener('pointerlockchange', onLockChange)
    return () => {
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('pointerlockchange', onLockChange)
    }
  }, [gl])

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const t = state.clock.elapsedTime
    const b = body.current
    if (!b) return
    playerRig.body = b
    const st = useGameStore.getState()
    const pos = b.translation()
    st.playerPos.x = pos.x
    st.playerPos.y = pos.y
    st.playerPos.z = pos.z

    if (st.activeRide || st.activeStall || st.shopMenu || st.photoMode) {
      // Parked while riding, playing a stall game, buying, or in photo mode.
      _linvel.x = 0
      _linvel.y = Math.min(0, b.linvel().y)
      _linvel.z = 0
      b.setLinvel(_linvel, true)
      return
    }
    const vel = b.linvel()
    if (st.paused) {
      _linvel.x = 0
      _linvel.y = vel.y
      _linvel.z = 0
      b.setLinvel(_linvel, true)
      return
    }

    let f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0)
    let r = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0)
    let sprint = !!keys.ShiftLeft || !!keys.ShiftRight
    let jump = !!keys.Space
    const gp = readGamepad()
    if (gp) {
      f -= gp.y
      r += gp.x
      sprint = sprint || gp.sprint
      jump = jump || gp.jump
    }

    // Buffer the jump on the press EDGE so holding Space doesn't auto-bounce.
    if (jump && !jumpHeldPrev.current) jumpBufferedAt.current = t
    jumpHeldPrev.current = jump

    // Yaw-relative movement basis (forward = -Z rotated by yaw around +Y).
    _fwd.set(-Math.sin(look.yaw), 0, -Math.cos(look.yaw))
    _right.set(Math.cos(look.yaw), 0, -Math.sin(look.yaw))
    _move.copy(_fwd).multiplyScalar(f).addScaledVector(_right, r)
    if (_move.lengthSq() > 1) _move.normalize()
    const speed = sprint ? SPRINT : WALK

    // Grounded = a short ray below the capsule hits something solid.
    // (Ray object is created once and its origin mutated — no per-frame allocs.)
    const ray = (groundRay.current ??= new rapier.Ray(
      { x: pos.x, y: pos.y, z: pos.z },
      { x: 0, y: -1, z: 0 }
    ))
    ray.origin.x = pos.x
    ray.origin.y = pos.y
    ray.origin.z = pos.z
    const grounded = world.castRay(ray, 1.1, true, undefined, undefined, undefined, b) !== null
    if (grounded) lastGrounded.current = t

    // Planar momentum: exponential approach to the desired velocity. Stopping
    // (no input on the ground) uses stronger friction so it feels crisp; mid-air
    // uses a gentler rate so jumps keep their launch momentum.
    const wantStop = grounded && _move.lengthSq() < 0.01
    const rate = grounded ? (wantStop ? STOP_FRICTION : GROUND_ACCEL) : AIR_ACCEL
    const approach = 1 - Math.pow(0.0001, dt * rate)
    _linvel.x = vel.x + (_move.x * speed - vel.x) * approach
    _linvel.z = vel.z + (_move.z * speed - vel.z) * approach

    // Jump with coyote time (just left an edge) + input buffer (pressed just before landing).
    const canJump = t - lastGrounded.current <= COYOTE
    const wantJump = t - jumpBufferedAt.current <= JUMP_BUFFER
    if (wantJump && canJump) {
      _linvel.y = JUMP_VELOCITY
      jumpBufferedAt.current = -99 // consume the buffered press
      lastGrounded.current = -99 // consume coyote so there's no double-jump
    } else {
      _linvel.y = vel.y
    }
    b.setLinvel(_linvel, true)

    // Landing dip: on the airborne->grounded frame, dip the camera by the impact speed.
    if (grounded && !wasGrounded.current) landDip.current = Math.min(0.3, Math.abs(vel.y) * 0.045)
    wasGrounded.current = grounded
    landDip.current *= Math.max(0, 1 - dt * 6) // decays toward 0 over ~0.25 s

    const moving = _move.lengthSq() > 0.01 && grounded
    bobPhase.current += dt * (moving ? speed * 1.8 : 0)
    const bob = moving ? Math.sin(bobPhase.current) * 0.045 : 0

    // Sprint FOV kick for a sense of speed (holds through sprint-jumps).
    const cam = camera as THREE.PerspectiveCamera
    const fastMoving = sprint && _move.lengthSq() > 0.01
    const targetFov = fastMoving ? FOV_SPRINT : FOV_BASE
    if (Math.abs(cam.fov - targetFov) > 0.05) {
      cam.fov += (targetFov - cam.fov) * (1 - Math.pow(0.0001, dt * 3))
      cam.updateProjectionMatrix()
    }

    if (st.view === 'first') {
      camera.position.set(pos.x, pos.y + 0.75 + bob - landDip.current, pos.z)
      camera.rotation.set(look.pitch, look.yaw, 0, 'YXZ')
    } else {
      _camTarget.set(pos.x - _fwd.x * 5.5, pos.y + 2.6, pos.z - _fwd.z * 5.5)
      camera.position.lerp(_camTarget, 1 - Math.pow(0.0001, dt))
      _camTarget.set(pos.x, pos.y + 1, pos.z)
      camera.lookAt(_camTarget)
    }
  })

  return (
    <RigidBody
      ref={body}
      colliders={false}
      enabledRotations={[false, false, false]}
      position={PLAYER_SPAWN}
      userData={{ tag: 'player' }}
      gravityScale={1.6}
      ccd
    >
      <CapsuleCollider args={[0.55, 0.35]} />
      <Suspense fallback={null}>
        <PlayerAvatar />
      </Suspense>
    </RigidBody>
  )
}

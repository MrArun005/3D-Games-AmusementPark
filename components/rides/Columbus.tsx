'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { RigidBody } from '@react-three/rapier'
import { RIDES } from '@/lib/spawn'
import { PALETTE, BAZAAR } from '@/lib/palette'
import { useGameStore, isNight } from '@/state/useGameStore'
import { useRideMachine, RideTrigger, applyRideCamera } from './RideBase'

const spec = RIDES.columbus
const PIVOT_Y = 9 // height of the swing axle
const ARM = 7 // pivot-to-deck length
const MAX_ANGLE = 1.15 // peak swing (~66°)
const _seat = new THREE.Vector3()
const _fwd = new THREE.Vector3()
const _target = new THREE.Vector3()

const smooth = (x: number) => x * x * (3 - 2 * x)

/**
 * Swing-ship amplitude envelope over the RUNNING timeline: ramp the peak angle
 * up over the first ~9 s, hold, then ramp down to rest by the end so it parks
 * level. The instantaneous angle is env(t) · sin(ω t).
 */
function envelope(t: number, dur: number): number {
  const up = 9
  const down = dur - 7
  if (t < up) return smooth(t / up)
  if (t > down) return smooth(Math.max(0, (dur - t) / (dur - down)))
  return 1
}

export default function Columbus() {
  const { phase, elapsed } = useRideMachine(spec)
  const swing = useRef<THREE.Group>(null)
  const seatRef = useRef<THREE.Group>(null)
  const trimMat = useRef<THREE.MeshStandardMaterial>(null)
  const camera = useThree((s) => s.camera)
  const prevAngle = useRef(0) // last swing angle, for angular-velocity cue

  // a row of seats slung under the hull
  const seats = useMemo(() => Array.from({ length: 5 }, (_, i) => -2 + i), [])

  useFrame((state, dt) => {
    const st = useGameStore.getState()
    const g = swing.current
    if (!g) return
    const mine = st.activeRide === spec.id
    const running = mine && phase.current === 'running'

    let angVel = 0 // swing angular velocity (rad/s) for the lean cue
    if (!st.paused) {
      let angle: number
      if (running) {
        // ω chosen for a stately ~5 s period; envelope shapes the amplitude
        angle = MAX_ANGLE * envelope(elapsed.current, spec.duration) * Math.sin(elapsed.current * 1.25)
      } else {
        // gentle idle sway, easing back toward level
        angle = g.rotation.x * Math.pow(0.2, dt) + Math.sin(state.clock.elapsedTime * 0.6) * 0.04
      }
      angVel = dt > 0 ? (angle - prevAngle.current) / dt : 0
      prevAngle.current = angle
      g.rotation.x = angle
    }
    if (trimMat.current) trimMat.current.emissiveIntensity = isNight(st.timeOfDay) ? 2 : 0.1

    if (mine && phase.current !== 'idle' && seatRef.current) {
      seatRef.current.getWorldPosition(_seat)
      _seat.y += 0.55
      // look out along the boat's local +Z (the direction the back row faces)
      seatRef.current.getWorldDirection(_fwd)
      _target.copy(_seat).addScaledVector(_fwd, -6)
      _target.y -= 1.5
      // Lean into the swing: roll proportional to swing angular velocity,
      // clamped to ±0.15 rad. Peak sweep is ~±1.4 rad/s, so ×0.1 keeps the
      // lean honest without overdriving the clamp.
      const roll = THREE.MathUtils.clamp(angVel * 0.1, -0.15, 0.15)
      applyRideCamera(camera, _seat, _target, dt, false, { roll })
    }
  })

  return (
    <group position={spec.position}>
      {/* A-frame supports */}
      {[-3.2, 3.2].map((x) => (
        <group key={x}>
          <mesh position={[x, PIVOT_Y / 2, 2.2]} rotation-x={0.32} castShadow>
            <cylinderGeometry args={[0.22, 0.28, PIVOT_Y + 1.4, 10]} />
            <meshStandardMaterial color={PALETTE.navy} />
          </mesh>
          <mesh position={[x, PIVOT_Y / 2, -2.2]} rotation-x={-0.32} castShadow>
            <cylinderGeometry args={[0.22, 0.28, PIVOT_Y + 1.4, 10]} />
            <meshStandardMaterial color={PALETTE.navy} />
          </mesh>
        </group>
      ))}
      {/* axle */}
      <mesh position={[0, PIVOT_Y, 0]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.28, 0.28, 7, 12]} />
        <meshStandardMaterial color="#8d97b8" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* base + boarding platform with collision */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[0, 0.4, 0]} receiveShadow castShadow>
          <boxGeometry args={[9, 0.8, 6]} />
          <meshStandardMaterial color="#37415c" />
        </mesh>
      </RigidBody>

      {/* the swinging assembly: pivots at the axle */}
      <group ref={swing} position={[0, PIVOT_Y, 0]}>
        {[-2.2, 2.2].map((x) => (
          <mesh key={x} position={[x, -ARM / 2, 0]}>
            <boxGeometry args={[0.22, ARM, 0.22]} />
            <meshStandardMaterial color="#b9532b" />
          </mesh>
        ))}
        {/* hull */}
        <group position={[0, -ARM, 0]}>
          <mesh castShadow>
            <boxGeometry args={[5.4, 1.2, 2.4]} />
            <meshStandardMaterial color="#7a4a24" />
          </mesh>
          {/* upswept bow + stern */}
          {[-2.9, 2.9].map((z, i) => (
            <mesh key={z} position={[z, 0.5, 0]} rotation-z={i ? -0.5 : 0.5} castShadow>
              <boxGeometry args={[1.4, 1.3, 2.4]} />
              <meshStandardMaterial color="#7a4a24" />
            </mesh>
          ))}
          <mesh position={[0, 0.75, 0]}>
            <boxGeometry args={[5.2, 0.3, 2.5]} />
            <meshStandardMaterial ref={trimMat} color={BAZAAR.yellow} emissive={BAZAAR.marigold} emissiveIntensity={0.1} />
          </mesh>
          {/* seat rows; the camera rides seatRef (the back row) */}
          {seats.map((sx) => (
            <group key={sx} ref={sx === -2 ? seatRef : undefined} position={[sx, 0.3, 0]}>
              <mesh position={[0, 0, 0.6]}>
                <boxGeometry args={[0.8, 0.5, 0.5]} />
                <meshStandardMaterial color={PALETTE.redDark} />
              </mesh>
              <mesh position={[0, 0, -0.6]}>
                <boxGeometry args={[0.8, 0.5, 0.5]} />
                <meshStandardMaterial color={PALETTE.redDark} />
              </mesh>
            </group>
          ))}
        </group>
      </group>
      <RideTrigger spec={spec} />
    </group>
  )
}

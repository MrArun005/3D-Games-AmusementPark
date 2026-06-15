'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Instances, Instance } from '@react-three/drei'
import { CuboidCollider, CylinderCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import { RIDES } from '@/lib/spawn'
import { useGameStore, isNight } from '@/state/useGameStore'
import { keys } from '@/components/Player/useControls'
import { PALETTE } from '@/lib/palette'
import { makeCheckerTexture, makeStripesTexture } from '@/lib/textures'
import { useRideMachine, RideTrigger, applyRideCamera } from './RideBase'

const spec = RIDES.bumper
const [AX, , AZ] = spec.position
const W = 18 // arena inner width (x)
const D = 13 // arena inner depth (z)
const N = 6
const COLORS = [PALETTE.goldLight, PALETTE.red, PALETTE.teal, PALETTE.cream, PALETTE.redDark, PALETTE.gold]

// canopy rim half-extents; the cone is built at RZ and scaled SX in x to fit the rectangle
const RZ = D / 2 + 1.2
const RX = W / 2 + 1.2
const SX = RX / RZ
const SCALLOPS = 28
const BULB_Y = 1.98

const _cam = new THREE.Vector3()
const _look = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _fwd = new THREE.Vector3()

/**
 * Pure-physics arena: 6 dynamic Rapier cars boxed in by fixed walls. AI cars
 * wander between random targets and bump; while the session RUNS the player
 * drives car 0 with the arrow keys under an overhead camera.
 */
export default function BumperCars() {
  const { phase } = useRideMachine(spec)
  const cars = useRef<(RapierRigidBody | null)[]>([])
  const camera = useThree((s) => s.camera)
  const ai = useRef(
    Array.from({ length: N }, () => ({ tx: AX, tz: AZ, t: 0 }))
  )

  const starts = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => [
        AX - W / 2 + 3 + (i % 3) * (W / 2 - 3),
        0.95,
        AZ - D / 2 + 3.5 + Math.floor(i / 3) * (D - 7),
      ] as [number, number, number]),
    []
  )

  const tex = useMemo(() => {
    const floor = makeCheckerTexture(PALETTE.navy, '#2c3654', 12)
    floor.repeat.set(1.35, 1)
    const wallLong = makeStripesTexture(PALETTE.red, PALETTE.cream, 8)
    wallLong.repeat.set(2, 1)
    const wallShort = makeStripesTexture(PALETTE.red, PALETTE.cream, 8)
    wallShort.repeat.set(1.5, 1)
    const canopy = makeStripesTexture(PALETTE.red, PALETTE.cream, 16)
    return { floor, wallLong, wallShort, canopy }
  }, [])

  const mats = useMemo(
    () => ({
      dark: new THREE.MeshStandardMaterial({ color: '#16181f', roughness: 0.85 }),
      gold: new THREE.MeshStandardMaterial({ color: PALETTE.gold, metalness: 0.85, roughness: 0.3 }),
      seat: new THREE.MeshStandardMaterial({ color: '#2a2522', roughness: 0.9, side: THREE.DoubleSide }),
      bulb: new THREE.MeshStandardMaterial({ color: PALETTE.cream, emissive: PALETTE.bulbWarm, emissiveIntensity: 0 }),
    }),
    []
  )

  // rounded bumper-car tub with an inward-rolled lip
  const bodyGeo = useMemo(() => {
    const pts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.45, 0.02),
      new THREE.Vector2(0.68, 0.1),
      new THREE.Vector2(0.79, 0.26),
      new THREE.Vector2(0.74, 0.44),
      new THREE.Vector2(0.58, 0.55),
      new THREE.Vector2(0.4, 0.58),
      new THREE.Vector2(0.34, 0.52),
    ]
    return new THREE.LatheGeometry(pts, 24)
  }, [])

  const bulbPositions = useMemo(() => {
    const pts: [number, number, number][] = []
    for (let i = 0; i < 7; i++) {
      const x = -W / 2 + ((i + 1) * W) / 8
      pts.push([x, BULB_Y, -D / 2 - 0.3], [x, BULB_Y, D / 2 + 0.3])
    }
    for (let i = 0; i < 5; i++) {
      const z = -D / 2 + ((i + 1) * D) / 6
      pts.push([-W / 2 - 0.3, BULB_Y, z], [W / 2 + 0.3, BULB_Y, z])
    }
    return pts
  }, [])

  const scallops = useMemo(
    () =>
      Array.from({ length: SCALLOPS }, (_, i) => {
        const a = (i / SCALLOPS) * Math.PI * 2
        return {
          pos: [Math.cos(a) * RX, 5.5, Math.sin(a) * RZ] as [number, number, number],
          color: i % 2 ? PALETTE.cream : PALETTE.red,
        }
      }),
    []
  )

  const corners = useMemo(
    () =>
      [
        [-W / 2 - 0.3, -D / 2 - 0.3],
        [W / 2 + 0.3, -D / 2 - 0.3],
        [-W / 2 - 0.3, D / 2 + 0.3],
        [W / 2 + 0.3, D / 2 + 0.3],
      ] as const,
    []
  )

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const st = useGameStore.getState()
    mats.bulb.emissiveIntensity = isNight(st.timeOfDay) ? 2.6 : 0
    if (st.paused) return
    const mine = st.activeRide === spec.id
    const running = mine && phase.current === 'running'

    for (let i = 0; i < N; i++) {
      const b = cars.current[i]
      if (!b) continue
      const p = b.translation()

      if (i === 0 && running) {
        const ax = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0) + ((keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0))
        const az = (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0) + ((keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0))
        b.applyImpulse({ x: ax * 16 * dt, y: 0, z: az * 16 * dt }, true)
      } else {
        const d = ai.current[i]
        d.t -= dt
        const dx = d.tx - p.x
        const dz = d.tz - p.z
        if (d.t <= 0 || dx * dx + dz * dz < 1.5) {
          d.tx = AX + (Math.random() - 0.5) * (W - 5)
          d.tz = AZ + (Math.random() - 0.5) * (D - 5)
          d.t = 2 + Math.random() * 3
        }
        const len = Math.hypot(dx, dz) || 1
        const power = running ? 9 : 2.5
        b.applyImpulse({ x: (dx / len) * power * dt, y: 0, z: (dz / len) * power * dt }, true)
      }

      // speed cap so collisions stay playful, not ballistic
      const v = b.linvel()
      const speed = Math.hypot(v.x, v.z)
      if (speed > 7) {
        const k = 7 / speed
        b.setLinvel({ x: v.x * k, y: v.y, z: v.z * k }, true)
      }

      // steer: ease the yaw toward the velocity heading. Rotations are locked
      // to Y, so the slerp collapses to shortest-arc angle easing — one scratch
      // quaternion, zero allocations.
      if (speed > 0.5) {
        const heading = Math.atan2(v.x, v.z)
        const rot = b.rotation()
        const yaw = 2 * Math.atan2(rot.y, rot.w)
        let d = heading - yaw
        d -= Math.round(d / (Math.PI * 2)) * Math.PI * 2 // wrap to [-pi, pi]
        const next = yaw + d * (1 - Math.pow(0.001, dt))
        _q.set(0, Math.sin(next / 2), 0, Math.cos(next / 2))
        b.setRotation(_q, true)
      }
    }

    if (mine && phase.current !== 'idle') {
      const me = cars.current[0]
      if (me) {
        const p = me.translation()
        const rot = me.rotation()
        const yaw = 2 * Math.atan2(rot.y, rot.w)
        _fwd.set(Math.sin(yaw), 0, Math.cos(yaw)) // car's facing direction
        if (useGameStore.getState().view === 'first') {
          // driver's seat: just above the car, looking forward
          _cam.set(p.x + _fwd.x * 0.1, p.y + 0.9, p.z + _fwd.z * 0.1)
          _look.set(p.x + _fwd.x * 5, p.y + 0.6, p.z + _fwd.z * 5)
        } else {
          // chase cam behind + above the car — sits UNDER the canopy so the
          // tent never blocks the view of your car
          _cam.set(p.x - _fwd.x * 4.2, p.y + 2.6, p.z - _fwd.z * 4.2)
          _look.set(p.x + _fwd.x * 1.5, p.y + 0.5, p.z + _fwd.z * 1.5)
        }
        applyRideCamera(camera, _cam, _look, dt)
      }
    }
  })

  return (
    <>
      {/* arena floor + walls (world-positioned so dynamic bodies stay simple) */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[W / 2 + 0.6, 0.3, D / 2 + 0.6]} position={[AX, 0.3, AZ]} />
        <CuboidCollider args={[W / 2 + 0.6, 0.9, 0.3]} position={[AX, 1.2, AZ - D / 2 - 0.3]} />
        <CuboidCollider args={[W / 2 + 0.6, 0.9, 0.3]} position={[AX, 1.2, AZ + D / 2 + 0.3]} />
        <CuboidCollider args={[0.3, 0.9, D / 2 + 0.6]} position={[AX - W / 2 - 0.3, 1.2, AZ]} />
        <CuboidCollider args={[0.3, 0.9, D / 2 + 0.6]} position={[AX + W / 2 + 0.3, 1.2, AZ]} />
      </RigidBody>
      <group position={[AX, 0, AZ]}>
        {/* deck skirt + checkered rink top */}
        <mesh position={[0, 0.3, 0]}>
          <boxGeometry args={[W + 1.2, 0.6, D + 1.2]} />
          <meshStandardMaterial color="#161d33" />
        </mesh>
        <mesh position={[0, 0.605, 0]} rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[W + 1.2, D + 1.2]} />
          <meshStandardMaterial map={tex.floor} roughness={0.55} metalness={0.2} />
        </mesh>

        {/* striped low walls with a gold cap rail */}
        <mesh position={[0, 1.2, -D / 2 - 0.3]}>
          <boxGeometry args={[W + 1.2, 1.2, 0.6]} />
          <meshStandardMaterial map={tex.wallLong} />
        </mesh>
        <mesh position={[0, 1.2, D / 2 + 0.3]}>
          <boxGeometry args={[W + 1.2, 1.2, 0.6]} />
          <meshStandardMaterial map={tex.wallLong} />
        </mesh>
        <mesh position={[-W / 2 - 0.3, 1.2, 0]}>
          <boxGeometry args={[0.6, 1.2, D + 1.2]} />
          <meshStandardMaterial map={tex.wallShort} />
        </mesh>
        <mesh position={[W / 2 + 0.3, 1.2, 0]}>
          <boxGeometry args={[0.6, 1.2, D + 1.2]} />
          <meshStandardMaterial map={tex.wallShort} />
        </mesh>
        <mesh position={[0, 1.85, -D / 2 - 0.3]} rotation-z={Math.PI / 2} material={mats.gold}>
          <cylinderGeometry args={[0.07, 0.07, W + 1.2, 8]} />
        </mesh>
        <mesh position={[0, 1.85, D / 2 + 0.3]} rotation-z={Math.PI / 2} material={mats.gold}>
          <cylinderGeometry args={[0.07, 0.07, W + 1.2, 8]} />
        </mesh>
        <mesh position={[-W / 2 - 0.3, 1.85, 0]} rotation-x={Math.PI / 2} material={mats.gold}>
          <cylinderGeometry args={[0.07, 0.07, D + 1.2, 8]} />
        </mesh>
        <mesh position={[W / 2 + 0.3, 1.85, 0]} rotation-x={Math.PI / 2} material={mats.gold}>
          <cylinderGeometry args={[0.07, 0.07, D + 1.2, 8]} />
        </mesh>

        {/* warm bulbs along the wall tops, shared night-emissive material */}
        <Instances limit={bulbPositions.length}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <primitive object={mats.bulb} attach="material" />
          {bulbPositions.map((p, i) => (
            <Instance key={i} position={p} />
          ))}
        </Instances>

        {/* rounded gold-capped corner posts doubling as canopy poles */}
        {corners.map(([cx, cz], i) => (
          <group key={i} position={[cx, 0, cz]}>
            <mesh position={[0, 1.4, 0]} castShadow>
              <cylinderGeometry args={[0.3, 0.34, 1.6, 12]} />
              <meshStandardMaterial color={PALETTE.redDark} />
            </mesh>
            <mesh position={[0, 2.25, 0]} material={mats.gold}>
              <sphereGeometry args={[0.32, 12, 10]} />
            </mesh>
            <mesh position={[0, 3.95, 0]}>
              <cylinderGeometry args={[0.12, 0.12, 3.5, 10]} />
              <meshStandardMaterial color={PALETTE.navy} />
            </mesh>
            <mesh position={[0, 5.3, 0]} rotation-x={Math.PI / 2} material={mats.gold}>
              <torusGeometry args={[0.16, 0.04, 8, 16]} />
            </mesh>
          </group>
        ))}

        {/* striped canvas canopy: cone built round at RZ, stretched SX in x to cover the rectangle */}
        <mesh position={[0, 6.75, 0]} scale={[SX, 1, 1]} castShadow>
          <coneGeometry args={[RZ, 2.4, 36, 1, true]} />
          <meshStandardMaterial map={tex.canopy} side={THREE.DoubleSide} />
        </mesh>
        {/* dark underside panel — the classic spark ceiling */}
        <mesh position={[0, 5.52, 0]} rotation-x={Math.PI / 2} scale={[SX, 1, 1]}>
          <circleGeometry args={[RZ - 0.1, 36]} />
          <meshStandardMaterial color="#10172b" />
        </mesh>
        {/* scalloped valance: alternating cone wedges hung apex-down around the rim */}
        <Instances limit={SCALLOPS}>
          <coneGeometry args={[0.4, 0.6, 8]} />
          <meshStandardMaterial side={THREE.DoubleSide} />
          {scallops.map((s, i) => (
            <Instance key={i} position={s.pos} rotation={[Math.PI, 0, 0]} color={s.color} />
          ))}
        </Instances>
        <mesh position={[0, 8.05, 0]} material={mats.gold}>
          <cylinderGeometry args={[0.06, 0.1, 0.5, 8]} />
        </mesh>
        <mesh position={[0, 8.35, 0]}>
          <sphereGeometry args={[0.22, 12, 10]} />
          <meshStandardMaterial color={PALETTE.goldLight} metalness={0.8} roughness={0.25} />
        </mesh>
      </group>

      {starts.map((pos, i) => (
        <RigidBody
          key={i}
          ref={(el) => {
            cars.current[i] = el
          }}
          colliders={false}
          position={pos}
          linearDamping={1.4}
          angularDamping={4}
          enabledRotations={[false, true, false]}
          restitution={0.95}
          friction={0.4}
          ccd
        >
          <CylinderCollider args={[0.3, 0.78]} position={[0, 0.3, 0]} />
          <mesh geometry={bodyGeo} position={[0, 0.02, 0]} castShadow>
            <meshStandardMaterial color={COLORS[i]} metalness={0.35} roughness={0.45} side={THREE.DoubleSide} />
          </mesh>
          {/* rubber bumper ring */}
          <mesh position={[0, 0.34, 0]} rotation-x={Math.PI / 2} material={mats.dark}>
            <torusGeometry args={[0.82, 0.16, 10, 24]} />
          </mesh>
          {/* gold trim ring at the waist */}
          <mesh position={[0, 0.55, 0]} rotation-x={Math.PI / 2} material={mats.gold}>
            <torusGeometry args={[0.66, 0.035, 8, 24]} />
          </mesh>
          {/* seat cushion + half-shell back (rear = -z) */}
          <mesh position={[0, 0.4, -0.1]} material={mats.seat}>
            <cylinderGeometry args={[0.3, 0.3, 0.1, 12]} />
          </mesh>
          <mesh position={[0, 0.62, -0.28]} material={mats.seat}>
            <cylinderGeometry args={[0.3, 0.3, 0.45, 12, 1, true, Math.PI / 2, Math.PI]} />
          </mesh>
          {/* steering column + wheel */}
          <mesh position={[0, 0.52, 0.3]} rotation-x={0.5} material={mats.dark}>
            <cylinderGeometry args={[0.025, 0.025, 0.3, 6]} />
          </mesh>
          <mesh position={[0, 0.68, 0.34]} rotation-x={-1.05} material={mats.dark}>
            <torusGeometry args={[0.14, 0.025, 8, 16]} />
          </mesh>
          {/* contact pole leaning ~15deg toward the rear, warm tip glows at night */}
          <group position={[0, 0.45, -0.55]} rotation-x={-0.26}>
            <mesh position={[0, 1, 0]} material={mats.dark}>
              <cylinderGeometry args={[0.025, 0.04, 2, 8]} />
            </mesh>
            <mesh position={[0, 2, 0]} material={mats.bulb}>
              <sphereGeometry args={[0.07, 8, 8]} />
            </mesh>
          </group>
        </RigidBody>
      ))}
      <RideTrigger spec={spec} />
    </>
  )
}

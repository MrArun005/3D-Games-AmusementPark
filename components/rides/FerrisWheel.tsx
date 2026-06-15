'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { Instances, Instance } from '@react-three/drei'
import { RIDES } from '@/lib/spawn'
import { PALETTE } from '@/lib/palette'
import { makeStripesTexture } from '@/lib/textures'
import { useGameStore, isNight } from '@/state/useGameStore'
import { useRideMachine, RideTrigger, applyRideCamera } from './RideBase'

const spec = RIDES.ferris
const RADIUS = 9
const HUB_Y = 11.6 // bottom gondola body must clear the 0.8 m platform at the 6 o'clock position
const RIM_Z = 0.7
const IDLE_SPEED = 0.06
/** Wheel spin-up/down time constant (s) — a 30m wheel must not snap to speed. */
const SPEED_TAU = 2
/** Safety fence footprint around the wheel's swing plane (ride-local). */
const FENCE_X = 10.5
const FENCE_Z = 2.5
const FENCE_H = 1.1
/** Boarding gap in the +z run, clear of the trigger sensor (local x 3..9). */
const GAP_X0 = 2.5
const GAP_X1 = 9.5
const _v = new THREE.Vector3()
const _t = new THREE.Vector3()

type Vec3 = [number, number, number]

export default function FerrisWheel() {
  const { phase } = useRideMachine(spec)
  const wheel = useRef<THREE.Group>(null)
  const speed = useRef(IDLE_SPEED)
  const cabins = useRef<(THREE.Group | null)[]>([])
  const rimMat = useRef<THREE.MeshStandardMaterial>(null)
  const bulbMat = useRef<THREE.MeshStandardMaterial>(null)
  const camera = useThree((s) => s.camera)

  const angles = useMemo(() => Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2), [])

  // Shared geometries/materials for everything repeated per-cabin or per-leg.
  const kit = useMemo(() => {
    const roofTex = makeStripesTexture(PALETTE.red, PALETTE.cream, 12)
    const hubTex = makeStripesTexture(PALETTE.red, PALETTE.cream, 16)
    const fasciaTex = makeStripesTexture(PALETTE.red, PALETTE.cream, 14)
    return {
      body: new THREE.SphereGeometry(0.72, 20, 14),
      trim: new THREE.TorusGeometry(0.74, 0.045, 8, 28),
      roofGeo: new THREE.ConeGeometry(0.8, 0.55, 14),
      hangerGeo: new THREE.CylinderGeometry(0.035, 0.035, 0.5, 6),
      legGeo: new THREE.CylinderGeometry(0.13, 0.28, HUB_Y + 1, 10),
      collarBig: new THREE.TorusGeometry(0.27, 0.05, 8, 18),
      collarSmall: new THREE.TorusGeometry(0.19, 0.045, 8, 18),
      red: new THREE.MeshStandardMaterial({ color: PALETTE.red, roughness: 0.45 }),
      cream: new THREE.MeshStandardMaterial({ color: PALETTE.cream, roughness: 0.55 }),
      gold: new THREE.MeshStandardMaterial({ color: PALETTE.gold, metalness: 0.9, roughness: 0.25 }),
      navy: new THREE.MeshStandardMaterial({ color: PALETTE.navy, metalness: 0.2, roughness: 0.4 }),
      roof: new THREE.MeshStandardMaterial({ map: roofTex, roughness: 0.65 }),
      hubCap: new THREE.MeshStandardMaterial({ map: hubTex, roughness: 0.6 }),
      fascia: new THREE.MeshStandardMaterial({ map: fasciaTex, roughness: 0.7 }),
    }
  }, [])

  // 16 truss spokes: 8 per rim plane, each a thin Y-cylinder swung to angle a.
  const spokes = useMemo(
    () =>
      angles.flatMap((a) =>
        [RIM_Z, -RIM_Z].map((z) => ({
          pos: [(Math.cos(a) * RADIUS) / 2, (Math.sin(a) * RADIUS) / 2, z] as Vec3,
          rot: [0, 0, a - Math.PI / 2] as Vec3,
        }))
      ),
    [angles]
  )
  const braceAngles = useMemo(() => Array.from({ length: 16 }, (_, i) => ((i + 0.5) / 16) * Math.PI * 2), [])
  // 32 bulbs riding the rims, alternating front/back ring, bulged just past the tube.
  const bulbs = useMemo(
    () =>
      Array.from({ length: 32 }, (_, i) => {
        const a = (i / 32) * Math.PI * 2
        return [Math.cos(a) * (RADIUS + 0.16), Math.sin(a) * (RADIUS + 0.16), i % 2 ? -RIM_Z : RIM_Z] as Vec3
      }),
    []
  )
  const legs = useMemo(
    () =>
      [
        { pos: [2.2, HUB_Y / 2, 1.05] as Vec3, tilt: -0.21 },
        { pos: [2.2, HUB_Y / 2, -1.05] as Vec3, tilt: -0.21 },
        { pos: [-2.2, HUB_Y / 2, 1.05] as Vec3, tilt: 0.21 },
        { pos: [-2.2, HUB_Y / 2, -1.05] as Vec3, tilt: 0.21 },
      ] as const,
    []
  )
  // Scalloped valance discs hung around the base platform's four edges.
  const valance = useMemo(() => {
    const items: { pos: Vec3; rot: Vec3; color: string }[] = []
    for (let i = 0; i < 15; i++) {
      const x = -3.22 + i * 0.46
      const color = i % 2 ? PALETTE.cream : PALETTE.red
      items.push({ pos: [x, 0.26, 2.08], rot: [Math.PI / 2, 0, 0], color })
      items.push({ pos: [x, 0.26, -2.08], rot: [Math.PI / 2, 0, 0], color })
    }
    for (let i = 0; i < 8; i++) {
      const z = -1.61 + i * 0.46
      const color = i % 2 ? PALETTE.red : PALETTE.cream
      items.push({ pos: [3.68, 0.26, z], rot: [0, 0, Math.PI / 2], color })
      items.push({ pos: [-3.68, 0.26, z], rot: [0, 0, Math.PI / 2], color })
    }
    return items
  }, [])

  // Safety fence around the gondola swing footprint. Five straight runs form a
  // rectangle in the wheel plane; the +z run is split so a gap (x 2.5..9.5)
  // faces the boarding trigger ([6,1,5] local, half [3,2,3]) and never touches it.
  const fence = useMemo(() => {
    const runs: { from: [number, number]; to: [number, number] }[] = [
      { from: [-FENCE_X, -FENCE_Z], to: [FENCE_X, -FENCE_Z] }, // back
      { from: [-FENCE_X, -FENCE_Z], to: [-FENCE_X, FENCE_Z] }, // left
      { from: [FENCE_X, -FENCE_Z], to: [FENCE_X, FENCE_Z] }, // right
      { from: [-FENCE_X, FENCE_Z], to: [GAP_X0, FENCE_Z] }, // front-left of gap
      { from: [GAP_X1, FENCE_Z], to: [FENCE_X, FENCE_Z] }, // front-right of gap
    ]
    const posts: Vec3[] = []
    const rails: { pos: Vec3; rot: Vec3; len: number }[] = []
    const colliders: { args: Vec3; pos: Vec3 }[] = []
    for (const r of runs) {
      const dx = r.to[0] - r.from[0]
      const dz = r.to[1] - r.from[1]
      const len = Math.hypot(dx, dz)
      const mx = (r.from[0] + r.to[0]) / 2
      const mz = (r.from[1] + r.to[1]) / 2
      const n = Math.max(1, Math.round(len / 1.5))
      for (let i = 0; i <= n; i++) {
        posts.push([r.from[0] + (dx * i) / n, FENCE_H / 2, r.from[1] + (dz * i) / n])
      }
      const alongX = Math.abs(dx) > Math.abs(dz)
      for (const y of [0.52, 1.0]) {
        rails.push({ pos: [mx, y, mz], rot: alongX ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0], len })
      }
      colliders.push({
        args: alongX ? [len / 2, FENCE_H / 2, 0.08] : [0.08, FENCE_H / 2, len / 2],
        pos: [mx, FENCE_H / 2, mz],
      })
    }
    return { posts, rails, colliders }
  }, [])

  useFrame((_, dt) => {
    const st = useGameStore.getState()
    if (!wheel.current) return
    if (!st.paused) {
      const mine = st.activeRide === spec.id
      // One full revolution over the ride duration; slow idle spin otherwise.
      const target = mine && phase.current === 'running' ? (Math.PI * 2) / spec.duration : IDLE_SPEED
      // Ease angular speed toward the target (~2s time constant): big wheels have inertia.
      speed.current += (target - speed.current) * (1 - Math.exp(-dt / SPEED_TAU))
      wheel.current.rotation.z += speed.current * dt
      // Counter-rotate every cabin by the wheel angle so gondolas stay upright:
      // parent rotation θ + child rotation -θ = 0 net roll.
      for (const c of cabins.current) if (c) c.rotation.z = -wheel.current.rotation.z
    }
    const night = isNight(st.timeOfDay)
    if (rimMat.current) rimMat.current.emissiveIntensity = night ? 2.4 : 0.15
    if (bulbMat.current) bulbMat.current.emissiveIntensity = night ? 2.6 : 0.1

    if (st.activeRide === spec.id && phase.current !== 'idle') {
      const c = cabins.current[0]
      if (c) {
        c.getWorldPosition(_v)
        _v.y += 0.35
        _t.set(0, Math.max(2, _v.y * 0.45), 0) // gaze drifts over the plaza
        applyRideCamera(camera, _v, _t, dt)
      }
    }
  })

  return (
    <group position={spec.position}>
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[0, 0.4, 0]} receiveShadow castShadow>
          <boxGeometry args={[7, 0.8, 4]} />
          <meshStandardMaterial color={PALETTE.navy} />
        </mesh>
      </RigidBody>
      {/* Striped fascia band + scalloped valance dressing the platform edge. */}
      <mesh position={[0, 0.55, 2.02]} material={kit.fascia}>
        <boxGeometry args={[7.2, 0.55, 0.08]} />
      </mesh>
      <mesh position={[0, 0.55, -2.02]} material={kit.fascia}>
        <boxGeometry args={[7.2, 0.55, 0.08]} />
      </mesh>
      <mesh position={[3.62, 0.55, 0]} material={kit.fascia}>
        <boxGeometry args={[0.08, 0.55, 4.2]} />
      </mesh>
      <mesh position={[-3.62, 0.55, 0]} material={kit.fascia}>
        <boxGeometry args={[0.08, 0.55, 4.2]} />
      </mesh>
      <Instances limit={valance.length}>
        <cylinderGeometry args={[0.24, 0.24, 0.07, 12]} />
        <meshStandardMaterial color="#ffffff" roughness={0.6} />
        {valance.map((s, i) => (
          <Instance key={i} position={s.pos} rotation={s.rot} color={s.color} />
        ))}
      </Instances>

      {/* Low safety fence: keeps walkers out of the gondola sweep, open toward the trigger. */}
      <RigidBody type="fixed" colliders={false}>
        {fence.colliders.map((c, i) => (
          <CuboidCollider key={i} args={c.args} position={c.pos} />
        ))}
      </RigidBody>
      <Instances limit={fence.posts.length}>
        <cylinderGeometry args={[0.07, 0.09, FENCE_H, 8]} />
        <meshStandardMaterial color={PALETTE.red} roughness={0.5} />
        {fence.posts.map((p, i) => (
          <Instance key={i} position={p} />
        ))}
      </Instances>
      <Instances limit={fence.rails.length}>
        <cylinderGeometry args={[0.035, 0.035, 1, 8]} />
        <meshStandardMaterial color={PALETTE.gold} metalness={0.6} roughness={0.32} />
        {fence.rails.map((r, i) => (
          <Instance key={i} position={r.pos} rotation={r.rot} scale={[1, r.len, 1]} />
        ))}
      </Instances>

      {legs.map((l, i) => (
        <group key={i} position={l.pos} rotation-z={l.tilt}>
          <mesh geometry={kit.legGeo} material={kit.navy} castShadow />
          <mesh geometry={kit.collarBig} material={kit.gold} rotation-x={Math.PI / 2} position={[0, -2.9, 0]} />
          <mesh geometry={kit.collarSmall} material={kit.gold} rotation-x={Math.PI / 2} position={[0, 2.6, 0]} />
        </group>
      ))}
      <mesh position={[0, HUB_Y, 0]} rotation-x={Math.PI / 2} material={kit.navy}>
        <cylinderGeometry args={[0.12, 0.12, 2.6, 10]} />
      </mesh>

      <group ref={wheel} position={[0, HUB_Y, 0]}>
        {/* Hub: navy drum capped by striped pinwheel cones, gold trim + finial. */}
        <mesh rotation-x={Math.PI / 2} material={kit.navy}>
          <cylinderGeometry args={[0.55, 0.55, 1.7, 18]} />
        </mesh>
        <mesh rotation-x={Math.PI / 2} position={[0, 0, 0.92]} material={kit.hubCap}>
          <coneGeometry args={[1.05, 0.35, 24]} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0, -0.92]} material={kit.hubCap}>
          <coneGeometry args={[1.05, 0.35, 24]} />
        </mesh>
        <mesh position={[0, 0, 0.8]} material={kit.gold}>
          <torusGeometry args={[1.03, 0.05, 8, 32]} />
        </mesh>
        <mesh position={[0, 0, -0.8]} material={kit.gold}>
          <torusGeometry args={[1.03, 0.05, 8, 32]} />
        </mesh>
        <mesh position={[0, 0, 1.2]} material={kit.gold}>
          <sphereGeometry args={[0.15, 12, 10]} />
        </mesh>

        {/* Double rim with cross-braces and the bulb rings. */}
        <Instances limit={2}>
          <torusGeometry args={[RADIUS, 0.14, 10, 72]} />
          <meshStandardMaterial ref={rimMat} color={PALETTE.red} emissive={PALETTE.red} emissiveIntensity={0.15} />
          <Instance position={[0, 0, RIM_Z]} />
          <Instance position={[0, 0, -RIM_Z]} />
        </Instances>
        <Instances limit={braceAngles.length}>
          <cylinderGeometry args={[0.045, 0.045, RIM_Z * 2, 6]} />
          <meshStandardMaterial color={PALETTE.gold} metalness={0.9} roughness={0.25} />
          {braceAngles.map((a, i) => (
            <Instance key={i} position={[Math.cos(a) * RADIUS, Math.sin(a) * RADIUS, 0]} rotation={[Math.PI / 2, 0, 0]} />
          ))}
        </Instances>
        <Instances limit={spokes.length}>
          <cylinderGeometry args={[0.05, 0.05, RADIUS, 6]} />
          <meshStandardMaterial color={PALETTE.cream} metalness={0.2} roughness={0.4} />
          {spokes.map((s, i) => (
            <Instance key={i} position={s.pos} rotation={s.rot} />
          ))}
        </Instances>
        <Instances limit={bulbs.length}>
          <sphereGeometry args={[0.13, 10, 8]} />
          <meshStandardMaterial ref={bulbMat} color={PALETTE.bulbWarm} emissive={PALETTE.bulbWarm} emissiveIntensity={0.1} />
          {bulbs.map((p, i) => (
            <Instance key={i} position={p} />
          ))}
        </Instances>

        {angles.map((a, i) => (
          <group
            key={i}
            ref={(el) => {
              cabins.current[i] = el
            }}
            position={[Math.cos(a) * RADIUS, Math.sin(a) * RADIUS, 0]}
          >
            <mesh geometry={kit.hangerGeo} material={kit.gold} position={[0, -0.24, 0]} />
            <mesh geometry={kit.roofGeo} material={kit.roof} position={[0, -0.52, 0]} />
            <mesh geometry={kit.trim} material={kit.gold} rotation-x={Math.PI / 2} position={[0, -1.12, 0]} />
            <mesh
              geometry={kit.body}
              material={i % 2 ? kit.cream : kit.red}
              position={[0, -1.12, 0]}
              scale={[1, 0.72, 1]}
              castShadow
            />
          </group>
        ))}
      </group>
      <RideTrigger spec={spec} />
    </group>
  )
}

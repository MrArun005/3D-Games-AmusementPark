'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Instances, Instance } from '@react-three/drei'
import { RigidBody, CylinderCollider } from '@react-three/rapier'
import { RIDES } from '@/lib/spawn'
import { useGameStore, isNight } from '@/state/useGameStore'
import { useRideMachine, RideTrigger, applyRideCamera } from './RideBase'
import { PALETTE } from '@/lib/palette'
import { makeStripesTexture } from '@/lib/textures'
import RideRider from '@/components/world/RideRider'
import { useRideOccupancy } from '@/lib/rideOccupancy'

const spec = RIDES.carousel
const HORSE_R = 4
/** Exponential spin-up/brake time constant (s) so the platform moves like machinery. */
const SPIN_TAU = 1.5
const RUN_SPEED = 0.85
const IDLE_SPEED = 0.12
const _v = new THREE.Vector3()
const _t = new THREE.Vector3()

// Gallop pose: front pair reaches forward (hoof toward +z), back pair trails.
const LEG_POSE: { x: number; z: number; rot: number }[] = [
  { x: 0.15, z: 0.34, rot: -0.5 },
  { x: -0.15, z: 0.34, rot: -0.22 },
  { x: 0.15, z: -0.34, rot: 0.55 },
  { x: -0.15, z: -0.34, rot: 0.28 },
]
const MANE_SPOTS: [number, number, number][] = [
  [0, 0.72, 0.38],
  [0, 0.6, 0.31],
  [0, 0.48, 0.25],
  [0, 0.36, 0.19],
]

export default function Carousel() {
  const { phase } = useRideMachine(spec)
  const platform = useRef<THREE.Group>(null)
  const speed = useRef(IDLE_SPEED)
  const horses = useRef<(THREE.Group | null)[]>([])
  const trimMat = useRef<THREE.MeshStandardMaterial>(null)
  const bulbMat = useRef<THREE.MeshStandardMaterial>(null)
  const camera = useThree((s) => s.camera)
  const seats = useRideOccupancy((s) => s.seats.carousel)

  const horseData = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        angle: (i / 8) * Math.PI * 2,
        tint: i % 3,
      })),
    []
  )
  const ring24 = useMemo(() => Array.from({ length: 24 }, (_, i) => (i / 24) * Math.PI * 2), [])
  const panelAngles = useMemo(() => Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2), [])
  const canopyTex = useMemo(() => makeStripesTexture(PALETTE.red, PALETTE.cream, 16), [])

  // Shared horse-part geometries: 8 horses reuse one geometry per part.
  const geo = useMemo(
    () => ({
      body: new THREE.CapsuleGeometry(0.24, 0.62, 6, 12),
      neck: new THREE.CylinderGeometry(0.11, 0.17, 0.55, 10),
      head: new THREE.ConeGeometry(0.11, 0.42, 10),
      ear: new THREE.ConeGeometry(0.035, 0.12, 6),
      mane: new THREE.SphereGeometry(0.1, 8, 6),
      leg: new THREE.CylinderGeometry(0.05, 0.055, 0.52, 8),
      hoof: new THREE.CylinderGeometry(0.062, 0.07, 0.09, 8),
      tail: new THREE.CylinderGeometry(0.03, 0.055, 0.48, 8),
      saddle: new THREE.BoxGeometry(0.3, 0.1, 0.34),
      blanket: new THREE.BoxGeometry(0.36, 0.05, 0.42),
      pole: new THREE.CylinderGeometry(0.045, 0.045, 3.4, 8),
      panel: new THREE.BoxGeometry(0.42, 2, 0.05),
    }),
    []
  )
  const mat = useMemo(
    () => ({
      bodies: [PALETTE.cream, PALETTE.teal, PALETTE.red].map(
        (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 })
      ),
      manes: [PALETTE.redDark, PALETTE.cream, PALETTE.navy].map(
        (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 })
      ),
      gold: new THREE.MeshStandardMaterial({ color: PALETTE.gold, metalness: 0.85, roughness: 0.3 }),
      saddle: new THREE.MeshStandardMaterial({ color: PALETTE.navy, roughness: 0.6 }),
      mirror: new THREE.MeshStandardMaterial({ color: PALETTE.cream, metalness: 0.9, roughness: 0.15 }),
    }),
    []
  )

  useFrame((_, dt) => {
    const st = useGameStore.getState()
    const p = platform.current
    if (!p) return
    const mine = st.activeRide === spec.id
    if (!st.paused) {
      // Ease current speed toward target (~1.5s time constant): machinery inertia.
      const target = mine && phase.current === 'running' ? RUN_SPEED : IDLE_SPEED
      speed.current += (target - speed.current) * (1 - Math.exp(-dt / SPIN_TAU))
      p.rotation.y += speed.current * dt
      // Sinusoidal vertical bob, phase-offset per horse so they alternate.
      for (let i = 0; i < horses.current.length; i++) {
        const h = horses.current[i]
        if (h) h.position.y = 1.15 + Math.sin(p.rotation.y * 2.4 + i * 1.7) * 0.4
      }
    }
    const night = isNight(st.timeOfDay)
    if (trimMat.current) trimMat.current.emissiveIntensity = night ? 2.2 : 0.1
    if (bulbMat.current) bulbMat.current.emissiveIntensity = night ? 2.4 : 0

    if (mine && phase.current !== 'idle') {
      const h = horses.current[0]
      if (h) {
        h.getWorldPosition(_v)
        _v.y += 0.55
        // rotation.y of θ maps local angle a to world angle (a - θ), and θ
        // grows over time, so "ahead" along the spin is at a smaller angle.
        const wa = -p.rotation.y - 0.45
        _t.set(
          spec.position[0] + Math.cos(wa) * HORSE_R,
          _v.y - 0.1,
          spec.position[2] + Math.sin(wa) * HORSE_R
        )
        applyRideCamera(camera, _v, _t, dt)
      }
    }
  })

  return (
    <group position={spec.position}>
      {/* static base players collide with while the visual platform spins.
          Deck mesh: h=0.35 centered at y=0.45 -> top at 0.625, radii 5.4 (top) / 5.6 (bottom).
          Collider top = 0.3125 + 0.3125 = 0.625 (flush with the deck); radius 5.5 sits on the flank midline. */}
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.3125, 5.5]} position={[0, 0.3125, 0]} />
      </RigidBody>

      <group ref={platform}>
        {/* wooden deck with gold trim and a low rail */}
        <mesh position={[0, 0.45, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[5.4, 5.6, 0.35, 32]} />
          <meshStandardMaterial color={PALETTE.wood} roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.62, 0]} rotation-x={Math.PI / 2} material={mat.gold}>
          <torusGeometry args={[5.42, 0.07, 10, 48]} />
        </mesh>
        <Instances limit={ring24.length}>
          <cylinderGeometry args={[0.035, 0.045, 0.42, 8]} />
          <meshStandardMaterial color={PALETTE.redDark} roughness={0.6} />
          {ring24.map((a, i) => (
            <Instance key={i} position={[Math.cos(a) * 5.15, 0.83, Math.sin(a) * 5.15]} />
          ))}
        </Instances>
        <mesh position={[0, 1.05, 0]} rotation-x={Math.PI / 2} material={mat.gold}>
          <torusGeometry args={[5.15, 0.035, 8, 48]} />
        </mesh>

        {/* center column: mirrored panels framed by gold rings */}
        <mesh position={[0, 2.3, 0]} castShadow>
          <cylinderGeometry args={[0.7, 0.7, 3.6, 20]} />
          <meshStandardMaterial color={PALETTE.redDark} roughness={0.5} />
        </mesh>
        {panelAngles.map((a, i) => (
          <mesh
            key={i}
            geometry={geo.panel}
            material={mat.mirror}
            position={[Math.cos(a) * 0.73, 2.3, Math.sin(a) * 0.73]}
            rotation-y={Math.PI / 2 - a}
          />
        ))}
        <mesh position={[0, 1.25, 0]} rotation-x={Math.PI / 2} material={mat.gold}>
          <torusGeometry args={[0.8, 0.08, 10, 28]} />
        </mesh>
        <mesh position={[0, 3.35, 0]} rotation-x={Math.PI / 2} material={mat.gold}>
          <torusGeometry args={[0.8, 0.08, 10, 28]} />
        </mesh>

        {horseData.map((h, i) => (
          <group key={i} rotation-y={h.angle}>
            <group ref={(el) => { horses.current[i] = el }} position={[HORSE_R, 1.15, 0]}>
              <mesh geometry={geo.body} material={mat.bodies[h.tint]} position={[0, 0.1, 0]} rotation-x={Math.PI / 2} castShadow />
              <mesh geometry={geo.neck} material={mat.bodies[h.tint]} position={[0, 0.42, 0.4]} rotation-x={0.35} />
              <mesh geometry={geo.head} material={mat.bodies[h.tint]} position={[0, 0.58, 0.66]} rotation-x={2.0} />
              <mesh geometry={geo.ear} material={mat.manes[h.tint]} position={[0.05, 0.74, 0.5]} rotation-x={-0.3} />
              <mesh geometry={geo.ear} material={mat.manes[h.tint]} position={[-0.05, 0.74, 0.5]} rotation-x={-0.3} />
              {MANE_SPOTS.map((p, j) => (
                <mesh
                  key={j}
                  geometry={geo.mane}
                  material={mat.manes[h.tint]}
                  position={p}
                  scale={[0.4, 1.15 - j * 0.1, 1.3 - j * 0.12]}
                />
              ))}
              {LEG_POSE.map((l, j) => (
                <group key={j} position={[l.x, -0.1, l.z]} rotation-x={l.rot}>
                  <mesh geometry={geo.leg} material={mat.bodies[h.tint]} position={[0, -0.26, 0]} />
                  <mesh geometry={geo.hoof} material={mat.gold} position={[0, -0.54, 0]} />
                </group>
              ))}
              <mesh geometry={geo.tail} material={mat.manes[h.tint]} position={[0, 0.02, -0.55]} rotation-x={-2.4} />
              <mesh geometry={geo.blanket} material={mat.gold} position={[0, 0.3, -0.02]} />
              <mesh geometry={geo.saddle} material={mat.saddle} position={[0, 0.37, -0.02]} />
              {/* brass pole up to the canopy */}
              <mesh geometry={geo.pole} material={mat.gold} position={[0, 1.3, 0]} />
              {seats[i] && (
                <group position={[0, 0.42, 0]}>
                  <RideRider variant={seats[i]!.variant} />
                </group>
              )}
            </group>
          </group>
        ))}

        {/* striped big-top canopy; u wraps the cone so stripes read as radial */}
        <mesh position={[0, 4.45, 0]} castShadow>
          <coneGeometry args={[5.9, 1.9, 48, 1, true]} />
          <meshStandardMaterial map={canopyTex} side={THREE.DoubleSide} roughness={0.8} />
        </mesh>
        <mesh position={[0, 3.5, 0]} rotation-x={Math.PI / 2} material={mat.gold}>
          <torusGeometry args={[5.88, 0.05, 8, 48]} />
        </mesh>
        {/* scalloped valance: flattened spheres rotated so the squashed axis points outward */}
        <Instances limit={ring24.length}>
          <sphereGeometry args={[0.42, 10, 8]} />
          <meshStandardMaterial roughness={0.75} />
          {ring24.map((a, i) => (
            <Instance
              key={i}
              color={i % 2 ? PALETTE.red : PALETTE.cream}
              position={[Math.cos(a) * 5.85, 3.38, Math.sin(a) * 5.85]}
              rotation={[0, Math.PI / 2 - a, 0]}
              scale={[1.7, 1.2, 0.3]}
            />
          ))}
        </Instances>
        {/* eave bulbs, half a step offset from the scallops */}
        <Instances limit={ring24.length}>
          <sphereGeometry args={[0.09, 8, 6]} />
          <meshStandardMaterial ref={bulbMat} color={PALETTE.bulbWarm} emissive={PALETTE.bulbWarm} emissiveIntensity={0} />
          {ring24.map((a, i) => (
            <Instance key={i} position={[Math.cos(a + Math.PI / 24) * 5.45, 3.46, Math.sin(a + Math.PI / 24) * 5.45]} />
          ))}
        </Instances>

        <mesh position={[0, 5.6, 0]}>
          <sphereGeometry args={[0.35, 16, 12]} />
          <meshStandardMaterial ref={trimMat} color={PALETTE.goldLight} emissive="#ffb52d" emissiveIntensity={0.1} />
        </mesh>
        <mesh position={[0, 6.05, 0]} material={mat.gold}>
          <coneGeometry args={[0.07, 0.55, 8]} />
        </mesh>
      </group>
      <RideTrigger spec={spec} />
    </group>
  )
}

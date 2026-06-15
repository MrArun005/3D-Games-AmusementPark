'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Instances, Instance } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { RIDES } from '@/lib/spawn'
import { useGameStore, isNight } from '@/state/useGameStore'
import { useRideMachine, RideTrigger, applyRideCamera } from './RideBase'
import { PALETTE } from '@/lib/palette'
import { makeStripesTexture } from '@/lib/textures'

const spec = RIDES.droptower
const H = 15 // travel height of the seat ring
const TOWER_H = H + 3
const POST = 0.62 // corner-post offset from the tower axis
const _v = new THREE.Vector3()
const _t = new THREE.Vector3()
const _dir = new THREE.Vector3()

const smooth = (x: number) => x * x * (3 - 2 * x)

// Bounce settle ends exactly on a zero of |sin(9k)| (k = pi, sin 9pi = 0) so the
// handoff to the rest height has no step. The old 14.5 cutoff left a ~1.5mm jump.
const SETTLE_END = 11.6 + Math.PI

/**
 * Seat-ring height over the RUNNING timeline: eased rise, a pause at the
 * top for the view, a sharp free-fall, then a damped bounce settle.
 * Piecewise boundaries are value-continuous: t=8 and t=11 also match slope,
 * t=11.6 reverses velocity (the bounce impact), SETTLE_END lands on zero.
 */
function towerY(t: number): number {
  if (t < 8) return 0.8 + H * smooth(t / 8)
  if (t < 11) return 0.8 + H
  if (t < 11.6) {
    const k = (t - 11) / 0.6
    return 0.8 + H * (1 - k * k)
  }
  if (t < SETTLE_END) {
    const k = t - 11.6
    return 0.8 + H * 0.07 * Math.exp(-2.2 * k) * Math.abs(Math.sin(9 * k))
  }
  return 0.8
}

/**
 * Ride-force cue for the camera, derived purely from the fall timeline:
 * during the sharp free-fall (t in [11, 11.6)) widen the FOV up to +5 for the
 * stomach-drop, scaled by how deep into the fall we are; on the catch/bounce
 * (the first ~0.35 s after impact) add a brief positional shake. No roll — a
 * straight vertical drop has no lateral lean. All cues fade to nothing outside
 * these windows so the rest of the ride stays calm.
 */
function dropG(t: number): { fov: number; shake: number } {
  if (t >= 11 && t < 11.6) {
    // k 0->1 across the fall; ease so the kick builds rather than snapping on.
    const k = (t - 11) / 0.6
    return { fov: 5 * k * k, shake: 0 }
  }
  if (t >= 11.6 && t < 11.95) {
    // Impact jolt, decaying over the first third of a second of the bounce.
    const k = 1 - (t - 11.6) / 0.35
    return { fov: 0, shake: 0.04 * k }
  }
  return { fov: 0, shake: 0 }
}

interface BraceXform {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
}

export default function DropTower() {
  const { phase, elapsed } = useRideMachine(spec)
  const ring = useRef<THREE.Group>(null)
  const stripMat = useRef<THREE.MeshStandardMaterial>(null)
  const camera = useThree((s) => s.camera)

  const seatAngles = useMemo(() => Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2), [])
  // Unit direction from the tower toward the plaza — the money view.
  const outDir = useMemo(() => {
    const d = new THREE.Vector3(-spec.position[0], 0, -spec.position[2]).normalize()
    return d
  }, [])

  const stripeTex = useMemo(() => {
    const t = makeStripesTexture(PALETTE.red, PALETTE.cream, 14)
    t.repeat.set(3, 1)
    return t
  }, [])
  const stripeMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: stripeTex, side: THREE.DoubleSide }),
    [stripeTex]
  )
  const goldMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: PALETTE.gold, metalness: 0.9, roughness: 0.25 }),
    []
  )
  const seatMat = useMemo(() => new THREE.MeshStandardMaterial({ color: PALETTE.red }), [])

  const sectionRingGeo = useMemo(() => new THREE.CylinderGeometry(1.0, 1.0, 0.6, 20, 1, true), [])
  // bucket seat: bottom hemisphere opening upward
  const seatGeo = useMemo(
    () => new THREE.SphereGeometry(0.32, 14, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    []
  )
  const seatRimGeo = useMemo(() => new THREE.TorusGeometry(0.32, 0.035, 6, 16), [])
  const harnessGeo = useMemo(() => new THREE.TorusGeometry(0.24, 0.035, 6, 10, Math.PI), [])
  const flagGeo = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(0, 0)
    s.lineTo(0.72, 0.17)
    s.lineTo(0, 0.34)
    s.closePath()
    return new THREE.ShapeGeometry(s)
  }, [])

  // Diagonal lattice between the four corner posts: one brace per panel per
  // face, direction alternating so adjacent panels zigzag like a truss.
  const braces = useMemo<BraceXform[]>(() => {
    const corners: [number, number][] = [
      [POST, POST],
      [-POST, POST],
      [-POST, -POST],
      [POST, -POST],
    ]
    const up = new THREE.Vector3(0, 1, 0)
    const dir = new THREE.Vector3()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const out: BraceXform[] = []
    const y0 = 1.2
    const panels = 10
    const panelH = (17.4 - y0) / panels
    for (let f = 0; f < 4; f++) {
      const [ax, az] = corners[f]
      const [bx, bz] = corners[(f + 1) % 4]
      for (let j = 0; j < panels; j++) {
        const rises = (f + j) % 2 === 0
        const ya = y0 + j * panelH + (rises ? 0 : panelH)
        const yb = y0 + j * panelH + (rises ? panelH : 0)
        dir.set(bx - ax, yb - ya, bz - az)
        const len = dir.length()
        // rotate the unit cylinder's Y axis onto the brace segment direction
        q.setFromUnitVectors(up, dir.normalize())
        e.setFromQuaternion(q)
        out.push({
          position: [(ax + bx) / 2, (ya + yb) / 2, (az + bz) / 2],
          rotation: [e.x, e.y, e.z],
          scale: [1, len, 1],
        })
      }
    }
    return out
  }, [])

  // Crown ring of 12 bulbs + a dotted run up the column (the old neon strip).
  const bulbs = useMemo<[number, number, number][]>(() => {
    const pts: [number, number, number][] = []
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      pts.push([Math.cos(a) * 1.15, TOWER_H - 0.1, Math.sin(a) * 1.15])
    }
    for (let i = 0; i < 12; i++) pts.push([1.1, 1.8 + i * 1.3, 0])
    return pts
  }, [])

  const valance = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => {
        const a = (i / 22) * Math.PI * 2
        return [Math.cos(a) * 2.78, 0.58, Math.sin(a) * 2.78] as [number, number, number]
      }),
    []
  )

  const queuePosts = useMemo<[number, number, number][]>(() => {
    const [ox, , oz] = spec.trigger.offset
    const dir = new THREE.Vector3(-ox, 0, -oz).normalize()
    const side = new THREE.Vector3(-dir.z, 0, dir.x)
    const pts: [number, number, number][] = []
    for (let i = 0; i < 2; i++) {
      for (const s of [-0.9, 0.9]) {
        const d = 1.2 + i * 1.6
        pts.push([ox + dir.x * d + side.x * s, 0.55, oz + dir.z * d + side.z * s])
      }
    }
    return pts
  }, [])

  useFrame((_, dt) => {
    const st = useGameStore.getState()
    const r = ring.current
    if (!r) return
    const mine = st.activeRide === spec.id
    if (!st.paused) {
      if (mine && phase.current === 'running') {
        r.position.y = towerY(elapsed.current)
      } else {
        // ease back to the loading height whenever not running — exponential
        // approach with a ~1s time constant, frame-rate independent, no pop
        r.position.y += (0.8 - r.position.y) * (1 - Math.exp(-dt))
      }
    }
    if (stripMat.current) stripMat.current.emissiveIntensity = isNight(st.timeOfDay) ? 2.6 : 0.12

    if (mine && phase.current !== 'idle') {
      _v.set(
        spec.position[0] + outDir.x * 2.1,
        r.position.y + 0.9,
        spec.position[2] + outDir.z * 2.1
      )
      _dir.copy(outDir)
      _t.copy(_v).addScaledVector(_dir, 30)
      _t.y = Math.max(1, _v.y * 0.55) // gaze dips toward the park below
      // Stomach-drop FOV + catch shake, only during the RUNNING fall timeline.
      const g = phase.current === 'running' ? dropG(elapsed.current) : undefined
      applyRideCamera(camera, _v, _t, dt, false, g)
    }
  })

  return (
    <group position={spec.position}>
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[0, 0.35, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[2.6, 2.9, 0.7, 24]} />
          <meshStandardMaterial color={PALETTE.navy} />
        </mesh>
      </RigidBody>
      {/* gold lip + scalloped valance skirt around the platform edge */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.71, 0]} material={goldMat}>
        <torusGeometry args={[2.62, 0.05, 6, 36]} />
      </mesh>
      <Instances limit={valance.length}>
        <coneGeometry args={[0.34, 0.55, 6]} />
        <meshStandardMaterial color="#ffffff" />
        {valance.map((p, i) => (
          <Instance key={i} position={p} rotation={[Math.PI, 0, 0]} color={i % 2 ? PALETTE.cream : PALETTE.red} />
        ))}
      </Instances>
      {queuePosts.map((p, i) => (
        <group key={i} position={p}>
          <mesh>
            <cylinderGeometry args={[0.05, 0.07, 1.1, 8]} />
            <meshStandardMaterial color={PALETTE.wood} />
          </mesh>
          <mesh position={[0, 0.62, 0]} material={goldMat}>
            <sphereGeometry args={[0.09, 8, 8]} />
          </mesh>
        </group>
      ))}

      {/* lattice tower: same solid footprint as the old column */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.8, TOWER_H / 2, 0.8]} position={[0, TOWER_H / 2, 0]} />
      </RigidBody>
      <Instances limit={4} castShadow>
        <cylinderGeometry args={[0.09, 0.11, TOWER_H, 8]} />
        <meshStandardMaterial color={PALETTE.navy} metalness={0.2} roughness={0.4} />
        {[
          [POST, POST],
          [-POST, POST],
          [-POST, -POST],
          [POST, -POST],
        ].map(([x, z], i) => (
          <Instance key={i} position={[x, TOWER_H / 2, z]} />
        ))}
      </Instances>
      <Instances limit={braces.length}>
        <cylinderGeometry args={[0.035, 0.035, 1, 6]} />
        <meshStandardMaterial color={PALETTE.cream} metalness={0.2} roughness={0.4} />
        {braces.map((b, i) => (
          <Instance key={i} position={b.position} rotation={b.rotation} scale={b.scale} />
        ))}
      </Instances>
      {/* candy-stripe section rings every 3m up the tower */}
      {[3, 6, 9, 12, 15].map((y) => (
        <mesh key={y} geometry={sectionRingGeo} material={stripeMat} position={[0, y, 0]} />
      ))}
      {/* batten the bulb run is mounted on (replaces the old neon bar) */}
      <mesh position={[1.02, 8.95, 0]}>
        <boxGeometry args={[0.07, 15.5, 0.26]} />
        <meshStandardMaterial color={PALETTE.cream} />
      </mesh>
      <Instances limit={bulbs.length}>
        <sphereGeometry args={[0.09, 8, 8]} />
        <meshStandardMaterial
          ref={stripMat}
          color={PALETTE.bulbWarm}
          emissive={PALETTE.bulbWarm}
          emissiveIntensity={0.12}
        />
        {bulbs.map((p, i) => (
          <Instance key={i} position={p} />
        ))}
      </Instances>

      {/* crown: gold trim, striped drum, finial and flag */}
      <mesh rotation-x={-Math.PI / 2} position={[0, TOWER_H - 0.4, 0]} material={goldMat}>
        <torusGeometry args={[1.02, 0.06, 8, 28]} />
      </mesh>
      <mesh material={stripeMat} position={[0, TOWER_H + 0.1, 0]}>
        <cylinderGeometry args={[1.05, 1.15, 0.5, 20, 1, true]} />
      </mesh>
      <mesh position={[0, TOWER_H + 0.95, 0]} material={goldMat} castShadow>
        <coneGeometry args={[1.05, 1.2, 12]} />
      </mesh>
      <mesh position={[0, TOWER_H + 1.9, 0]} material={goldMat}>
        <cylinderGeometry args={[0.025, 0.025, 1.2, 6]} />
      </mesh>
      <mesh geometry={flagGeo} position={[0.02, TOWER_H + 2.15, 0]}>
        <meshStandardMaterial color={PALETTE.red} side={THREE.DoubleSide} />
      </mesh>

      <group ref={ring} position={[0, 0.8, 0]}>
        <mesh>
          <torusGeometry args={[1.75, 0.22, 10, 28]} />
          <meshStandardMaterial color={PALETTE.red} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.16, 0]} material={goldMat}>
          <torusGeometry args={[1.78, 0.045, 6, 36]} />
        </mesh>
        {seatAngles.map((a, i) => (
          <group key={i} rotation-y={-a} position={[Math.cos(a) * 1.95, 0, Math.sin(a) * 1.95]}>
            <mesh geometry={seatGeo} material={seatMat} position={[0, 0.18, 0]} />
            <mesh geometry={seatRimGeo} material={goldMat} rotation-x={-Math.PI / 2} position={[0, 0.18, 0]} />
            {/* over-shoulder harness hoop, arcing front-to-back */}
            <mesh geometry={harnessGeo} material={goldMat} rotation-y={Math.PI / 2} position={[0, 0.3, 0]} />
          </group>
        ))}
      </group>
      <RideTrigger spec={spec} />
    </group>
  )
}

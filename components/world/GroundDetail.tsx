'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { Instances, Instance } from '@react-three/drei'
import { useGameStore, type Quality } from '@/state/useGameStore'
import {
  mulberry32, RIDE_LIST, PARK_RADIUS,
  BOOTH_POS, GATE_POS, RESTROOM_POS, TENT_POS, BALLOON_STALL_POS,
  STALLS, GAME_STALLS, VENDOR_CARTS, RICKSHAW_POS,
} from '@/lib/spawn'

/** Per-quality scatter counts for each detail type. */
const TUFTS_BY_Q: Record<Quality, number> = { low: 70, medium: 150, high: 280 }
const BUSHES_BY_Q: Record<Quality, number> = { low: 10, medium: 18, high: 30 }
const ROCKS_BY_Q: Record<Quality, number> = { low: 8, medium: 14, high: 20 }

interface Scatter {
  x: number
  z: number
  s: number
  rot: number
  /** Per-instance tint (green tufts/bushes; grey rocks). */
  color: THREE.Color
}

const INNER_R = 13.5 // outside the plaza disc
const OUTER_R = PARK_RADIUS - 3

// --- Road / structure exclusion -------------------------------------------
// The paving is: a plaza disc (r≈12), a midway RING (r 25.5–28.5), and radial
// STRIPS (width 3) from the plaza out to every ride entrance + the booth + gate.
// Scenery must avoid all of that, plus a clearance around every structure.

/** Radial path strip centre-lines: same targets Pathways.tsx draws strips to. */
const STRIP_TARGETS: [number, number][] = [
  ...RIDE_LIST.map((s): [number, number] => [
    s.position[0] + s.trigger.offset[0],
    s.position[2] + s.trigger.offset[2],
  ]),
  [BOOTH_POS[0], BOOTH_POS[2]],
  [GATE_POS[0], GATE_POS[2]],
]

/** Structures to keep clear of: [x, z, clearanceRadius]. */
const STRUCTURES: [number, number, number][] = [
  [0, 0, 3.5], // fountain
  [BOOTH_POS[0], BOOTH_POS[2], 4],
  [GATE_POS[0], GATE_POS[2], 5],
  [RESTROOM_POS[0], RESTROOM_POS[2], 4],
  [TENT_POS[0], TENT_POS[2], 6.5],
  [BALLOON_STALL_POS[0], BALLOON_STALL_POS[2], 3],
  [RICKSHAW_POS[0], RICKSHAW_POS[2], 3],
  ...RIDE_LIST.map((s): [number, number, number] => [s.position[0], s.position[2], 7]),
  ...STALLS.map((s): [number, number, number] => [s.position[0], s.position[2], 4]),
  ...GAME_STALLS.map((s): [number, number, number] => [s.position[0], s.position[2], 4]),
  ...VENDOR_CARTS.map((c): [number, number, number] => [c.position[0], c.position[2], 3]),
]

const STRIP_HALF = 2.4 // strip is 3 wide; clear a touch more
const RING_INNER = 23.5
const RING_OUTER = 30

/** True if (x, z) lands on a path/ring/strip or too close to a structure. */
function blocked(x: number, z: number): boolean {
  const r2 = x * x + z * z
  if (r2 < INNER_R * INNER_R) return true // plaza + core
  if (r2 > RING_INNER * RING_INNER && r2 < RING_OUTER * RING_OUTER) return true // midway ring
  for (const [sx, sz, cr] of STRUCTURES) {
    if ((x - sx) ** 2 + (z - sz) ** 2 < cr * cr) return true
  }
  // radial strips: near the centre-line from origin out to each target
  for (const [tx, tz] of STRIP_TARGETS) {
    const len = Math.hypot(tx, tz) || 1
    const dx = tx / len
    const dz = tz / len
    const proj = x * dx + z * dz // distance along the strip direction
    if (proj < 8 || proj > len + 2) continue
    const perp = Math.abs(x * -dz + z * dx)
    if (perp < STRIP_HALF) return true
  }
  return false
}

/** Rejection-sample `n` deterministic scatter points on the open grass. */
function scatter(rnd: () => number, n: number, tint: (r: () => number) => THREE.Color, sMin: number, sMax: number): Scatter[] {
  const out: Scatter[] = []
  let tries = 0
  while (out.length < n && tries < n * 80) {
    tries++
    const a = rnd() * Math.PI * 2
    const r = INNER_R + rnd() * (OUTER_R - INNER_R)
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    if (blocked(x, z)) continue
    out.push({ x, z, s: sMin + rnd() * (sMax - sMin), rot: rnd() * Math.PI * 2, color: tint(rnd) })
  }
  return out
}

/**
 * Decorative instanced ground scatter — small grass tufts, low bushes and a
 * handful of rocks — to break up the flat PBR lawn. One InstancedMesh per type,
 * deterministically placed on the OPEN GRASS only (never on the plaza, midway
 * ring, radial paths or on top of structures) and quality-scaled. Static.
 */
export default function GroundDetail() {
  const quality = useGameStore((s) => s.quality)

  const { tufts, bushes, rocks } = useMemo(() => {
    const rnd = mulberry32(20260615)
    const tufts = scatter(rnd, TUFTS_BY_Q[quality], (r) => new THREE.Color().setHSL(0.28 + r() * 0.05, 0.45, 0.30 + r() * 0.1), 0.6, 1.0)
    const bushes = scatter(rnd, BUSHES_BY_Q[quality], (r) => new THREE.Color().setHSL(0.31 + r() * 0.04, 0.42, 0.22 + r() * 0.08), 0.45, 0.8)
    const rocks = scatter(rnd, ROCKS_BY_Q[quality], (r) => new THREE.Color().setHSL(0.08 + r() * 0.05, 0.04, 0.42 + r() * 0.16), 0.5, 1.1)
    return { tufts, bushes, rocks }
  }, [quality])

  // A grass tuft: 6 thin short blades fanned from a common base.
  const tuftGeo = useMemo(() => {
    const blade = new THREE.ConeGeometry(0.022, 0.32, 3)
    const parts: THREE.BufferGeometry[] = []
    const rnd = mulberry32(7)
    for (let i = 0; i < 6; i++) {
      const g = blade.clone()
      g.rotateZ((rnd() - 0.5) * 0.5)
      g.rotateX((rnd() - 0.5) * 0.5)
      g.translate((rnd() - 0.5) * 0.18, 0.16, (rnd() - 0.5) * 0.18)
      parts.push(g)
    }
    blade.dispose()
    return mergeSimple(parts)
  }, [])

  // A bush: 5 small lobes packed into a rounded dome.
  const bushGeo = useMemo(() => {
    const lobe = new THREE.SphereGeometry(0.4, 8, 6)
    const parts: THREE.BufferGeometry[] = [
      lobe.clone().translate(0, 0.34, 0),
      lobe.clone().scale(0.8, 0.8, 0.8).translate(0.3, 0.26, 0.08),
      lobe.clone().scale(0.78, 0.78, 0.78).translate(-0.26, 0.24, -0.14),
      lobe.clone().scale(0.7, 0.7, 0.7).translate(0.05, 0.22, -0.3),
      lobe.clone().scale(0.72, 0.72, 0.72).translate(-0.05, 0.5, 0.05),
    ]
    lobe.dispose()
    return mergeSimple(parts)
  }, [])

  const rockGeo = useMemo(() => {
    const g = new THREE.DodecahedronGeometry(0.4, 0)
    g.scale(1, 0.6, 0.9)
    g.translate(0, 0.18, 0)
    g.computeVertexNormals()
    return g
  }, [])

  return (
    <group>
      {/* grass tufts — no shadow (cheap, low to the ground) */}
      <Instances limit={Math.max(tufts.length, 1)} geometry={tuftGeo}>
        <meshStandardMaterial color="#ffffff" roughness={0.95} />
        {tufts.map((t, i) => (
          <Instance key={i} position={[t.x, 0, t.z]} rotation={[0, t.rot, 0]} scale={t.s} color={t.color} />
        ))}
      </Instances>
      {/* bushes — small green clusters, cast shadow */}
      <Instances limit={Math.max(bushes.length, 1)} castShadow geometry={bushGeo}>
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
        {bushes.map((b, i) => (
          <Instance key={i} position={[b.x, 0, b.z]} rotation={[0, b.rot, 0]} scale={b.s} color={b.color} />
        ))}
      </Instances>
      {/* rocks — grey low-poly boulders, cast shadow */}
      <Instances limit={Math.max(rocks.length, 1)} castShadow geometry={rockGeo}>
        <meshStandardMaterial color="#ffffff" roughness={1} />
        {rocks.map((r, i) => (
          <Instance key={i} position={[r.x, 0, r.z]} rotation={[r.rot * 0.2, r.rot, r.rot * 0.15]} scale={r.s} color={r.color} />
        ))}
      </Instances>
    </group>
  )
}

/**
 * Minimal position+normal geometry merge (avoids a dependency on
 * BufferGeometryUtils). All input geometries here are non-indexed cones/spheres
 * sharing the same attribute layout.
 */
function mergeSimple(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const nonIndexed = geos.map((g) => (g.index ? g.toNonIndexed() : g))
  let posCount = 0
  for (const g of nonIndexed) posCount += g.getAttribute('position').count
  const pos = new Float32Array(posCount * 3)
  const nrm = new Float32Array(posCount * 3)
  let o = 0
  for (const g of nonIndexed) {
    const p = g.getAttribute('position') as THREE.BufferAttribute
    const n = g.getAttribute('normal') as THREE.BufferAttribute
    pos.set(p.array as Float32Array, o)
    nrm.set(n.array as Float32Array, o)
    o += p.count * 3
    g.dispose()
  }
  const merged = new THREE.BufferGeometry()
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  merged.setAttribute('normal', new THREE.BufferAttribute(nrm, 3))
  return merged
}

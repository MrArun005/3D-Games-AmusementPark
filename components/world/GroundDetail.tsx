'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { Instances, Instance } from '@react-three/drei'
import { useGameStore, type Quality } from '@/state/useGameStore'
import { mulberry32, RIDE_LIST, PARK_RADIUS } from '@/lib/spawn'

/** Per-quality scatter counts for each detail type. */
const TUFTS_BY_Q: Record<Quality, number> = { low: 60, medium: 140, high: 260 }
const BUSHES_BY_Q: Record<Quality, number> = { low: 12, medium: 24, high: 40 }
const ROCKS_BY_Q: Record<Quality, number> = { low: 8, medium: 14, high: 22 }

interface Scatter {
  x: number
  z: number
  s: number
  rot: number
  /** Per-instance tint (green tufts/bushes; grey rocks). */
  color: THREE.Color
}

/** Keep scenery off the paved areas + away from ride pads, plaza and fountain. */
const RIDE_CLEAR_SQ = 7 * 7
const PLAZA_CLEAR_SQ = 13 * 13
const FOUNTAIN_CLEAR_SQ = 3 * 3
const INNER_R = 6
const OUTER_R = PARK_RADIUS - 3

/**
 * Rejection-sample `n` deterministic scatter points across the grass ring
 * (INNER_R → OUTER_R), excluding ride pads, the plaza/path core and the
 * fountain. `tint(rnd)` picks the per-instance colour.
 */
function scatter(rnd: () => number, n: number, tint: (r: () => number) => THREE.Color, sMin: number, sMax: number): Scatter[] {
  const out: Scatter[] = []
  let tries = 0
  while (out.length < n && tries < n * 40) {
    tries++
    const a = rnd() * Math.PI * 2
    const r = INNER_R + rnd() * (OUTER_R - INNER_R)
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    if (x * x + z * z < PLAZA_CLEAR_SQ) continue // plaza + paths core
    if (x * x + z * z < FOUNTAIN_CLEAR_SQ) continue // fountain (redundant inside plaza, kept explicit)
    if (RIDE_LIST.some((s) => (x - s.position[0]) ** 2 + (z - s.position[2]) ** 2 < RIDE_CLEAR_SQ)) continue
    out.push({ x, z, s: sMin + rnd() * (sMax - sMin), rot: rnd() * Math.PI * 2, color: tint(rnd) })
  }
  return out
}

/**
 * Decorative instanced ground scatter — grass tufts, low bushes and a handful
 * of rocks — to break up the flat PBR lawn. One InstancedMesh per detail type,
 * deterministically placed (so it never reshuffles) and quality-scaled. Static:
 * no per-frame work. No collider; it's purely visual.
 */
export default function GroundDetail() {
  const quality = useGameStore((s) => s.quality)

  const { tufts, bushes, rocks } = useMemo(() => {
    const rnd = mulberry32(20260615)
    // grass tufts — varied yellow-green
    const tufts = scatter(rnd, TUFTS_BY_Q[quality], (r) => new THREE.Color().setHSL(0.27 + r() * 0.06, 0.5, 0.32 + r() * 0.12), 0.7, 1.4)
    // bushes — deeper, more saturated green
    const bushes = scatter(rnd, BUSHES_BY_Q[quality], (r) => new THREE.Color().setHSL(0.3 + r() * 0.05, 0.45, 0.24 + r() * 0.1), 0.8, 1.5)
    // rocks — desaturated grey, slight warm/cool drift
    const rocks = scatter(rnd, ROCKS_BY_Q[quality], (r) => new THREE.Color().setHSL(0.08 + r() * 0.06, 0.05, 0.4 + r() * 0.18), 0.6, 1.3)
    return { tufts, bushes, rocks }
  }, [quality])

  // Procedural geometry built once — a 4-blade tuft, a 3-lobe bush, a low rock.
  const tuftGeo = useMemo(() => {
    const blade = new THREE.ConeGeometry(0.05, 0.5, 4)
    const parts: THREE.BufferGeometry[] = []
    const offs: [number, number, number, number][] = [
      [0, 0, 0, 0],
      [0.08, 0.05, 0.5, -0.18],
      [-0.07, -0.04, -0.5, 0.16],
      [0.04, -0.08, 1.2, 0.12],
    ]
    for (const [ox, oz, tilt, lean] of offs) {
      const g = blade.clone()
      g.rotateX(lean)
      g.rotateZ(tilt * 0.12)
      g.translate(ox, 0.25, oz)
      parts.push(g)
    }
    blade.dispose()
    return mergeSimple(parts)
  }, [])

  const bushGeo = useMemo(() => {
    const lobe = new THREE.SphereGeometry(0.5, 8, 6)
    const parts: THREE.BufferGeometry[] = [
      lobe.clone().translate(0, 0.42, 0),
      lobe.clone().scale(0.8, 0.8, 0.8).translate(0.38, 0.3, 0.1),
      lobe.clone().scale(0.75, 0.75, 0.75).translate(-0.32, 0.28, -0.18),
    ]
    lobe.dispose()
    return mergeSimple(parts)
  }, [])

  const rockGeo = useMemo(() => {
    const g = new THREE.DodecahedronGeometry(0.5, 0)
    g.scale(1, 0.65, 0.9) // squash so it sits like a boulder
    g.translate(0, 0.25, 0)
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
      {/* bushes — green clusters, cast shadow */}
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

'use client'

import { useMemo } from 'react'
import { Instances, Instance } from '@react-three/drei'
import { RigidBody, CylinderCollider } from '@react-three/rapier'
import { mulberry32, RIDE_LIST } from '@/lib/spawn'

interface Tree {
  x: number
  z: number
  s: number
  shade: string
}

/**
 * ~100 instanced trees seeded deterministically and rejection-sampled away from
 * ride pads and the gate. The trunk is one instanced layer; the canopy is THREE
 * stacked/offset instanced cone layers (same per-tree transform) for a fuller,
 * rounder crown. Foliage is tinted per-instance for variety and uses a high
 * roughness so it reads naturally under the IBL/sky.
 */
export default function Trees() {
  const trees = useMemo<Tree[]>(() => {
    const rnd = mulberry32(20260611)
    const arr: Tree[] = []
    let tries = 0
    while (arr.length < 100 && tries < 1000) {
      tries++
      const a = rnd() * Math.PI * 2
      const r = 38 + rnd() * 18
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      if (RIDE_LIST.some((s) => (x - s.position[0]) ** 2 + (z - s.position[2]) ** 2 < 170)) continue
      if (x * x + (z - 40) ** 2 < 120) continue // keep the gate clear
      // Per-instance green tint: vary both hue (slightly) and lightness so the
      // canopy isn't a uniform colour. Base material is white so this multiplies.
      arr.push({
        x,
        z,
        s: 0.8 + rnd() * 0.7,
        shade: `hsl(${108 + Math.round(rnd() * 18)}, ${40 + Math.round(rnd() * 14)}%, ${24 + Math.round(rnd() * 14)}%)`,
      })
    }
    return arr
  }, [])

  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {trees.map((t, i) => (
          <CylinderCollider
            key={i}
            args={[0.8 * t.s, 0.28 * t.s]}
            position={[t.x, 0.8 * t.s, t.z]}
          />
        ))}
      </RigidBody>

      {/* trunk — wood brown, very rough */}
      <Instances limit={trees.length} castShadow>
        <cylinderGeometry args={[0.18, 0.26, 1.6, 7]} />
        <meshStandardMaterial color="#5c3d22" roughness={0.95} />
        {trees.map((t, i) => (
          <Instance key={i} position={[t.x, 0.8 * t.s, t.z]} scale={t.s} />
        ))}
      </Instances>

      {/* canopy bottom (widest) */}
      <Instances limit={trees.length} castShadow>
        <coneGeometry args={[1.45, 2.4, 8]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
        {trees.map((t, i) => (
          <Instance key={i} position={[t.x, (1.6 + 1.0) * t.s, t.z]} scale={t.s} color={t.shade} />
        ))}
      </Instances>

      {/* canopy middle */}
      <Instances limit={trees.length} castShadow>
        <coneGeometry args={[1.15, 2.2, 8]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
        {trees.map((t, i) => (
          <Instance key={i} position={[t.x, (1.6 + 1.85) * t.s, t.z]} scale={t.s} color={t.shade} />
        ))}
      </Instances>

      {/* canopy top (narrowest, points the crown) */}
      <Instances limit={trees.length} castShadow>
        <coneGeometry args={[0.8, 1.9, 8]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
        {trees.map((t, i) => (
          <Instance key={i} position={[t.x, (1.6 + 2.7) * t.s, t.z]} scale={t.s} color={t.shade} />
        ))}
      </Instances>
    </group>
  )
}

'use client'

import { useMemo } from 'react'
import { Instances, Instance } from '@react-three/drei'
import { mulberry32, RIDE_LIST } from '@/lib/spawn'

interface Tree {
  x: number
  z: number
  s: number
  shade: string
}

/**
 * ~100 instanced trees (trunk + canopy instanced separately) seeded
 * deterministically, rejection-sampled away from ride pads and the gate.
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
      arr.push({ x, z, s: 0.8 + rnd() * 0.7, shade: `hsl(115, 45%, ${22 + Math.round(rnd() * 14)}%)` })
    }
    return arr
  }, [])

  return (
    <group>
      <Instances limit={trees.length} castShadow>
        <cylinderGeometry args={[0.18, 0.26, 1.6, 7]} />
        <meshStandardMaterial color="#6b4a2f" />
        {trees.map((t, i) => (
          <Instance key={i} position={[t.x, 0.8 * t.s, t.z]} scale={t.s} />
        ))}
      </Instances>
      <Instances limit={trees.length} castShadow>
        <coneGeometry args={[1.3, 2.8, 8]} />
        <meshStandardMaterial color="#3f7a3f" />
        {trees.map((t, i) => (
          <Instance key={i} position={[t.x, (1.6 + 1.3) * t.s, t.z]} scale={t.s} color={t.shade} />
        ))}
      </Instances>
    </group>
  )
}

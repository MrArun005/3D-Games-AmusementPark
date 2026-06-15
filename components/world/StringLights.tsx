'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Instances, Instance } from '@react-three/drei'
import { useGameStore, isNight } from '@/state/useGameStore'
import { LAMP_POSITIONS, PLAZA_LAMP_COUNT } from '@/lib/spawn'
import { PALETTE } from '@/lib/palette'

const PER_SPAN = 9
const WIRE_Y = 3.1
const SAG = 0.5

/**
 * Warm bulb strings sagging between consecutive midway lamp posts. All bulbs
 * share one emissive material that the night cycle switches on (bloom > 1.05).
 */
export default function StringLights() {
  const bulbMat = useRef<THREE.MeshStandardMaterial>(null)

  const bulbs = useMemo(() => {
    const midway = LAMP_POSITIONS.slice(PLAZA_LAMP_COUNT)
    const out: [number, number, number][] = []
    for (let i = 0; i < midway.length; i++) {
      const [ax, az] = midway[i]
      const [bx, bz] = midway[(i + 1) % midway.length]
      for (let k = 1; k <= PER_SPAN; k++) {
        const t = k / (PER_SPAN + 1)
        // quadratic sag: 0 at the posts, SAG at midspan
        out.push([ax + (bx - ax) * t, WIRE_Y - SAG * 4 * t * (1 - t), az + (bz - az) * t])
      }
    }
    return out
  }, [])

  useFrame(() => {
    if (bulbMat.current) {
      bulbMat.current.emissiveIntensity = isNight(useGameStore.getState().timeOfDay) ? 2.2 : 0
    }
  })

  return (
    <Instances limit={bulbs.length}>
      <sphereGeometry args={[0.07, 8, 6]} />
      <meshStandardMaterial
        ref={bulbMat}
        color={PALETTE.cream}
        emissive={PALETTE.bulbWarm}
        emissiveIntensity={0}
      />
      {bulbs.map((p, i) => (
        <Instance key={i} position={p} />
      ))}
    </Instances>
  )
}

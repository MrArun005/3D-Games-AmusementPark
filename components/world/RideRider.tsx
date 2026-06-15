'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { BAZAAR } from '@/lib/palette'

const CLOTHES = [BAZAAR.magenta, BAZAAR.marigold, BAZAAR.parrotGreen, BAZAAR.turquoise, BAZAAR.purple, BAZAAR.skyBlue, BAZAAR.chilliRed, BAZAAR.yellow]
const SKIN = [BAZAAR.skin1, BAZAAR.skin2, BAZAAR.skin3]

/**
 * A small static seated figure for ride seats: torso, head, thighs forward,
 * shins down — reads as a person sitting. `variant` picks deterministic colours.
 * Purely visual (no physics/animation); cheap enough for ~16 on screen.
 */
export default function RideRider({ variant = 0 }: { variant?: number }) {
  const { cloth, skin } = useMemo(
    () => ({ cloth: CLOTHES[variant % CLOTHES.length], skin: SKIN[variant % SKIN.length] }),
    [variant],
  )
  return (
    <group>
      <mesh position={[0, 0.32, 0]} castShadow>
        <capsuleGeometry args={[0.16, 0.32, 4, 8]} />
        <meshStandardMaterial color={cloth} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.7, 0]} castShadow>
        <sphereGeometry args={[0.13, 12, 10]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.12, 0.16]} rotation-x={-1.3}>
        <capsuleGeometry args={[0.08, 0.3, 4, 8]} />
        <meshStandardMaterial color={cloth} roughness={0.85} />
      </mesh>
      <mesh position={[0, -0.1, 0.34]}>
        <capsuleGeometry args={[0.07, 0.3, 4, 8]} />
        <meshStandardMaterial color="#3b332b" roughness={0.9} />
      </mesh>
    </group>
  )
}

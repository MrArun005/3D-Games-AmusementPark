'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { Instances, Instance } from '@react-three/drei'
import { BALLOON_STALL_POS, BALLOON_STALL_COST } from '@/lib/spawn'
import { PALETTE, BAZAAR } from '@/lib/palette'
import { makeStripesTexture, makeTextTexture } from '@/lib/textures'
import { useGameStore } from '@/state/useGameStore'

const [BX, , BZ] = BALLOON_STALL_POS
const YAW = Math.atan2(-BX, -BZ)
const NEAR_R = 4.2

export const BALLOON_PALETTE = [
  BAZAAR.chilliRed, BAZAAR.yellow, BAZAAR.turquoise, BAZAAR.magenta,
  BAZAAR.parrotGreen, BAZAAR.marigold, BAZAAR.skyBlue, BAZAAR.purple,
]

/** A balloon seller: a cart of bobbing balloons with a buy interaction. */
export default function BalloonStall() {
  const signTex = useMemo(() => makeTextTexture('BALLOONS'), [])
  const canopyTex = useMemo(() => makeStripesTexture(BAZAAR.magenta, PALETTE.cream, 12), [])
  const bunch = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2
        return {
          pos: [Math.cos(a) * (0.3 + (i % 3) * 0.12), 2.4 + (i % 4) * 0.28, Math.sin(a) * (0.3 + (i % 3) * 0.12)] as [number, number, number],
          color: BALLOON_PALETTE[i % BALLOON_PALETTE.length],
        }
      }),
    []
  )

  useFrame(() => {
    const st = useGameStore.getState()
    if (!st.activeRide && !st.activeStall && !st.shopMenu && !st.paused) {
      const near = (st.playerPos.x - BX) ** 2 + (st.playerPos.z - BZ) ** 2 < NEAR_R * NEAR_R
      if (near && st.nearbyShop?.id !== 'balloons') {
        st.setNearbyShop({ id: 'balloons', kind: 'balloon', name: 'BALLOONS', cost: BALLOON_STALL_COST, emoji: '🎈', color: BAZAAR.magenta })
      } else if (!near && st.nearbyShop?.id === 'balloons') {
        st.setNearbyShop(null)
      }
    }
  })

  return (
    <group position={BALLOON_STALL_POS} rotation-y={YAW}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.9, 0.6, 0.6]} position={[0, 0.6, 0]} />
      </RigidBody>
      {/* cart body */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[1.7, 0.7, 1.1]} />
        <meshStandardMaterial color={PALETTE.wood} roughness={0.85} />
      </mesh>
      {[-0.6, 0.6].map((z) => (
        <mesh key={z} position={[0, 0.25, z]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.28, 0.05, 8, 16]} />
          <meshStandardMaterial color="#2e2620" />
        </mesh>
      ))}
      {/* pole + striped canopy */}
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 1.9, 8]} />
        <meshStandardMaterial color={PALETTE.navy} />
      </mesh>
      <mesh position={[0, 2.5, 0]} castShadow>
        <coneGeometry args={[1.1, 0.5, 12]} />
        <meshStandardMaterial map={canopyTex} side={THREE.DoubleSide} />
      </mesh>
      {/* balloons on strings */}
      <Instances limit={bunch.length} castShadow>
        <sphereGeometry args={[0.17, 12, 10]} />
        <meshStandardMaterial roughness={0.4} />
        {bunch.map((b, i) => (
          <Instance key={i} position={b.pos} color={b.color} />
        ))}
      </Instances>
      <mesh position={[0, 3.35, 0]}>
        <planeGeometry args={[1.8, 0.45]} />
        <meshStandardMaterial map={signTex} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

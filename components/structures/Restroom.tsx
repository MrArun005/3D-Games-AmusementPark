'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { RigidBody } from '@react-three/rapier'
import { RESTROOM_POS } from '@/lib/spawn'
import { PALETTE } from '@/lib/palette'
import { makeStripesTexture, makeTextTexture } from '@/lib/textures'

/** Set-dressing restroom block with collision. */
export default function Restroom() {
  const signTex = useMemo(() => makeTextTexture('RESTROOMS'), [])
  const trimTex = useMemo(() => makeStripesTexture(PALETTE.red, PALETTE.cream, 12), [])

  return (
    <group position={RESTROOM_POS}>
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[0, 1.4, 0]} castShadow>
          <boxGeometry args={[4.4, 2.8, 3]} />
          <meshStandardMaterial color={PALETTE.cream} />
        </mesh>
      </RigidBody>
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[4.5, 0.4, 3.1]} />
        <meshStandardMaterial color={PALETTE.wood} />
      </mesh>
      <mesh position={[0, 2.62, 0]}>
        <boxGeometry args={[4.5, 0.28, 3.1]} />
        <meshStandardMaterial map={trimTex} />
      </mesh>
      {/* 4-seg cylinder turned 45° + anisotropic scale = rectangular hip roof */}
      <mesh position={[0, 3.3, 0]} rotation-y={Math.PI / 4} scale={[1.18, 1, 0.82]} castShadow>
        <cylinderGeometry args={[0.8, 3.2, 1.0, 4]} />
        <meshStandardMaterial color={PALETTE.navy} flatShading />
      </mesh>
      <mesh position={[0, 3.88, 0]}>
        <sphereGeometry args={[0.12, 10, 8]} />
        <meshStandardMaterial color={PALETTE.gold} />
      </mesh>
      <mesh position={[0, 2.2, 1.52]}>
        <planeGeometry args={[2.6, 0.55]} />
        <meshStandardMaterial map={signTex} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.9, 1.51]}>
        <planeGeometry args={[0.9, 1.8]} />
        <meshStandardMaterial color={PALETTE.navy} />
      </mesh>
      <mesh position={[0, 1.86, 1.52]}>
        <boxGeometry args={[1.1, 0.07, 0.08]} />
        <meshStandardMaterial color={PALETTE.gold} />
      </mesh>
      {[-1.5, 1.5].map((x) => (
        <group key={x} position={[x, 0, 1.85]}>
          <mesh position={[0, 0.21, 0]}>
            <boxGeometry args={[0.65, 0.42, 0.65]} />
            <meshStandardMaterial color={PALETTE.wood} />
          </mesh>
          <mesh position={[0, 0.6, 0]}>
            <sphereGeometry args={[0.3, 10, 8]} />
            <meshStandardMaterial color="#4e7d46" />
          </mesh>
          <mesh position={[0.18, 0.5, 0.12]}>
            <sphereGeometry args={[0.19, 8, 6]} />
            <meshStandardMaterial color="#5d8f53" />
          </mesh>
          <mesh position={[-0.2, 0.52, -0.08]}>
            <sphereGeometry args={[0.17, 8, 6]} />
            <meshStandardMaterial color="#446c3d" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

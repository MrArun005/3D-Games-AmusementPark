'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Instances, Instance } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { BOOTH_POS } from '@/lib/spawn'
import { PALETTE } from '@/lib/palette'
import { makeStripesTexture, makeTextTexture } from '@/lib/textures'
import { useGameStore, isNight } from '@/state/useGameStore'

/**
 * Ticket booth: solid kiosk. Standing near it (plain distance check — physics
 * sensors proved unreliable) and pressing E claims tickets via GameSystems.
 */
export default function TicketBooth() {
  const signTex = useMemo(() => makeTextTexture('TICKETS'), [])
  const wallTex = useMemo(() => makeStripesTexture(PALETTE.cream, PALETTE.red, 16), [])
  const roofTex = useMemo(() => makeStripesTexture(PALETTE.red, PALETTE.cream, 16), [])
  const awningTex = useMemo(() => makeStripesTexture(PALETTE.red, PALETTE.cream, 6), [])
  const bulbMat = useRef<THREE.MeshStandardMaterial>(null)

  const bulbPositions = useMemo(() => {
    const pts: [number, number, number][] = []
    for (let i = 0; i < 8; i++) pts.push([-1.05 + i * 0.3, 2.8, 1.42])
    pts.push([-1.15, 2.55, 1.42], [1.15, 2.55, 1.42], [-1.15, 2.35, 1.42], [1.15, 2.35, 1.42])
    return pts
  }, [])

  useFrame(() => {
    const st = useGameStore.getState()
    if (bulbMat.current) {
      bulbMat.current.emissiveIntensity = isNight(st.timeOfDay) ? 2.6 : 0.15
    }
    const near =
      Math.abs(st.playerPos.x - BOOTH_POS[0]) <= 3.4 && Math.abs(st.playerPos.z - BOOTH_POS[2]) <= 3.4
    if (near !== st.nearbyBooth) st.setNearbyBooth(near)
  })

  return (
    <group position={BOOTH_POS}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.3, 1.4, 1.1]} position={[0, 1.4, 0]} />
      </RigidBody>
      {/* π/8 turn points an octagon face at +z for the window and sign */}
      <mesh position={[0, 1.3, 0]} rotation-y={Math.PI / 8} castShadow>
        <cylinderGeometry args={[1.35, 1.45, 2.6, 8]} />
        <meshStandardMaterial map={wallTex} />
      </mesh>
      <mesh position={[0, 2.56, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[1.4, 0.055, 8, 32]} />
        <meshStandardMaterial color={PALETTE.gold} />
      </mesh>
      <mesh position={[0, 0.1, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[1.52, 0.07, 8, 32]} />
        <meshStandardMaterial color={PALETTE.redDark} />
      </mesh>
      <mesh position={[0, 1.45, 1.32]}>
        <planeGeometry args={[1.3, 0.85]} />
        <meshStandardMaterial color={PALETTE.navy} />
      </mesh>
      <mesh position={[0, 1.0, 1.42]}>
        <boxGeometry args={[1.6, 0.07, 0.35]} />
        <meshStandardMaterial color={PALETTE.wood} />
      </mesh>
      <mesh position={[0, 2.0, 1.55]} rotation-x={0.55}>
        <planeGeometry args={[1.8, 0.75]} />
        <meshStandardMaterial map={awningTex} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 2.5, 1.38]}>
        <planeGeometry args={[2.0, 0.48]} />
        <meshStandardMaterial map={signTex} side={THREE.DoubleSide} />
      </mesh>
      <Instances limit={bulbPositions.length}>
        <sphereGeometry args={[0.055, 8, 8]} />
        <meshStandardMaterial
          ref={bulbMat}
          color={PALETTE.bulbWarm}
          emissive={PALETTE.bulbWarm}
          emissiveIntensity={0.15}
        />
        {bulbPositions.map((p, i) => (
          <Instance key={i} position={p} />
        ))}
      </Instances>
      <mesh position={[0, 3.1, 0]} rotation-y={Math.PI / 8} castShadow>
        <coneGeometry args={[2.0, 1.05, 8]} />
        <meshStandardMaterial map={roofTex} />
      </mesh>
      <mesh position={[0, 3.66, 0]}>
        <sphereGeometry args={[0.09, 10, 8]} />
        <meshStandardMaterial color={PALETTE.gold} />
      </mesh>
      <mesh position={[0, 3.92, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.5, 6]} />
        <meshStandardMaterial color={PALETTE.navy} />
      </mesh>
      <mesh position={[0.19, 4.06, 0]}>
        <planeGeometry args={[0.36, 0.2]} />
        <meshStandardMaterial color={PALETTE.red} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

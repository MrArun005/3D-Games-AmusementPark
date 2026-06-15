'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { RigidBody } from '@react-three/rapier'
import { PALETTE } from '@/lib/palette'
import { makeStripesTexture, makeTextTexture } from '@/lib/textures'
import { useGameStore, isNight } from '@/state/useGameStore'

interface Props {
  id: string
  position: [number, number, number]
  name: string
  color: string
  emoji: string
  cost: number
}

const NEAR_R = 4.2

/** Food stall: collision + striped awning + popcorn prop, and a buy interaction. */
export default function FoodStall({ id, position, name, color, emoji, cost }: Props) {
  const signTex = useMemo(() => makeTextTexture(name), [name])
  const awningTex = useMemo(() => makeStripesTexture(color, PALETTE.cream, 10), [color])
  // theta -π/2..π/2 keeps the +z half; rotated 90° about x it hangs flat-side-up
  const scallopGeo = useMemo(
    () => new THREE.CylinderGeometry(0.24, 0.24, 0.07, 10, 1, false, -Math.PI / 2, Math.PI),
    []
  )
  const scallopMats = useMemo(
    () => [
      new THREE.MeshStandardMaterial({ color }),
      new THREE.MeshStandardMaterial({ color: PALETTE.cream }),
    ],
    [color]
  )
  const scallops = useMemo(() => Array.from({ length: 8 }, (_, i) => i), [])
  const popMat = useRef<THREE.MeshStandardMaterial>(null)

  useFrame(() => {
    const st = useGameStore.getState()
    if (popMat.current) {
      popMat.current.emissiveIntensity = isNight(st.timeOfDay) ? 2.4 : 0.6
    }
    // arm the buy prompt when the player is close and not otherwise occupied
    if (!st.activeRide && !st.activeStall && !st.shopMenu && !st.paused) {
      const near = (st.playerPos.x - position[0]) ** 2 + (st.playerPos.z - position[2]) ** 2 < NEAR_R * NEAR_R
      if (near && st.nearbyShop?.id !== id) {
        st.setNearbyShop({ id, kind: 'food', name, cost, emoji, color })
      } else if (!near && st.nearbyShop?.id === id) {
        st.setNearbyShop(null)
      }
    }
  })

  return (
    <group position={position}>
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[0, 1.1, 0]} castShadow>
          <boxGeometry args={[3.2, 2.2, 2.4]} />
          <meshStandardMaterial color={PALETTE.cream} />
        </mesh>
      </RigidBody>
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[3.3, 0.45, 2.5]} />
        <meshStandardMaterial color={PALETTE.wood} />
      </mesh>
      <mesh position={[0, 1.5, 1.21]}>
        <planeGeometry args={[2.2, 0.8]} />
        <meshStandardMaterial color={PALETTE.navy} />
      </mesh>
      {/* rounded counter: wood slab with a gold bullnose lip */}
      <mesh position={[0, 1.12, 1.42]}>
        <boxGeometry args={[3.0, 0.12, 0.55]} />
        <meshStandardMaterial color={PALETTE.wood} />
      </mesh>
      <mesh position={[0, 1.12, 1.7]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.06, 0.06, 3.0, 10]} />
        <meshStandardMaterial color={PALETTE.gold} />
      </mesh>
      <mesh position={[0, 2.45, 1.7]} rotation-x={0.5} castShadow>
        <planeGeometry args={[3.8, 1.3]} />
        <meshStandardMaterial map={awningTex} side={THREE.DoubleSide} />
      </mesh>
      {scallops.map((i) => (
        <mesh
          key={i}
          geometry={scallopGeo}
          material={scallopMats[i % 2]}
          position={[-1.6625 + i * 0.475, 1.88, 2.01]}
          rotation-x={Math.PI / 2}
        />
      ))}
      {[-1.8, 1.8].map((x) => (
        <mesh key={x} position={[x, 0.94, 2.0]}>
          <cylinderGeometry args={[0.035, 0.035, 1.88, 8]} />
          <meshStandardMaterial color={PALETTE.gold} />
        </mesh>
      ))}
      {[-1.0, 1.0].map((x) => (
        <mesh key={x} position={[x, 2.88, 1.3]}>
          <cylinderGeometry args={[0.04, 0.04, 1.35, 8]} />
          <meshStandardMaterial color={PALETTE.navy} />
        </mesh>
      ))}
      <mesh position={[0, 3.3, 1.32]}>
        <planeGeometry args={[2.6, 0.7]} />
        <meshStandardMaterial map={signTex} side={THREE.DoubleSide} />
      </mesh>
      {/* counter prop: little popcorn machine with a warm light inside the glass */}
      <group position={[0.8, 0, 1.42]}>
        <mesh position={[0, 1.24, 0]}>
          <boxGeometry args={[0.34, 0.12, 0.3]} />
          <meshStandardMaterial color={PALETTE.red} />
        </mesh>
        <mesh position={[0, 1.46, 0]}>
          <boxGeometry args={[0.3, 0.32, 0.26]} />
          <meshStandardMaterial color={PALETTE.cream} transparent opacity={0.28} roughness={0.1} />
        </mesh>
        <mesh position={[0, 1.56, 0]}>
          <boxGeometry args={[0.12, 0.09, 0.1]} />
          <meshStandardMaterial
            ref={popMat}
            color={PALETTE.bulbWarm}
            emissive={PALETTE.bulbWarm}
            emissiveIntensity={0.6}
          />
        </mesh>
        {(
          [
            [-0.06, 1.36, -0.02],
            [0.05, 1.35, 0.04],
            [0.0, 1.38, -0.05],
          ] as [number, number, number][]
        ).map((p, i) => (
          <mesh key={i} position={p}>
            <sphereGeometry args={[0.05, 8, 6]} />
            <meshStandardMaterial color={PALETTE.goldLight} />
          </mesh>
        ))}
        <mesh position={[0, 1.65, 0]}>
          <boxGeometry args={[0.36, 0.07, 0.32]} />
          <meshStandardMaterial color={PALETTE.red} />
        </mesh>
        <mesh position={[0, 1.72, 0]}>
          <sphereGeometry args={[0.04, 8, 6]} />
          <meshStandardMaterial color={PALETTE.gold} />
        </mesh>
      </group>
    </group>
  )
}

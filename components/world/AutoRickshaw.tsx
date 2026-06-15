'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { RICKSHAW_POS, RICKSHAW_YAW } from '@/lib/spawn'
import { makeTextTexture } from '@/lib/textures'
import { useGameStore, isNight } from '@/state/useGameStore'

const YELLOW = '#f4c01e'
const BLACK = '#1d1d22'

/** The iconic black-and-yellow auto, parked by the entrance gate. */
export default function AutoRickshaw() {
  const plateTex = useMemo(() => makeTextTexture('TAXI', '#1d1d22', '#ffd230'), [])
  const headlightMat = useRef<THREE.MeshStandardMaterial>(null)

  useFrame(() => {
    if (headlightMat.current) {
      headlightMat.current.emissiveIntensity = isNight(useGameStore.getState().timeOfDay) ? 2.6 : 0.1
    }
  })

  return (
    <group position={RICKSHAW_POS} rotation-y={RICKSHAW_YAW}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.65, 0.8, 1.05]} position={[0, 0.8, 0]} />
      </RigidBody>

      {/* yellow lower shell + sloped nose */}
      <mesh position={[0, 0.72, -0.15]} castShadow>
        <boxGeometry args={[1.15, 0.55, 1.65]} />
        <meshStandardMaterial color={YELLOW} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.85, 0.85]} rotation-x={-0.45} castShadow>
        <boxGeometry args={[1.1, 0.7, 0.35]} />
        <meshStandardMaterial color={YELLOW} roughness={0.4} />
      </mesh>
      {/* black canopy with rolled side openings */}
      <mesh position={[0, 1.55, -0.3]} castShadow>
        <boxGeometry args={[1.18, 0.55, 1.45]} />
        <meshStandardMaterial color={BLACK} roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.25, -0.95]}>
        <boxGeometry args={[1.16, 0.7, 0.08]} />
        <meshStandardMaterial color={BLACK} roughness={0.85} />
      </mesh>
      {/* windshield */}
      <mesh position={[0, 1.45, 0.62]} rotation-x={-0.18}>
        <planeGeometry args={[0.95, 0.55]} />
        <meshStandardMaterial color="#bcd9f0" transparent opacity={0.35} roughness={0.1} side={THREE.DoubleSide} />
      </mesh>
      {/* bench seat */}
      <mesh position={[0, 1.05, -0.45]}>
        <boxGeometry args={[1.0, 0.16, 0.5]} />
        <meshStandardMaterial color="#5a3b2e" roughness={0.9} />
      </mesh>
      {/* handlebar + meter */}
      <mesh position={[0, 1.18, 0.55]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.025, 0.025, 0.7, 8]} />
        <meshStandardMaterial color="#c8cdd4" metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh position={[0.32, 1.1, 0.6]}>
        <boxGeometry args={[0.12, 0.12, 0.1]} />
        <meshStandardMaterial color={YELLOW} />
      </mesh>
      {/* three wheels: single front, two rear */}
      {([[0, 0.28, 0.95], [-0.62, 0.28, -0.65], [0.62, 0.28, -0.65]] as const).map((p, i) => (
        <mesh key={i} position={[...p]} rotation-y={Math.PI / 2} castShadow>
          <torusGeometry args={[0.22, 0.09, 10, 18]} />
          <meshStandardMaterial color={BLACK} roughness={0.9} />
        </mesh>
      ))}
      {/* front mudguard + headlight */}
      <mesh position={[0, 0.52, 0.95]} rotation-x={0.3}>
        <boxGeometry args={[0.3, 0.35, 0.5]} />
        <meshStandardMaterial color={YELLOW} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.02, 1.02]}>
        <sphereGeometry args={[0.1, 10, 8]} />
        <meshStandardMaterial
          ref={headlightMat}
          color="#fff3c8"
          emissive="#ffeaa0"
          emissiveIntensity={0.1}
        />
      </mesh>
      {/* rear TAXI plate + green permit stripe */}
      <mesh position={[0, 1.0, -1.0]}>
        <planeGeometry args={[0.6, 0.18]} />
        <meshStandardMaterial map={plateTex} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.48, -0.99]}>
        <boxGeometry args={[1.1, 0.1, 0.04]} />
        <meshStandardMaterial color="#2f7d4f" />
      </mesh>
    </group>
  )
}

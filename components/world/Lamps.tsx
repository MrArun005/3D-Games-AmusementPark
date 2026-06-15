'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Instances, Instance } from '@react-three/drei'
import { useGameStore, isNight } from '@/state/useGameStore'
import { LAMP_POSITIONS } from '@/lib/spawn'

/**
 * Instanced lamp posts along the plaza and midway rings. Bulbs share one
 * emissive material that switches on at night (bloom picks it up on High);
 * two real point lights in the plaza carry the actual night illumination
 * so the light count stays tiny.
 */
export default function Lamps() {
  const bulbMat = useRef<THREE.MeshStandardMaterial>(null)
  const l1 = useRef<THREE.PointLight>(null)
  const l2 = useRef<THREE.PointLight>(null)

  const positions = useMemo(() => LAMP_POSITIONS, [])

  useFrame(() => {
    const night = isNight(useGameStore.getState().timeOfDay)
    if (bulbMat.current) bulbMat.current.emissiveIntensity = night ? 2.8 : 0
    const glow = night ? 22 : 0
    if (l1.current) l1.current.intensity = glow
    if (l2.current) l2.current.intensity = glow
  })

  return (
    <group>
      <Instances limit={positions.length} castShadow>
        <cylinderGeometry args={[0.06, 0.09, 3.2, 7]} />
        <meshStandardMaterial color="#252c44" />
        {positions.map(([x, z], i) => (
          <Instance key={i} position={[x, 1.6, z]} />
        ))}
      </Instances>
      <Instances limit={positions.length}>
        <sphereGeometry args={[0.21, 10, 8]} />
        <meshStandardMaterial ref={bulbMat} color="#fff3c8" emissive="#ffdf8a" emissiveIntensity={0} />
        {positions.map(([x, z], i) => (
          <Instance key={i} position={[x, 3.3, z]} />
        ))}
      </Instances>
      <pointLight ref={l1} position={[-7, 3.6, 4]} distance={34} decay={2} color="#ffd9a0" intensity={0} />
      <pointLight ref={l2} position={[7, 3.6, -4]} distance={34} decay={2} color="#ffd9a0" intensity={0} />
    </group>
  )
}

'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Instances, Instance } from '@react-three/drei'
import { RigidBody } from '@react-three/rapier'
import { GATE_POS } from '@/lib/spawn'
import { PALETTE } from '@/lib/palette'
import { makeStripesTexture, makeTextTexture } from '@/lib/textures'
import { useGameStore, isNight } from '@/state/useGameStore'

export default function EntranceGate() {
  const signTex = useMemo(() => makeTextTexture('★ MYSURU EXHIBITION ★'), [])
  const towerTex = useMemo(() => {
    const tex = makeStripesTexture(PALETTE.cream, PALETTE.red, 8)
    // rotate the vertical canvas stripes 90° so they wrap as horizontal bands
    tex.center.set(0.5, 0.5)
    tex.rotation = Math.PI / 2
    return tex
  }, [])
  const roofTex = useMemo(() => makeStripesTexture(PALETTE.red, PALETTE.cream, 12), [])
  const archMat = useRef<THREE.MeshStandardMaterial>(null)
  const bulbMat = useRef<THREE.MeshStandardMaterial>(null)

  const bulbPositions = useMemo(() => {
    const pts: [number, number, number][] = []
    for (let i = 0; i < 10; i++) {
      const x = -3.35 + (i * 6.7) / 9
      pts.push([x, 5.12, 0.67], [x, 4.28, 0.67])
    }
    return pts
  }, [])

  useFrame(() => {
    const night = isNight(useGameStore.getState().timeOfDay)
    if (archMat.current) archMat.current.emissiveIntensity = night ? 2.2 : 0.1
    if (bulbMat.current) bulbMat.current.emissiveIntensity = night ? 2.6 : 0.15
  })

  return (
    <group position={GATE_POS}>
      {[-4, 4].map((x) => (
        <group key={x}>
          <RigidBody type="fixed" colliders="cuboid">
            <mesh position={[x, 2.2, 0]} castShadow>
              <cylinderGeometry args={[0.62, 0.7, 4.4, 16]} />
              <meshStandardMaterial map={towerTex} />
            </mesh>
          </RigidBody>
          <mesh position={[x, 4.32, 0]} rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.66, 0.06, 8, 24]} />
            <meshStandardMaterial color={PALETTE.gold} />
          </mesh>
          <mesh position={[x, 0.14, 0]} rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.74, 0.07, 8, 24]} />
            <meshStandardMaterial color={PALETTE.redDark} />
          </mesh>
          <mesh position={[x, 5.0, 0]} castShadow>
            <coneGeometry args={[0.95, 1.25, 12]} />
            <meshStandardMaterial map={roofTex} />
          </mesh>
          <mesh position={[x, 5.95, 0]}>
            <cylinderGeometry args={[0.022, 0.022, 0.75, 6]} />
            <meshStandardMaterial color={PALETTE.navy} />
          </mesh>
          <mesh position={[x + 0.26, 6.16, 0]}>
            <planeGeometry args={[0.48, 0.26]} />
            <meshStandardMaterial color={PALETTE.red} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      {/* local-x squash keeps the rotated beam ~1.05 tall while staying round in z */}
      <mesh position={[0, 4.7, 0]} rotation-z={Math.PI / 2} scale={[0.85, 1, 1]} castShadow>
        <cylinderGeometry args={[0.62, 0.62, 8.4, 20]} />
        <meshStandardMaterial ref={archMat} color={PALETTE.red} emissive={PALETTE.goldLight} emissiveIntensity={0.1} />
      </mesh>
      <mesh position={[0, 4.7, 0.64]}>
        <planeGeometry args={[6.8, 0.95]} />
        <meshStandardMaterial map={signTex} />
      </mesh>
      <Instances limit={bulbPositions.length}>
        <sphereGeometry args={[0.07, 8, 8]} />
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
    </group>
  )
}

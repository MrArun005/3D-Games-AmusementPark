'use client'

import { useMemo } from 'react'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { makeGrassTexture } from '@/lib/textures'

export default function Ground() {
  const grass = useMemo(() => {
    const tex = makeGrassTexture()
    tex.repeat.set(14, 14)
    return tex
  }, [])

  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[70, 0.5, 70]} position={[0, -0.5, 0]} />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[64, 48]} />
        <meshStandardMaterial map={grass} roughness={1} />
      </mesh>
    </RigidBody>
  )
}

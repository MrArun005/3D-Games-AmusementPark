'use client'

import { useMemo } from 'react'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { Instances, Instance } from '@react-three/drei'
import { PARK_RADIUS } from '@/lib/spawn'

/**
 * Perimeter fence: 72 instanced posts, two torus rails, and 24 invisible
 * box colliders approximating the circle so nothing escapes the park.
 */
export default function Fence() {
  const posts = useMemo(
    () =>
      Array.from({ length: 72 }, (_, i) => {
        const a = (i / 72) * Math.PI * 2
        return [Math.cos(a) * PARK_RADIUS, 0.8, Math.sin(a) * PARK_RADIUS] as [number, number, number]
      }),
    []
  )
  const colliders = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * Math.PI * 2
        return {
          pos: [Math.cos(a) * PARK_RADIUS, 1.4, Math.sin(a) * PARK_RADIUS] as [number, number, number],
          // rotate the box's long axis onto the circle tangent at this angle
          rotY: -a - Math.PI / 2,
        }
      }),
    []
  )

  return (
    <group>
      <Instances limit={posts.length} castShadow>
        <cylinderGeometry args={[0.09, 0.11, 1.6, 8]} />
        <meshStandardMaterial color="#3c4663" />
        {posts.map((p, i) => (
          <Instance key={i} position={p} />
        ))}
      </Instances>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.65, 0]}>
        <torusGeometry args={[PARK_RADIUS, 0.05, 6, 96]} />
        <meshStandardMaterial color="#5a6585" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 1.25, 0]}>
        <torusGeometry args={[PARK_RADIUS, 0.05, 6, 96]} />
        <meshStandardMaterial color="#5a6585" />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        {colliders.map((c, i) => (
          <CuboidCollider key={i} args={[7.8, 1.5, 0.25]} position={c.pos} rotation={[0, c.rotY, 0]} />
        ))}
      </RigidBody>
    </group>
  )
}

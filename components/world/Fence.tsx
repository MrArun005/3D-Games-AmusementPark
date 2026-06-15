'use client'

import { useMemo } from 'react'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { Instances, Instance } from '@react-three/drei'
import { PARK_RADIUS } from '@/lib/spawn'
import { usePbrMaterial, PBR_SETS } from '@/lib/pbr'

/**
 * Perimeter fence: 72 instanced posts, two torus rails, and 24 invisible
 * box colliders approximating the circle so nothing escapes the park.
 */
export default function Fence() {
  // Wood PBR for the structural parts. Posts are short, stocky cylinders
  // (~1.6 tall) so a low repeat reads as a couple of plank rows. The rails are
  // very long thin tori (major circumference ~2π·PARK_RADIUS ≈ 364 units), so
  // their major-axis (u) repeat is high to keep planks at a realistic scale.
  const postWood = usePbrMaterial(PBR_SETS.wood, [1, 2], { roughness: 0.9, metalness: 0 })
  const railWood = usePbrMaterial(PBR_SETS.wood, [48, 1], { roughness: 0.9, metalness: 0 })

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
        <primitive object={postWood} attach="material" />
        {posts.map((p, i) => (
          <Instance key={i} position={p} />
        ))}
      </Instances>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.65, 0]} material={railWood}>
        <torusGeometry args={[PARK_RADIUS, 0.05, 6, 96]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 1.25, 0]} material={railWood}>
        <torusGeometry args={[PARK_RADIUS, 0.05, 6, 96]} />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        {colliders.map((c, i) => (
          <CuboidCollider key={i} args={[7.8, 1.5, 0.25]} position={c.pos} rotation={[0, c.rotY, 0]} />
        ))}
      </RigidBody>
    </group>
  )
}

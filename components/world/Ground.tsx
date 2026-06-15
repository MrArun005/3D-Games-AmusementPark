'use client'

import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { usePbrMaterial, PBR_SETS } from '@/lib/pbr'

/** PBR-textured grass terrain (normal + roughness relief). Collider unchanged. */
export default function Ground() {
  const grass = usePbrMaterial(PBR_SETS.grass, [40, 40], { roughness: 1 })
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[70, 0.5, 70]} position={[0, -0.5, 0]} />
      <mesh rotation-x={-Math.PI / 2} receiveShadow material={grass}>
        <circleGeometry args={[64, 48]} />
      </mesh>
    </RigidBody>
  )
}

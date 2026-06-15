'use client'

import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from '@/state/useGameStore'

/**
 * The balloon the player bought, bobbing on a string above their head and
 * lagging behind their movement with a spring-y lerp. Hidden until bought.
 */
export default function BalloonFollow() {
  const group = useRef<THREE.Group>(null)
  const balloonMat = useRef<THREE.MeshStandardMaterial>(null)
  const pos = useRef(new THREE.Vector3(0, 3, 44))

  useFrame((state, dt) => {
    const g = group.current
    if (!g) return
    const color = useGameStore.getState().balloon
    g.visible = !!color
    if (!color) return
    if (balloonMat.current) balloonMat.current.color.set(color)

    const p = useGameStore.getState().playerPos
    // anchor ~2.4 m above the player, lerped so it sways behind them
    pos.current.x += (p.x - pos.current.x) * (1 - Math.pow(0.002, dt))
    pos.current.z += (p.z - pos.current.z) * (1 - Math.pow(0.002, dt))
    pos.current.y = p.y + 2.4 + Math.sin(state.clock.elapsedTime * 1.5) * 0.1
    g.position.copy(pos.current)
    // tilt toward the direction of travel for a floaty feel
    g.rotation.z = THREE.MathUtils.clamp((p.x - pos.current.x) * 0.4, -0.4, 0.4)
    g.rotation.x = THREE.MathUtils.clamp((pos.current.z - p.z) * 0.4, -0.4, 0.4)
  })

  return (
    <group ref={group} visible={false}>
      <mesh castShadow>
        <sphereGeometry args={[0.32, 16, 14]} />
        <meshStandardMaterial ref={balloonMat} color="#e91e8c" roughness={0.4} />
      </mesh>
      <mesh position={[0, -0.34, 0]}>
        <coneGeometry args={[0.06, 0.1, 6]} />
        <meshStandardMaterial color="#cccccc" />
      </mesh>
      {/* string down toward the player's hand */}
      <mesh position={[0, -1.1, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 1.8, 4]} />
        <meshStandardMaterial color="#d8d2c0" />
      </mesh>
    </group>
  )
}

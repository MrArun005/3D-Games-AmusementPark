'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Instances, Instance } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { PALETTE } from '@/lib/palette'

const CLUSTERS: { pos: [number, number, number]; yaw: number }[] = [
  { pos: [4, 0, 40], yaw: 0 }, // by the gate
  { pos: [10.5, 0, 36], yaw: 2.1 }, // by the booth, spun so the clusters don't read as clones
]

const OFFSETS: [number, number, number][] = [
  [0, 3.35, 0],
  [0.5, 3.05, 0.22],
  [-0.42, 3.2, 0.3],
  [0.28, 2.7, -0.38],
  [-0.34, 2.45, -0.18],
  [0.55, 2.25, -0.05],
  [-0.12, 2.9, -0.5],
]

const COLORS = [
  PALETTE.red,
  PALETTE.gold,
  PALETTE.teal,
  PALETTE.cream,
  PALETTE.goldLight,
  PALETTE.redDark,
  PALETTE.red,
] as const

const UP = new THREE.Vector3(0, 1, 0)

interface StringSeg {
  pos: [number, number, number]
  quat: THREE.Quaternion
  len: number
}

/** Two anchored balloon clusters: instanced spheres, strings down to a weight box. */
export default function Balloons() {
  const sway = useRef<(THREE.Group | null)[]>([])

  const balloonGeo = useMemo(() => new THREE.SphereGeometry(0.35, 12, 10), [])
  const balloonMat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.3 }), [])
  const stringGeo = useMemo(() => new THREE.CylinderGeometry(0.01, 0.01, 1, 4), [])
  const stringMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: PALETTE.navy, roughness: 0.9 }),
    []
  )

  // Strings run from the weight box up to each balloon's knot; identical for both clusters.
  const strings = useMemo<StringSeg[]>(() => {
    const anchor = new THREE.Vector3(0, 0.24, 0)
    return OFFSETS.map(([x, y, z]) => {
      const end = new THREE.Vector3(x, y - 0.38, z)
      const dir = end.clone().sub(anchor)
      const len = dir.length()
      const quat = new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize())
      return {
        pos: [(anchor.x + end.x) / 2, (anchor.y + end.y) / 2, (anchor.z + end.z) / 2],
        quat,
        len,
      }
    })
  }, [])

  useFrame((state) => {
    const r = Math.sin(state.clock.elapsedTime * 0.8) * 0.05
    const refs = sway.current
    for (let i = 0; i < refs.length; i++) {
      const g = refs[i]
      if (g) g.rotation.z = r
    }
  })

  return (
    <group>
      {/* Solid anchor weights — fixed colliders so the player can't ghost through
          the tether point. Kept outside the swaying groups (the sway is visual-only
          and the weight stays planted); balloons/strings remain non-colliding. */}
      <RigidBody type="fixed" colliders={false}>
        {CLUSTERS.map((c, ci) => (
          <CuboidCollider
            key={ci}
            args={[0.25, 0.25, 0.25]}
            position={[c.pos[0], 0.25, c.pos[2]]}
          />
        ))}
      </RigidBody>
      {CLUSTERS.map((c, ci) => (
        <group
          key={ci}
          position={c.pos}
          rotation={[0, c.yaw, 0]}
          ref={(g: THREE.Group | null) => {
            sway.current[ci] = g
          }}
        >
          <Instances limit={OFFSETS.length} geometry={balloonGeo} material={balloonMat}>
            {OFFSETS.map((o, i) => (
              <Instance key={i} position={o} scale={[1, 1.12, 1]} color={COLORS[i]} />
            ))}
          </Instances>
          <Instances limit={strings.length} geometry={stringGeo} material={stringMat}>
            {strings.map((s, i) => (
              <Instance key={i} position={s.pos} quaternion={s.quat} scale={[1, s.len, 1]} />
            ))}
          </Instances>
          <mesh position={[0, 0.12, 0]}>
            <boxGeometry args={[0.24, 0.24, 0.24]} />
            <meshStandardMaterial color={PALETTE.wood} roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

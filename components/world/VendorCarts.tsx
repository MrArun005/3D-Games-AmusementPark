'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { Instances, Instance } from '@react-three/drei'
import { VENDOR_CARTS, type CartSpec } from '@/lib/spawn'
import { PALETTE, BAZAAR } from '@/lib/palette'
import { makeStripesTexture } from '@/lib/textures'
import Person from './Person'

const UMBRELLA_COLORS: Record<CartSpec['goods'], string> = {
  balloons: BAZAAR.magenta,
  fruits: BAZAAR.parrotGreen,
  toys: BAZAAR.skyBlue,
}
const VENDOR_CLOTH: Record<CartSpec['goods'], string> = {
  balloons: BAZAAR.yellow,
  fruits: '#f5f0e6',
  toys: BAZAAR.chilliRed,
}
const BALLOON_BUNCH = [
  BAZAAR.chilliRed, BAZAAR.yellow, BAZAAR.turquoise, BAZAAR.magenta,
  BAZAAR.parrotGreen, BAZAAR.marigold, BAZAAR.skyBlue, BAZAAR.purple, BAZAAR.yellow,
]

function Goods({ goods, pinwheel }: { goods: CartSpec['goods']; pinwheel: React.RefObject<THREE.Group | null> }) {
  if (goods === 'balloons') {
    return (
      <group position={[0, 0.62, 0]}>
        <Instances limit={BALLOON_BUNCH.length}>
          <sphereGeometry args={[0.16, 10, 8]} />
          <meshStandardMaterial roughness={0.4} />
          {BALLOON_BUNCH.map((c, i) => {
            const a = (i / BALLOON_BUNCH.length) * Math.PI * 2
            return (
              <Instance
                key={i}
                position={[Math.cos(a) * 0.32, 1.5 + (i % 3) * 0.32, Math.sin(a) * 0.32]}
                color={c}
              />
            )
          })}
        </Instances>
        <Instances limit={BALLOON_BUNCH.length}>
          <cylinderGeometry args={[0.006, 0.006, 1, 4]} />
          <meshStandardMaterial color="#d8d2c0" />
          {BALLOON_BUNCH.map((_, i) => {
            const a = (i / BALLOON_BUNCH.length) * Math.PI * 2
            const h = 1.34 + (i % 3) * 0.32
            return (
              <Instance
                key={i}
                position={[Math.cos(a) * 0.18, h / 2 + 0.1, Math.sin(a) * 0.18]}
                rotation={[0, 0, (i % 2 ? 1 : -1) * 0.1]}
                scale={[1, h, 1]}
              />
            )
          })}
        </Instances>
      </group>
    )
  }
  if (goods === 'fruits') {
    return (
      <group position={[0, 0.68, 0]}>
        {/* two pyramid piles: oranges and guavas */}
        {[
          { x: -0.45, color: BAZAAR.marigold },
          { x: 0.45, color: BAZAAR.parrotGreen },
        ].map(({ x, color }) => (
          <Instances key={color} limit={14}>
            <sphereGeometry args={[0.085, 8, 6]} />
            <meshStandardMaterial color={color} roughness={0.6} />
            {Array.from({ length: 14 }, (_, i) => {
              const layer = i < 9 ? 0 : 1
              const idx = layer === 0 ? i : i - 9
              const row = layer === 0 ? 3 : 2
              return (
                <Instance
                  key={i}
                  position={[
                    x + ((idx % row) - (row - 1) / 2) * 0.17,
                    0.08 + layer * 0.14,
                    (Math.floor(idx / row) - (row - 1) / 2) * 0.17,
                  ]}
                />
              )
            })}
          </Instances>
        ))}
      </group>
    )
  }
  return (
    <group position={[0, 0.68, 0]}>
      {[
        [-0.5, 0.08, 0.2, BAZAAR.chilliRed],
        [-0.15, 0.08, -0.25, BAZAAR.turquoise],
        [0.3, 0.08, 0.15, BAZAAR.yellow],
        [0.6, 0.08, -0.2, BAZAAR.purple],
      ].map(([x, y, z, c], i) => (
        <mesh key={i} position={[x as number, y as number, z as number]} rotation-y={i}>
          <boxGeometry args={[0.22, 0.16, 0.18]} />
          <meshStandardMaterial color={c as string} />
        </mesh>
      ))}
      {/* two pinwheels that slowly spin */}
      <group ref={pinwheel}>
        {[-0.7, 0.85].map((x) => (
          <group key={x} position={[x, 0.55, 0]}>
            <mesh>
              <cylinderGeometry args={[0.012, 0.012, 0.9, 4]} />
              <meshStandardMaterial color="#d8d2c0" />
            </mesh>
            {[0, 1, 2, 3].map((q) => (
              <mesh key={q} position={[0, 0.45, 0.02]} rotation-z={(q * Math.PI) / 2 + 0.4}>
                <coneGeometry args={[0.07, 0.18, 3]} />
                <meshStandardMaterial color={BALLOON_BUNCH[(q + (x > 0 ? 2 : 0)) % 9]} side={THREE.DoubleSide} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    </group>
  )
}

function Cart({ spec }: { spec: CartSpec }) {
  const umbrellaTex = useMemo(
    () => makeStripesTexture(UMBRELLA_COLORS[spec.goods], PALETTE.cream, 12),
    [spec.goods]
  )
  const pinwheel = useRef<THREE.Group>(null)

  useFrame((_, dt) => {
    if (pinwheel.current) pinwheel.current.rotation.y += dt * 1.6
  })

  return (
    <group position={spec.position} rotation-y={spec.rotationY}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.0, 0.7, 0.7]} position={[0, 0.7, 0]} />
      </RigidBody>
      {/* plank bed on a simple frame, two spoked wheels, handle poles */}
      <mesh position={[0, 0.56, 0]} castShadow>
        <boxGeometry args={[1.8, 0.12, 1.1]} />
        <meshStandardMaterial color={PALETTE.wood} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[1.5, 0.4, 0.12]} />
        <meshStandardMaterial color="#6e4a2b" roughness={0.9} />
      </mesh>
      {[-0.62, 0.62].map((z) => (
        <group key={z} position={[0, 0.34, z]}>
          <mesh rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.32, 0.05, 8, 18]} />
            <meshStandardMaterial color="#2e2620" roughness={0.8} />
          </mesh>
          <mesh>
            <boxGeometry args={[0.6, 0.04, 0.04]} />
            <meshStandardMaterial color="#8a6a42" />
          </mesh>
          <mesh rotation-z={Math.PI / 2}>
            <boxGeometry args={[0.6, 0.04, 0.04]} />
            <meshStandardMaterial color="#8a6a42" />
          </mesh>
        </group>
      ))}
      {[-0.35, 0.35].map((z) => (
        <mesh key={z} position={[1.1, 0.48, z]} rotation-z={-1.35}>
          <cylinderGeometry args={[0.03, 0.03, 0.7, 6]} />
          <meshStandardMaterial color={PALETTE.wood} />
        </mesh>
      ))}
      {/* tilted striped umbrella */}
      <mesh position={[-0.6, 1.5, 0]} rotation-z={0.14}>
        <cylinderGeometry args={[0.025, 0.035, 1.9, 6]} />
        <meshStandardMaterial color={PALETTE.wood} />
      </mesh>
      <mesh position={[-0.73, 2.42, 0]} rotation-z={0.14} castShadow>
        <coneGeometry args={[1.35, 0.55, 12]} />
        <meshStandardMaterial map={umbrellaTex} side={THREE.DoubleSide} />
      </mesh>
      <group position={[0, 0, 0]}>
        <Goods goods={spec.goods} pinwheel={pinwheel} />
      </group>
      <Person
        position={[1.25, 0, 0.2]}
        yaw={-0.5}
        cloth={VENDOR_CLOTH[spec.goods]}
        skin={spec.goods === 'fruits' ? BAZAAR.skin2 : BAZAAR.skin1}
        saree={false}
      />

      {/* street clutter: crate, jute sack, red stool */}
      <mesh position={[-1.5, 0.22, 0.7]} rotation-y={0.4} castShadow>
        <boxGeometry args={[0.45, 0.44, 0.45]} />
        <meshStandardMaterial color="#7a5a36" roughness={0.95} />
      </mesh>
      <mesh position={[-1.2, 0.16, -0.75]} scale={[1, 0.62, 1]}>
        <sphereGeometry args={[0.3, 10, 8]} />
        <meshStandardMaterial color="#8f7a55" roughness={1} />
      </mesh>
      <group position={[1.7, 0, -0.6]}>
        <mesh position={[0, 0.32, 0]}>
          <boxGeometry args={[0.34, 0.05, 0.34]} />
          <meshStandardMaterial color={BAZAAR.chilliRed} />
        </mesh>
        {[
          [-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13],
        ].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.15, z]}>
            <cylinderGeometry args={[0.02, 0.025, 0.3, 5]} />
            <meshStandardMaterial color={BAZAAR.chilliRed} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** Thela carts with umbrellas, goods, vendors and street clutter. */
export default function VendorCarts() {
  return (
    <>
      {VENDOR_CARTS.map((c, i) => (
        <Cart key={i} spec={c} />
      ))}
    </>
  )
}

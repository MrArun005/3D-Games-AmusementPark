'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CylinderCollider, RigidBody } from '@react-three/rapier'
import { useGameStore, isNight } from '@/state/useGameStore'
import { PALETTE } from '@/lib/palette'

const STONE = '#ded5c2'
const STONE_DARK = '#c2b8a1'
const WATER = '#2e6b78'
const JET_ANGLES = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]

/**
 * Procedural ripple normal map: sum a few sine lobes into a tangent-space normal
 * texture so the water catches the HDRI with a moving, watery wobble. Generated
 * once on a small canvas (no asset, no per-frame vertex work); we just scroll its
 * `offset` in useFrame. RepeatWrapping makes the scroll seamless.
 */
function makeRippleNormalMap(): THREE.Texture {
  const S = 64
  const cv = document.createElement('canvas')
  cv.width = cv.height = S
  const ctx = cv.getContext('2d')!
  const img = ctx.createImageData(S, S)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = (x / S) * Math.PI * 2
      const v = (y / S) * Math.PI * 2
      // partial derivatives of a couple of crossing waves -> tangent-space normal
      const nx = Math.sin(u * 2) * 0.5 + Math.sin(u + v) * 0.3
      const ny = Math.sin(v * 2) * 0.5 + Math.cos(u - v) * 0.3
      const nz = 1
      const len = Math.hypot(nx, ny, nz)
      const i = (y * S + x) * 4
      img.data[i] = ((nx / len) * 0.5 + 0.5) * 255
      img.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255
      img.data[i + 2] = ((nz / len) * 0.5 + 0.5) * 255
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(cv)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(3, 3)
  return tex
}

/** Plaza centrepiece: two-tier stone fountain with pulsing jets, glows at night. */
export default function Fountain() {
  const jet = useRef<THREE.Mesh>(null)
  const waterMat = useRef<THREE.MeshPhysicalMaterial>(null)
  const waterTopMat = useRef<THREE.MeshPhysicalMaterial>(null)

  const { lowerBasin, upperBasin, column, jetMat, rippleMap } = useMemo(() => {
    // profiles are (radius, height) pairs swept around Y: out along the floor,
    // up the outer wall, over the lip, then back down the inner wall
    const profile = (pts: [number, number][]) => pts.map(([r, y]) => new THREE.Vector2(r, y))
    const lowerBasin = new THREE.LatheGeometry(
      profile([
        [0, 0], [3.45, 0], [3.58, 0.22], [3.5, 0.62], [3.44, 0.92],
        [3.58, 1.0], [3.18, 1.0], [3.08, 0.4],
      ]),
      40
    )
    const upperBasin = new THREE.LatheGeometry(
      profile([
        [0, 0], [1.55, 0], [1.72, 0.16], [1.6, 0.45], [1.55, 0.54],
        [1.7, 0.6], [1.32, 0.6], [1.26, 0.2],
      ]),
      32
    )
    // turned column: flared foot, slim waist, flared capital
    const column = new THREE.LatheGeometry(
      profile([
        [0.62, 0], [0.44, 0.14], [0.32, 0.4], [0.3, 0.62], [0.36, 0.8], [0.56, 0.93],
      ]),
      24
    )
    const jetMat = new THREE.MeshStandardMaterial({
      color: '#bfe9ff',
      emissive: '#9fd8ff',
      emissiveIntensity: 0,
      transparent: true,
      opacity: 0.55,
    })
    const rippleMap = makeRippleNormalMap()
    return { lowerBasin, upperBasin, column, jetMat, rippleMap }
  }, [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (jet.current) jet.current.scale.y = 1 + Math.sin(t * 2.2) * 0.18
    const night = isNight(useGameStore.getState().timeOfDay)
    if (waterMat.current) waterMat.current.emissiveIntensity = night ? 2.2 : 0.18
    if (waterTopMat.current) waterTopMat.current.emissiveIntensity = night ? 2.2 : 0.18
    jetMat.emissiveIntensity = night ? 1.6 : 0
    // scroll the shared ripple normal map (slow, watery drift) — refs only, no state
    rippleMap.offset.x = (t * 0.03) % 1
    rippleMap.offset.y = (t * 0.018) % 1
  })

  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.6, 3.3]} position={[0, 0.6, 0]} />
      </RigidBody>

      <mesh geometry={lowerBasin} receiveShadow castShadow>
        <meshStandardMaterial color={STONE} roughness={0.85} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, 1.0, 0]}>
        <torusGeometry args={[3.38, 0.055, 10, 48]} />
        <meshStandardMaterial color={PALETTE.gold} roughness={0.35} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[3.05, 3.05, 0.06, 36]} />
        <meshPhysicalMaterial
          ref={waterMat}
          color={WATER}
          roughness={0.1}
          metalness={0}
          transmission={0.5}
          thickness={0.5}
          ior={1.33}
          normalMap={rippleMap}
          normalScale={new THREE.Vector2(0.18, 0.18)}
          emissive="#2fa7dd"
          emissiveIntensity={0.18}
        />
      </mesh>

      <mesh geometry={column} position={[0, 0.92, 0]}>
        <meshStandardMaterial color={STONE_DARK} roughness={0.9} />
      </mesh>

      <mesh geometry={upperBasin} position={[0, 1.85, 0]} castShadow>
        <meshStandardMaterial color={STONE} roughness={0.85} />
      </mesh>
      <mesh position={[0, 2.32, 0]}>
        <cylinderGeometry args={[1.28, 1.28, 0.05, 28]} />
        <meshPhysicalMaterial
          ref={waterTopMat}
          color={WATER}
          roughness={0.1}
          metalness={0}
          transmission={0.5}
          thickness={0.5}
          ior={1.33}
          normalMap={rippleMap}
          normalScale={new THREE.Vector2(0.18, 0.18)}
          emissive="#2fa7dd"
          emissiveIntensity={0.18}
        />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, 2.45, 0]}>
        <torusGeometry args={[1.68, 0.04, 8, 36]} />
        <meshStandardMaterial color={PALETTE.gold} roughness={0.35} metalness={0.6} />
      </mesh>

      <mesh position={[0, 2.62, 0]}>
        <cylinderGeometry args={[0.14, 0.24, 0.4, 12]} />
        <meshStandardMaterial color={STONE_DARK} roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.88, 0]}>
        <sphereGeometry args={[0.16, 16, 12]} />
        <meshStandardMaterial color={PALETTE.gold} roughness={0.3} metalness={0.7} />
      </mesh>

      <mesh ref={jet} position={[0, 3.55, 0]} material={jetMat}>
        <coneGeometry args={[0.38, 1.4, 12]} />
      </mesh>

      {/* four jets tilted outward off the upper rim, arcing toward the lower pool */}
      {JET_ANGLES.map((a) => (
        <group key={a} rotation-y={a}>
          <mesh position={[0, 2.62, 1.35]} rotation-x={0.9} material={jetMat}>
            <coneGeometry args={[0.1, 1.2, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

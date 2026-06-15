'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { Instances, Instance } from '@react-three/drei'
import { RIDE_LIST, BOOTH_POS, GATE_POS } from '@/lib/spawn'
import { PALETTE } from '@/lib/palette'
import { makeCobbleTexture } from '@/lib/textures'

/**
 * Flat visual paving: a plaza disc, a midway ring, and radial strips from
 * the plaza out to every ride entrance plus the gate/booth. Slightly
 * different Y offsets avoid z-fighting; the terrain handles collision.
 */
export default function Pathways() {
  const strips = useMemo(() => {
    const targets: [number, number][] = [
      ...RIDE_LIST.map((s): [number, number] => [
        s.position[0] + s.trigger.offset[0],
        s.position[2] + s.trigger.offset[2],
      ]),
      [BOOTH_POS[0], BOOTH_POS[2]],
      [GATE_POS[0], GATE_POS[2]],
    ]
    return targets.map(([tx, tz]) => {
      const d = Math.hypot(tx, tz)
      const angle = Math.atan2(tx, tz) // box Z-axis rotated onto the target direction
      const len = Math.max(0, d - 9)
      const mid = 11 + len / 2
      return { angle, len, x: (tx / d) * mid, z: (tz / d) * mid }
    })
  }, [])

  const { plazaTex, ringTex, stripMats } = useMemo(() => {
    const plazaTex = makeCobbleTexture()
    plazaTex.repeat.set(6, 6)
    // ring spans ~57 units vs the plaza's 24, so 14x14 keeps cobble size matched
    const ringTex = plazaTex.clone()
    ringTex.repeat.set(14, 14)
    ringTex.needsUpdate = true
    // one texture per strip so the cobbles repeat along each strip's own length
    const stripMats = strips.map((s) => {
      const tex = plazaTex.clone()
      tex.repeat.set(1, Math.max(1, s.len / 3))
      tex.needsUpdate = true
      return new THREE.MeshStandardMaterial({ map: tex, roughness: 1 })
    })
    return { plazaTex, ringTex, stripMats }
  }, [strips])

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.035, 0]} receiveShadow>
        <circleGeometry args={[12, 40]} />
        <meshStandardMaterial map={plazaTex} roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} receiveShadow>
        <ringGeometry args={[25.5, 28.5, 64]} />
        <meshStandardMaterial map={ringTex} roughness={1} />
      </mesh>
      {strips.map((s, i) => (
        <mesh key={i} position={[s.x, 0.027, s.z]} rotation-y={s.angle} receiveShadow material={stripMats[i]}>
          <boxGeometry args={[3, 0.02, s.len]} />
        </mesh>
      ))}
      {/* red brick edging: one instanced unit box, stretched per strip length */}
      <Instances limit={strips.length * 2}>
        <boxGeometry args={[0.16, 0.03, 1]} />
        <meshStandardMaterial color={PALETTE.redDark} roughness={1} />
        {strips.map((s, i) => (
          <group key={i} position={[s.x, 0.031, s.z]} rotation-y={s.angle}>
            <Instance position={[-1.56, 0, 0]} scale={[1, 1, Math.max(s.len, 0.001)]} />
            <Instance position={[1.56, 0, 0]} scale={[1, 1, Math.max(s.len, 0.001)]} />
          </group>
        ))}
      </Instances>
    </group>
  )
}

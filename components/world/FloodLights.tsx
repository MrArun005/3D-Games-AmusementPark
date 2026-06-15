'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { FLOODLIGHTS } from '@/lib/spawn'
import { PALETTE } from '@/lib/palette'
import { useGameStore, isNight, type Quality } from '@/state/useGameStore'

const MAST_H = 20
/** How far in from each mast the beam is aimed (toward the park centre). */
const AIM_IN = 36
/** Real spotlights are expensive — scale how many actually emit by quality. */
const LIT_BY_Q: Record<Quality, number> = { low: 2, medium: 6, high: 10 }

/**
 * Stadium floodlight masts on a ring OUTSIDE the perimeter fence, each aimed
 * inward and down so their wide overlapping cones cover the whole park. The
 * lamp panels go full emissive at night (bloom halo on High), a faint beam
 * cone fades in, and real spotlights wash the grounds (count scales by quality).
 */
export default function FloodLights() {
  const lights = useRef<(THREE.SpotLight | null)[]>([])

  const { lampMat, beamMat } = useMemo(
    () => ({
      lampMat: new THREE.MeshStandardMaterial({
        color: '#fff7dd',
        emissive: '#fff3c4',
        emissiveIntensity: 0.05,
      }),
      beamMat: new THREE.MeshBasicMaterial({
        color: '#fff2c0',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    }),
    []
  )

  const masts = useMemo(
    () =>
      FLOODLIGHTS.map(([x, z]) => ({
        x,
        z,
        yaw: Math.atan2(-x, -z), // +Z of the mast group faces the park centre
        // aim down at a ground point AIM_IN metres toward the centre
        tilt: -Math.atan2(MAST_H, AIM_IN),
        targetZ: AIM_IN,
      })),
    []
  )
  const targets = useMemo(() => FLOODLIGHTS.map(() => new THREE.Object3D()), [])
  const lampGrid = useMemo(() => {
    const pts: [number, number][] = []
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) pts.push([-0.5 + c * 0.5, -0.26 + r * 0.52])
    return pts
  }, [])

  useFrame(() => {
    const st = useGameStore.getState()
    const night = isNight(st.timeOfDay)
    lampMat.emissiveIntensity = night ? 1.5 : 0.05
    beamMat.opacity = night ? 0.04 : 0
    const lit = LIT_BY_Q[st.quality]
    lights.current.forEach((l, i) => {
      if (l) l.intensity = night && i < lit ? 360 : 0
    })
  })

  return (
    <group>
      {masts.map((m, i) => (
        <group key={i} position={[m.x, 0, m.z]} rotation-y={m.yaw}>
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[0.55, 0.6, 0.55]} position={[0, 0.6, 0]} />
          </RigidBody>
          <mesh position={[0, 0.5, 0]} castShadow>
            <boxGeometry args={[1.1, 1, 1.1]} />
            <meshStandardMaterial color="#3a4258" />
          </mesh>
          <mesh position={[0, MAST_H / 2, 0]} castShadow>
            <cylinderGeometry args={[0.16, 0.3, MAST_H, 10]} />
            <meshStandardMaterial color={PALETTE.navy} />
          </mesh>
          <mesh position={[0, MAST_H * 0.35, 0]} rotation-z={0.5}>
            <cylinderGeometry args={[0.04, 0.04, 4.2, 6]} />
            <meshStandardMaterial color="#5d6a8c" />
          </mesh>
          <mesh position={[0, MAST_H * 0.65, 0]} rotation-z={-0.5}>
            <cylinderGeometry args={[0.04, 0.04, 4.2, 6]} />
            <meshStandardMaterial color="#5d6a8c" />
          </mesh>

          {/* tilted lamp bank + light shaft (apex at the bank) */}
          <group position={[0, MAST_H + 0.3, 0.25]} rotation-x={m.tilt}>
            <mesh castShadow>
              <boxGeometry args={[1.8, 1.25, 0.18]} />
              <meshStandardMaterial color="#1d222f" />
            </mesh>
            {lampGrid.map(([lx, ly], j) => (
              <mesh key={j} position={[lx, ly, 0.11]} material={lampMat}>
                <boxGeometry args={[0.42, 0.42, 0.08]} />
              </mesh>
            ))}
            <mesh position={[0, 0, 20]} rotation-x={-Math.PI / 2} material={beamMat}>
              <coneGeometry args={[11, 42, 16, 1, true]} />
            </mesh>
          </group>

          <spotLight
            ref={(el) => {
              lights.current[i] = el
            }}
            position={[0, MAST_H, 0]}
            target={targets[i]}
            angle={0.85}
            penumbra={0.7}
            distance={120}
            decay={2}
            intensity={0}
            color="#ffeec2"
          />
          <primitive object={targets[i]} position={[0, 0, m.targetZ]} />
        </group>
      ))}
    </group>
  )
}

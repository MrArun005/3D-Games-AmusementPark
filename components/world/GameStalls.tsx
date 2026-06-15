'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { Instances, Instance } from '@react-three/drei'
import { GAME_STALLS, type GameStallSpec } from '@/lib/spawn'
import { PALETTE, BAZAAR } from '@/lib/palette'
import { makeStripesTexture, makeTextTexture } from '@/lib/textures'
import { useGameStore, isNight } from '@/state/useGameStore'
import Person from './Person'

const BALLOON_COLORS = [
  BAZAAR.magenta, BAZAAR.marigold, BAZAAR.parrotGreen, BAZAAR.turquoise,
  BAZAAR.yellow, BAZAAR.chilliRed, BAZAAR.skyBlue, BAZAAR.purple,
]
const _dummy = new THREE.Object3D()

/** One fair-game booth: striped roof, counter, bulbs, targets and people playing. */
function Stall({ spec, accent }: { spec: GameStallSpec; accent: string }) {
  const yaw = Math.atan2(-spec.position[0], -spec.position[2])
  const roofTex = useMemo(() => makeStripesTexture(accent, PALETTE.cream, 10), [accent])
  const signTex = useMemo(() => makeTextTexture(spec.name), [spec])
  const bulbMat = useRef<THREE.MeshStandardMaterial>(null)
  const balloons = useRef<THREE.InstancedMesh>(null)
  // Per-balloon respawn clock: <= 0 means inflated, > 0 counts down while popped.
  const popped = useRef<number[]>(Array.from({ length: 20 }, () => 0))
  const nextPop = useRef(3)

  const balloonGrid = useMemo(() => {
    const pts: [number, number, number][] = []
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 5; c++) pts.push([-1.2 + c * 0.6, 1.05 + r * 0.4, -0.98])
    }
    return pts
  }, [])

  const bulbXs = useMemo(() => Array.from({ length: 9 }, (_, i) => -1.7 + i * 0.425), [])

  useFrame((_, dt) => {
    const st = useGameStore.getState()
    if (bulbMat.current) bulbMat.current.emissiveIntensity = isNight(st.timeOfDay) ? 2.4 : 0.15
    if (spec.kind !== 'balloon' || !balloons.current || st.paused) return
    // Every few seconds someone "wins": a random balloon pops and respawns.
    nextPop.current -= dt
    if (nextPop.current <= 0) {
      const alive = popped.current.map((v, i) => (v <= 0 ? i : -1)).filter((i) => i >= 0)
      if (alive.length) popped.current[alive[Math.floor(Math.random() * alive.length)]] = 2
      nextPop.current = 2.5 + Math.random() * 3.5
    }
    for (let i = 0; i < balloonGrid.length; i++) {
      if (popped.current[i] > 0) popped.current[i] -= dt
      const s = popped.current[i] > 0 ? 0 : 1
      _dummy.position.set(...balloonGrid[i])
      _dummy.scale.setScalar(s)
      _dummy.rotation.set(0, 0, 0)
      _dummy.updateMatrix()
      balloons.current.setMatrixAt(i, _dummy.matrix)
    }
    balloons.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group position={spec.position} rotation-y={yaw}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.8, 1.3, 1.05]} position={[0, 1.3, -0.15]} />
      </RigidBody>

      {/* booth shell: back wall, side panels, counter, posts, striped roof */}
      <mesh position={[0, 1.4, -1.1]} castShadow>
        <boxGeometry args={[3.6, 2.2, 0.12]} />
        <meshStandardMaterial color={PALETTE.navy} />
      </mesh>
      {[-1.74, 1.74].map((x) => (
        <mesh key={x} position={[x, 1.4, -0.2]}>
          <boxGeometry args={[0.12, 2.2, 1.9]} />
          <meshStandardMaterial color={PALETTE.navy} />
        </mesh>
      ))}
      <mesh position={[0, 0.92, 0.85]} castShadow>
        <boxGeometry args={[3.6, 0.9, 0.5]} />
        <meshStandardMaterial color={PALETTE.wood} roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.4, 0.85]}>
        <boxGeometry args={[3.7, 0.07, 0.6]} />
        <meshStandardMaterial color={accent} />
      </mesh>
      <mesh position={[0, 2.75, 0.1]} rotation-x={0.32} castShadow>
        <planeGeometry args={[3.9, 2.1]} />
        <meshStandardMaterial map={roofTex} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 3.45, 0.6]}>
        <planeGeometry args={[3.2, 0.8]} />
        <meshStandardMaterial map={signTex} side={THREE.DoubleSide} />
      </mesh>
      <Instances limit={bulbXs.length}>
        <sphereGeometry args={[0.07, 8, 6]} />
        <meshStandardMaterial ref={bulbMat} color={PALETTE.bulbWarm} emissive={PALETTE.bulbWarm} emissiveIntensity={0.15} />
        {bulbXs.map((x, i) => (
          <Instance key={i} position={[x, 2.42, 1.05]} />
        ))}
      </Instances>

      {spec.kind === 'balloon' ? (
        <>
          {/* shootable balloon + duck targets are provided by <ShootingGallery>;
              this branch only dresses the counter */}
          {/* cork gun resting on the counter */}
          <mesh position={[0.5, 1.42, 0.8]} rotation-y={0.4}>
            <boxGeometry args={[0.5, 0.07, 0.09]} />
            <meshStandardMaterial color="#5a4632" />
          </mesh>
          <mesh position={[0.72, 1.42, 0.71]} rotation={[0, 0.4, Math.PI / 2]}>
            <cylinderGeometry args={[0.025, 0.025, 0.3, 6]} />
            <meshStandardMaterial color="#2e3440" metalness={0.6} />
          </mesh>
        </>
      ) : (
        <>
          {/* the table + pegs are provided by <RingToss>; spare rings on the rail */}
          {[BAZAAR.chilliRed, BAZAAR.yellow, BAZAAR.turquoise].map((c, i) => (
            <mesh key={c} position={[-0.5 + i * 0.5, 1.42, 0.78]} rotation-x={Math.PI / 2}>
              <torusGeometry args={[0.14, 0.025, 8, 18]} />
              <meshStandardMaterial color={c} />
            </mesh>
          ))}
        </>
      )}

      {/* Just the vendor behind the counter — the human plays from the front,
          so the approach is kept clear of standing onlookers at both games. */}
      <Person position={[-0.6, 0, -0.45]} yaw={0} cloth={accent} skin={BAZAAR.skin2} saree={false} />
    </group>
  )
}

/** One-time instance colors (separate component so the ref exists at effect time). */
function BalloonColors({ mesh, count }: { mesh: React.RefObject<THREE.InstancedMesh | null>; count: number }) {
  useFrame(() => {
    const m = mesh.current
    if (!m || m.userData.colored) return
    const c = new THREE.Color()
    for (let i = 0; i < count; i++) {
      c.set(BALLOON_COLORS[i % BALLOON_COLORS.length])
      m.setColorAt(i, c)
    }
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.userData.colored = true
  })
  return null
}

export default function GameStalls() {
  return (
    <>
      {GAME_STALLS.map((s) => (
        <Stall key={s.name} spec={s} accent={s.kind === 'balloon' ? BAZAAR.chilliRed : BAZAAR.turquoise} />
      ))}
    </>
  )
}

'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { RigidBody, CylinderCollider } from '@react-three/rapier'
import { Instances, Instance } from '@react-three/drei'
import { RIDES } from '@/lib/spawn'
import { useGameStore, isNight } from '@/state/useGameStore'
import { keys } from '@/components/Player/useControls'
import { PALETTE } from '@/lib/palette'
import { makePolkaTexture, makeStripesTexture, makeCheckerTexture } from '@/lib/textures'
import { useRideMachine, RideTrigger, applyRideCamera } from './RideBase'

const spec = RIDES.teacups
/** Exponential spin-up/brake time constant (s) so all three rotations behave like machinery. */
const SPIN_TAU = 1.5
const PLAT_RUN = 0.55
const PLAT_IDLE = 0.08
const TABLE_RUN = 1.1
const TABLE_IDLE = 0.14
const CUP_RUN = 1.8
const CUP_IDLE = 0.2
const _v = new THREE.Vector3()
const _t = new THREE.Vector3()

/**
 * Three nested rotations: the big platform spins one way, the three
 * turntables on it counter-spin, and every cup spins on its own axis.
 * While riding, A/D lets the player crank cup 0 faster or slower.
 */
export default function TeacupSpinner() {
  const { phase } = useRideMachine(spec)
  const platform = useRef<THREE.Group>(null)
  const tables = useRef<(THREE.Group | null)[]>([])
  const cups = useRef<(THREE.Group | null)[]>([])
  const platSpeed = useRef(PLAT_IDLE)
  const tableSpeed = useRef(TABLE_IDLE)
  const cupSpeed = useRef(CUP_IDLE)
  const spinBoost = useRef(0)
  const bulbMat = useRef<THREE.MeshStandardMaterial>(null)
  const camera = useThree((s) => s.camera)

  const tableAngles = useMemo(() => [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3], [])
  const railAngles = useMemo(() => Array.from({ length: 16 }, (_, i) => (i / 16) * Math.PI * 2), [])
  const bulbAngles = useMemo(() => Array.from({ length: 32 }, (_, i) => (i / 32) * Math.PI * 2), [])
  const scallopAngles = useMemo(() => Array.from({ length: 40 }, (_, i) => (i / 40) * Math.PI * 2), [])

  const { cupSkins, cupAccents, teapotSkin, turntableTop } = useMemo(() => {
    const polkaRed = makePolkaTexture(PALETTE.cream, PALETTE.red, 5)
    polkaRed.repeat.set(2, 1)
    const stripesRed = makeStripesTexture(PALETTE.cream, PALETTE.red, 12)
    const polkaTeal = makePolkaTexture(PALETTE.cream, PALETTE.teal, 5)
    polkaTeal.repeat.set(2, 1)
    const stripesTeal = makeStripesTexture(PALETTE.cream, PALETTE.teal, 12)
    const teapotSkin = makePolkaTexture(PALETTE.cream, PALETTE.red, 6)
    teapotSkin.repeat.set(3, 2)
    const turntableTop = makeCheckerTexture(PALETTE.cream, PALETTE.teal, 8)
    turntableTop.repeat.set(2, 2)
    return {
      cupSkins: [polkaRed, stripesRed, polkaTeal, stripesTeal],
      cupAccents: [PALETTE.red, PALETTE.redDark, PALETTE.teal, PALETTE.navy],
      teapotSkin,
      turntableTop,
    }
  }, [])

  const { cupPoints, saucerPoints, scallopGeo } = useMemo(() => {
    // Lathe profile: flat base, bulging belly, rim flaring to r=0.95 at h=0.9 with a small outward lip.
    const cupPoints = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.42, 0),
      new THREE.Vector2(0.5, 0.03),
      new THREE.Vector2(0.62, 0.12),
      new THREE.Vector2(0.74, 0.3),
      new THREE.Vector2(0.78, 0.48),
      new THREE.Vector2(0.82, 0.64),
      new THREE.Vector2(0.88, 0.78),
      new THREE.Vector2(0.95, 0.9),
      new THREE.Vector2(1.0, 0.94),
    ]
    const saucerPoints = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.5, 0.02),
      new THREE.Vector2(0.62, 0.03),
      new THREE.Vector2(0.92, 0.1),
      new THREE.Vector2(1.1, 0.16),
      new THREE.Vector2(1.14, 0.2),
    ]
    // Half-cylinder pre-rotated so the semicircle hangs down (-Y) and its axis (thickness) runs along +X;
    // each instance then only needs rotation.y = -angle to point that axis radially outward.
    const scallopGeo = new THREE.CylinderGeometry(0.58, 0.58, 0.12, 10, 1, false, 0, Math.PI)
    scallopGeo.rotateZ(-Math.PI / 2)
    return { cupPoints, saucerPoints, scallopGeo }
  }, [])

  useFrame((_, dt) => {
    const st = useGameStore.getState()
    const p = platform.current
    if (!p) return
    const mine = st.activeRide === spec.id
    const running = mine && phase.current === 'running'
    if (!st.paused) {
      // Ease each rotation's speed toward its target (~1.5s time constant): machinery inertia.
      const k = 1 - Math.exp(-dt / SPIN_TAU)
      platSpeed.current += ((running ? PLAT_RUN : PLAT_IDLE) - platSpeed.current) * k
      tableSpeed.current += ((running ? TABLE_RUN : TABLE_IDLE) - tableSpeed.current) * k
      cupSpeed.current += ((running ? CUP_RUN : CUP_IDLE) - cupSpeed.current) * k
      p.rotation.y += platSpeed.current * dt
      for (let i = 0; i < tables.current.length; i++) {
        const tb = tables.current[i]
        if (tb) tb.rotation.y -= tableSpeed.current * dt
      }
      // Player-influenced spin on the ridden cup (kept as-is, on top of the eased base speed).
      if (running) {
        const input = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0)
        spinBoost.current = THREE.MathUtils.clamp(spinBoost.current + input * dt * 2.5, -2, 3.5)
      } else {
        spinBoost.current *= Math.max(0, 1 - dt)
      }
      for (let i = 0; i < cups.current.length; i++) {
        const c = cups.current[i]
        if (c) c.rotation.y += (cupSpeed.current + (i === 0 ? spinBoost.current : 0)) * dt
      }
    }
    if (bulbMat.current) bulbMat.current.emissiveIntensity = isNight(st.timeOfDay) ? 2.6 : 0.15
    if (mine && phase.current !== 'idle') {
      const c = cups.current[0]
      const tb = tables.current[0]
      if (c && tb) {
        c.getWorldPosition(_v)
        _v.y += 0.9
        tb.getWorldPosition(_t) // looking at the turntable hub = dizzy orbit view
        _t.y = _v.y - 0.35
        // Outward centrifugal lean: net spin rate of the ridden cup (its own
        // eased spin + the player's A/D boost + the platform's carry) mapped to
        // a small roll, clamped to ±0.18 rad. A touch of FOV at full whirl.
        const spin = cupSpeed.current + spinBoost.current + platSpeed.current
        const roll = THREE.MathUtils.clamp(spin * 0.03, -0.18, 0.18)
        const fov = THREE.MathUtils.clamp(Math.abs(spin) * 0.5, 0, 3)
        applyRideCamera(camera, _v, _t, dt, false, { roll, fov })
      }
    }
  })

  return (
    <group position={spec.position}>
      {/* Deck mesh: h=0.4 centered at y=0.35 -> top at 0.55, radii 7.2 (top) / 7.4 (bottom).
          Collider top = 0.275 + 0.275 = 0.55 (flush with the deck); radius 7.3 sits on the flank midline. */}
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.275, 7.3]} position={[0, 0.275, 0]} />
      </RigidBody>

      <group ref={platform}>
        <mesh position={[0, 0.35, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[7.2, 7.4, 0.4, 48]} />
          <meshStandardMaterial color={PALETTE.teal} />
        </mesh>
        <mesh position={[0, 0.56, 0]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[7.2, 0.08, 8, 64]} />
          <meshStandardMaterial color={PALETTE.gold} metalness={0.8} roughness={0.3} />
        </mesh>

        {/* scalloped valance skirt around the platform edge */}
        <Instances geometry={scallopGeo} limit={40}>
          <meshStandardMaterial color="#ffffff" />
          {scallopAngles.map((a, i) => (
            <Instance
              key={i}
              color={i % 2 ? PALETTE.cream : PALETTE.red}
              position={[Math.cos(a) * 7.36, 0.5, Math.sin(a) * 7.36]}
              rotation={[0, -a, 0]}
            />
          ))}
        </Instances>

        {/* low railing: 16 navy posts, gold rail, warm bulbs along the top */}
        <Instances limit={16}>
          <cylinderGeometry args={[0.045, 0.055, 0.6, 8]} />
          <meshStandardMaterial color={PALETTE.navy} />
          {railAngles.map((a, i) => (
            <Instance key={i} position={[Math.cos(a) * 6.85, 0.85, Math.sin(a) * 6.85]} />
          ))}
        </Instances>
        <mesh position={[0, 1.16, 0]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[6.85, 0.04, 8, 72]} />
          <meshStandardMaterial color={PALETTE.gold} metalness={0.7} roughness={0.35} />
        </mesh>
        <Instances limit={32}>
          <sphereGeometry args={[0.07, 10, 8]} />
          <meshStandardMaterial
            ref={bulbMat}
            color={PALETTE.bulbWarm}
            emissive={PALETTE.bulbWarm}
            emissiveIntensity={0.15}
          />
          {bulbAngles.map((a, i) => (
            <Instance key={i} position={[Math.cos(a) * 6.85, 1.26, Math.sin(a) * 6.85]} />
          ))}
        </Instances>

        {/* centerpiece: giant polka teapot on a navy pedestal */}
        <group position={[0, 0.55, 0]}>
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[1.0, 1.3, 0.6, 24]} />
            <meshStandardMaterial color={PALETTE.navy} />
          </mesh>
          <mesh position={[0, 0.62, 0]} rotation-x={Math.PI / 2}>
            <torusGeometry args={[1.05, 0.05, 8, 32]} />
            <meshStandardMaterial color={PALETTE.gold} metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0, 1.75, 0]} scale={[1, 0.85, 1]} castShadow>
            <sphereGeometry args={[1.35, 32, 24]} />
            <meshStandardMaterial map={teapotSkin} />
          </mesh>
          <mesh position={[1.55, 2.1, 0]} rotation-z={-1.0}>
            <coneGeometry args={[0.24, 1.3, 14]} />
            <meshStandardMaterial color={PALETTE.teal} />
          </mesh>
          {/* handle arc opens toward +X so the body fills the gap */}
          <mesh position={[-1.5, 1.8, 0]} rotation-z={0.45 * Math.PI}>
            <torusGeometry args={[0.65, 0.11, 10, 28, Math.PI * 1.1]} />
            <meshStandardMaterial color={PALETTE.teal} />
          </mesh>
          <mesh position={[0, 2.75, 0]} scale={[1, 0.45, 1]}>
            <sphereGeometry args={[0.85, 24, 16]} />
            <meshStandardMaterial color={PALETTE.teal} />
          </mesh>
          <mesh position={[0, 2.8, 0]} rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.86, 0.045, 8, 32]} />
            <meshStandardMaterial color={PALETTE.gold} metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0, 3.18, 0]}>
            <sphereGeometry args={[0.17, 16, 12]} />
            <meshStandardMaterial color={PALETTE.gold} metalness={0.85} roughness={0.25} />
          </mesh>
        </group>

        {tableAngles.map((a, ti) => (
          <group key={ti} position={[Math.cos(a) * 4, 0.62, Math.sin(a) * 4]}>
            <group ref={(el) => { tables.current[ti] = el }}>
              <mesh receiveShadow>
                <cylinderGeometry args={[2.3, 2.4, 0.18, 28]} />
                <meshStandardMaterial color={PALETTE.teal} />
              </mesh>
              <mesh position={[0, 0.105, 0]} receiveShadow>
                <cylinderGeometry args={[2.25, 2.25, 0.05, 28]} />
                <meshStandardMaterial map={turntableTop} />
              </mesh>
              <mesh position={[0, 0.1, 0]} rotation-x={Math.PI / 2}>
                <torusGeometry args={[2.3, 0.05, 8, 40]} />
                <meshStandardMaterial color={PALETTE.gold} metalness={0.8} roughness={0.3} />
              </mesh>
              {[0, Math.PI].map((ca, ci) => {
                const idx = ti * 2 + ci
                const skin = cupSkins[idx % 4]
                const accent = cupAccents[idx % 4]
                return (
                  <group
                    key={ci}
                    ref={(el) => { cups.current[idx] = el }}
                    position={[Math.cos(ca) * 1.15, 0.45, Math.sin(ca) * 1.15]}
                  >
                    <mesh position={[0, -0.32, 0]}>
                      <latheGeometry args={[saucerPoints, 28]} />
                      <meshStandardMaterial map={skin} side={THREE.DoubleSide} />
                    </mesh>
                    <mesh position={[0, -0.3, 0]} castShadow>
                      <latheGeometry args={[cupPoints, 32]} />
                      <meshStandardMaterial map={skin} side={THREE.DoubleSide} />
                    </mesh>
                    <mesh position={[0, 0.63, 0]} rotation-x={Math.PI / 2}>
                      <torusGeometry args={[0.99, 0.03, 8, 36]} />
                      <meshStandardMaterial color={PALETTE.gold} metalness={0.8} roughness={0.3} />
                    </mesh>
                    {/* handle arc opens toward -X, into the cup wall */}
                    <mesh position={[0.95, 0.15, 0]} rotation-z={-0.7 * Math.PI}>
                      <torusGeometry args={[0.24, 0.06, 10, 24, Math.PI * 1.4]} />
                      <meshStandardMaterial color={accent} />
                    </mesh>
                  </group>
                )
              })}
            </group>
          </group>
        ))}
      </group>
      <RideTrigger spec={spec} />
    </group>
  )
}

'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { GAME_STALL_BY_ID } from '@/lib/spawn'
import { PALETTE, BAZAAR } from '@/lib/palette'
import { useGameStore } from '@/state/useGameStore'
import { useRingToss } from '@/lib/minigame'
import { look, playerRig } from '@/lib/refs'

const spec = GAME_STALL_BY_ID.ringtoss
const [SX, , SZ] = spec.position
const YAW = Math.atan2(-SX, -SZ)
const OUT = new THREE.Vector3(Math.sin(YAW), 0, Math.cos(YAW))
const NEAR_R = 4.6

const BOTTLE_MODEL = '/models/WaterBottle.glb'
const BOTTLE_SCALE = 5 // model is small in its own units; → ~0.55 m bottles
const PEG_TOP_Y = 1.5 // world height of the bottle necks the rings catch on
const CATCH_R = 0.36 // landing must fall within this of a peg to count
const FLIGHT_T = 0.6 // seconds a thrown ring takes to fly its arc
const PREVIEW_DOTS = 14
const RING_COLOR = BAZAAR.turquoise

/** Where the player stands + the FIXED hand origin every throw launches from
 *  (independent of the camera, so FPP/TPP don't change the throw). */
const STAND_X = SX + OUT.x * 3.6
const STAND_Z = SZ + OUT.z * 3.6
const RIGHT = new THREE.Vector3(OUT.z, 0, -OUT.x)
const THROW_ORIGIN = new THREE.Vector3(STAND_X, 1.6, STAND_Z)

const _fwd = new THREE.Vector3()
const _camPos = new THREE.Vector3()
const _land = new THREE.Vector3()
const _tmp = new THREE.Vector3()

/** Arc point at t∈[0,1] between origin and landing, lifted by a sine hump. */
function arcAt(out: THREE.Vector3, origin: THREE.Vector3, land: THREE.Vector3, height: number, t: number) {
  out.lerpVectors(origin, land, t)
  out.y += height * Math.sin(Math.PI * t)
}

/**
 * Playable ring toss. Pegs (bottles) sit on a table inside the booth. Hold the
 * left button to build power (a dotted arc previews the landing); release to
 * throw. If the landing falls within a peg's catch radius the ring snaps onto
 * it and stacks. 5 rings per round; rings landed pay tokens. The pegs live in
 * the rotated booth group, but every moving FX (preview, flying ring, stacked
 * rings) lives in a world-space group so positions are set in world coords.
 */
export default function RingToss() {
  const { camera } = useThree()
  const booth = useRef<THREE.Group>(null)
  const preview = useRef<THREE.InstancedMesh>(null)
  const flyRing = useRef<THREE.Mesh>(null)
  const stacked = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const charging = useRef(false)
  const power = useRef(0)
  const throwOrigin = useRef(new THREE.Vector3())
  const throwTarget = useRef(new THREE.Vector3())
  const flight = useRef<{ t: number; success: boolean; h: number } | null>(null)
  const stackCount = useRef(0)
  const wasActive = useRef(false)

  // pegs: a 3×3 grid on the table (local to the booth group)
  const pegs = useMemo(() => {
    const p: [number, number][] = []
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) p.push([-0.7 + c * 0.7, -0.65 + r * 0.32])
    return p
  }, [])
  // world XZ of each peg neck for the catch test + ring stacking
  const pegWorld = useMemo(
    () =>
      pegs.map(([x, z]) => new THREE.Vector2(SX + x * Math.cos(YAW) + z * Math.sin(YAW), SZ - x * Math.sin(YAW) + z * Math.cos(YAW))),
    [pegs]
  )

  // real water-bottle model for each peg (one independent clone)
  const { scene: bottleScene } = useGLTF(BOTTLE_MODEL)
  const bottles = useMemo(
    () =>
      pegs.map(() => {
        const c = bottleScene.clone(true)
        c.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) o.castShadow = true
        })
        return c
      }),
    [pegs, bottleScene]
  )

  useEffect(() => {
    if (stacked.current) stacked.current.count = 0
  }, [])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      const g = useRingToss.getState()
      if (!g.active || g.result || g.ringsLeft <= 0 || flight.current || !document.pointerLockElement) return
      charging.current = true
      power.current = 0
    }
    const onUp = () => {
      if (!charging.current) return
      charging.current = false
      const g = useRingToss.getState()
      if (!g.active || g.result || g.ringsLeft <= 0) return

      // landing: straight ahead (yaw) at a power-scaled distance, at peg height
      _fwd.set(-Math.sin(look.yaw), 0, -Math.cos(look.yaw))
      const dist = 2.6 + power.current * 2.9
      _land.copy(THROW_ORIGIN).addScaledVector(_fwd, dist)
      _land.y = PEG_TOP_Y

      // nearest peg within catch radius (horizontal)?
      let best = -1
      let bestD = CATCH_R
      for (let i = 0; i < pegWorld.length; i++) {
        const dd = Math.hypot(_land.x - pegWorld[i].x, _land.z - pegWorld[i].y)
        if (dd < bestD) {
          bestD = dd
          best = i
        }
      }
      throwOrigin.current.copy(THROW_ORIGIN)
      if (best >= 0) throwTarget.current.set(pegWorld[best].x, PEG_TOP_Y, pegWorld[best].y)
      else throwTarget.current.copy(_land)
      flight.current = { t: 0, success: best >= 0, h: 0.9 + power.current * 0.7 }
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
    }
  }, [pegWorld])

  useFrame((_, dt) => {
    const st = useGameStore.getState()
    if (!booth.current) return
    const g = useRingToss.getState()
    const me = st.activeStall === spec.id

    if (me && !wasActive.current) {
      look.yaw = YAW
      look.pitch = -0.22 // look down over the counter onto the bottles
      stackCount.current = 0
      if (stacked.current) stacked.current.count = 0
      flight.current = null
      charging.current = false
      power.current = 0
      playerRig.body?.setTranslation({ x: STAND_X, y: 1.1, z: STAND_Z }, true)
      playerRig.body?.setLinvel({ x: 0, y: 0, z: 0 }, true)
    }
    wasActive.current = me

    if (!st.activeStall && !st.activeRide && !st.paused) {
      const near = (st.playerPos.x - SX) ** 2 + (st.playerPos.z - SZ) ** 2 < NEAR_R * NEAR_R
      if (near && st.nearbyStall !== spec.id) st.setNearbyStall(spec.id)
      else if (!near && st.nearbyStall === spec.id) st.setNearbyStall(null)
    }

    if (me) {
      if (st.view === 'third') {
        // over-the-shoulder so you see your character toss the rings
        _fwd.set(-Math.sin(look.yaw), 0, -Math.cos(look.yaw))
        _camPos.set(STAND_X - _fwd.x * 3.0 + RIGHT.x * 1.0, 3.0, STAND_Z - _fwd.z * 3.0 + RIGHT.z * 1.0)
      } else {
        _camPos.copy(OUT).multiplyScalar(3.6)
        _camPos.set(SX + _camPos.x, 2.15, SZ + _camPos.z)
      }
      camera.position.lerp(_camPos, 1 - Math.pow(0.0001, dt))
      camera.rotation.set(look.pitch, look.yaw, 0, 'YXZ')
    }

    if (me && charging.current && !g.result) {
      power.current = Math.min(1, power.current + dt * 0.85)
      g.setPower(power.current)
    }

    // dotted preview arc while charging
    const pv = preview.current
    if (pv) {
      const show = me && charging.current && !flight.current
      pv.visible = show
      if (show) {
        _fwd.set(-Math.sin(look.yaw), 0, -Math.cos(look.yaw))
        _land.copy(THROW_ORIGIN).addScaledVector(_fwd, 2.6 + power.current * 2.9)
        _land.y = PEG_TOP_Y
        const h = 0.9 + power.current * 0.7
        for (let i = 0; i < PREVIEW_DOTS; i++) {
          arcAt(_tmp, THROW_ORIGIN, _land, h, i / (PREVIEW_DOTS - 1))
          dummy.position.copy(_tmp)
          dummy.scale.setScalar(0.5 + (1 - i / PREVIEW_DOTS) * 0.7)
          dummy.updateMatrix()
          pv.setMatrixAt(i, dummy.matrix)
        }
        pv.instanceMatrix.needsUpdate = true
      }
    }

    // fly a thrown ring along its fixed arc, then resolve
    const fr = flyRing.current
    const f = flight.current
    if (fr && f) {
      fr.visible = true
      f.t = Math.min(1, f.t + dt / FLIGHT_T)
      arcAt(fr.position, throwOrigin.current, throwTarget.current, f.h, f.t)
      fr.rotation.set(Math.PI / 2, 0, fr.rotation.z + dt * 6)
      if (f.t >= 1) {
        if (f.success && stacked.current) {
          const lc = stackCount.current++
          dummy.position.copy(throwTarget.current)
          dummy.rotation.set(Math.PI / 2, 0, 0)
          dummy.scale.setScalar(1)
          dummy.updateMatrix()
          stacked.current.setMatrixAt(lc, dummy.matrix)
          stacked.current.count = stackCount.current
          stacked.current.instanceMatrix.needsUpdate = true
        }
        g.resolve(f.success)
        flight.current = null
        fr.visible = false
      }
    } else if (fr) {
      fr.visible = false
    }
  })

  return (
    <>
      <group ref={booth} position={[SX, 0, SZ]} rotation-y={YAW}>
        <mesh position={[0, 0.95, -0.35]} receiveShadow>
          <boxGeometry args={[2.8, 0.1, 1.2]} />
          <meshStandardMaterial color={PALETTE.wood} />
        </mesh>
        {pegs.map(([x, z], i) => (
          <primitive key={i} object={bottles[i]} position={[x, 1.0, z]} scale={BOTTLE_SCALE} />
        ))}
      </group>

      {/* world-space FX (no booth transform) */}
      <instancedMesh ref={preview} args={[undefined, undefined, PREVIEW_DOTS]} visible={false} frustumCulled={false}>
        <sphereGeometry args={[0.045, 6, 5]} />
        <meshBasicMaterial color={PALETTE.goldLight} transparent opacity={0.85} />
      </instancedMesh>
      <mesh ref={flyRing} visible={false} frustumCulled={false}>
        <torusGeometry args={[0.16, 0.04, 8, 20]} />
        <meshStandardMaterial color={RING_COLOR} emissive={RING_COLOR} emissiveIntensity={0.3} />
      </mesh>
      <instancedMesh ref={stacked} args={[undefined, undefined, 5]} frustumCulled={false}>
        <torusGeometry args={[0.16, 0.04, 8, 20]} />
        <meshStandardMaterial color={RING_COLOR} />
      </instancedMesh>
    </>
  )
}

useGLTF.preload(BOTTLE_MODEL)

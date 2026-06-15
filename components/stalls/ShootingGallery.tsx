'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { GAME_STALL_BY_ID } from '@/lib/spawn'
import { PALETTE, BAZAAR } from '@/lib/palette'
import { useGameStore } from '@/state/useGameStore'
import { useShooting } from '@/lib/minigame'
import { useFestival } from '@/lib/festival'
import { announce } from '@/lib/announcer'
import { look, playerRig } from '@/lib/refs'
import { parkAudio } from '@/lib/audio'

const spec = GAME_STALL_BY_ID.shooting
const [SX, , SZ] = spec.position
const YAW = Math.atan2(-SX, -SZ)
/** Unit vector from the booth toward the plaza — where the player stands to aim. */
const OUT = new THREE.Vector3(Math.sin(YAW), 0, Math.cos(YAW))
const NEAR_R = 4.6
const DUCK_MODEL = '/models/Duck.glb'
/** Duck.glb is ~1.7 units tall; scale to a ~0.55 m fairground target. */
const DUCK_SCALE = 0.32

const BALLOON_COLORS = [
  BAZAAR.magenta, BAZAAR.marigold, BAZAAR.parrotGreen, BAZAAR.turquoise, BAZAAR.chilliRed,
]
/** Where the player stands to shoot (and where their character is placed). */
const STAND_X = SX + OUT.x * 3.4
const STAND_Z = SZ + OUT.z * 3.4
const RIGHT = new THREE.Vector3(OUT.z, 0, -OUT.x) // shoulder offset for the TPP cam
const _ray = new THREE.Raycaster()
const _center = new THREE.Vector2(0, 0)
const _camPos = new THREE.Vector3()
const _gunPos = new THREE.Vector3()
const _fwd = new THREE.Vector3()

interface Target {
  kind: 'balloon' | 'duck'
  home: [number, number, number]
  points: number
  rail?: number
  phase?: number
}

/**
 * Playable shooting gallery. Targets sit in the open window (in front of the
 * booth's back wall so nothing occludes them). E starts a 30 s / 8-shot round;
 * each left-click raycasts from screen centre, popping a balloon or knocking a
 * duck with a bang + pop SFX. A first-person rifle with muzzle flash and recoil
 * sells the shooting; the camera locks to an over-the-counter aim view.
 */
export default function ShootingGallery() {
  const { camera } = useThree()
  const booth = useRef<THREE.Group>(null)
  const gun = useRef<THREE.Group>(null)
  const flashMat = useRef<THREE.MeshBasicMaterial>(null)
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  const popped = useRef<boolean[]>([])
  const knock = useRef<number[]>([])
  const wasActive = useRef(false)
  const recoil = useRef(0)
  const flash = useRef(0)

  const targets = useMemo<Target[]>(() => {
    const t: Target[] = []
    // two balloon rows in the open window (z = -0.45, in front of the back wall)
    for (let row = 0; row < 2; row++) {
      for (let c = 0; c < 6; c++) {
        t.push({ kind: 'balloon', home: [-1.5 + c * 0.6, 1.55 + row * 0.5, -0.45], points: 1 })
      }
    }
    // one sliding duck row, just above and behind the counter rim
    for (let c = 0; c < 4; c++) {
      t.push({ kind: 'duck', home: [-1.35 + c * 0.9, 1.62, 0.15], points: 3, rail: 1.3, phase: c * 1.3 })
    }
    // a cocky golden duck: erratic, high value, taunts when missed
    t.push({ kind: 'duck', home: [0, 2.15, 0.15], points: 6, rail: 1.9, phase: 2.1 })
    return t
  }, [])

  // real rubber-duck model for the duck targets (one independent clone each)
  const { scene: duckScene } = useGLTF(DUCK_MODEL)
  const duckClones = useMemo(
    () =>
      targets.map((t) => {
        if (t.kind !== 'duck') return null
        const c = duckScene.clone(true)
        c.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) o.castShadow = true
        })
        return c
      }),
    [targets, duckScene]
  )

  useEffect(() => {
    popped.current = targets.map(() => false)
    knock.current = targets.map(() => 0)
  }, [targets])

  // Left-click fires while the round is live and the pointer is locked.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      const g = useShooting.getState()
      if (!g.active || g.result || g.ammo <= 0) return
      if (!document.pointerLockElement) return

      recoil.current = 1
      flash.current = 1
      parkAudio.gunshot()

      _ray.setFromCamera(_center, camera)
      const live = meshes.current.filter(
        (m, i): m is THREE.Mesh => !!m && m.visible && !popped.current[i]
      )
      const first = _ray.intersectObjects(live, false)[0]
      let points = 0
      if (first) {
        const idx = meshes.current.indexOf(first.object as THREE.Mesh)
        if (idx >= 0 && !popped.current[idx]) {
          popped.current[idx] = true
          points = targets[idx].points
          if (targets[idx].kind === 'balloon') parkAudio.pop()
          else parkAudio.clank()
          if (points >= 6) {
            useFestival.getState().addScore(300) // cocky duck bonus
            announce('gameWin')
          }
        }
      } else {
        // near-miss: ray passed close to a live target but hit nothing
        announce('miss')
      }
      g.fire(points)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [camera, targets])

  useFrame((state, dt) => {
    const st = useGameStore.getState()
    if (!booth.current || !gun.current) return
    const gs = useShooting.getState()
    const me = st.activeStall === spec.id

    // fresh round → restore targets, snap the aim to face the booth
    if (me && !wasActive.current) {
      popped.current = targets.map(() => false)
      knock.current = targets.map(() => 0)
      look.yaw = YAW
      look.pitch = -0.08 // crosshair rests on the balloon rows
      // stand the player's character at the firing spot so FPP/TPP line up
      playerRig.body?.setTranslation({ x: STAND_X, y: 1.1, z: STAND_Z }, true)
      playerRig.body?.setLinvel({ x: 0, y: 0, z: 0 }, true)
    }
    wasActive.current = me

    // proximity prompt
    if (!st.activeStall && !st.activeRide && !st.paused) {
      const near = (st.playerPos.x - SX) ** 2 + (st.playerPos.z - SZ) ** 2 < NEAR_R * NEAR_R
      if (near && st.nearbyStall !== spec.id) st.setNearbyStall(spec.id)
      else if (!near && st.nearbyStall === spec.id) st.setNearbyStall(null)
    }

    if (me && !gs.result && !st.paused) gs.tick(dt)

    // animate targets
    const t = state.clock.elapsedTime
    for (let i = 0; i < targets.length; i++) {
      const m = meshes.current[i]
      const tg = targets[i]
      if (!m) continue
      if (tg.kind === 'duck' && tg.rail != null) {
        const fast = tg.points >= 6 ? 2.6 : 1.3 // cocky duck darts faster
        m.position.x = tg.home[0] + Math.sin(t * fast + (tg.phase ?? 0)) * tg.rail
        // juke: dip behind the counter on a per-duck rhythm (visible tell — it
        // sinks for ~0.4 s); firing while dipped registers no hit
        const dip = Math.sin(t * 0.9 + (tg.phase ?? 0) * 3) > 0.86
        m.position.y = tg.home[1] - (dip && !popped.current[i] ? 0.9 : 0)
      }
      if (popped.current[i]) {
        if (tg.kind === 'balloon') m.visible = false
        else {
          knock.current[i] = Math.min(1, knock.current[i] + dt * 4)
          m.rotation.x = -knock.current[i] * 1.4
        }
      } else {
        m.visible = true
        m.rotation.x = 0
      }
    }

    // camera while playing; V switches first-person aim ↔ over-shoulder TPP
    const g = gun.current
    const thirdPerson = st.view === 'third'
    g.visible = me && !thirdPerson // the FPP rifle only makes sense in first person
    if (me) {
      recoil.current = Math.max(0, recoil.current - dt * 6)
      flash.current = Math.max(0, flash.current - dt * 12)
      // aim direction from the mouse-look (same in both views, so the centre
      // crosshair + raycast behave identically — TPP just pulls the cam back)
      _fwd.set(-Math.sin(look.yaw), 0, -Math.cos(look.yaw))
      if (thirdPerson) {
        // over-the-shoulder: behind + up + to the right so the character sits
        // lower-left and the centre stays clear for aiming
        _camPos.set(
          STAND_X - _fwd.x * 2.8 + RIGHT.x * 1.0,
          2.5,
          STAND_Z - _fwd.z * 2.8 + RIGHT.z * 1.0
        )
      } else {
        _camPos.set(STAND_X, 1.85, STAND_Z)
      }
      camera.position.lerp(_camPos, 1 - Math.pow(0.0001, dt))
      camera.rotation.set(look.pitch + recoil.current * 0.05, look.yaw, 0, 'YXZ')

      _gunPos.set(0.32, -0.27, -0.7 + recoil.current * 0.14).applyMatrix4(camera.matrixWorld)
      g.position.copy(_gunPos)
      g.quaternion.copy(camera.quaternion)
      if (flashMat.current) flashMat.current.opacity = flash.current
    }
  })

  return (
    <>
      <group ref={booth} position={[SX, 0, SZ]} rotation-y={YAW}>
        {targets.map((tg, i) =>
          tg.kind === 'balloon' ? (
            <mesh
              key={i}
              ref={(el) => {
                meshes.current[i] = el
              }}
              position={tg.home}
              castShadow
            >
              <sphereGeometry args={[0.22, 12, 10]} />
              <meshStandardMaterial
                color={BALLOON_COLORS[i % BALLOON_COLORS.length]}
                roughness={0.5}
                emissive={BALLOON_COLORS[i % BALLOON_COLORS.length]}
                emissiveIntensity={0.25}
              />
            </mesh>
          ) : (
            // invisible proxy box: handles raycast + slide/tip animation; the
            // real Duck model rides on it as a child so it follows automatically
            <mesh
              key={i}
              ref={(el) => {
                meshes.current[i] = el
              }}
              position={tg.home}
            >
              <boxGeometry args={[0.5, 0.55, 0.4]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              {duckClones[i] && (
                <primitive
                  object={duckClones[i] as THREE.Object3D}
                  scale={DUCK_SCALE}
                  position={[0, -0.28, 0]}
                  rotation={[0, Math.PI / 2, 0]}
                />
              )}
            </mesh>
          )
        )}
      </group>

      {/* first-person rifle, positioned in camera space each frame */}
      <group ref={gun} visible={false}>
        <mesh position={[0, -0.02, 0.05]}>
          <boxGeometry args={[0.07, 0.09, 0.5]} />
          <meshStandardMaterial color="#3a2a1c" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.01, -0.32]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.022, 0.022, 0.45, 8]} />
          <meshStandardMaterial color="#20242c" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, -0.12, 0.18]} rotation-x={0.5}>
          <boxGeometry args={[0.06, 0.16, 0.07]} />
          <meshStandardMaterial color="#2a1d12" roughness={0.8} />
        </mesh>
        {/* muzzle flash */}
        <mesh position={[0, 0.01, -0.56]}>
          <sphereGeometry args={[0.11, 8, 6]} />
          <meshBasicMaterial ref={flashMat} color="#ffd27d" transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </>
  )
}

useGLTF.preload(DUCK_MODEL)

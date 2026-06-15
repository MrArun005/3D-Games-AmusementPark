'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { SkeletonUtils } from 'three-stdlib'
import { useGameStore, type Quality } from '@/state/useGameStore'
import { mulberry32, WAYPOINTS } from '@/lib/spawn'
import { CROWD_TARGETS, crowdAgents } from '@/lib/crowd'
import { BAZAAR } from '@/lib/palette'

const MODEL = '/models/CesiumMan.glb'
const MAX = 24
const COUNT_BY_Q: Record<Quality, number> = { low: 10, medium: 16, high: MAX }

/** Beyond this distance from the player, freeze the walk cycle (cheap LOD). */
const ANIM_LOD_R = 30
const FOUNTAIN_AVOID_R = 4.5
const AVOID_GAIN = 2

/** Clothing tints applied over the model's texture — varied but kept moderate. */
const CLOTH_TINTS = [
  BAZAAR.magenta, BAZAAR.marigold, BAZAAR.parrotGreen, BAZAAR.turquoise,
  BAZAAR.purple, BAZAAR.chilliRed, BAZAAR.yellow, BAZAAR.skyBlue,
  '#e8e2d2', '#cdd6e0',
]

interface Npc {
  x: number
  z: number
  tx: number
  tz: number
  speed: number
  idle: number
  yaw: number
  /** Height multiplier — people aren't all the same size; some kids move faster. */
  s: number
  root: THREE.Object3D
  mixer: THREE.AnimationMixer
  action: THREE.AnimationAction
}

/**
 * Realistic wandering crowd: each NPC is an independent skinned clone of the
 * same textured human as the player (CesiumMan), with a per-person clothing
 * tint, varied height, and the walk clip driven by speed. Physics-free — they
 * steer in straight lines between path waypoints with fountain avoidance and
 * occasional idle pauses. A distance LOD freezes the animation of far NPCs.
 */
export default function Crowd() {
  const count = useGameStore((s) => COUNT_BY_Q[s.quality])
  const { scene, animations } = useGLTF(MODEL)
  const group = useRef<THREE.Group>(null)

  const npcs = useMemo<Npc[]>(() => {
    const rnd = mulberry32(777)
    const list: Npc[] = []
    for (let i = 0; i < MAX; i++) {
      const wp = WAYPOINTS[Math.floor(rnd() * WAYPOINTS.length)]
      const target = WAYPOINTS[Math.floor(rnd() * WAYPOINTS.length)]
      const root = SkeletonUtils.clone(scene)
      const s = 0.85 + rnd() * 0.3
      root.scale.setScalar(s)

      // independent, tinted materials so each clone wears a different colour
      const tint = new THREE.Color(CLOTH_TINTS[Math.floor(rnd() * CLOTH_TINTS.length)])
      root.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.isMesh) {
          m.castShadow = true
          m.frustumCulled = false
          const src = m.material as THREE.MeshStandardMaterial
          const mat = src.clone()
          // blend the tint lightly over the baked texture: enough for clothing
          // variety, but not so much it flattens the face into a solid colour
          mat.color = new THREE.Color('#ffffff').lerp(tint, 0.35)
          m.material = mat
        }
      })

      // ~40% carry a balloon (visible "bought something" prop) on a string
      if (rnd() < 0.4) {
        const carry = new THREE.Group()
        carry.position.set(0.28, 1.9, 0.05)
        const balloon = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 10, 8),
          new THREE.MeshStandardMaterial({ color: CLOTH_TINTS[Math.floor(rnd() * CLOTH_TINTS.length)], roughness: 0.4 })
        )
        const string = new THREE.Mesh(
          new THREE.CylinderGeometry(0.005, 0.005, 0.5, 4),
          new THREE.MeshStandardMaterial({ color: '#d8d2c0' })
        )
        string.position.y = -0.32
        carry.add(balloon, string)
        root.add(carry)
      }

      const mixer = new THREE.AnimationMixer(root)
      const action = mixer.clipAction(animations[0])
      action.play()
      action.time = rnd() * 2 // desync the stride between people

      list.push({
        x: wp[0] + (rnd() - 0.5) * 3,
        z: wp[1] + (rnd() - 0.5) * 3,
        tx: target[0],
        tz: target[1],
        speed: 0.7 + rnd() * 0.9,
        idle: 0,
        yaw: rnd() * Math.PI * 2,
        s,
        root,
        mixer,
        action,
      })
    }
    return list
  }, [scene, animations])

  // attach the clones to the scene graph once
  useEffect(() => {
    const g = group.current
    if (!g) return
    npcs.forEach((n) => g.add(n.root))
    return () => {
      npcs.forEach((n) => {
        n.mixer.stopAllAction()
        g.remove(n.root)
      })
    }
  }, [npcs])

  // show only the first `count` clones for the current quality level
  useEffect(() => {
    npcs.forEach((n, i) => (n.root.visible = i < count))
  }, [npcs, count])

  useFrame((_, rawDt) => {
    const st = useGameStore.getState()
    if (st.paused) return
    const dt = Math.min(rawDt, 0.05)
    const px = st.playerPos.x
    const pz = st.playerPos.z

    for (let i = 0; i < count; i++) {
      const n = npcs[i]
      const dx = n.tx - n.x
      const dz = n.tz - n.z
      const d = Math.hypot(dx, dz)
      let walking = false
      if (n.idle > 0) {
        n.idle -= dt
      } else if (d < 1) {
        // Half the time take a SHORT hop to a nearby spot so people cluster and
        // linger (and chat); otherwise stroll off to a random stall/ride front.
        let wp: [number, number]
        if (Math.random() < 0.5) {
          const nearby = CROWD_TARGETS.filter(
            (t) => (t[0] - n.x) ** 2 + (t[1] - n.z) ** 2 < 14 * 14
          )
          wp = (nearby.length ? nearby : CROWD_TARGETS)[Math.floor(Math.random() * (nearby.length || CROWD_TARGETS.length))]
        } else {
          wp = CROWD_TARGETS[Math.floor(Math.random() * CROWD_TARGETS.length)]
        }
        n.tx = wp[0] + (Math.random() - 0.5) * 2.5
        n.tz = wp[1] + (Math.random() - 0.5) * 2.5
        // linger most of the time (browse / chat) so bubbles have time to show
        if (Math.random() < 0.8) n.idle = 2.5 + Math.random() * 3.5
      } else {
        walking = true
        n.yaw = Math.atan2(dx, dz)
        n.x += (dx / d) * n.speed * dt
        n.z += (dz / d) * n.speed * dt
        const distO = Math.hypot(n.x, n.z)
        if (distO < FOUNTAIN_AVOID_R) {
          const ppx = -dz / d
          const ppz = dx / d
          const side = ppx * n.x + ppz * n.z >= 0 ? 1 : -1
          const push = (FOUNTAIN_AVOID_R - distO) * AVOID_GAIN * side * dt
          n.x += ppx * push
          n.z += ppz * push
        }
      }

      n.root.position.set(n.x, 0, n.z)
      n.root.rotation.y = n.yaw

      // publish transform for the speech-bubble system
      const a = (crowdAgents[i] ??= { x: 0, z: 0, y: 0, idle: false })
      a.x = n.x
      a.z = n.z
      a.y = 1.95 * n.s
      a.idle = !walking

      // LOD: only advance the walk cycle for nearby NPCs; pause the rest.
      const near = (n.x - px) ** 2 + (n.z - pz) ** 2 < ANIM_LOD_R * ANIM_LOD_R
      if (near && walking) {
        n.action.paused = false
        n.action.timeScale = THREE.MathUtils.clamp(n.speed * 1.3, 0.7, 2)
        n.mixer.update(dt)
      } else {
        n.action.paused = true
      }
    }
    crowdAgents.length = count
  })

  return <group ref={group} />
}

useGLTF.preload(MODEL)

'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useRapier, type RapierRigidBody } from '@react-three/rapier'
import { useGLTF } from '@react-three/drei'
import { useGameStore, type Quality } from '@/state/useGameStore'
import { mulberry32, WAYPOINTS } from '@/lib/spawn'
import { CROWD_TARGETS, crowdAgents } from '@/lib/crowd'
import { buildCharacter, randomConfig, findClip, CHARACTER_MODELS, CHARACTER_URLS, ACCENT_COLORS } from '@/lib/characters'

/** Bright balloon colours (skip index 0 = white) for the "bought something" prop. */
const BALLOON_COLORS = ACCENT_COLORS.slice(1)

const MAX = 24
const COUNT_BY_Q: Record<Quality, number> = { low: 10, medium: 16, high: MAX }

/** Beyond this distance from the player, freeze the walk cycle (cheap LOD). */
const ANIM_LOD_R = 30
const FOUNTAIN_AVOID_R = 4.5
const AVOID_GAIN = 2

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
  walkAction: THREE.AnimationAction
  idleAction: THREE.AnimationAction | null
}

/**
 * Realistic wandering crowd: each NPC is an independent skinned clone drawn from
 * one of the {@link CHARACTER_MODELS} modern-civilian models, with a per-person
 * accent tint, varied height, and the walk clip driven by speed. Physics-free —
 * they steer in straight lines between path waypoints with fountain avoidance and
 * occasional idle pauses. A distance LOD freezes the animation of far NPCs.
 */
export default function Crowd() {
  const count = useGameStore((s) => COUNT_BY_Q[s.quality])
  const gltfs = useGLTF(CHARACTER_URLS)
  const group = useRef<THREE.Group>(null)

  const npcs = useMemo<Npc[]>(() => {
    const rnd = mulberry32(777)
    const list: Npc[] = []
    for (let i = 0; i < MAX; i++) {
      const wp = WAYPOINTS[Math.floor(rnd() * WAYPOINTS.length)]
      const target = WAYPOINTS[Math.floor(rnd() * WAYPOINTS.length)]
      const cfg = randomConfig(rnd)
      const { scene, animations } = gltfs[cfg.model]
      const root = buildCharacter(scene, cfg)
      const s = cfg.scale

      // ~40% carry a balloon (visible "bought something" prop) on a string
      if (rnd() < 0.4) {
        const carry = new THREE.Group()
        carry.position.set(0.28, 1.9, 0.05)
        const balloon = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 10, 8),
          new THREE.MeshStandardMaterial({ color: BALLOON_COLORS[Math.floor(rnd() * BALLOON_COLORS.length)], roughness: 0.4 })
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
      const walkClip = findClip(animations, 'Walk') ?? animations[0]
      const idleClip = findClip(animations, 'Idle')
      const walkAction = mixer.clipAction(walkClip)
      walkAction.play()
      walkAction.time = rnd() * 2 // desync the stride between people
      const idleAction = idleClip ? mixer.clipAction(idleClip) : null
      if (idleAction) {
        idleAction.play()
        idleAction.time = rnd() * 2
      }

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
        walkAction,
        idleAction,
      })
    }
    return list
  }, [gltfs])

  // Each visible NPC gets a kinematic-position capsule so the player collides
  // with people. Created imperatively (the visual roots are moved by steering
  // math, not a <RigidBody>), then driven to follow each NPC every frame.
  const { world, rapier } = useRapier()
  const bodies = useRef<RapierRigidBody[]>([])

  useEffect(() => {
    const created: RapierRigidBody[] = []
    for (let i = 0; i < npcs.length; i++) {
      const n = npcs[i]
      const body = world.createRigidBody(
        rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(n.x, 0.9, n.z),
      )
      world.createCollider(rapier.ColliderDesc.capsule(0.55, 0.3), body)
      created.push(body)
    }
    bodies.current = created
    return () => {
      created.forEach((b) => world.removeRigidBody(b))
      bodies.current = []
    }
  }, [npcs, world, rapier])

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
        // steer around the player so NPCs don't walk into the (now solid) body
        const pdx = n.x - px
        const pdz = n.z - pz
        const pd = Math.hypot(pdx, pdz)
        const PLAYER_AVOID_R = 2.2
        if (pd < PLAYER_AVOID_R && pd > 0.001) {
          const push = (PLAYER_AVOID_R - pd) * 1.5 * dt
          n.x += (pdx / pd) * push
          n.z += (pdz / pd) * push
        }
      }

      n.root.position.set(n.x, 0, n.z)
      n.root.rotation.y = n.yaw

      // move the kinematic capsule to follow the NPC
      const body = bodies.current[i]
      if (body) body.setNextKinematicTranslation({ x: n.x, y: 0.9, z: n.z })

      // publish transform for the speech-bubble system
      const a = (crowdAgents[i] ??= { x: 0, z: 0, y: 0, idle: false })
      a.x = n.x
      a.z = n.z
      a.y = 1.95 * n.s
      a.idle = !walking

      // LOD: only animate nearby NPCs (cheap). Near ones blend walk<->idle so
      // lingering people stand and breathe instead of freezing mid-stride; far
      // ones simply stop advancing (frozen, but off-screen/distant anyway).
      const near = (n.x - px) ** 2 + (n.z - pz) ** 2 < ANIM_LOD_R * ANIM_LOD_R
      if (near) {
        n.walkAction.timeScale = THREE.MathUtils.clamp(n.speed * 1.3, 0.7, 2)
        if (n.idleAction) {
          n.walkAction.weight = walking ? 1 : 0
          n.idleAction.weight = walking ? 0 : 1
        } else {
          n.walkAction.paused = !walking
        }
        n.mixer.update(dt)
      }
    }
    // park colliders of NPCs hidden by the quality LOD far below the floor
    for (let i = count; i < bodies.current.length; i++) {
      bodies.current[i].setNextKinematicTranslation({ x: 0, y: -50, z: 0 })
    }
    crowdAgents.length = count
  })

  return <group ref={group} />
}

CHARACTER_URLS.forEach((u) => useGLTF.preload(u))

'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import { SkeletonUtils } from 'three-stdlib'
import { useGameStore } from '@/state/useGameStore'
import { look, playerRig } from '@/lib/refs'

const MODEL = '/models/CesiumMan.glb'

/**
 * Third-person body: a real textured human (Khronos CesiumMan, a scanned
 * person with a built-in walk cycle). Rendered as a child of the player's
 * RigidBody so it follows physics exactly; visible only in third person and
 * never while a ride owns the camera. The single walk clip is sped up with
 * movement and paused when standing still.
 */
export default function PlayerAvatar() {
  const { scene, animations } = useGLTF(MODEL)
  // Clone so the avatar instance is independent of the cached source graph.
  const cloned = useMemo(() => SkeletonUtils.clone(scene), [scene])
  const group = useRef<THREE.Group>(null)
  const { actions, names } = useAnimations(animations, group)
  const walk = useRef<THREE.AnimationAction | null>(null)

  useEffect(() => {
    cloned.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true
        o.frustumCulled = false // skinned bounds lag the capsule; never pop out
      }
    })
    const a = actions[names[0]]
    if (a) {
      a.play()
      walk.current = a
    }
  }, [cloned, actions, names])

  useFrame(() => {
    const g = group.current
    if (!g) return
    const st = useGameStore.getState()
    g.visible = st.view === 'third' && !st.activeRide

    const v = playerRig.body?.linvel()
    const speed = v ? Math.hypot(v.x, v.z) : 0
    const a = walk.current
    if (a) {
      if (speed > 0.4) {
        a.paused = false
        a.timeScale = THREE.MathUtils.clamp(speed / 2.2, 0.7, 2.4)
      } else {
        a.paused = true // stand still instead of sliding
      }
    }
    // Face velocity while moving, else the camera yaw. Model front is +Z.
    if (v && speed > 0.4) g.rotation.y = Math.atan2(v.x, v.z)
    else g.rotation.y = look.yaw + Math.PI
  })

  // CesiumMan is modelled ~1.8 m tall in metres; feet sit at the capsule base.
  return (
    <group ref={group} position={[0, -0.95, 0]}>
      <primitive object={cloned} />
    </group>
  )
}

useGLTF.preload(MODEL)

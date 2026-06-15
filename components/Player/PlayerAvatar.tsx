'use client'

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useGameStore } from '@/state/useGameStore'
import { useAvatarStore } from '@/state/useAvatarStore'
import { buildCharacter, findClip, CHARACTER_MODELS, CHARACTER_URLS } from '@/lib/characters'
import { look, playerRig } from '@/lib/refs'

/**
 * Third-person body built from the player's saved CharacterConfig on a civilian
 * model. Uses an explicit AnimationMixer rooted on the built model and updated
 * every frame (the same proven pattern as the crowd) — drei's useAnimations was
 * not reliably advancing the mixer through the wrapper. Blends walk<->idle by
 * speed so standing still looks natural. Visible only in third person, never on rides.
 */
export default function PlayerAvatar() {
  const config = useAvatarStore((s) => s.config)
  const rev = useAvatarStore((s) => s.rev)
  const { scene, animations } = useGLTF(CHARACTER_MODELS[config.model].url)
  const built = useMemo(() => buildCharacter(scene, config), [scene, config, rev])

  const anim = useMemo(() => {
    const mixer = new THREE.AnimationMixer(built)
    const walkClip = findClip(animations, 'Walk') ?? animations[0]
    const idleClip = findClip(animations, 'Idle')
    const walk = walkClip ? mixer.clipAction(walkClip) : null
    const idle = idleClip ? mixer.clipAction(idleClip) : null
    walk?.play()
    idle?.play()
    return { mixer, walk, idle }
  }, [built, animations])

  useEffect(() => () => { anim.mixer.stopAllAction() }, [anim])

  useFrame((_, dt) => {
    const st = useGameStore.getState()
    built.visible = st.view === 'third' && !st.activeRide

    const v = playerRig.body?.linvel()
    const speed = v ? Math.hypot(v.x, v.z) : 0
    const moving = speed > 0.4
    const { mixer, walk, idle } = anim
    if (walk) {
      walk.timeScale = THREE.MathUtils.clamp(speed / 2.2, 0.7, 2.4)
      if (idle) {
        walk.weight = moving ? 1 : 0
        idle.weight = moving ? 0 : 1
      } else {
        walk.paused = !moving
      }
    }
    mixer.update(dt)

    if (moving && v) built.rotation.y = Math.atan2(v.x, v.z)
    else built.rotation.y = look.yaw + Math.PI
  })

  return <primitive object={built} position={[0, -0.9, 0]} />
}

CHARACTER_URLS.forEach((u) => useGLTF.preload(u))

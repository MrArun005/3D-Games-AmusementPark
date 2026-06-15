'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import { useGameStore } from '@/state/useGameStore'
import { useAvatarStore } from '@/state/useAvatarStore'
import { buildCharacter, findClip, CHARACTER_MODELS, CHARACTER_URLS } from '@/lib/characters'
import { look, playerRig } from '@/lib/refs'

/**
 * Third-person body built from the player's saved CharacterConfig on a civilian
 * model. Rebuilds when the avatar config revision changes. Visible only in third
 * person and never while a ride owns the camera. Walk clip sped up by movement.
 */
export default function PlayerAvatar() {
  const config = useAvatarStore((s) => s.config)
  const rev = useAvatarStore((s) => s.rev)
  const { scene, animations } = useGLTF(CHARACTER_MODELS[config.model].url)
  const built = useMemo(() => buildCharacter(scene, config), [scene, config, rev])
  const group = useRef<THREE.Group>(null)
  const { actions, mixer } = useAnimations(animations, group)
  const walk = useRef<THREE.AnimationAction | null>(null)

  useEffect(() => {
    const clip = findClip(animations, 'Walk') ?? animations[0]
    const a = clip ? actions[clip.name] : null
    if (a) { a.play(); walk.current = a }
    return () => { mixer.stopAllAction() }
  }, [actions, animations, mixer, built])

  useFrame(() => {
    const g = group.current
    if (!g) return
    const st = useGameStore.getState()
    g.visible = st.view === 'third' && !st.activeRide

    const v = playerRig.body?.linvel()
    const speed = v ? Math.hypot(v.x, v.z) : 0
    const a = walk.current
    if (a) {
      if (speed > 0.4) { a.paused = false; a.timeScale = THREE.MathUtils.clamp(speed / 2.2, 0.7, 2.4) }
      else a.paused = true
    }
    if (v && speed > 0.4) g.rotation.y = Math.atan2(v.x, v.z)
    else g.rotation.y = look.yaw + Math.PI
  })

  return (
    <group ref={group} position={[0, -0.95, 0]}>
      <primitive object={built} />
    </group>
  )
}

CHARACTER_URLS.forEach((u) => useGLTF.preload(u))

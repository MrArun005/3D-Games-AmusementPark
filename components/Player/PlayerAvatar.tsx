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
  const idle = useRef<THREE.AnimationAction | null>(null)

  useEffect(() => {
    const walkClip = findClip(animations, 'Walk') ?? animations[0]
    const idleClip = findClip(animations, 'Idle')
    const w = walkClip ? actions[walkClip.name] : null
    const i = idleClip ? actions[idleClip.name] : null
    if (w) { w.play(); walk.current = w }
    if (i) { i.play(); idle.current = i }
    return () => { mixer.stopAllAction() }
  }, [actions, animations, mixer, built])

  useFrame(() => {
    const g = group.current
    if (!g) return
    const st = useGameStore.getState()
    g.visible = st.view === 'third' && !st.activeRide

    const v = playerRig.body?.linvel()
    const speed = v ? Math.hypot(v.x, v.z) : 0
    const moving = speed > 0.4
    const w = walk.current
    if (w) {
      w.timeScale = THREE.MathUtils.clamp(speed / 2.2, 0.7, 2.4)
      if (idle.current) {
        // blend walk<->idle so standing still looks natural, not a frozen stride
        w.paused = false
        w.weight = moving ? 1 : 0
        idle.current.weight = moving ? 0 : 1
      } else {
        w.paused = !moving
      }
    }
    if (moving) g.rotation.y = Math.atan2(v!.x, v!.z)
    else g.rotation.y = look.yaw + Math.PI
  })

  return (
    <group ref={group} position={[0, -0.9, 0]}>
      <primitive object={built} />
    </group>
  )
}

CHARACTER_URLS.forEach((u) => useGLTF.preload(u))

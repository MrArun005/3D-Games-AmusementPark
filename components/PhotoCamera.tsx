'use client'

import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useGameStore } from '@/state/useGameStore'
import { PHOTO_SHOTS } from '@/lib/spawn'

const _target = new THREE.Vector3()

/**
 * Cinematic camera for Photo Mode: smoothly glides the camera to the selected
 * preset shot and frames its target. The world keeps animating (rides, crowd,
 * lights) so the captured frame is alive. Owns the camera only while photoMode.
 */
export default function PhotoCamera() {
  const camera = useThree((s) => s.camera)
  const look = useRef(new THREE.Vector3(0, 0, -6))

  useFrame((_, dt) => {
    const st = useGameStore.getState()
    if (!st.photoMode) return
    const shot = PHOTO_SHOTS[st.photoShot % PHOTO_SHOTS.length]
    const k = 1 - Math.pow(0.0015, dt) // smooth glide between shots
    camera.position.x += (shot.pos[0] - camera.position.x) * k
    camera.position.y += (shot.pos[1] - camera.position.y) * k
    camera.position.z += (shot.pos[2] - camera.position.z) * k
    _target.set(shot.target[0], shot.target[1], shot.target[2])
    look.current.lerp(_target, k)
    camera.lookAt(look.current)
  })

  return null
}

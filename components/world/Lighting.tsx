'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useGameStore, sunElevation } from '@/state/useGameStore'

const DAY_FOG = new THREE.Color('#cfe3ff')
const NIGHT_FOG = new THREE.Color('#0b1026')
const WARM = new THREE.Color('#ff9b4a')
const WHITE = new THREE.Color('#ffffff')

/**
 * One shadow-casting "sun" + hemisphere/ambient fill, all driven per-frame
 * from the clock via refs (no React re-renders). Fog colour follows dusk.
 */
export default function Lighting() {
  const sun = useRef<THREE.DirectionalLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const quality = useGameStore((s) => s.quality)

  useEffect(() => {
    scene.fog = new THREE.Fog('#cfe3ff', 45, 210)
    return () => {
      scene.fog = null
    }
  }, [scene])

  useFrame(() => {
    const t = useGameStore.getState().timeOfDay
    const elev = sunElevation(t)
    const ang = ((t - 6) / 12) * Math.PI
    const dayness = THREE.MathUtils.clamp(elev * 2 + 0.15, 0, 1)
    if (sun.current) {
      sun.current.position.set(Math.cos(ang) * 70, Math.max(elev, -0.15) * 70, 25)
      sun.current.intensity = Math.max(0, elev) * 2 + 0.04
      sun.current.color.lerpColors(WARM, WHITE, Math.min(1, Math.max(0, elev * 1.6)))
    }
    if (hemi.current) hemi.current.intensity = 0.08 + Math.max(0, elev) * 0.35
    if (scene.fog instanceof THREE.Fog) scene.fog.color.lerpColors(NIGHT_FOG, DAY_FOG, dayness)
    scene.environmentIntensity = 0.12 + dayness * 0.88 // IBL fades out at night
    gl.toneMappingExposure = 0.85 + dayness * 0.35 // brighter, photographic by day
  })

  return (
    <>
      <hemisphereLight ref={hemi} args={['#bcd6ff', '#3c5a3c', 0.5]} />
      <ambientLight intensity={0.05} />
      <directionalLight
        ref={sun}
        castShadow={quality !== 'low'}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-camera-far={220}
        shadow-bias={-0.0004}
      />
    </>
  )
}

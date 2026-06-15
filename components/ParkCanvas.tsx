'use client'

import { Suspense, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { Leva } from 'leva'
import Scene from '@/components/Scene'
import { useGameStore, type Quality } from '@/state/useGameStore'
import { playerRig } from '@/lib/refs'

/** Pixel-ratio scaling per quality tier (shadows toggle lives in Lighting). */
function QualityManager() {
  const quality = useGameStore((s) => s.quality)
  const setDpr = useThree((s) => s.setDpr)
  useEffect(() => {
    const dprs: Record<Quality, number> = {
      low: 0.7,
      medium: Math.min(1.25, window.devicePixelRatio),
      high: Math.min(2, window.devicePixelRatio),
    }
    setDpr(dprs[quality])
  }, [quality, setDpr])
  return null
}

/** Bloom only on High — makes the night neon glow. */
function PostFX() {
  const quality = useGameStore((s) => s.quality)
  if (quality !== 'high') return null
  return (
    <EffectComposer>
      <Bloom mipmapBlur intensity={0.8} luminanceThreshold={1.05} />
    </EffectComposer>
  )
}

export default function ParkCanvas() {
  return (
    <>
      <Canvas
        shadows
        camera={{ fov: 75, near: 0.1, far: 400, position: [0, 2, 50] }}
        onCreated={({ gl }) => {
          playerRig.canvas = gl.domElement
        }}
      >
        <color attach="background" args={['#0b1026']} />
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
        <PostFX />
        <QualityManager />
      </Canvas>
      <Leva hidden={process.env.NODE_ENV === 'production'} collapsed />
    </>
  )
}

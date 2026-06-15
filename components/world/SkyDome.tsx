'use client'

import { Sky, Stars } from '@react-three/drei'
import { useGameStore, sunElevation } from '@/state/useGameStore'

/**
 * drei Sky driven by the in-game clock. Subscribes to a coarse (0.05 h)
 * rounding of timeOfDay so the Sky shader re-renders every couple of
 * seconds instead of every frame.
 */
export default function SkyDome() {
  const t = useGameStore((s) => Math.round(s.timeOfDay * 20) / 20)
  const ang = ((t - 6) / 12) * Math.PI
  const sunPos: [number, number, number] = [Math.cos(ang) * 100, Math.sin(ang) * 100, 30]
  const night = sunElevation(t) < 0

  return (
    <>
      <Sky distance={4500} sunPosition={sunPos} turbidity={8} rayleigh={night ? 0.25 : 1.2} />
      {night && <Stars radius={200} depth={40} count={2000} factor={4} fade />}
    </>
  )
}

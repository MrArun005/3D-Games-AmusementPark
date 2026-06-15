'use client'

import { useEffect, useState } from 'react'
import { Html } from '@react-three/drei'
import { crowdAgents, PHRASES } from '@/lib/crowd'
import { useGameStore } from '@/state/useGameStore'

const MAX = 4 // pooled bubbles — only a few near the player at once
const RANGE = 26
const SPACING2 = 9 // keep chosen NPCs at least 3 m apart

interface Bubble {
  x: number
  y: number
  z: number
  text: string
  key: string
}

/**
 * Pooled NPC chat bubbles: every ~1.8 s, pick up to MAX idle crowd members
 * near the player (spaced apart) and float a short Kannada fair phrase over
 * each. Positions are sampled when assigned — idle NPCs are ~stationary, so
 * the bubble sits over their head until the next refresh.
 */
export default function SpeechBubbles() {
  const [bubbles, setBubbles] = useState<Bubble[]>([])

  useEffect(() => {
    let seq = 0
    const id = window.setInterval(() => {
      const st = useGameStore.getState()
      if (st.paused || st.photoMode || st.activeRide || st.activeStall) {
        setBubbles([])
        return
      }
      const p = st.playerPos
      const chosen: { x: number; z: number; y: number; i: number }[] = []
      for (let i = 0; i < crowdAgents.length; i++) {
        const a = crowdAgents[i]
        if (!a.idle) continue
        if ((a.x - p.x) ** 2 + (a.z - p.z) ** 2 > RANGE * RANGE) continue
        if (chosen.some((o) => (o.x - a.x) ** 2 + (o.z - a.z) ** 2 < SPACING2)) continue
        chosen.push({ x: a.x, z: a.z, y: a.y, i })
        if (chosen.length >= MAX) break
      }
      setBubbles(
        chosen.map((c) => ({
          x: c.x,
          y: c.y,
          z: c.z,
          text: PHRASES[(seq + c.i) % PHRASES.length],
          key: `b${seq++}_${c.i}`,
        }))
      )
    }, 1800)
    return () => window.clearInterval(id)
  }, [])

  return (
    <>
      {bubbles.map((b) => (
        <Html key={b.key} position={[b.x, b.y, b.z]} center distanceFactor={11} occlude={false} pointerEvents="none" zIndexRange={[5, 0]}>
          <div className="-translate-y-1/2 whitespace-nowrap rounded-xl border-2 border-[#8e0c20] bg-[#fff3dc] px-2.5 py-1 font-[Georgia,'Times_New_Roman',serif] text-sm font-semibold text-[#8e0c20] shadow-md">
            {b.text}
          </div>
        </Html>
      ))}
    </>
  )
}

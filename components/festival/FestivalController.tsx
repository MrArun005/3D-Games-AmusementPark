'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from '@/state/useGameStore'
import { useFestival, festivalHour } from '@/lib/festival'
import { announce } from '@/lib/announcer'

/**
 * Frame systems for an active festival run: advance the in-game clock dusk→
 * midnight, tick the combo + day timers, and trigger the finale. While a run
 * is active the festival OWNS the clock (the time-of-day selector is ignored).
 */
export default function FestivalController() {
  const prevScore = useRef(0)
  const idle = useRef(0)

  useFrame((_, rawDt) => {
    const f = useFestival.getState()
    if (f.phase !== 'running') {
      prevScore.current = f.score
      idle.current = 0
      return
    }
    const dt = Math.min(rawDt, 0.1)
    f.tick(dt)

    // festival drives the sky: write timeOfDay directly each frame
    useGameStore.setState({ timeOfDay: festivalHour(f.timeLeft) })

    // idle nag: 25 s with no points → a heckle (replaced by announcer in Task 4)
    if (f.score !== prevScore.current) {
      prevScore.current = f.score
      idle.current = 0
    } else {
      idle.current += dt
      if (idle.current > 25) {
        idle.current = 0
        announce('idle')
      }
    }
  })

  return null
}

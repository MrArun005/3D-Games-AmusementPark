'use client'

import { useEffect, useState } from 'react'
import { useGameStore } from '@/state/useGameStore'
import InteractPrompt from './InteractPrompt'
import RideOverlay from './RideOverlay'
import MiniGameOverlay from './MiniGameOverlay'
import RingTossOverlay from './RingTossOverlay'
import ShopMenu from './ShopMenu'
import FestivalHUD from './FestivalHUD'
import PhotoOverlay from './PhotoOverlay'
import Minimap from './Minimap'
import PauseMenu from './PauseMenu'
import CharacterCreator from './CharacterCreator'

function usePointerLocked(): boolean {
  const [locked, setLocked] = useState(false)
  useEffect(() => {
    const onChange = () => setLocked(!!document.pointerLockElement)
    document.addEventListener('pointerlockchange', onChange)
    onChange()
    return () => document.removeEventListener('pointerlockchange', onChange)
  }, [])
  return locked
}

function Clock() {
  const label = useGameStore((s) => {
    const h = Math.floor(s.timeOfDay)
    const m = Math.floor((s.timeOfDay % 1) * 60)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  })
  const day = useGameStore((s) => s.day)
  return (
    <span className="tabular-nums">
      Day {day} · {label}
    </span>
  )
}

function Fps() {
  const [fps, setFps] = useState(0)
  useEffect(() => {
    let frames = 0
    let last = performance.now()
    let raf = 0
    const loop = (t: number) => {
      frames++
      if (t - last >= 1000) {
        setFps(frames)
        frames = 0
        last = t
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  return <span className="self-center text-xs tabular-nums text-[#fff3dc]/70 drop-shadow">{fps} fps</span>
}

/** Black fade that covers the boarding/unloading camera swap. */
function FadeOverlay() {
  const fading = useGameStore((s) => s.ridePhase === 'boarding' || s.ridePhase === 'unloading')
  return (
    <div
      className={`absolute inset-0 bg-black transition-opacity duration-700 ${
        fading ? 'opacity-100' : 'opacity-0'
      }`}
    />
  )
}

/** Brief "enjoying your snack" toast after buying food. */
function FoodToast() {
  const food = useGameStore((s) => s.heldFood)
  if (!food) return null
  return (
    <div className="absolute bottom-40 left-1/2 -translate-x-1/2 animate-pulse rounded-lg border-2 border-[#f2a900] bg-[#8e0c20]/90 px-5 py-2 font-[Georgia,'Times_New_Roman',serif] text-[#ffd23f] shadow-xl">
      Enjoying your {food.emoji} {food.name.toLowerCase()}!
    </div>
  )
}

const TIME_LABEL = { cycle: '🔄 Auto', day: '☀️ Day', night: '🌙 Night' } as const
const NEXT_MODE = { cycle: 'day', day: 'night', night: 'cycle' } as const

export default function HUD() {
  const tickets = useGameStore((s) => s.tickets)
  const muted = useGameStore((s) => s.muted)
  const toggleMuted = useGameStore((s) => s.toggleMuted)
  const paused = useGameStore((s) => s.paused)
  const activeRide = useGameStore((s) => s.activeRide)
  const activeStall = useGameStore((s) => s.activeStall)
  const view = useGameStore((s) => s.view)
  const timeMode = useGameStore((s) => s.timeMode)
  const setTimeMode = useGameStore((s) => s.setTimeMode)
  const photoMode = useGameStore((s) => s.photoMode)
  const locked = usePointerLocked()

  // Photo Mode hides the whole HUD and shows just the cinematic overlay.
  if (photoMode) return <PhotoOverlay />

  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none">
      <FadeOverlay />

      {/* top bar */}
      <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-4 py-3 font-[Georgia,'Times_New_Roman',serif] text-sm font-semibold">
        <div className="flex items-center gap-3">
          {/* "ADMIT ONE" ticket stub */}
          <div className="flex items-center gap-2 rounded-full border-2 border-dashed border-[#8e0c20] bg-[#fff3dc] px-4 py-1.5 text-[#8e0c20] shadow-md">
            <span className="text-[10px] font-bold uppercase tracking-widest">Admit One</span>
            <span className="h-4 w-px bg-[#8e0c20]/40" />
            <span className="text-base font-bold tabular-nums">🎟 {tickets}</span>
          </div>
          {/* wooden clock sign */}
          <div className="rounded-md border border-[#f2a900]/70 bg-[#8a5a33] px-3 py-2 text-xs font-bold uppercase tracking-widest text-[#fff3dc] shadow-md">
            <Clock />
          </div>
          {process.env.NODE_ENV === 'development' && <Fps />}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTimeMode(NEXT_MODE[timeMode])}
            className="pointer-events-auto rounded-md border border-[#f2a900]/70 bg-[#8a5a33] px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#fff3dc] shadow-md transition hover:bg-[#9c6a3f]"
            title="Day / Night / Auto cycle"
          >
            {TIME_LABEL[timeMode]}
          </button>
          <button
            onClick={toggleMuted}
            className="pointer-events-auto rounded-md border border-[#f2a900]/70 bg-[#8a5a33] px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#fff3dc] shadow-md transition hover:bg-[#9c6a3f]"
            title="Toggle sound (M)"
          >
            {muted ? '🔇 Muted' : '🔊 Sound'}
          </button>
        </div>
      </div>

      {/* crosshair in first person */}
      {locked && !paused && !activeRide && !activeStall && view === 'first' && (
        <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#fff3dc]/90 ring-1 ring-[#8e0c20]/60" />
      )}

      {/* click-to-play hint */}
      {!locked && !paused && !activeRide && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 rounded-md border-2 border-[#8e0c20] bg-[#fff3dc]/95 px-5 py-2 font-[Georgia,'Times_New_Roman',serif] text-xs font-semibold uppercase tracking-widest text-[#8e0c20] shadow-lg">
          Click to look around
        </div>
      )}

      <InteractPrompt />
      <RideOverlay />
      <MiniGameOverlay />
      <RingTossOverlay />
      <ShopMenu />
      <FestivalHUD />
      <FoodToast />
      <Minimap />
      <PauseMenu />
      <CharacterCreator />
    </div>
  )
}

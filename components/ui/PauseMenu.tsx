'use client'

import { useGameStore, type Quality } from '@/state/useGameStore'
import { requestPointerLock } from '@/lib/refs'

const QUALITIES: Quality[] = ['low', 'medium', 'high']

function TimeModePicker() {
  const timeMode = useGameStore((s) => s.timeMode)
  const setTimeMode = useGameStore((s) => s.setTimeMode)
  const options = [
    { mode: 'cycle', label: '🔄 Auto' },
    { mode: 'day', label: '☀️ Day' },
    { mode: 'night', label: '🌙 Night' },
  ] as const
  return (
    <div className="mt-4">
      <div className="mb-2 text-center text-xs font-bold uppercase tracking-widest text-[#8e0c20]/70">
        Time of Day
      </div>
      <div className="grid grid-cols-3 gap-2">
        {options.map((o) => (
          <button
            key={o.mode}
            onClick={() => setTimeMode(o.mode)}
            className={`rounded-full border-2 py-2 text-sm font-bold transition ${
              timeMode === o.mode
                ? 'border-[#f2a900] bg-[#8e0c20] text-[#ffd23f]'
                : 'border-[#8e0c20]/40 bg-[#fff3dc] text-[#8e0c20] hover:border-[#8e0c20]'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function PauseMenu() {
  const paused = useGameStore((s) => s.paused)
  const activeRide = useGameStore((s) => s.activeRide)
  const quality = useGameStore((s) => s.quality)
  const muted = useGameStore((s) => s.muted)
  const setPaused = useGameStore((s) => s.setPaused)
  const setQuality = useGameStore((s) => s.setQuality)
  const toggleMuted = useGameStore((s) => s.toggleMuted)
  const resetPark = useGameStore((s) => s.resetPark)

  if (!paused || activeRide) return null

  const resume = () => {
    setPaused(false)
    requestPointerLock()
  }

  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[26rem] max-w-[92vw] overflow-hidden rounded-lg border-4 border-[#8e0c20] bg-[#fff3dc] font-[Georgia,'Times_New_Roman',serif] text-[#8e0c20] shadow-2xl">
        <div className="h-4 bg-[repeating-linear-gradient(45deg,#c8102e_0_12px,#fff3dc_12px_24px)]" />

        <div className="p-6">
          <h2 className="text-center text-3xl font-bold uppercase tracking-[0.2em]">Intermission</h2>
          <div className="mx-auto mt-2 h-0.5 w-28 bg-[#f2a900]" />

          <button
            onClick={resume}
            className="mt-5 w-full rounded-md border-2 border-[#f2a900] bg-[#8e0c20] py-3 font-bold uppercase tracking-widest text-[#ffd23f] shadow-md transition hover:bg-[#c8102e]"
          >
            ▶ Resume the Show
          </button>

          <div className="mt-5">
            <div className="mb-2 text-center text-xs font-bold uppercase tracking-widest text-[#8e0c20]/70">
              Quality
            </div>
            <div className="grid grid-cols-3 gap-2">
              {QUALITIES.map((q) => (
                <button
                  key={q}
                  onClick={() => setQuality(q)}
                  className={`rounded-full border-2 py-2 text-sm font-bold capitalize transition ${
                    quality === q
                      ? 'border-[#f2a900] bg-[#8e0c20] text-[#ffd23f]'
                      : 'border-[#8e0c20]/40 bg-[#fff3dc] text-[#8e0c20] hover:border-[#8e0c20]'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <TimeModePicker />

          <div className="mt-4 flex gap-2">
            <button
              onClick={toggleMuted}
              className="flex-1 rounded-md border-2 border-[#8e0c20]/40 bg-[#fff3dc] py-2 text-sm font-semibold text-[#8e0c20] transition hover:border-[#8e0c20]"
            >
              {muted ? '🔇 Unmute' : '🔊 Mute'}
            </button>
            <button
              onClick={resetPark}
              className="flex-1 rounded-md border-2 border-[#c8102e]/50 bg-[#fff3dc] py-2 text-sm font-semibold text-[#c8102e] transition hover:bg-[#c8102e] hover:text-[#fff3dc]"
            >
              ↺ Reset park
            </button>
          </div>

          <div className="mt-5 rounded-md border border-[#8e0c20]/40 bg-[#fff3dc] p-4 text-center text-sm leading-6 text-[#8e0c20]/90">
            <b className="text-xs uppercase tracking-widest text-[#8e0c20]">Programme of Controls</b>
            <br />
            WASD move · Mouse look · Shift sprint · Space jump
            <br />
            E interact · V first/third person · M mute · Esc pause
            <br />
            Arrow keys drive the bumper cars · A/D spin your teacup
          </div>
        </div>

        <div className="h-4 bg-[repeating-linear-gradient(45deg,#c8102e_0_12px,#fff3dc_12px_24px)]" />
      </div>
    </div>
  )
}

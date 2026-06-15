'use client'

import { useShooting } from '@/lib/minigame'
import { requestPointerLock } from '@/lib/refs'

/** Crosshair + ammo/score/timer for the shooting gallery, plus the result card. */
export default function MiniGameOverlay() {
  const active = useShooting((s) => s.active)
  const ammo = useShooting((s) => s.ammo)
  const score = useShooting((s) => s.score)
  const timeLeft = useShooting((s) => s.timeLeft)
  const result = useShooting((s) => s.result)
  const close = useShooting((s) => s.close)

  if (!active) return null

  if (result) {
    return (
      <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/55 backdrop-blur-sm">
        <div className="w-[24rem] max-w-[92vw] overflow-hidden rounded-lg border-4 border-[#8e0c20] bg-[#fff3dc] text-center font-[Georgia,'Times_New_Roman',serif] text-[#8e0c20] shadow-2xl">
          <div className="h-3 bg-[repeating-linear-gradient(45deg,#c8102e_0_12px,#fff3dc_12px_24px)]" />
          <div className="p-6">
            <h2 className="text-2xl font-bold uppercase tracking-widest">
              {result.reward > 0 ? '🎉 Winner!' : 'Round Over'}
            </h2>
            <p className="mt-3 text-lg">
              {result.hits} hits · {result.score} pts
            </p>
            <p className="mt-1 text-xl font-bold text-[#c8102e]">
              {result.reward > 0 ? `+${result.reward} 🎟 won!` : 'No prize — try again!'}
            </p>
            <button
              onClick={() => {
                close()
                requestPointerLock()
              }}
              className="mt-5 w-full rounded-md border-2 border-[#f2a900] bg-[#c8102e] py-2.5 font-bold uppercase tracking-widest text-[#ffd23f] transition hover:bg-[#8e0c20]"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* aiming crosshair */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative h-8 w-8">
          <div className="absolute left-1/2 top-0 h-3 w-0.5 -translate-x-1/2 bg-[#c8102e]" />
          <div className="absolute bottom-0 left-1/2 h-3 w-0.5 -translate-x-1/2 bg-[#c8102e]" />
          <div className="absolute top-1/2 left-0 h-0.5 w-3 -translate-y-1/2 bg-[#c8102e]" />
          <div className="absolute top-1/2 right-0 h-0.5 w-3 -translate-y-1/2 bg-[#c8102e]" />
          <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c8102e]" />
        </div>
      </div>

      {/* stats bar */}
      <div className="absolute left-1/2 top-20 -translate-x-1/2 rounded-xl border-2 border-[#f2a900] bg-[#8e0c20]/90 px-6 py-2 text-center font-[Georgia,'Times_New_Roman',serif] text-[#ffd23f] shadow-xl">
        <div className="flex items-center gap-5 text-lg font-bold tabular-nums">
          <span>🔫 {ammo}</span>
          <span>⭐ {score}</span>
          <span>⏱ {Math.ceil(timeLeft)}s</span>
        </div>
      </div>
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 rounded-lg bg-black/45 px-4 py-2 text-sm text-white/90 backdrop-blur">
        Click to shoot the balloons &amp; ducks!
      </div>
    </>
  )
}

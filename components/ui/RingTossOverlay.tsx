'use client'

import { useRingToss } from '@/lib/minigame'
import { requestPointerLock } from '@/lib/refs'

/** Crosshair + rings-left + power bar for ring toss, plus the result card. */
export default function RingTossOverlay() {
  const active = useRingToss((s) => s.active)
  const ringsLeft = useRingToss((s) => s.ringsLeft)
  const on = useRingToss((s) => s.on)
  const power = useRingToss((s) => s.power)
  const result = useRingToss((s) => s.result)
  const close = useRingToss((s) => s.close)

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
            <p className="mt-3 text-lg">{result.on} / 5 rings landed</p>
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
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="h-6 w-6 rounded-full border-2 border-[#c8102e]" />
      </div>

      <div className="absolute left-1/2 top-20 -translate-x-1/2 rounded-xl border-2 border-[#f2a900] bg-[#0e7c7b]/90 px-6 py-2 text-center font-[Georgia,'Times_New_Roman',serif] text-[#fff3dc] shadow-xl">
        <div className="flex items-center gap-5 text-lg font-bold tabular-nums">
          <span>💍 {ringsLeft} left</span>
          <span>✓ {on}</span>
        </div>
      </div>

      {/* power meter */}
      <div className="absolute bottom-28 left-1/2 h-3 w-56 -translate-x-1/2 overflow-hidden rounded-full border-2 border-[#8e0c20] bg-[#fff3dc]">
        <div
          className="h-full bg-gradient-to-r from-[#3fae49] via-[#ffd230] to-[#c8102e] transition-[width] duration-75"
          style={{ width: `${Math.round(power * 100)}%` }}
        />
      </div>
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-lg bg-black/45 px-4 py-1.5 text-sm text-white/90 backdrop-blur">
        Hold to charge power, release to toss the ring onto a bottle!
      </div>
    </>
  )
}

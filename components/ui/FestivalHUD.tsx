'use client'

import { useFestival, COMBO_WINDOW } from '@/lib/festival'

/** Score, combo meter, day clock and the announcer caption during a run; a
 *  Start button when idle. Pure overlay (parent HUD owns pointer-events). */
export default function FestivalHUD() {
  const phase = useFestival((s) => s.phase)
  const score = useFestival((s) => s.score)
  const combo = useFestival((s) => s.combo)
  const comboTimer = useFestival((s) => s.comboTimer)
  const timeLeft = useFestival((s) => s.timeLeft)
  const caption = useFestival((s) => s.caption)
  const start = useFestival((s) => s.start)

  if (phase === 'idle') {
    return (
      <button
        onClick={start}
        className="pointer-events-auto absolute right-4 top-16 rounded-xl border-2 border-[#f2a900] bg-[#c8102e] px-5 py-2.5 font-[Georgia,'Times_New_Roman',serif] text-sm font-bold uppercase tracking-widest text-[#ffd23f] shadow-lg transition hover:bg-[#8e0c20]"
      >
        ▶ Start Festival
      </button>
    )
  }

  if (phase === 'finale') return null // FinaleScreen takes over

  const mins = Math.floor(timeLeft / 60)
  const secs = Math.floor(timeLeft % 60)
  const comboPct = Math.round((comboTimer / COMBO_WINDOW) * 100)

  return (
    <>
      <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-xl border-2 border-[#f2a900] bg-[#8e0c20]/90 px-6 py-2 text-center font-[Georgia,'Times_New_Roman',serif] text-[#ffd23f] shadow-xl">
        <div className="text-2xl font-bold tabular-nums">{score.toLocaleString()}</div>
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#fff3dc]/80">
          Festival Score · {mins}:{String(secs).padStart(2, '0')} left
        </div>
        {combo > 1 && (
          <div className="mt-1">
            <span className="text-lg font-extrabold text-[#ffd23f]">×{combo}</span>
            <div className="mx-auto mt-0.5 h-1.5 w-32 overflow-hidden rounded-full bg-black/40">
              <div className="h-full bg-[#ffd23f] transition-[width] duration-100" style={{ width: `${comboPct}%` }} />
            </div>
          </div>
        )}
      </div>

      {caption && (
        <div className="absolute left-1/2 top-28 -translate-x-1/2 animate-pulse rounded-lg border-2 border-[#f2a900] bg-[#1a2238]/90 px-5 py-2 font-[Georgia,'Times_New_Roman',serif] text-base font-semibold text-[#ffd23f] shadow-xl">
          📣 {caption}
        </div>
      )}
    </>
  )
}

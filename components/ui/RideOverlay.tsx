'use client'

import { useGameStore } from '@/state/useGameStore'
import { RIDES } from '@/lib/spawn'

/** Shown while on a ride: ride name, status, bumper-car controls hint, exit button. */
export default function RideOverlay() {
  const activeRide = useGameStore((s) => s.activeRide)
  const phase = useGameStore((s) => s.ridePhase)
  const requestExit = useGameStore((s) => s.requestExit)

  if (!activeRide) return null
  const spec = RIDES[activeRide]

  return (
    <>
      <div className="absolute left-1/2 top-16 -translate-x-1/2 rounded-lg border-2 border-[#f2a900] bg-[#8e0c20]/95 px-7 py-2.5 text-center font-[Georgia,'Times_New_Roman',serif] shadow-xl">
        <div className="text-xl font-bold uppercase tracking-widest text-[#ffd23f]">{spec.name}</div>
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#fff3dc]/80">
          {phase === 'boarding' ? 'Boarding…' : phase === 'unloading' ? 'Unloading…' : 'Enjoy the ride — drag the mouse to look around!'}
        </div>
      </div>
      {phase === 'running' && activeRide === 'bumper' && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 rounded-md border-2 border-[#8e0c20] bg-[#fff3dc]/95 px-5 py-2 font-[Georgia,'Times_New_Roman',serif] text-sm font-semibold text-[#8e0c20] shadow-lg">
          Drive with the arrow keys — bump everyone!
        </div>
      )}
      {phase === 'running' && activeRide === 'teacups' && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 rounded-md border-2 border-[#8e0c20] bg-[#fff3dc]/95 px-5 py-2 font-[Georgia,'Times_New_Roman',serif] text-sm font-semibold text-[#8e0c20] shadow-lg">
          Hold A / D to spin your cup faster
        </div>
      )}
      {phase === 'running' && (
        <button
          onClick={requestExit}
          className="pointer-events-auto absolute bottom-8 right-8 rounded-full border-[3px] border-[#f2a900] bg-[#c8102e] px-6 py-3 font-[Georgia,'Times_New_Roman',serif] text-sm font-bold uppercase tracking-widest text-[#fff3dc] shadow-lg ring-2 ring-[#8e0c20] transition hover:bg-[#8e0c20]"
        >
          Exit ride
        </button>
      )}
    </>
  )
}

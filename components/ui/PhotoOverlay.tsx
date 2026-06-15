'use client'

import { useGameStore } from '@/state/useGameStore'
import { PHOTO_SHOTS } from '@/lib/spawn'

/** Letterbox bars + shot label for Photo Mode (P). Replaces the normal HUD. */
export default function PhotoOverlay() {
  const shot = useGameStore((s) => s.photoShot)
  const name = PHOTO_SHOTS[shot % PHOTO_SHOTS.length].name

  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-x-0 top-0 h-[12vh] bg-black" />
      <div className="absolute inset-x-0 bottom-0 h-[12vh] bg-black" />
      <div className="absolute left-1/2 top-[13vh] -translate-x-1/2 rounded-full border border-[#f2a900]/70 bg-black/50 px-4 py-1 font-[Georgia,'Times_New_Roman',serif] text-sm uppercase tracking-[0.3em] text-[#ffd23f]">
        📷 {name}
      </div>
      <div className="absolute bottom-[4vh] left-1/2 -translate-x-1/2 text-center text-xs uppercase tracking-widest text-white/70">
        ← / → change shot · P to exit
      </div>
    </div>
  )
}

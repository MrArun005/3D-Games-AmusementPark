'use client'

import { useEffect, useRef } from 'react'
import { useGameStore } from '@/state/useGameStore'
import { RIDE_LIST, BOOTH_POS, PARK_RADIUS, type RideId } from '@/lib/spawn'
import { look } from '@/lib/refs'

const SIZE = 150
const SCALE = SIZE / 134 // world ±67 m -> 150 px

const RIDE_COLORS: Record<RideId, string> = {
  ferris: '#ff5fa2',
  coaster: '#ff6b4a',
  carousel: '#ffd23f',
  teacups: '#7ec8c9',
  droptower: '#7dffea',
  bumper: '#70a1ff',
  columbus: '#ffa94d',
}

/** Top-down canvas minimap redrawn at 10 Hz from transient store state. */
export default function Minimap() {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = canvas.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    const mid = SIZE / 2
    const toPx = (w: number) => mid + w * SCALE

    const draw = () => {
      const st = useGameStore.getState()
      ctx.clearRect(0, 0, SIZE, SIZE)
      ctx.fillStyle = 'rgba(14, 26, 18, 0.85)'
      ctx.beginPath()
      ctx.arc(mid, mid, mid - 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(mid, mid, PARK_RADIUS * SCALE, 0, Math.PI * 2)
      ctx.stroke()

      for (const spec of RIDE_LIST) {
        ctx.fillStyle = RIDE_COLORS[spec.id]
        ctx.beginPath()
        ctx.arc(toPx(spec.position[0]), toPx(spec.position[2]), 4.5, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = '#aef3c8'
      ctx.fillRect(toPx(BOOTH_POS[0]) - 3, toPx(BOOTH_POS[2]) - 3, 6, 6)

      // player arrow: screen-up is -Z, so rotate by -yaw
      ctx.save()
      ctx.translate(toPx(st.playerPos.x), toPx(st.playerPos.z))
      ctx.rotate(-look.yaw)
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.moveTo(0, -6)
      ctx.lineTo(4.5, 5)
      ctx.lineTo(-4.5, 5)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }

    draw()
    const id = window.setInterval(draw, 100)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="absolute bottom-4 left-4 flex flex-col items-center gap-1">
      <canvas
        ref={canvas}
        width={SIZE}
        height={SIZE}
        className="rounded-full border-[3px] border-[#f2a900] shadow-lg ring-2 ring-[#8e0c20]"
      />
      <span className="rounded-sm border border-[#f2a900]/70 bg-[#8a5a33] px-2 py-0.5 font-[Georgia,'Times_New_Roman',serif] text-[9px] font-bold uppercase tracking-widest text-[#fff3dc] shadow-md">
        Park Map
      </span>
    </div>
  )
}

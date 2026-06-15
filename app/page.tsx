'use client'

import dynamic from 'next/dynamic'
import HUD from '@/components/ui/HUD'

const ParkCanvas = dynamic(() => import('@/components/ParkCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#0b1026] text-white">
      <div className="text-center">
        <div className="text-3xl font-bold">🎡 Fableland</div>
        <div className="mt-3 animate-pulse text-sm text-white/70">Loading the park…</div>
      </div>
    </div>
  ),
})

export default function Page() {
  return (
    <main className="relative h-dvh w-screen overflow-hidden">
      <ParkCanvas />
      <HUD />
    </main>
  )
}

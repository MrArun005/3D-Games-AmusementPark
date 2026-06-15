'use client'

import { useGameStore } from '@/state/useGameStore'
import { RIDES, GAME_STALL_BY_ID, DAILY_TICKETS } from '@/lib/spawn'

/** Contextual bottom-center prompt: ride boarding or booth ticket claim. */
export default function InteractPrompt() {
  const activeRide = useGameStore((s) => s.activeRide)
  const activeStall = useGameStore((s) => s.activeStall)
  const shopMenu = useGameStore((s) => s.shopMenu)
  const nearbyRide = useGameStore((s) => s.nearbyRide)
  const nearbyStall = useGameStore((s) => s.nearbyStall)
  const nearbyShop = useGameStore((s) => s.nearbyShop)
  const nearbyBooth = useGameStore((s) => s.nearbyBooth)
  const tickets = useGameStore((s) => s.tickets)

  if (activeRide || activeStall || shopMenu) return null

  let content: React.ReactNode = null
  if (nearbyRide) {
    const spec = RIDES[nearbyRide]
    content =
      tickets >= spec.cost ? (
        <>
          Press <Key>E</Key> to ride the <b>{spec.name}</b> — {spec.cost} 🎟
        </>
      ) : (
        <span className="text-[#c8102e]">
          Not enough tickets for the {spec.name} (need {spec.cost}, have {tickets}) — visit the ticket booth!
        </span>
      )
  } else if (nearbyStall) {
    const stall = GAME_STALL_BY_ID[nearbyStall]
    content =
      tickets >= stall.cost ? (
        <>
          Press <Key>E</Key> to play <b>{stall.name}</b> — {stall.cost} 🎟
        </>
      ) : (
        <span className="text-[#c8102e]">
          Not enough tickets for {stall.name} (need {stall.cost}, have {tickets}) — visit the ticket booth!
        </span>
      )
  } else if (nearbyShop) {
    content =
      tickets >= nearbyShop.cost ? (
        <>
          Press <Key>E</Key> to buy {nearbyShop.emoji} <b>{nearbyShop.name}</b> — {nearbyShop.cost} 🎟
        </>
      ) : (
        <span className="text-[#c8102e]">
          Not enough tickets for {nearbyShop.name} (need {nearbyShop.cost}, have {tickets}) — visit the ticket booth!
        </span>
      )
  } else if (nearbyBooth) {
    content = (
      <>
        Press <Key>E</Key> to collect <b>{DAILY_TICKETS} 🎟</b>
      </>
    )
  }

  if (!content) return null
  return (
    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 rounded-lg border-4 border-double border-[#8e0c20] bg-[#fff3dc]/95 px-6 py-3 text-center font-[Georgia,'Times_New_Roman',serif] text-base text-[#8e0c20] shadow-xl">
      {content}
    </div>
  )
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mx-1 inline-block rounded border-2 border-[#8e0c20] bg-[#f2a900] px-2 py-0.5 font-mono text-sm font-bold text-[#8e0c20] shadow-[0_2px_0_#8e0c20]">
      {children}
    </kbd>
  )
}

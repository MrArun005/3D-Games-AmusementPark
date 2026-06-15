'use client'

import { useGameStore } from '@/state/useGameStore'
import { requestPointerLock } from '@/lib/refs'
import { BALLOON_PALETTE } from '@/components/structures/BalloonStall'

/** Tailwind buy menu for food / balloon stalls. Opens on E, frees the pointer. */
export default function ShopMenu() {
  const shop = useGameStore((s) => s.shopMenu)
  const tickets = useGameStore((s) => s.tickets)
  const buyFood = useGameStore((s) => s.buyFood)
  const buyBalloon = useGameStore((s) => s.buyBalloon)
  const closeShop = useGameStore((s) => s.closeShop)

  if (!shop) return null
  const afford = tickets >= shop.cost

  const done = (fn?: () => void) => {
    fn?.()
    closeShop()
    requestPointerLock()
  }

  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/55 backdrop-blur-sm">
      <div className="w-[24rem] max-w-[92vw] overflow-hidden rounded-lg border-4 border-[#8e0c20] bg-[#fff3dc] text-center font-[Georgia,'Times_New_Roman',serif] text-[#8e0c20] shadow-2xl">
        <div className="h-3 bg-[repeating-linear-gradient(45deg,#c8102e_0_12px,#fff3dc_12px_24px)]" />
        <div className="p-6">
          <h2 className="text-2xl font-bold uppercase tracking-widest">
            {shop.emoji} {shop.name}
          </h2>
          <div className="mx-auto mt-2 h-0.5 w-24 bg-[#f2a900]" />
          <p className="mt-2 text-sm text-[#8e0c20]/70">You have {tickets} 🎟</p>

          {shop.kind === 'food' ? (
            <button
              disabled={!afford}
              onClick={() => done(() => buyFood(shop.name, shop.emoji))}
              className="mt-5 w-full rounded-md border-2 border-[#f2a900] bg-[#c8102e] py-3 text-lg font-bold uppercase tracking-widest text-[#ffd23f] transition hover:bg-[#8e0c20] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Buy {shop.emoji} — {shop.cost} 🎟
            </button>
          ) : (
            <>
              <p className="mt-4 text-sm font-semibold">Pick a colour — {shop.cost} 🎟</p>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {BALLOON_PALETTE.map((c) => (
                  <button
                    key={c}
                    disabled={!afford}
                    onClick={() => done(() => buyBalloon(c))}
                    style={{ backgroundColor: c }}
                    className="h-12 rounded-full border-2 border-[#8e0c20] shadow transition hover:scale-110 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={`balloon ${c}`}
                  />
                ))}
              </div>
            </>
          )}

          {!afford && (
            <p className="mt-3 text-sm font-bold text-[#c8102e]">
              Not enough tickets — visit the ticket booth!
            </p>
          )}

          <button
            onClick={() => done()}
            className="mt-4 w-full rounded-md border-2 border-[#8e0c20]/40 bg-[#fff3dc] py-2 text-sm font-semibold text-[#8e0c20] transition hover:border-[#8e0c20]"
          >
            Cancel
          </button>
        </div>
        <div className="h-3 bg-[repeating-linear-gradient(45deg,#c8102e_0_12px,#fff3dc_12px_24px)]" />
      </div>
    </div>
  )
}

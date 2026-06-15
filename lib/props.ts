import { mulberry32 } from '@/lib/spawn'

export type PropKind = 'ball' | 'beachball' | 'can' | 'crate'
export interface PropSpec { kind: PropKind; x: number; z: number }

/** Per-quality count of dynamic props (hard cap on awake bodies). */
export const PROP_COUNT_BY_Q = { low: 12, medium: 20, high: 30 } as const

/** Deterministic scatter of MAX props across the central park (plaza + midway),
 *  where the player actually walks, so they're kicked around. Order is stable so
 *  lowering quality just renders the first N. */
export const MAX_PROPS = 30
export const PROPS: PropSpec[] = (() => {
  const rnd = mulberry32(43210)
  const kinds: PropKind[] = ['ball', 'beachball', 'can', 'crate']
  const arr: PropSpec[] = []
  for (let i = 0; i < MAX_PROPS; i++) {
    const a = rnd() * Math.PI * 2
    const r = 7 + rnd() * 19 // central area, radius ~7..26
    arr.push({ kind: kinds[Math.floor(rnd() * kinds.length)], x: Math.cos(a) * r, z: Math.sin(a) * r })
  }
  return arr
})()

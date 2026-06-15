import { describe, it, expect } from 'vitest'
import { STATIONS, pickGoal, type Goal } from '@/lib/npc'
import { mulberry32 } from '@/lib/spawn'

describe('STATIONS', () => {
  it('has ride, food and game stations with queue slots for rides/games', () => {
    expect(STATIONS.some((s) => s.kind === 'ride')).toBe(true)
    expect(STATIONS.some((s) => s.kind === 'food')).toBe(true)
    expect(STATIONS.some((s) => s.kind === 'game')).toBe(true)
    for (const s of STATIONS) {
      if (s.kind === 'ride' || s.kind === 'game') expect(s.slots.length).toBeGreaterThan(0)
    }
  })
})

describe('pickGoal', () => {
  it('is deterministic for a seed', () => {
    expect(pickGoal(mulberry32(5))).toEqual(pickGoal(mulberry32(5)))
  })
  it('always returns finite target coordinates and a valid kind', () => {
    for (let s = 0; s < 100; s++) {
      const g: Goal = pickGoal(mulberry32(s))
      expect(Number.isFinite(g.x)).toBe(true)
      expect(Number.isFinite(g.z)).toBe(true)
      expect(['ride', 'food', 'game', 'stroll']).toContain(g.kind)
    }
  })
})

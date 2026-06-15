import { describe, it, expect } from 'vitest'
import { StationQueue } from '@/lib/queue'

const slots = [{ x: 0, z: 0 }, { x: 0, z: 1 }, { x: 0, z: 2 }]

describe('StationQueue', () => {
  it('joins up to capacity and reports place positions', () => {
    const q = new StationQueue(slots)
    expect(q.join(10)).toBe(true)
    expect(q.join(11)).toBe(true)
    expect(q.slotFor(10)).toEqual({ x: 0, z: 0 })
    expect(q.slotFor(11)).toEqual({ x: 0, z: 1 })
    expect(q.length).toBe(2)
  })
  it('rejects joins beyond capacity', () => {
    const q = new StationQueue(slots)
    q.join(1); q.join(2); q.join(3)
    expect(q.join(4)).toBe(false)
    expect(q.length).toBe(3)
  })
  it('frontReady true only for the agent at slot 0', () => {
    const q = new StationQueue(slots)
    q.join(7); q.join(8)
    expect(q.frontReady(7)).toBe(true)
    expect(q.frontReady(8)).toBe(false)
  })
  it('leaveFront removes the head and shuffles others forward', () => {
    const q = new StationQueue(slots)
    q.join(7); q.join(8)
    expect(q.leaveFront()).toBe(7)
    expect(q.slotFor(8)).toEqual({ x: 0, z: 0 })
    expect(q.has(7)).toBe(false)
  })
  it('remove pulls an agent out of the middle', () => {
    const q = new StationQueue(slots)
    q.join(1); q.join(2); q.join(3)
    q.remove(2)
    expect(q.slotFor(3)).toEqual({ x: 0, z: 1 })
    expect(q.length).toBe(2)
  })
})

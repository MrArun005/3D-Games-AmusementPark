import { describe, it, expect, beforeEach } from 'vitest'
import { useRideOccupancy, RIDE_SEATS } from '@/lib/rideOccupancy'

beforeEach(() => useRideOccupancy.getState().reset())

describe('ride occupancy', () => {
  it('knows seat counts for ferris and carousel, none for others', () => {
    expect(RIDE_SEATS.ferris).toBe(8)
    expect(RIDE_SEATS.carousel).toBe(8)
    expect(RIDE_SEATS.coaster).toBeUndefined()
  })
  it('claims the lowest free seat and rejects when full', () => {
    const { claimSeat } = useRideOccupancy.getState()
    const seats: number[] = []
    for (let i = 0; i < 8; i++) seats.push(claimSeat('ferris', 'npc', 0)!)
    expect(seats).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    expect(claimSeat('ferris', 'npc', 0)).toBeNull()
  })
  it('releases a seat so it can be reclaimed', () => {
    const { claimSeat, releaseSeat, seatsOf } = useRideOccupancy.getState()
    const s = claimSeat('carousel', 'npc', 2)!
    expect(seatsOf('carousel')[s]).not.toBeNull()
    releaseSeat('carousel', s)
    expect(seatsOf('carousel')[s]).toBeNull()
  })
  it('clearCompany frees only company seats, leaving npc riders', () => {
    const { claimSeat, clearCompany, seatsOf } = useRideOccupancy.getState()
    const a = claimSeat('ferris', 'npc', 1)!
    const b = claimSeat('ferris', 'company', 2)!
    clearCompany('ferris')
    expect(seatsOf('ferris')[a]).not.toBeNull()
    expect(seatsOf('ferris')[b]).toBeNull()
  })
})

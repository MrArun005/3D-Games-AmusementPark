import { create } from 'zustand'

/** Seats per ride that visibly carry riders. Rides absent here use placeholder boarding. */
export const RIDE_SEATS: Record<string, number> = { ferris: 8, carousel: 8 }

export type RiderSource = 'npc' | 'company'
export interface Rider { source: RiderSource; variant: number }

interface OccupancyState {
  seats: Record<string, (Rider | null)[]>
  claimSeat: (rideId: string, source: RiderSource, variant: number) => number | null
  releaseSeat: (rideId: string, seat: number) => void
  clearCompany: (rideId: string) => void
  seatsOf: (rideId: string) => (Rider | null)[]
  reset: () => void
}

const emptyFor = (rideId: string): (Rider | null)[] =>
  Array.from({ length: RIDE_SEATS[rideId] ?? 0 }, () => null)
const initial = (): Record<string, (Rider | null)[]> =>
  Object.fromEntries(Object.keys(RIDE_SEATS).map((id) => [id, emptyFor(id)]))

export const useRideOccupancy = create<OccupancyState>((set, get) => ({
  seats: initial(),
  claimSeat: (rideId, source, variant) => {
    const arr = get().seats[rideId]
    if (!arr) return null
    const i = arr.indexOf(null)
    if (i < 0) return null
    const next = arr.slice()
    next[i] = { source, variant }
    set((s) => ({ seats: { ...s.seats, [rideId]: next } }))
    return i
  },
  releaseSeat: (rideId, seat) => {
    const arr = get().seats[rideId]
    if (!arr || !arr[seat]) return
    const next = arr.slice()
    next[seat] = null
    set((s) => ({ seats: { ...s.seats, [rideId]: next } }))
  },
  clearCompany: (rideId) => {
    const arr = get().seats[rideId]
    if (!arr) return
    set((s) => ({ seats: { ...s.seats, [rideId]: arr.map((r) => (r?.source === 'company' ? null : r)) } }))
  },
  seatsOf: (rideId) => get().seats[rideId] ?? [],
  reset: () => set({ seats: initial() }),
}))

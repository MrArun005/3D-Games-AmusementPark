import { create } from 'zustand'
import { DAILY_TICKETS, type RideId, type StallId } from '@/lib/spawn'
import { useFestival } from '@/lib/festival'

export type RidePhase = 'idle' | 'boarding' | 'running' | 'unloading'
export interface ShopDesc {
  id: string
  kind: 'food' | 'balloon'
  name: string
  cost: number
  emoji: string
  /** Food tint / balloon colour. */
  color: string
}
export type Quality = 'low' | 'medium' | 'high'
export type ViewMode = 'first' | 'third'
export type TimeMode = 'cycle' | 'day' | 'night'

const zeroCompleted = (): Record<RideId, number> => ({
  ferris: 0, coaster: 0, carousel: 0, teacups: 0, droptower: 0, bumper: 0, columbus: 0,
})

interface GameState {
  tickets: number
  timeOfDay: number
  timeScale: number
  day: number
  activeRide: RideId | null
  ridePhase: RidePhase
  nearbyRide: RideId | null
  nearbyBooth: boolean
  ridesCompleted: Record<RideId, number>
  /** A stall mini-game the player is currently playing (locks movement + aim camera). */
  activeStall: StallId | null
  /** A stall the player is standing at and could start with E. */
  nearbyStall: StallId | null
  gamesWon: number
  /** A food/balloon shop the player is standing at. */
  nearbyShop: ShopDesc | null
  /** The shop whose buy menu is currently open (parks the player, frees the pointer). */
  shopMenu: ShopDesc | null
  /** Food currently being eaten (shown in HUD + held prop), cleared after a few seconds. */
  heldFood: { name: string; emoji: string } | null
  /** Colour of the balloon floating above the player, or null. */
  balloon: string | null
  paused: boolean
  muted: boolean
  quality: Quality
  view: ViewMode
  timeMode: TimeMode
  exitRequested: boolean
  lastClaimDay: number
  /** Cinematic free-look mode (P): freezes the player, cycles preset shots. */
  photoMode: boolean
  photoShot: number
  /** Mutated in place every frame (transient — never replaced, never re-renders React). */
  playerPos: { x: number; y: number; z: number }
  spendTickets: (n: number) => boolean
  addTickets: (n: number) => void
  setActiveRide: (id: RideId | null) => void
  setRidePhase: (p: RidePhase) => void
  setNearbyRide: (id: RideId | null) => void
  setNearbyBooth: (b: boolean) => void
  setActiveStall: (id: StallId | null) => void
  setNearbyStall: (id: StallId | null) => void
  setNearbyShop: (s: ShopDesc | null) => void
  openShop: (s: ShopDesc) => void
  closeShop: () => void
  buyFood: (name: string, emoji: string) => void
  buyBalloon: (color: string) => void
  winGame: () => void
  completeRide: (id: RideId) => void
  requestExit: () => void
  clearExit: () => void
  setPaused: (p: boolean) => void
  toggleMuted: () => void
  setQuality: (q: Quality) => void
  toggleView: () => void
  setTimeMode: (m: TimeMode) => void
  togglePhotoMode: () => void
  setPhotoShot: (i: number) => void
  setTimeScale: (s: number) => void
  advanceTime: (dtSeconds: number) => void
  claimDaily: () => boolean
  resetPark: () => void
}

export const useGameStore = create<GameState>((set, get) => ({
  tickets: 20,
  timeOfDay: 9.5,
  timeScale: 1, // 1 = a full in-game day in ~8 real minutes
  day: 1,
  activeRide: null,
  ridePhase: 'idle',
  nearbyRide: null,
  nearbyBooth: false,
  ridesCompleted: zeroCompleted(),
  activeStall: null,
  nearbyStall: null,
  gamesWon: 0,
  nearbyShop: null,
  shopMenu: null,
  heldFood: null,
  balloon: null,
  paused: false,
  muted: false,
  quality: 'medium',
  view: 'first',
  timeMode: 'cycle',
  exitRequested: false,
  lastClaimDay: 0,
  photoMode: false,
  photoShot: 0,
  playerPos: { x: 0, y: 1.5, z: 44 },

  spendTickets: (n) => {
    if (get().tickets < n) return false
    set((s) => ({ tickets: s.tickets - n }))
    return true
  },
  addTickets: (n) => set((s) => ({ tickets: s.tickets + n })),
  setActiveRide: (id) => set({ activeRide: id }),
  setRidePhase: (p) => set({ ridePhase: p }),
  setNearbyRide: (id) => set({ nearbyRide: id }),
  setNearbyBooth: (b) => set({ nearbyBooth: b }),
  setActiveStall: (id) => set({ activeStall: id }),
  setNearbyStall: (id) => set({ nearbyStall: id }),
  setNearbyShop: (s) => set({ nearbyShop: s }),
  openShop: (s) => set({ shopMenu: s }),
  closeShop: () => set({ shopMenu: null }),
  buyFood: (name, emoji) => {
    if (!get().spendTickets(get().shopMenu?.cost ?? 0)) return
    set({ heldFood: { name, emoji }, shopMenu: null })
    useFestival.getState().addScore(30)
    // finish eating after a few seconds (transient — fine to use a timer here)
    setTimeout(() => {
      if (get().heldFood?.name === name) set({ heldFood: null })
    }, 5000)
  },
  buyBalloon: (color) => {
    if (!get().spendTickets(get().shopMenu?.cost ?? 0)) return
    set({ balloon: color, shopMenu: null })
    useFestival.getState().addScore(30)
  },
  winGame: () => set((s) => ({ gamesWon: s.gamesWon + 1 })),
  completeRide: (id) =>
    set((s) => ({ ridesCompleted: { ...s.ridesCompleted, [id]: s.ridesCompleted[id] + 1 } })),
  requestExit: () => set({ exitRequested: true }),
  clearExit: () => set({ exitRequested: false }),
  setPaused: (p) => set({ paused: p }),
  toggleMuted: () => set((s) => ({ muted: !s.muted })),
  setQuality: (q) => set({ quality: q }),
  toggleView: () => set((s) => ({ view: s.view === 'first' ? 'third' : 'first' })),
  setTimeMode: (m) =>
    set(m === 'day' ? { timeMode: m, timeOfDay: 13 } : m === 'night' ? { timeMode: m, timeOfDay: 21 } : { timeMode: m }),
  togglePhotoMode: () => set((s) => ({ photoMode: !s.photoMode })),
  setPhotoShot: (i) => set({ photoShot: i }),
  setTimeScale: (s) => set({ timeScale: s }),
  advanceTime: (dt) => {
    if (get().timeMode !== 'cycle') return // pinned to noon/night by the selector
    const next = get().timeOfDay + dt * (24 / 480) * get().timeScale
    if (next >= 24) set((s) => ({ timeOfDay: next - 24, day: s.day + 1 }))
    else set({ timeOfDay: next })
  },
  claimDaily: () => {
    // The booth is always stocked — running out of tickets must never lock the player out.
    set((s) => ({ tickets: s.tickets + DAILY_TICKETS, lastClaimDay: s.day }))
    return true
  },
  resetPark: () =>
    set({
      tickets: 20, timeOfDay: 9.5, day: 1, activeRide: null, ridePhase: 'idle',
      nearbyRide: null, nearbyBooth: false, ridesCompleted: zeroCompleted(),
      activeStall: null, nearbyStall: null, gamesWon: 0,
      nearbyShop: null, shopMenu: null, heldFood: null, balloon: null,
      exitRequested: false, lastClaimDay: 0, paused: false, timeMode: 'cycle',
      photoMode: false, photoShot: 0,
    }),
}))

/** Sun elevation in [-1, 1] for an hour of day (6h sunrise, 18h sunset). */
export const sunElevation = (timeOfDay: number): number =>
  Math.sin(((timeOfDay - 6) / 12) * Math.PI)

export const isNight = (timeOfDay: number): boolean => sunElevation(timeOfDay) < 0.03

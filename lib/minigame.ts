import { create } from 'zustand'
import { useGameStore } from '@/state/useGameStore'
import { parkAudio } from '@/lib/audio'
import { useFestival } from '@/lib/festival'

const AMMO = 8
const DURATION = 30

/** Tokens paid out for a shooting round by hit count (spec: 5+ =3, all 8 =6). */
function payout(hits: number): number {
  if (hits >= AMMO) return 6
  if (hits >= 5) return 3
  if (hits >= 3) return 1
  return 0
}

interface ShootingState {
  active: boolean
  ammo: number
  score: number
  hits: number
  timeLeft: number
  /** Set when the round is over; the overlay shows it until the player closes. */
  result: { hits: number; score: number; reward: number } | null
  start: () => void
  /** A trigger pull: `points` > 0 means a target was hit. Spends one shot. */
  fire: (points: number) => void
  tick: (dt: number) => void
  end: () => void
  close: () => void
}

/**
 * Isolated session store for the shooting gallery so its fast-changing ammo /
 * score / timer never re-render the rest of the game. Payout and game-win
 * counters cross over into the main store on `end`.
 */
export const useShooting = create<ShootingState>((set, get) => ({
  active: false,
  ammo: AMMO,
  score: 0,
  hits: 0,
  timeLeft: DURATION,
  result: null,
  start: () => set({ active: true, ammo: AMMO, score: 0, hits: 0, timeLeft: DURATION, result: null }),
  fire: (points) => {
    const s = get()
    if (!s.active || s.ammo <= 0 || s.result) return
    const ammo = s.ammo - 1
    const hits = s.hits + (points > 0 ? 1 : 0)
    set({ ammo, score: s.score + points, hits })
    if (points > 0) useFestival.getState().addScore(points >= 3 ? 120 : 50)
    if (ammo <= 0) get().end()
  },
  tick: (dt) => {
    const s = get()
    if (!s.active || s.result) return
    const timeLeft = s.timeLeft - dt
    if (timeLeft <= 0) {
      set({ timeLeft: 0 })
      get().end()
    } else set({ timeLeft })
  },
  end: () => {
    const s = get()
    if (s.result) return
    const reward = payout(s.hits)
    if (reward > 0) {
      useGameStore.getState().addTickets(reward)
      useGameStore.getState().winGame()
    }
    set({ result: { hits: s.hits, score: s.score, reward } })
    parkAudio.fanfare(reward > 0)
    // Release the pointer so the cursor reappears to click the result's "Done".
    if (typeof document !== 'undefined') document.exitPointerLock()
  },
  close: () => {
    set({ active: false, result: null })
    useGameStore.getState().setActiveStall(null)
  },
}))

const RINGS = 5

/** Tokens for a ring-toss round by rings landed (out of 5). */
function ringPayout(on: number): number {
  if (on >= 4) return 6
  if (on >= 2) return 3
  if (on >= 1) return 1
  return 0
}

interface RingTossState {
  active: boolean
  ringsLeft: number
  on: number
  /** 0..1 charge while the throw button is held; drives the power bar. */
  power: number
  result: { on: number; reward: number } | null
  start: () => void
  setPower: (p: number) => void
  /** Resolve one thrown ring; `landed` true if it caught a peg. */
  resolve: (landed: boolean) => void
  end: () => void
  close: () => void
}

/** Isolated session store for ring toss — mirrors the shooting one. */
export const useRingToss = create<RingTossState>((set, get) => ({
  active: false,
  ringsLeft: RINGS,
  on: 0,
  power: 0,
  result: null,
  start: () => set({ active: true, ringsLeft: RINGS, on: 0, power: 0, result: null }),
  setPower: (p) => set({ power: p }),
  resolve: (landed) => {
    const s = get()
    if (!s.active || s.result) return
    const on = s.on + (landed ? 1 : 0)
    const ringsLeft = s.ringsLeft - 1
    if (landed) parkAudio.pop()
    if (landed) useFestival.getState().addScore(150)
    set({ on, ringsLeft, power: 0 })
    if (ringsLeft <= 0) get().end()
  },
  end: () => {
    const s = get()
    if (s.result) return
    const reward = ringPayout(s.on)
    if (reward > 0) {
      useGameStore.getState().addTickets(reward)
      useGameStore.getState().winGame()
    }
    set({ result: { on: s.on, reward } })
    parkAudio.fanfare(reward > 0)
    if (typeof document !== 'undefined') document.exitPointerLock()
  },
  close: () => {
    set({ active: false, result: null })
    useGameStore.getState().setActiveStall(null)
  },
}))

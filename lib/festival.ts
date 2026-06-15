import { create } from 'zustand'

export type FestivalPhase = 'idle' | 'running' | 'finale'

export const DAY_SECONDS = 7 * 60 // ~7 real minutes dusk -> midnight
export const COMBO_WINDOW = 12 // seconds before an unfed combo resets
const START_HOUR = 18
const END_HOUR = 24
const BEST_KEY = 'fableland-festival-best'

/** Side-effect hooks wired by the announcer/audio layer to avoid an import cycle. */
export const festivalEvents: { onScore?: (combo: number) => void; onComboLost?: () => void } = {}

interface FestivalState {
  phase: FestivalPhase
  score: number
  combo: number
  comboTimer: number // seconds left on the current combo (0 = none)
  timeLeft: number // seconds left in the festival day
  best: number
  caption: string | null
  start: () => void
  /** Apply `base` points × current combo, then grow the combo + refill its timer. */
  addScore: (base: number) => void
  tick: (dt: number) => void
  setCaption: (text: string) => void
  clearCaption: () => void
  toFinale: () => void
  reset: () => void
}

export const useFestival = create<FestivalState>((set, get) => ({
  phase: 'idle',
  score: 0,
  combo: 1,
  comboTimer: 0,
  timeLeft: DAY_SECONDS,
  best: 0,
  caption: null,

  start: () =>
    set({ phase: 'running', score: 0, combo: 1, comboTimer: 0, timeLeft: DAY_SECONDS, caption: null }),

  addScore: (base) => {
    const s = get()
    if (s.phase !== 'running') return
    const combo = s.comboTimer > 0 ? s.combo + 1 : 1
    set({ score: s.score + base * combo, combo, comboTimer: COMBO_WINDOW })
    festivalEvents.onScore?.(combo)
  },

  tick: (dt) => {
    const s = get()
    if (s.phase !== 'running') return
    let combo = s.combo
    let comboTimer = s.comboTimer
    if (comboTimer > 0) {
      comboTimer = Math.max(0, comboTimer - dt)
      if (comboTimer === 0) {
        combo = 1
        festivalEvents.onComboLost?.()
      }
    }
    const timeLeft = Math.max(0, s.timeLeft - dt)
    set({ comboTimer, combo, timeLeft })
    if (timeLeft === 0) get().toFinale()
  },

  setCaption: (text) => set({ caption: text }),
  clearCaption: () => set({ caption: null }),

  toFinale: () => {
    const s = get()
    if (s.phase === 'finale') return
    const best = Math.max(s.best, s.score)
    if (typeof window !== 'undefined') localStorage.setItem(BEST_KEY, String(best))
    set({ phase: 'finale', best })
  },

  reset: () =>
    set({ phase: 'idle', score: 0, combo: 1, comboTimer: 0, timeLeft: DAY_SECONDS, caption: null }),
}))

// load persisted best on the client
if (typeof window !== 'undefined') {
  const stored = Number(localStorage.getItem(BEST_KEY) || 0)
  if (stored > 0) useFestival.setState({ best: stored })
}

/** In-game hour (18→24) for the current run, driving the sky/lighting. */
export const festivalHour = (timeLeft: number): number =>
  START_HOUR + (END_HOUR - START_HOUR) * (1 - timeLeft / DAY_SECONDS)

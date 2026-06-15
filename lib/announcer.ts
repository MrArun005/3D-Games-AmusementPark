import { useFestival, festivalEvents } from '@/lib/festival'
import { parkAudio } from '@/lib/audio'

export type AnnounceEvent =
  | 'score' | 'bigScore' | 'miss' | 'comboLost' | 'comboMilestone'
  | 'rideComplete' | 'gameWin' | 'gameLose' | 'idle' | 'finale'

const LINES: Record<AnnounceEvent, string[]> = {
  score: ['Nice one!', 'Keep it going!', 'Show-off!'],
  bigScore: ['BOMBAAT!', 'Now THAT’s a Dasara!', 'The crowd goes wild!'],
  miss: ['Arre, SO close!', 'Ayyo, missed!', 'Is that all, hero?', 'My grandmother aims better!'],
  comboLost: ['Ayyo, combo gone!', 'You snooze, you lose!', 'Streak? What streak?'],
  comboMilestone: ['You’re ON FIRE!', 'Unstoppable!', 'The crowd can’t believe it!'],
  rideComplete: ['Enjoyed the ride?', 'Round and round!', 'Next!'],
  gameWin: ['Winner winner!', 'Champion shot!', 'Take a bow!'],
  gameLose: ['Better luck next time… not.', 'The crowd is unimpressed…', 'Try harder, champ.'],
  idle: ['Fell asleep, champ? 😴', 'The fair’s THIS way!', 'Are we boring you?'],
  finale: ['That’s a wrap — feast your eyes!', 'The grand finale!', 'Dasara dhamaka!'],
}

const PRIORITY: Record<AnnounceEvent, number> = {
  finale: 5, comboLost: 4, comboMilestone: 4, gameWin: 3, gameLose: 3,
  bigScore: 3, rideComplete: 2, miss: 2, idle: 1, score: 1,
}

const COOLDOWN_MS = 2500
let lastAt = -Infinity
let lastPriority = 0
let clearToken = 0

/** Push a heckle/hype caption (with a PA chime), respecting cooldown + priority. */
export function announce(ev: AnnounceEvent): void {
  if (typeof performance === 'undefined') return
  const now = performance.now()
  const prio = PRIORITY[ev]
  if (now - lastAt < COOLDOWN_MS && prio <= lastPriority) return
  lastAt = now
  lastPriority = prio
  const pool = LINES[ev]
  const line = pool[Math.floor(Math.random() * pool.length)]
  useFestival.getState().setCaption(line)
  parkAudio.chime()
  const token = ++clearToken
  window.setTimeout(() => {
    if (token === clearToken) useFestival.getState().clearCaption()
  }, 3000)
}

// Wire the festival store's side-effect hooks (avoids a festival→announcer import cycle).
festivalEvents.onScore = (combo: number) => {
  parkAudio.comboUp(combo)
  if (combo >= 5 && combo % 5 === 0) announce('comboMilestone')
  else if (combo >= 4) announce('bigScore')
  else announce('score')
}
festivalEvents.onComboLost = () => {
  parkAudio.comboLost()
  announce('comboLost')
}

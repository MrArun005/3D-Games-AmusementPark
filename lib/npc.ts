import { RIDE_LIST, STALLS, GAME_STALLS, WAYPOINTS, mulberry32 } from '@/lib/spawn'

export type StationKind = 'ride' | 'food' | 'game'
export interface QueueSlotPos { x: number; z: number }
export interface Station {
  kind: StationKind
  id: string
  x: number
  z: number
  slots: QueueSlotPos[]
}

function buildSlots(cx: number, cz: number, n: number): QueueSlotPos[] {
  const len = Math.hypot(cx, cz) || 1
  const dx = -cx / len
  const dz = -cz / len
  const px = -dz
  const pz = dx
  const out: QueueSlotPos[] = []
  for (let k = 0; k < n; k++) {
    const dist = 2.5 + k * 1.15
    const zig = k % 2 ? 0.35 : -0.35
    out.push({ x: cx + dx * dist + px * zig, z: cz + dz * dist + pz * zig })
  }
  return out
}

export const STATIONS: Station[] = [
  ...RIDE_LIST.map((r): Station => {
    const cx = r.position[0] + r.trigger.offset[0]
    const cz = r.position[2] + r.trigger.offset[2]
    return { kind: 'ride', id: r.id, x: cx, z: cz, slots: buildSlots(cx, cz, 6) }
  }),
  ...STALLS.map((s): Station => ({
    kind: 'food', id: s.id, x: s.position[0], z: s.position[2] + 2, slots: [],
  })),
  ...GAME_STALLS.map((s): Station => {
    const cx = s.position[0]
    const cz = s.position[2] + 2
    return { kind: 'game', id: s.id, x: cx, z: cz, slots: buildSlots(cx, cz, 4) }
  }),
]

export type GoalKind = StationKind | 'stroll'
export interface Goal { kind: GoalKind; id: string; x: number; z: number }

export function pickGoal(rnd: () => number): Goal {
  const roll = rnd()
  let kind: GoalKind
  if (roll < 0.5) kind = 'ride'
  else if (roll < 0.7) kind = 'food'
  else if (roll < 0.85) kind = 'game'
  else kind = 'stroll'

  if (kind === 'stroll') {
    const wp = WAYPOINTS[Math.floor(rnd() * WAYPOINTS.length)]
    return { kind, id: 'stroll', x: wp[0], z: wp[1] }
  }
  const pool = STATIONS.filter((s) => s.kind === kind)
  const st = pool[Math.floor(rnd() * pool.length)]
  return { kind, id: st.id, x: st.x, z: st.z }
}

export const STATION_BY_ID: Record<string, Station> = Object.fromEntries(
  STATIONS.map((s) => [s.id, s]),
)

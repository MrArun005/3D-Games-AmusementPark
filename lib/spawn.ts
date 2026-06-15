export type RideId = 'ferris' | 'coaster' | 'carousel' | 'teacups' | 'droptower' | 'bumper' | 'columbus'

export interface RideSpec {
  id: RideId
  name: string
  cost: number
  /** Seconds the RUNNING phase lasts. */
  duration: number
  position: [number, number, number]
  /** Sensor half-extents + local offset relative to `position`. */
  trigger: { offset: [number, number, number]; half: [number, number, number] }
  /** World-space spot the player is returned to after riding. */
  exit: [number, number, number]
}

export const DAILY_TICKETS = 20
export const PARK_RADIUS = 58
export const PLAYER_SPAWN: [number, number, number] = [0, 1.5, 44]

export const RIDES: Record<RideId, RideSpec> = {
  ferris: {
    id: 'ferris', name: 'Ferris Wheel', cost: 3, duration: 24,
    position: [-30, 0, -16],
    trigger: { offset: [6, 1, 5], half: [4, 2.5, 4] },
    exit: [-23, 1.5, -10],
  },
  coaster: {
    id: 'coaster', name: 'Roller Coaster', cost: 5, duration: 30,
    position: [32, 0, -8],
    trigger: { offset: [-15, 1, 4], half: [4.5, 2.5, 4.5] },
    exit: [14, 1.5, -2],
  },
  carousel: {
    id: 'carousel', name: 'Carousel', cost: 2, duration: 18,
    position: [0, 0, -32],
    trigger: { offset: [0, 1, 8], half: [4, 2.5, 3.5] },
    exit: [0, 1.5, -22],
  },
  teacups: {
    id: 'teacups', name: 'Spinning Teacups', cost: 2, duration: 18,
    position: [-30, 0, 12],
    trigger: { offset: [7, 1, 3], half: [4, 2.5, 4] },
    exit: [-21, 1.5, 14],
  },
  droptower: {
    id: 'droptower', name: 'Drop Tower', cost: 4, duration: 20,
    position: [24, 0, -30],
    trigger: { offset: [-5, 1, 6], half: [4, 2.5, 4] },
    exit: [17, 1.5, -22],
  },
  bumper: {
    id: 'bumper', name: 'Bumper Cars', cost: 4, duration: 25,
    position: [30, 0, 18],
    trigger: { offset: [-8, 1, 2], half: [4, 2.5, 4] },
    exit: [20, 1.5, 18],
  },
  columbus: {
    id: 'columbus', name: 'Columbus', cost: 4, duration: 24,
    position: [-16, 0, -42],
    trigger: { offset: [6, 1, 7], half: [3.5, 2, 3.5] },
    exit: [-9, 1.5, -34],
  },
}

export const RIDE_LIST: RideSpec[] = Object.values(RIDES)

export const BOOTH_POS: [number, number, number] = [8, 0, 38]
export const GATE_POS: [number, number, number] = [0, 0, 42]
export const RESTROOM_POS: [number, number, number] = [-22, 0, 22]
export interface FoodStallSpec {
  id: string
  position: [number, number, number]
  name: string
  color: string
  emoji: string
  cost: number
}
export const STALLS: FoodStallSpec[] = [
  { id: 'panipuri', position: [-12, 0, 28], name: 'PANI PURI', color: '#e91e8c', emoji: '🥟', cost: 2 },
  { id: 'juice', position: [14, 0, 26], name: 'FRESH JUICE', color: '#ff9d2e', emoji: '🧃', cost: 2 },
  { id: 'chaat', position: [10, 0, -31], name: 'CHAAT CORNER', color: '#3fae49', emoji: '🍛', cost: 3 },
  { id: 'mysorepak', position: [-32, 0, -2], name: 'MYSORE PAK', color: '#ffd230', emoji: '🍬', cost: 2 },
]

/** Balloon-seller stall by the plaza; buying attaches a balloon above the player. */
export const BALLOON_STALL_POS: [number, number, number] = [12, 0, 34]
export const BALLOON_STALL_COST = 1

/** Fair-game stalls where NPCs stand and play (yaw faces the plaza: atan2(-x, -z)). */
export type StallId = 'shooting' | 'ringtoss'
export interface GameStallSpec {
  id: StallId
  position: [number, number, number]
  kind: 'balloon' | 'ringtoss'
  name: string
  /** Tokens to play one round. */
  cost: number
}
export const GAME_STALLS: GameStallSpec[] = [
  { id: 'shooting', position: [-7, 0, 33], kind: 'balloon', name: 'SHOOTING GALLERY', cost: 2 },
  { id: 'ringtoss', position: [25, 0, 27], kind: 'ringtoss', name: 'RING TOSS', cost: 2 },
]
export const GAME_STALL_BY_ID: Record<StallId, GameStallSpec> = {
  shooting: GAME_STALLS[0],
  ringtoss: GAME_STALLS[1],
}

/** Wooden thela carts with umbrellas, scattered beside the paths. */
export interface CartSpec {
  position: [number, number, number]
  rotationY: number
  goods: 'balloons' | 'fruits' | 'toys'
}
export const VENDOR_CARTS: CartSpec[] = [
  { position: [5, 0, 31], rotationY: 0.4, goods: 'balloons' },
  { position: [-18, 0, 18], rotationY: 2.2, goods: 'fruits' },
  { position: [18, 0, -17], rotationY: -1.1, goods: 'toys' },
  { position: [-14, 0, -27], rotationY: 1.0, goods: 'fruits' },
]

/** Auto-rickshaw parked by the entrance gate. */
export const RICKSHAW_POS: [number, number, number] = [7, 0, 45]
export const RICKSHAW_YAW = -0.5

/** Cinematic Photo Mode preset shots (camera position + look-at target). */
export const PHOTO_SHOTS: { name: string; pos: [number, number, number]; target: [number, number, number] }[] = [
  { name: 'Giant Wheel', pos: [-30, 3, 0], target: [-30, 11, -16] },
  { name: 'Bazaar Street', pos: [0, 3.5, 32], target: [0, 2, -10] },
  { name: 'Crowd Overhead', pos: [0, 34, 6], target: [0, 0, -6] },
  { name: 'Drop Tower Vista', pos: [24, 17, -12], target: [24, 9, -30] },
  { name: 'Fountain Lights', pos: [10, 5, 16], target: [-12, 6, -10] },
]

/**
 * Stadium floodlight masts on a ring JUST OUTSIDE the perimeter fence
 * (radius > PARK_RADIUS), all aimed inward + down so their overlapping cones
 * blanket the entire park. 10 masts give full coverage with redundancy.
 */
export const FLOOD_RING = PARK_RADIUS + 4
export const FLOODLIGHTS: [number, number][] = Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2
  return [Math.cos(a) * FLOOD_RING, Math.sin(a) * FLOOD_RING] as [number, number]
})

/** The big-top tent landmark (decorative, with collision). */
export const TENT_POS: [number, number, number] = [20, 0, 34]

/** Lamp post spots — the first PLAZA_LAMP_COUNT are the plaza ring, the rest the midway ring. */
export const PLAZA_LAMP_COUNT = 10
export const LAMP_POSITIONS: [number, number][] = (() => {
  const pts: [number, number][] = []
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    pts.push([Math.cos(a) * 13.5, Math.sin(a) * 13.5])
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    pts.push([Math.cos(a) * 30.5, Math.sin(a) * 30.5])
  }
  return pts
})()

/** Waypoints NPCs wander between — gate, plaza ring and midway ring. */
export const WAYPOINTS: [number, number][] = (() => {
  const pts: [number, number][] = [[0, 38]]
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    pts.push([Math.cos(a) * 10, Math.sin(a) * 10])
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    pts.push([Math.cos(a) * 27, Math.sin(a) * 27])
  }
  return pts
})()

/** Deterministic PRNG so instanced scenery never reshuffles between renders. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

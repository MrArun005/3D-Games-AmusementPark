import { WAYPOINTS, STALLS, BALLOON_STALL_POS, RIDE_LIST } from '@/lib/spawn'

/** Short fairground chatter lines for NPC speech bubbles. */
export const PHRASES = [
  'Eshtu rate?',
  'Adu nodu!',
  'Super ide!',
  'Bombaat!',
  'Baa illi!',
  'Channagide!',
  'Photo thogo!',
  'Ondu sutthu!',
]

/** Targets NPCs wander between: path waypoints + stall/ride fronts (so they
 *  visibly gather and "shop"). Each entry is an [x, z] destination. */
export const CROWD_TARGETS: [number, number][] = [
  ...WAYPOINTS,
  ...STALLS.map((s) => [s.position[0], s.position[2] + 3] as [number, number]),
  [BALLOON_STALL_POS[0], BALLOON_STALL_POS[2] + 3],
  ...RIDE_LIST.map((r) => [r.position[0] + r.trigger.offset[0], r.position[2] + r.trigger.offset[2] + 2] as [number, number]),
]

export interface CrowdAgent {
  x: number
  z: number
  y: number
  idle: boolean
}

/** Live transforms of crowd NPCs, written by Crowd each frame, read by
 *  SpeechBubbles. Mutated in place — never triggers React renders. */
export const crowdAgents: CrowdAgent[] = []

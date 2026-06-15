export interface QueueSlot { x: number; z: number }

/**
 * A FIFO line of agent ids at a station (ride/game). Place k in line maps to
 * physical `slots[k]`; agents past the last slot stack at the final slot.
 */
export class StationQueue {
  private waiting: number[] = []
  constructor(public readonly slots: QueueSlot[]) {}

  get length(): number { return this.waiting.length }
  has(agentId: number): boolean { return this.waiting.includes(agentId) }
  join(agentId: number): boolean {
    if (this.waiting.length >= this.slots.length) return false
    if (!this.waiting.includes(agentId)) this.waiting.push(agentId)
    return true
  }
  slotFor(agentId: number): QueueSlot | null {
    const i = this.waiting.indexOf(agentId)
    if (i < 0) return null
    return this.slots[Math.min(i, this.slots.length - 1)]
  }
  frontReady(agentId: number): boolean { return this.waiting[0] === agentId }
  leaveFront(): number | null { return this.waiting.shift() ?? null }
  remove(agentId: number): void {
    const i = this.waiting.indexOf(agentId)
    if (i >= 0) this.waiting.splice(i, 1)
  }
}

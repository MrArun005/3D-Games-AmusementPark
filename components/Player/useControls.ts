'use client'

/** Live keyboard state keyed by KeyboardEvent.code. */
export const keys: Record<string, boolean> = {}

export function bindKeys(): () => void {
  const down = (e: KeyboardEvent) => {
    keys[e.code] = true
  }
  const up = (e: KeyboardEvent) => {
    keys[e.code] = false
  }
  const clear = () => {
    for (const k of Object.keys(keys)) keys[k] = false
  }
  window.addEventListener('keydown', down)
  window.addEventListener('keyup', up)
  window.addEventListener('blur', clear)
  return () => {
    window.removeEventListener('keydown', down)
    window.removeEventListener('keyup', up)
    window.removeEventListener('blur', clear)
  }
}

/** Optional gamepad support: left stick = move, A = jump, RB = sprint. */
export function readGamepad(): { x: number; y: number; jump: boolean; sprint: boolean } | null {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return null
  const gp = navigator.getGamepads()[0]
  if (!gp) return null
  const dead = (v: number) => (Math.abs(v) > 0.18 ? v : 0)
  return {
    x: dead(gp.axes[0] ?? 0),
    y: dead(gp.axes[1] ?? 0),
    jump: !!gp.buttons[0]?.pressed,
    sprint: !!gp.buttons[5]?.pressed,
  }
}

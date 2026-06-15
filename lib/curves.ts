import * as THREE from 'three'

/**
 * Closed coaster circuit in ride-local space: a flat station straight, a
 * climb to a ~13 m crest, a steep drop, a full vertical loop and the run-out
 * back to the station. CatmullRom (centripetal) smooths the hand-placed
 * control points without kinks or self-crossings.
 */
export function buildCoasterCurve(): THREE.CatmullRomCurve3 {
  const pts: THREE.Vector3[] = []
  const add = (x: number, y: number, z: number) => pts.push(new THREE.Vector3(x, y, z))

  add(-14, 1.2, 2) // station
  add(-8, 1.2, 9)
  add(2, 2, 12)
  add(10, 3.5, 10)
  add(15, 9, 4) // lift hill
  add(13, 13, -4) // crest
  add(7, 4, -9) // the drop
  add(2, 2, -11)

  // Vertical loop: a circle in the X/Y plane whose Z drifts 2 m so the track
  // doesn't intersect itself. The angle runs *backwards* from the bottom of
  // the circle because the train arrives travelling toward -X.
  const cx = -4
  const cy = 6.5
  const r = 4.2
  for (let i = 1; i <= 7; i++) {
    const a = -Math.PI / 2 - (i / 8) * Math.PI * 2
    add(cx + Math.cos(a) * r, cy + Math.sin(a) * r, -10.5 + (i / 8) * 2)
  }

  add(-11, 1.8, -8)
  add(-16, 1.4, -2)
  return new THREE.CatmullRomCurve3(pts, true, 'centripetal')
}

/**
 * Gravity-flavoured speed: convert "height below the crest" into velocity
 * (v = sqrt(2gh)), clamped so the train never stalls uphill or tears away.
 */
export function coasterSpeed(y: number, crestY: number): number {
  const v = Math.sqrt(Math.max(0, 2 * 9.81 * (crestY + 1.5 - y)))
  return Math.min(16, Math.max(2.5, v))
}

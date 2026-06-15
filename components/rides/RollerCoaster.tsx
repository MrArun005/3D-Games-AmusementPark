'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { Instances, Instance } from '@react-three/drei'
import { RIDES } from '@/lib/spawn'
import { useGameStore, isNight } from '@/state/useGameStore'
import { buildCoasterCurve, coasterSpeed } from '@/lib/curves'
import { coasterTelemetry } from '@/lib/refs'
import { PALETTE } from '@/lib/palette'
import { makeStripesTexture } from '@/lib/textures'
import { useRideMachine, RideTrigger, applyRideCamera } from './RideBase'

const spec = RIDES.coaster
const CART_GAP = 1.5 // metres between carts along the track
const RAIL_OFFSET = 0.34 // half the rail gauge
const SERVICE_SPEED = 3 // empty-train cruise while returning to the station
const CREEP_SPEED = 1.5 // final approach speed easing into the platform
const LAUNCH_EASE = 2 // seconds to ramp up from rest when RUNNING begins
const _zero = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)
const _m = new THREE.Matrix4()
const _side = new THREE.Vector3()
const _d = new THREE.Vector3()
const _w = new THREE.Vector3()
const _lookT = new THREE.Vector3()
const _head = new THREE.Vector3()
const _p = new THREE.Vector3()
const _tan = new THREE.Vector3()
const _tan2 = new THREE.Vector3()

export default function RollerCoaster() {
  const { phase, elapsed } = useRideMachine(spec)
  const carts = useRef<(THREE.Group | null)[]>([])
  const u = useRef(0)
  const prevRunning = useRef(false)
  const launchV = useRef(0) // train speed at the moment RUNNING began
  const railMat = useRef<THREE.MeshStandardMaterial>(null)
  const headlightMat = useRef<THREE.MeshStandardMaterial>(null)
  const camera = useThree((s) => s.camera)

  const { curve, length, crestY, spine, railL, railR, ties, supports, kickers, canopyTex, fencePosts, fenceRails } = useMemo(() => {
    const curve = buildCoasterCurve()
    const length = curve.getLength()
    let crestY = 0
    for (const p of curve.getPoints(240)) crestY = Math.max(crestY, p.y)
    // Slim centre spine doubles as the track's structural backbone.
    const spine = new THREE.TubeGeometry(curve, 480, 0.06, 8, true)

    // Twin rails: offset the centreline ±RAIL_OFFSET along the horizontal
    // side vector at each sample, then re-tube the two offset curves.
    const leftPts: THREE.Vector3[] = []
    const rightPts: THREE.Vector3[] = []
    const tanV = new THREE.Vector3()
    const sideV = new THREE.Vector3()
    const prevSide = new THREE.Vector3(1, 0, 0)
    const SAMPLES = 240
    for (let i = 0; i < SAMPLES; i++) {
      const p = curve.getPointAt(i / SAMPLES)
      curve.getTangentAt(i / SAMPLES, tanV)
      sideV.crossVectors(tanV, _up)
      if (sideV.lengthSq() < 0.01) {
        // Near-vertical tangent (loop sides) — cross degenerates, carry on.
        sideV.copy(prevSide)
      } else {
        sideV.normalize()
        // Through the vertical loop the raw cross product flips sign twice;
        // keeping continuity with the previous sample stops the rails from
        // swapping sides (and the flip count is even, so the seam still meets).
        if (sideV.dot(prevSide) < 0) sideV.negate()
      }
      prevSide.copy(sideV)
      leftPts.push(p.clone().addScaledVector(sideV, -RAIL_OFFSET))
      rightPts.push(p.clone().addScaledVector(sideV, RAIL_OFFSET))
    }
    const railL = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(leftPts, true, 'centripetal'), 480, 0.07, 8, true)
    const railR = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rightPts, true, 'centripetal'), 480, 0.07, 8, true)

    // Cross-ties: orient a flat box along the local tangent at each sample.
    const ties: { pos: [number, number, number]; rot: [number, number, number] }[] = []
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    for (let i = 0; i < 130; i++) {
      const t = i / 130
      const p = curve.getPointAt(t)
      const tan = curve.getTangentAt(t)
      _m.lookAt(_zero, tan, _up)
      q.setFromRotationMatrix(_m)
      e.setFromQuaternion(q)
      ties.push({ pos: [p.x, p.y - 0.13, p.z], rot: [e.x, e.y, e.z] })
    }

    // Support pillars from elevated track samples straight to the ground;
    // tall ones get a pair of 30° diagonal kickers braced back to the ground.
    const supports: { pos: [number, number, number]; h: number }[] = []
    const kickers: { pos: [number, number, number]; rotZ: number; len: number }[] = []
    const TAN30 = Math.tan(Math.PI / 6)
    const COS30 = Math.cos(Math.PI / 6)
    for (let i = 0; i < 26; i++) {
      const p = curve.getPointAt(i / 26)
      if (p.y > 1.2) supports.push({ pos: [p.x, (p.y - 0.3) / 2, p.z], h: p.y - 0.3 })
      if (p.y > 6) {
        const attach = (p.y - 0.3) * 0.6
        const foot = attach * TAN30
        const len = attach / COS30
        for (const s of [-1, 1] as const) {
          kickers.push({ pos: [p.x + (s * foot) / 2, attach / 2, p.z], rotZ: -s * (Math.PI / 6), len })
        }
      }
    }

    const canopyTex = makeStripesTexture(PALETTE.red, PALETTE.cream, 12)
    canopyTex.repeat.set(2, 1)

    // Perimeter fence around the circuit footprint (track spans ~x -16..15,
    // z -11..12). The west side keeps a boarding gap over local z 0..8 so the
    // trigger (offset [-15,1,4], half 3.5), the station platform and the exit
    // path (world [14,1.5,-2] = local [-18,1.5,6]) all stay clear.
    const FX = 17.5
    const FZ0 = -13
    const FZ1 = 14
    const GAP0 = 0
    const GAP1 = 8
    const fencePosts: [number, number][] = []
    const postsAlong = (x0: number, z0: number, x1: number, z1: number, every: number, skipEnds: boolean) => {
      const dx = x1 - x0
      const dz = z1 - z0
      const n = Math.max(1, Math.round(Math.hypot(dx, dz) / every))
      for (let i = skipEnds ? 1 : 0; i <= n - (skipEnds ? 1 : 0); i++) {
        fencePosts.push([x0 + (dx * i) / n, z0 + (dz * i) / n])
      }
    }
    postsAlong(-FX, FZ0, FX, FZ0, 2.5, false) // north run (z = -13), corners included
    postsAlong(-FX, FZ1, FX, FZ1, 2.5, false) // south run (z = +14), corners included
    postsAlong(FX, FZ0, FX, FZ1, 2.5, true) // east run, corners already placed
    postsAlong(-FX, FZ0, -FX, GAP0, 2.2, true) // west run below the boarding gap
    fencePosts.push([-FX, GAP0], [-FX, GAP1]) // frame the gap opening
    postsAlong(-FX, GAP1, -FX, FZ1, 2, true) // west run above the gap

    const fenceRails: { pos: [number, number, number]; rot: [number, number, number]; len: number }[] = []
    const railPair = (cx: number, cz: number, len: number, alongX: boolean) => {
      const rot: [number, number, number] = alongX ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]
      for (const y of [0.62, 1.24]) fenceRails.push({ pos: [cx, y, cz], rot, len })
    }
    railPair(0, FZ0, FX * 2, true)
    railPair(0, FZ1, FX * 2, true)
    railPair(FX, (FZ0 + FZ1) / 2, FZ1 - FZ0, false)
    railPair(-FX, (FZ0 + GAP0) / 2, GAP0 - FZ0, false)
    railPair(-FX, (GAP1 + FZ1) / 2, FZ1 - GAP1, false)

    return { curve, length, crestY, spine, railL, railR, ties, supports, kickers, canopyTex, fencePosts, fenceRails }
  }, [])

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const st = useGameStore.getState()
    if (st.paused) return
    const mine = st.activeRide === spec.id
    const running = mine && phase.current === 'running'

    // Drive model: with no run in progress the train returns to the station
    // at service speed, eases down to a creep on the final approach and parks
    // exactly at u = 0. A paid run launches from rest on the gravity-speed
    // model, smoothstepped over the first LAUNCH_EASE seconds so the train
    // pulls away from the platform instead of snapping to full speed.
    curve.getPointAt(u.current, _head)
    const remaining = (1 - u.current) * length // metres left to the station mark
    const serviceV = Math.min(SERVICE_SPEED, CREEP_SPEED + remaining * 0.35)
    if (running && !prevRunning.current) {
      // Almost always 0 (parked); if a run starts mid-return, blend from the
      // current service speed instead so the train never freezes in place.
      launchV.current = u.current === 0 ? 0 : serviceV
    }
    prevRunning.current = running
    let v: number
    if (running) {
      const k = Math.min(1, elapsed.current / LAUNCH_EASE)
      const ease = k * k * (3 - 2 * k)
      v = launchV.current + (coasterSpeed(_head.y, crestY) - launchV.current) * ease
      u.current = (u.current + (v * dt) / length) % 1
    } else if (u.current === 0) {
      v = 0 // parked at the platform, holding for riders
    } else {
      v = serviceV
      const du = (v * dt) / length
      if (du >= 1 - u.current) {
        u.current = 0 // home — clamp to the station mark and hold
        v = 0
      } else {
        u.current += du
      }
    }

    for (let i = 0; i < 3; i++) {
      const cart = carts.current[i]
      if (!cart) continue
      const cu = (((u.current - (i * CART_GAP) / length) % 1) + 1) % 1
      curve.getPointAt(cu, _p)
      curve.getTangentAt(cu, _tan)
      cart.position.copy(_p)
      // Orient the cart so its -Z axis follows the travel direction.
      _m.lookAt(_zero, _tan, _up)
      cart.quaternion.setFromRotationMatrix(_m)
      // Banking: roll about the forward axis proportional to how fast the
      // tangent swings toward the side vector (lateral turn rate).
      curve.getTangentAt((cu + 0.004) % 1, _tan2)
      _side.crossVectors(_tan, _up).normalize()
      const bank = THREE.MathUtils.clamp(_d.subVectors(_tan2, _tan).dot(_side) * -28, -0.7, 0.7)
      cart.rotateZ(bank)
    }

    const front = carts.current[0]
    coasterTelemetry.speed = v // actual train speed; exactly 0 when parked
    if (front) {
      front.getWorldPosition(_w)
      coasterTelemetry.x = _w.x
      coasterTelemetry.y = _w.y
      coasterTelemetry.z = _w.z
    }
    const night = isNight(st.timeOfDay)
    if (railMat.current) railMat.current.emissiveIntensity = night ? 2.2 : 0
    if (headlightMat.current) headlightMat.current.emissiveIntensity = night ? 2.6 : 0

    if (mine && phase.current !== 'idle' && front) {
      front.getWorldPosition(_w)
      _w.y += 0.7
      curve.getTangentAt(u.current, _tan)
      _lookT.copy(_w).addScaledVector(_tan, 6)
      // hard position lock while running (no swim); base view follows the track
      // and the player's drag-to-look offset is applied on top.
      applyRideCamera(camera, _w, _lookT, dt, phase.current !== 'boarding')
      void state
    }
  })

  return (
    <group position={spec.position}>
      <mesh geometry={spine} castShadow>
        <meshStandardMaterial color={PALETTE.navy} metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh geometry={railL} castShadow>
        <meshStandardMaterial
          ref={railMat}
          color={PALETTE.gold}
          emissive={PALETTE.goldLight}
          emissiveIntensity={0}
          metalness={0.65}
          roughness={0.3}
        />
      </mesh>
      <mesh geometry={railR} castShadow>
        <meshStandardMaterial color={PALETTE.gold} metalness={0.65} roughness={0.3} />
      </mesh>

      <Instances limit={ties.length} castShadow>
        <boxGeometry args={[1.04, 0.08, 0.26]} />
        <meshStandardMaterial color={PALETTE.wood} roughness={0.85} />
        {ties.map((t, i) => (
          <Instance key={i} position={t.pos} rotation={t.rot} />
        ))}
      </Instances>

      <Instances limit={supports.length}>
        <cylinderGeometry args={[0.12, 0.15, 1, 8]} />
        <meshStandardMaterial color={PALETTE.navy} roughness={0.6} />
        {supports.map((s, i) => (
          <Instance key={i} position={s.pos} scale={[1, s.h, 1]} />
        ))}
      </Instances>

      <Instances limit={kickers.length}>
        <cylinderGeometry args={[0.06, 0.07, 1, 6]} />
        <meshStandardMaterial color={PALETTE.navy} roughness={0.6} />
        {kickers.map((k, i) => (
          <Instance key={i} position={k.pos} rotation={[0, 0, k.rotZ]} scale={[1, k.len, 1]} />
        ))}
      </Instances>

      {/* station platform */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[-14, 0.45, 4.6]} receiveShadow castShadow>
          <boxGeometry args={[5, 0.9, 2.6]} />
          <meshStandardMaterial color={PALETTE.navy} roughness={0.7} />
        </mesh>
      </RigidBody>

      {/* station canopy + queue fence posts (per-instance colours) */}
      <Instances limit={9}>
        <cylinderGeometry args={[0.07, 0.08, 1, 8]} />
        <meshStandardMaterial color="#ffffff" roughness={0.6} />
        {([
          [-16, 3.75],
          [-12, 3.75],
          [-16, 5.45],
          [-12, 5.45],
        ] as const).map(([x, z], i) => (
          <Instance key={`c${i}`} position={[x, 2.1, z]} scale={[1, 2.4, 1]} color={PALETTE.cream} />
        ))}
        {[-16.1, -15.05, -14, -12.95, -11.9].map((x, i) => (
          <Instance key={`q${i}`} position={[x, 0.5, 6.2]} scale={[0.65, 1, 0.65]} color={PALETTE.redDark} />
        ))}
      </Instances>
      {/* queue handrail */}
      <mesh position={[-14, 0.98, 6.2]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.035, 4.5, 8]} />
        <meshStandardMaterial color={PALETTE.gold} metalness={0.6} roughness={0.35} />
      </mesh>
      {/* striped marquee roof: a stretched 4-sided cone over the platform */}
      <group position={[-14, 3.85, 4.6]} scale={[3.3, 1.1, 2.2]}>
        <mesh castShadow>
          <coneGeometry args={[1, 1, 4]} />
          <meshStandardMaterial map={canopyTex} side={THREE.DoubleSide} roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1, 0.045, 8, 28]} />
          <meshStandardMaterial color={PALETTE.gold} metalness={0.6} roughness={0.35} />
        </mesh>
      </group>
      {/* gold ball finials: queue post caps + canopy peak */}
      <Instances limit={6}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshStandardMaterial color={PALETTE.gold} metalness={0.6} roughness={0.3} />
        {[-16.1, -15.05, -14, -12.95, -11.9].map((x, i) => (
          <Instance key={i} position={[x, 1.04, 6.2]} />
        ))}
        <Instance position={[-14, 4.5, 4.6]} scale={1.8} />
      </Instances>

      {/* perimeter fence: keeps walkers off the circuit (the track sweeps at
          chest height over open ground). Same family as the queue fence —
          dark-red posts, gold rails, gold finials — with a west-side gap for
          the boarding trigger, station platform and exit path. */}
      <Instances limit={fencePosts.length} castShadow>
        <cylinderGeometry args={[0.07, 0.08, 1, 8]} />
        <meshStandardMaterial color={PALETTE.redDark} roughness={0.6} />
        {fencePosts.map(([x, z], i) => (
          <Instance key={i} position={[x, 0.65, z]} scale={[0.65, 1.3, 0.65]} />
        ))}
      </Instances>
      <Instances limit={fenceRails.length}>
        <cylinderGeometry args={[0.035, 0.035, 1, 8]} />
        <meshStandardMaterial color={PALETTE.gold} metalness={0.6} roughness={0.35} />
        {fenceRails.map((r, i) => (
          <Instance key={i} position={r.pos} rotation={r.rot} scale={[1, r.len, 1]} />
        ))}
      </Instances>
      <Instances limit={fencePosts.length}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshStandardMaterial color={PALETTE.gold} metalness={0.6} roughness={0.3} />
        {fencePosts.map(([x, z], i) => (
          <Instance key={i} position={[x, 1.36, z]} />
        ))}
      </Instances>
      {/* fence physics: thin walls topping out at the 1.3 m post height; the
          west side is split around the z 0..8 boarding gap. */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[17.62, 0.65, 0.12]} position={[0, 0.65, -13]} />
        <CuboidCollider args={[17.62, 0.65, 0.12]} position={[0, 0.65, 14]} />
        <CuboidCollider args={[0.12, 0.65, 13.5]} position={[17.5, 0.65, 0.5]} />
        <CuboidCollider args={[0.12, 0.65, 6.5]} position={[-17.5, 0.65, -6.5]} />
        <CuboidCollider args={[0.12, 0.65, 3]} position={[-17.5, 0.65, 11]} />
      </RigidBody>

      {/* train */}
      {[0, 1, 2].map((i) => (
        <group key={i} ref={(el) => { carts.current[i] = el }}>
          <mesh castShadow>
            <boxGeometry args={[0.85, 0.42, 1.15]} />
            <meshStandardMaterial color={PALETTE.red} metalness={0.25} roughness={0.45} />
          </mesh>
          {/* rounded nose: rear half of the squashed sphere hides in the body */}
          <mesh position={[0, 0, -0.58]} scale={[0.99, 0.5, 0.82]}>
            <sphereGeometry args={[0.43, 20, 14]} />
            <meshStandardMaterial color={PALETTE.red} metalness={0.25} roughness={0.45} />
          </mesh>
          {/* gold side-panel stripe wraps the body as a belt band */}
          <mesh position={[0, 0.02, 0.02]}>
            <boxGeometry args={[0.87, 0.13, 1.16]} />
            <meshStandardMaterial color={PALETTE.gold} metalness={0.55} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.36, 0.5]}>
            <boxGeometry args={[0.78, 0.34, 0.14]} />
            <meshStandardMaterial color={PALETTE.navy} roughness={0.6} />
          </mesh>
          {i === 0 && (
            <mesh position={[0, 0.04, -0.92]}>
              <sphereGeometry args={[0.06, 12, 10]} />
              <meshStandardMaterial
                ref={headlightMat}
                color={PALETTE.cream}
                emissive={PALETTE.bulbWarm}
                emissiveIntensity={0}
              />
            </mesh>
          )}
        </group>
      ))}
      <RideTrigger spec={spec} />
    </group>
  )
}

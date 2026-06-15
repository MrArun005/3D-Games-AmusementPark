'use client'

import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { RigidBody, type RapierRigidBody } from '@react-three/rapier'
import { useGameStore } from '@/state/useGameStore'
import { PALETTE, BAZAAR } from '@/lib/palette'
import { PARK_RADIUS, mulberry32 } from '@/lib/spawn'
import { PROPS, PROP_COUNT_BY_Q, type PropKind, type PropSpec } from '@/lib/props'

// --- Shared geometries + materials (created once, reused across instances) ---
// Each prop gets its own RigidBody (so it moves independently), but the visual
// mesh inside reuses these singletons — no per-prop geometry/material churn.

const BALL_GEO = new THREE.SphereGeometry(0.18, 16, 12)
const BEACHBALL_GEO = new THREE.SphereGeometry(0.35, 18, 14)
const CAN_GEO = new THREE.CylinderGeometry(0.12, 0.12, 0.3, 14)
const CRATE_GEO = new THREE.BoxGeometry(0.5, 0.5, 0.5)

// Colorful little balls — cycle through the bazaar palette.
const BALL_COLORS = [
  BAZAAR.chilliRed, BAZAAR.turquoise, BAZAAR.yellow, BAZAAR.magenta,
  BAZAAR.parrotGreen, BAZAAR.skyBlue, BAZAAR.purple, BAZAAR.marigold,
] as const
const BALL_MATS = BALL_COLORS.map(
  (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45 })
)

// Bright beachballs — light, glossy, vivid.
const BEACHBALL_COLORS = [
  BAZAAR.magenta, BAZAAR.turquoise, BAZAAR.yellow, BAZAAR.parrotGreen,
] as const
const BEACHBALL_MATS = BEACHBALL_COLORS.map(
  (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.25 })
)

// A drink can — metallic.
const CAN_MAT = new THREE.MeshStandardMaterial({
  color: PALETTE.gold,
  metalness: 0.8,
  roughness: 0.3,
})

// A wooden crate — dead, matte.
const CRATE_MAT = new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.95 })

// Stable per-prop color index so balls/beachballs don't all read identical.
const COLOR_RND = mulberry32(98765)
const COLOR_IDX = PROPS.map(() => COLOR_RND())

interface KindConfig {
  /** Auto-collider shape for the RigidBody. */
  colliders: 'ball' | 'hull' | 'cuboid'
  restitution: number
  friction: number
  /** Continuous collision detection — on for small/fast bodies so they don't tunnel. */
  ccd: boolean
  /** Optional density override (beachball is light). */
  density?: number
  /** Drop height so it settles on spawn / respawn. */
  dropY: number
}

const KIND: Record<PropKind, KindConfig> = {
  // small + fast -> ccd; bouncy
  ball: { colliders: 'ball', restitution: 0.6, friction: 0.5, ccd: true, dropY: 0.7 },
  // big + light -> very bouncy, low density; not fast enough to need ccd
  beachball: { colliders: 'ball', restitution: 0.7, friction: 0.4, ccd: false, density: 0.3, dropY: 1.0 },
  // small + can roll fast -> ccd
  can: { colliders: 'hull', restitution: 0.3, friction: 0.55, ccd: true, dropY: 0.6 },
  // heavy, dead, grippy
  crate: { colliders: 'cuboid', restitution: 0.1, friction: 0.9, ccd: false, dropY: 0.8 },
}

function meshFor(spec: PropSpec, colorIdx: number): React.ReactElement {
  switch (spec.kind) {
    case 'ball':
      return (
        <mesh geometry={BALL_GEO} material={BALL_MATS[Math.floor(colorIdx * BALL_MATS.length)]} castShadow />
      )
    case 'beachball':
      return (
        <mesh geometry={BEACHBALL_GEO} material={BEACHBALL_MATS[Math.floor(colorIdx * BEACHBALL_MATS.length)]} castShadow />
      )
    case 'can':
      return <mesh geometry={CAN_GEO} material={CAN_MAT} castShadow />
    case 'crate':
      return <mesh geometry={CRATE_GEO} material={CRATE_MAT} castShadow />
  }
}

const PARK_R2 = PARK_RADIUS * PARK_RADIUS

/**
 * A small, quality-capped set of DYNAMIC physics props scattered in the central
 * park where the player walks. Rapier's dynamic player capsule pushes them
 * naturally (no manual impulse code). Each prop is its own RigidBody dropped
 * from a small height so it settles. A single useFrame respawns any prop that
 * escapes (falls through the floor or rolls past the park edge) back to its
 * spawn point with zeroed velocity. Counts scale with the quality setting.
 */
export default function Props() {
  const quality = useGameStore((s) => s.quality)
  const count = PROP_COUNT_BY_Q[quality]
  const visible = PROPS.slice(0, count)

  const bodies = useRef<(RapierRigidBody | null)[]>([])

  useFrame(() => {
    const refs = bodies.current
    for (let i = 0; i < visible.length; i++) {
      const b = refs[i]
      if (!b) continue
      const p = b.translation()
      // Escaped: fell through the floor, or rolled/bounced out of the park.
      if (p.y < -5 || p.x * p.x + p.z * p.z > PARK_R2) {
        const spec = visible[i]
        b.setTranslation({ x: spec.x, y: 1, z: spec.z }, true)
        b.setLinvel({ x: 0, y: 0, z: 0 }, true)
        b.setAngvel({ x: 0, y: 0, z: 0 }, true)
      }
    }
  })

  return (
    <group>
      {visible.map((spec, i) => {
        const cfg = KIND[spec.kind]
        return (
          <RigidBody
            key={i}
            ref={(el) => {
              bodies.current[i] = el
            }}
            position={[spec.x, cfg.dropY, spec.z]}
            colliders={cfg.colliders}
            restitution={cfg.restitution}
            friction={cfg.friction}
            density={cfg.density}
            ccd={cfg.ccd}
          >
            {meshFor(spec, COLOR_IDX[i])}
          </RigidBody>
        )
      })}
    </group>
  )
}

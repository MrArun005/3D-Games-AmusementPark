'use client'

import { useMemo } from 'react'
import { Instances, Instance } from '@react-three/drei'
import { LAMP_POSITIONS, PLAZA_LAMP_COUNT } from '@/lib/spawn'
import { PALETTE } from '@/lib/palette'

const COLORS = [PALETTE.red, PALETTE.gold, PALETTE.teal, PALETTE.cream] as const
const PER_SPAN = 7
const WIRE_Y = 3.1
const SAG = 0.5

/** Triangular pennant garlands strung between consecutive plaza lamp posts. */
export default function Bunting() {
  const pennants = useMemo(() => {
    const out: { pos: [number, number, number]; color: string }[] = []
    for (let i = 0; i < PLAZA_LAMP_COUNT; i++) {
      const [ax, az] = LAMP_POSITIONS[i]
      const [bx, bz] = LAMP_POSITIONS[(i + 1) % PLAZA_LAMP_COUNT]
      for (let k = 1; k <= PER_SPAN; k++) {
        const t = k / (PER_SPAN + 1)
        // quadratic sag: 0 at the posts, SAG at midspan; drop half a pennant so it hangs below the line
        const y = WIRE_Y - SAG * 4 * t * (1 - t) - 0.2
        out.push({
          pos: [ax + (bx - ax) * t, y, az + (bz - az) * t],
          color: COLORS[out.length % COLORS.length],
        })
      }
    }
    return out
  }, [])

  return (
    <Instances limit={pennants.length}>
      <coneGeometry args={[0.16, 0.4, 4]} />
      <meshStandardMaterial roughness={0.9} />
      {pennants.map((p, i) => (
        <Instance key={i} position={p.pos} rotation={[Math.PI, 0, 0]} color={p.color} />
      ))}
    </Instances>
  )
}

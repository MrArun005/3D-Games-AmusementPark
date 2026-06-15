'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Instances, Instance } from '@react-three/drei'
import { CylinderCollider, RigidBody } from '@react-three/rapier'
import { TENT_POS, GATE_POS } from '@/lib/spawn'
import { PALETTE } from '@/lib/palette'
import { makeStripesTexture } from '@/lib/textures'

// Doorway faces the entrance gate so arriving players see the open flap.
const DOOR_ANGLE = Math.atan2(GATE_POS[0] - TENT_POS[0], GATE_POS[2] - TENT_POS[2])

const WALL_RADIUS = 6
const WALL_HEIGHT = 3
const ROOF_RADIUS = 7
const ROOF_HEIGHT = 5
const VALANCE_COUNT = 24

/** The big-top landmark: striped drum, swooping cone roof, finial flag and awning. */
export default function CircusTent() {
  const flag = useRef<THREE.Mesh>(null)

  const stripeTex = useMemo(() => {
    const t = makeStripesTexture(PALETTE.red, PALETTE.cream, 16)
    t.repeat.set(2, 1) // 32 stripes around the drum / radially down the roof
    return t
  }, [])
  const awningTex = useMemo(() => makeStripesTexture(PALETTE.red, PALETTE.cream, 8), [])

  // Swooping big-top profile: near-vertical at the peak, flaring wide at the rim.
  const roofPoints = useMemo(() => {
    const pts: THREE.Vector2[] = []
    for (let i = 0; i <= 9; i++) {
      const t = i / 9
      pts.push(new THREE.Vector2(ROOF_RADIUS * Math.pow(1 - t, 1.45), ROOF_HEIGHT * t))
    }
    return pts
  }, [])

  const flagGeo = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(0, 0)
    s.lineTo(0.85, -0.16)
    s.lineTo(0, -0.32)
    s.closePath()
    return new THREE.ShapeGeometry(s)
  }, [])

  const valanceAngles = useMemo(
    () => Array.from({ length: VALANCE_COUNT }, (_, i) => (i / VALANCE_COUNT) * Math.PI * 2),
    []
  )

  useFrame((state) => {
    if (flag.current) flag.current.rotation.z = Math.sin(state.clock.elapsedTime) * 0.1
  })

  return (
    <group position={TENT_POS}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[2, 6.2]} position={[0, 2, 0]} />
      </RigidBody>

      {/* striped canvas drum */}
      <mesh position={[0, WALL_HEIGHT / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[WALL_RADIUS, WALL_RADIUS, WALL_HEIGHT, 32, 1, true]} />
        <meshStandardMaterial map={stripeTex} side={THREE.DoubleSide} roughness={0.85} />
      </mesh>

      {/* swooping roof — stripes read as radial wedges on the lathe */}
      <mesh position={[0, WALL_HEIGHT, 0]} castShadow>
        <latheGeometry args={[roofPoints, 32]} />
        <meshStandardMaterial map={stripeTex} side={THREE.DoubleSide} roughness={0.8} />
      </mesh>

      {/* gold trim rings at the rim and the base */}
      <mesh position={[0, 2.95, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[6.95, 0.07, 8, 48]} />
        <meshStandardMaterial color={PALETTE.gold} metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[6.08, 0.06, 8, 48]} />
        <meshStandardMaterial color={PALETTE.gold} metalness={0.6} roughness={0.3} />
      </mesh>

      {/* scalloped valance skirt hanging from the roof rim */}
      <Instances limit={VALANCE_COUNT}>
        <coneGeometry args={[0.45, 0.55, 4]} />
        <meshStandardMaterial roughness={0.9} />
        {valanceAngles.map((a, i) => (
          <Instance
            key={i}
            position={[Math.cos(a) * 6.8, 2.78, Math.sin(a) * 6.8]}
            rotation={[Math.PI, 0, 0]}
            color={i % 2 ? PALETTE.cream : PALETTE.red}
          />
        ))}
      </Instances>

      {/* gold finial, pole and swaying pennant flag */}
      <mesh position={[0, 8.05, 0]}>
        <sphereGeometry args={[0.16, 12, 10]} />
        <meshStandardMaterial color={PALETTE.gold} metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 8.45, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.9, 6]} />
        <meshStandardMaterial color={PALETTE.gold} metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh ref={flag} geometry={flagGeo} position={[0.03, 8.86, 0]}>
        <meshStandardMaterial color={PALETTE.red} side={THREE.DoubleSide} roughness={0.8} />
      </mesh>

      {/* doorway + entry awning, rotated to face the gate */}
      <group rotation={[0, DOOR_ANGLE, 0]}>
        <mesh position={[0, 1.25, 6.08]}>
          <planeGeometry args={[1.9, 2.5]} />
          <meshStandardMaterial color="#0e1322" roughness={1} />
        </mesh>
        <mesh position={[0, 2.55, 6.85]} rotation={[-1.15, 0, 0]}>
          <planeGeometry args={[2.4, 1.5]} />
          <meshStandardMaterial map={awningTex} side={THREE.DoubleSide} roughness={0.85} />
        </mesh>
        {[-1.1, 1.1].map((x) => (
          <mesh key={x} position={[x, 1.12, 7.5]}>
            <cylinderGeometry args={[0.03, 0.03, 2.24, 6]} />
            <meshStandardMaterial color={PALETTE.gold} metalness={0.5} roughness={0.4} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

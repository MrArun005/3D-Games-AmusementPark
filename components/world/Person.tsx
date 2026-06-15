'use client'

import { BAZAAR } from '@/lib/palette'

/**
 * Static low-poly fairgoer with the cues that make a silhouette read as
 * human: separated legs, hanging (or raised) arms, shoulder-wide torso,
 * ellipsoid head with a hair cap — and for sarees, a draped pallu + bun.
 * Used for posed people at stalls and carts (the walking crowd is instanced).
 */
export default function Person({
  position,
  yaw,
  cloth,
  skin,
  saree,
  armRaised = false,
  pallu = '#f2a900',
}: {
  position: [number, number, number]
  yaw: number
  cloth: string
  skin: string
  saree: boolean
  armRaised?: boolean
  pallu?: string
}) {
  return (
    <group position={position} rotation-y={yaw}>
      {saree ? (
        <>
          <mesh position={[0, 0.43, 0]} castShadow>
            <coneGeometry args={[0.38, 0.86, 10]} />
            <meshStandardMaterial color={cloth} roughness={0.85} />
          </mesh>
          {/* pallu draped shoulder-to-hip */}
          <mesh position={[0.06, 1.08, 0.14]} rotation-z={0.5}>
            <boxGeometry args={[0.17, 0.62, 0.04]} />
            <meshStandardMaterial color={pallu} roughness={0.8} />
          </mesh>
          <mesh position={[0, 1.5, -0.12]}>
            <sphereGeometry args={[0.07, 8, 6]} />
            <meshStandardMaterial color={BAZAAR.hair} roughness={0.9} />
          </mesh>
        </>
      ) : (
        <>
          {[-0.09, 0.09].map((x) => (
            <mesh key={x} position={[x, 0.41, 0]}>
              <cylinderGeometry args={[0.06, 0.052, 0.74, 7]} />
              <meshStandardMaterial color="#3b332b" roughness={0.9} />
            </mesh>
          ))}
        </>
      )}

      {/* torso with shoulders (wider than deep) */}
      <mesh position={[0, 1.05, 0]} scale={[1.12, 1, 0.78]} castShadow>
        <capsuleGeometry args={[0.155, 0.42, 4, 10]} />
        <meshStandardMaterial color={cloth} roughness={0.8} />
      </mesh>

      {/* arms — one optionally raised mid-throw */}
      <mesh position={[-0.25, 1.04, 0]} rotation-z={0.1}>
        <cylinderGeometry args={[0.045, 0.04, 0.55, 6]} />
        <meshStandardMaterial color={cloth} roughness={0.8} />
      </mesh>
      {armRaised ? (
        <mesh position={[0.27, 1.39, 0.17]} rotation={[-1.05, 0, -0.35]}>
          <cylinderGeometry args={[0.045, 0.04, 0.55, 6]} />
          <meshStandardMaterial color={cloth} roughness={0.8} />
        </mesh>
      ) : (
        <mesh position={[0.25, 1.04, 0]} rotation-z={-0.1}>
          <cylinderGeometry args={[0.045, 0.04, 0.55, 6]} />
          <meshStandardMaterial color={cloth} roughness={0.8} />
        </mesh>
      )}

      {/* head + hair cap */}
      <mesh position={[0, 1.52, 0]} scale={[0.95, 1.1, 1]}>
        <sphereGeometry args={[0.135, 12, 10]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.57, -0.025]} scale={[1.02, 0.78, 1.02]}>
        <sphereGeometry args={[0.135, 12, 10]} />
        <meshStandardMaterial color={BAZAAR.hair} roughness={0.95} />
      </mesh>
    </group>
  )
}

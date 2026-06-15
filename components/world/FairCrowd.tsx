'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CapsuleCollider } from '@react-three/rapier'
import { useGameStore } from '@/state/useGameStore'
import { RIDE_LIST, GAME_STALLS, mulberry32 } from '@/lib/spawn'
import { BAZAAR } from '@/lib/palette'

const SAREE_COLORS = [
  BAZAAR.magenta, BAZAAR.marigold, BAZAAR.parrotGreen, BAZAAR.turquoise,
  BAZAAR.purple, BAZAAR.chilliRed, BAZAAR.yellow, BAZAAR.skyBlue,
]
const KURTA_COLORS = ['#f5f0e6', '#e8f2f5', '#f9e9d2', '#dcd2f0', '#e6f0dc', '#fdeef2']
const SKIN = [BAZAAR.skin1, BAZAAR.skin2, BAZAAR.skin3]
const HAIR = ['#1c1410', '#2b1c12', '#0f0c0a']

interface Stander {
  x: number
  z: number
  yaw: number
  saree: boolean
  s: number
  /** 'queue' just waits; 'play' has an arm raised (shooting/tossing). */
  play: boolean
  phase: number
}

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0)

/**
 * Stationary fairgoers: lines queueing at every ride counter and knots of
 * spectators/players at the game stalls — the thing that makes it feel like a
 * packed exhibition. Same instanced body-part approach as the walking Crowd,
 * but rooted in place with a subtle breathing/weight-shift idle. Players get a
 * raised arm; everyone faces what they're waiting for.
 */
export default function FairCrowd() {
  const skirts = useRef<THREE.InstancedMesh>(null)
  const torsos = useRef<THREE.InstancedMesh>(null)
  const legsL = useRef<THREE.InstancedMesh>(null)
  const legsR = useRef<THREE.InstancedMesh>(null)
  const armsL = useRef<THREE.InstancedMesh>(null)
  const armsR = useRef<THREE.InstancedMesh>(null)
  const heads = useRef<THREE.InstancedMesh>(null)
  const hairs = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const legGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.06, 0.052, 0.74, 7)
    g.translate(0, -0.37, 0)
    return g
  }, [])
  const armGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.045, 0.04, 0.55, 6)
    g.translate(0, -0.275, 0)
    return g
  }, [])

  const people = useMemo<Stander[]>(() => {
    const rnd = mulberry32(9090)
    const arr: Stander[] = []

    // A snaking queue leading up to each ride's ticket counter.
    for (const spec of RIDE_LIST) {
      const cx = spec.position[0] + spec.trigger.offset[0]
      const cz = spec.position[2] + spec.trigger.offset[2]
      const len = Math.hypot(cx, cz) || 1
      const dx = -cx / len // counter -> plaza centre
      const dz = -cz / len
      const px = -dz // perpendicular, for a little zig-zag width
      const pz = dx
      const n = 5 + Math.floor(rnd() * 3)
      for (let k = 0; k < n; k++) {
        const dist = 3 + k * 1.15
        const zig = (k % 2 ? 0.4 : -0.4) + (rnd() - 0.5) * 0.2
        const x = cx + dx * dist + px * zig
        const z = cz + dz * dist + pz * zig
        arr.push({
          x,
          z,
          yaw: Math.atan2(cx - x, cz - z), // face the counter
          saree: rnd() > 0.5,
          s: 0.9 + rnd() * 0.2,
          play: false,
          phase: rnd() * Math.PI * 2,
        })
      }
    }

    // (Game stalls are played from the front by the human player, so no
    // standing spectators are placed there — the approach stays clear.)
    return arr
  }, [])

  const count = people.length

  useLayoutEffect(() => {
    const rnd = mulberry32(313)
    const c = new THREE.Color()
    for (let i = 0; i < count; i++) {
      const p = people[i]
      const cloth = p.saree
        ? SAREE_COLORS[Math.floor(rnd() * SAREE_COLORS.length)]
        : KURTA_COLORS[Math.floor(rnd() * KURTA_COLORS.length)]
      c.set(cloth)
      skirts.current?.setColorAt(i, c)
      torsos.current?.setColorAt(i, c)
      armsL.current?.setColorAt(i, c)
      armsR.current?.setColorAt(i, c)
      c.set('#3b332b')
      legsL.current?.setColorAt(i, c)
      legsR.current?.setColorAt(i, c)
      c.set(SKIN[Math.floor(rnd() * SKIN.length)])
      heads.current?.setColorAt(i, c)
      c.set(HAIR[Math.floor(rnd() * HAIR.length)])
      hairs.current?.setColorAt(i, c)
    }
    for (const m of [skirts, torsos, legsL, legsR, armsL, armsR, heads, hairs]) {
      if (m.current?.instanceColor) m.current.instanceColor.needsUpdate = true
    }
  }, [count, people])

  useFrame((state) => {
    if (useGameStore.getState().paused) return
    const refs = {
      sk: skirts.current, to: torsos.current, ll: legsL.current, lr: legsR.current,
      al: armsL.current, ar: armsR.current, he: heads.current, ha: hairs.current,
    }
    if (Object.values(refs).some((m) => !m)) return
    const { sk, to, ll, lr, al, ar, he, ha } = refs as Record<string, THREE.InstancedMesh>
    const t = state.clock.elapsedTime

    for (let i = 0; i < count; i++) {
      const p = people[i]
      const s = p.s
      const breathe = Math.sin(t * 1.6 + p.phase) * 0.012
      const shift = Math.sin(t * 0.8 + p.phase) * 0.03 // weight shift
      const cy = Math.cos(p.yaw)
      const sy = Math.sin(p.yaw)
      const ox = (lx: number, lz: number) => p.x + (lx * cy + lz * sy) * s
      const oz = (lx: number, lz: number) => p.z + (-lx * sy + lz * cy) * s

      if (p.saree) {
        ll.setMatrixAt(i, ZERO)
        lr.setMatrixAt(i, ZERO)
        dummy.rotation.set(0, p.yaw, shift)
        dummy.scale.setScalar(s)
        dummy.position.set(p.x, 0.43 * s, p.z)
        dummy.updateMatrix()
        sk.setMatrixAt(i, dummy.matrix)
      } else {
        sk.setMatrixAt(i, ZERO)
        dummy.scale.setScalar(s)
        dummy.rotation.set(0, p.yaw, 0)
        dummy.position.set(ox(-0.09, 0), 0.74 * s, oz(-0.09, 0))
        dummy.updateMatrix()
        ll.setMatrixAt(i, dummy.matrix)
        dummy.position.set(ox(0.09, 0), 0.74 * s, oz(0.09, 0))
        dummy.updateMatrix()
        lr.setMatrixAt(i, dummy.matrix)
      }

      // arms — players raise the right arm toward the target
      dummy.scale.setScalar(s)
      dummy.rotation.set(0.05, p.yaw, 0.1, 'YXZ')
      dummy.position.set(ox(-0.245, 0), (1.3 + breathe) * s, oz(-0.245, 0))
      dummy.updateMatrix()
      al.setMatrixAt(i, dummy.matrix)
      if (p.play) {
        dummy.rotation.set(-1.15, p.yaw, -0.2, 'YXZ')
        dummy.position.set(ox(0.245, 0.05), (1.42 + breathe) * s, oz(0.245, 0.05))
      } else {
        dummy.rotation.set(0.05, p.yaw, -0.1, 'YXZ')
        dummy.position.set(ox(0.245, 0), (1.3 + breathe) * s, oz(0.245, 0))
      }
      dummy.updateMatrix()
      ar.setMatrixAt(i, dummy.matrix)

      // torso, head, hair
      dummy.rotation.set(0, p.yaw, shift)
      dummy.scale.set(1.12 * s, 1 * s, 0.78 * s)
      dummy.position.set(p.x, (1.05 + breathe) * s, p.z)
      dummy.updateMatrix()
      to.setMatrixAt(i, dummy.matrix)
      dummy.rotation.set(0, p.yaw, 0)
      dummy.scale.set(0.95 * s, 1.1 * s, 1 * s)
      dummy.position.set(p.x, (1.52 + breathe) * s, p.z)
      dummy.updateMatrix()
      he.setMatrixAt(i, dummy.matrix)
      dummy.scale.set(1.02 * s, 0.78 * s, 1.02 * s)
      dummy.position.set(ox(0, -0.025), (1.57 + breathe) * s, oz(0, -0.025))
      dummy.updateMatrix()
      ha.setMatrixAt(i, dummy.matrix)
    }
    for (const m of [sk, to, ll, lr, al, ar, he, ha]) m.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {people.map((p, i) => (
          <CapsuleCollider key={i} args={[0.5 * p.s, 0.32 * p.s]} position={[p.x, 0.85 * p.s, p.z]} />
        ))}
      </RigidBody>
      <instancedMesh ref={skirts} args={[undefined, undefined, count]} castShadow>
        <coneGeometry args={[0.38, 0.86, 10]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={torsos} args={[undefined, undefined, count]} castShadow>
        <capsuleGeometry args={[0.155, 0.42, 4, 10]} />
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={legsL} args={[undefined, undefined, count]} geometry={legGeo}>
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={legsR} args={[undefined, undefined, count]} geometry={legGeo}>
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={armsL} args={[undefined, undefined, count]} geometry={armGeo}>
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={armsR} args={[undefined, undefined, count]} geometry={armGeo}>
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, count]}>
        <sphereGeometry args={[0.135, 12, 10]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={hairs} args={[undefined, undefined, count]}>
        <sphereGeometry args={[0.135, 12, 10]} />
        <meshStandardMaterial roughness={0.95} />
      </instancedMesh>
    </group>
  )
}

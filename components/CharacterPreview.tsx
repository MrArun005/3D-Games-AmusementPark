'use client'

import { Suspense, useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import {
  buildCharacter, findClip, CHARACTER_MODELS, CHARACTER_URLS, type CharacterConfig,
} from '@/lib/characters'

function Model({ config }: { config: CharacterConfig }) {
  const url = CHARACTER_MODELS[config.model].url
  const { scene, animations } = useGLTF(url)
  const built = useMemo(() => buildCharacter(scene, config), [scene, config])
  const group = useRef<THREE.Group>(null)
  const { actions, mixer } = useAnimations(animations, group)
  useEffect(() => {
    const idle = findClip(animations, 'Idle') ?? animations[0]
    const a = idle ? actions[idle.name] : Object.values(actions)[0]
    a?.reset().play()
    return () => { mixer.stopAllAction() }
  }, [actions, animations, mixer, built])
  useFrame((_, dt) => { if (group.current) group.current.rotation.y += dt * 0.6 })
  return <group ref={group}><primitive object={built} /></group>
}

/** A small turntable preview of one character config; used inside CharacterCreator. */
export default function CharacterPreview({ config }: { config: CharacterConfig }) {
  return (
    <Canvas camera={{ fov: 35, position: [0, 1.4, 3.4] }} style={{ width: '100%', height: '100%' }}>
      <color attach="background" args={['#241a2e']} />
      <hemisphereLight intensity={1.1} />
      <directionalLight position={[3, 5, 2]} intensity={1.4} />
      <Suspense fallback={null}>
        <group position={[0, -0.9, 0]}><Model config={config} /></group>
      </Suspense>
    </Canvas>
  )
}

CHARACTER_URLS.forEach((u) => useGLTF.preload(u))

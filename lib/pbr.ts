import { useMemo } from 'react'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'

export interface PbrSet { dir: string; color: string; normal: string; rough: string }

/** Filenames are the exact CC0 ambientCG files downloaded in Realism Task 1. */
export const PBR_SETS: Record<'grass' | 'paving' | 'dirt', PbrSet> = {
  grass:  { dir: '/textures/grass',  color: 'Grass004_1K-JPG_Color.jpg',  normal: 'Grass004_1K-JPG_NormalGL.jpg',  rough: 'Grass004_1K-JPG_Roughness.jpg' },
  paving: { dir: '/textures/paving', color: 'PavingStones070_1K-JPG_Color.jpg', normal: 'PavingStones070_1K-JPG_NormalGL.jpg', rough: 'PavingStones070_1K-JPG_Roughness.jpg' },
  dirt:   { dir: '/textures/dirt',   color: 'Ground054_1K-JPG_Color.jpg',   normal: 'Ground054_1K-JPG_NormalGL.jpg',   rough: 'Ground054_1K-JPG_Roughness.jpg' },
}

/**
 * Build a tiling PBR MeshStandardMaterial from a CC0 set. Albedo is sRGB; the
 * normal/roughness data maps stay linear. Textures are cloned per-call so the
 * `repeat` of one surface never mutates another sharing the same files.
 */
export function usePbrMaterial(
  set: PbrSet,
  repeat: [number, number],
  extra?: THREE.MeshStandardMaterialParameters,
): THREE.MeshStandardMaterial {
  const [map, normalMap, roughnessMap] = useTexture([
    `${set.dir}/${set.color}`, `${set.dir}/${set.normal}`, `${set.dir}/${set.rough}`,
  ])
  return useMemo(() => {
    const m = map.clone(), n = normalMap.clone(), r = roughnessMap.clone()
    for (const t of [m, n, r]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(repeat[0], repeat[1])
      t.anisotropy = 8
      t.needsUpdate = true
    }
    m.colorSpace = THREE.SRGBColorSpace
    return new THREE.MeshStandardMaterial({ map: m, normalMap: n, roughnessMap: r, ...extra })
  }, [map, normalMap, roughnessMap, repeat, extra])
}

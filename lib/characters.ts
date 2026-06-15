import * as THREE from 'three'
import { SkeletonUtils } from 'three-stdlib'
import { BAZAAR } from '@/lib/palette'

export interface CharacterModel { url: string; label: string; sex: 'm' | 'f' }

/** The 6 CC0 civilian models (single skinned mesh each). Order is the picker order. */
export const CHARACTER_MODELS: CharacterModel[] = [
  { url: '/models/characters/civilian_casual.glb', label: 'Casual', sex: 'm' },
  { url: '/models/characters/civilian_man.glb', label: 'Everyday', sex: 'm' },
  { url: '/models/characters/civilian_longsleeve.glb', label: 'Long-sleeve', sex: 'm' },
  { url: '/models/characters/civilian_suit.glb', label: 'Suit', sex: 'm' },
  { url: '/models/characters/civilian_woman.glb', label: 'Woman', sex: 'f' },
  { url: '/models/characters/civilian_woman2.glb', label: 'Woman II', sex: 'f' },
]

export const CHARACTER_URLS: string[] = CHARACTER_MODELS.map((m) => m.url)

/**
 * Accent tints layered LIGHTLY over the base look for subtle per-person variety.
 * Index 0 is "none" (white = identity multiply) and is the default.
 */
export const ACCENT_COLORS: string[] = [
  '#ffffff', BAZAAR.magenta, BAZAAR.marigold, BAZAAR.parrotGreen, BAZAAR.turquoise,
  BAZAAR.purple, BAZAAR.chilliRed, BAZAAR.skyBlue, '#e8e2d2', '#cdd6e0',
]

export interface CharacterConfig {
  model: number   // index into CHARACTER_MODELS
  accent: number  // index into ACCENT_COLORS (0 = no tint)
  scale: number   // 0.9..1.2 typical
  name?: string
}

export const defaultConfig = (): CharacterConfig => ({ model: 0, accent: 0, scale: 1 })

/** Deterministic varied NPC config from a seeded PRNG (see mulberry32 in spawn.ts). */
export function randomConfig(rnd: () => number): CharacterConfig {
  return {
    model: Math.floor(rnd() * CHARACTER_MODELS.length),
    accent: Math.floor(rnd() * ACCENT_COLORS.length),
    scale: 0.9 + rnd() * 0.3,
  }
}

/** Find a clip by action suffix — handles "HumanArmature|Man_Idle"/"...Female_Walk". */
export function findClip(
  animations: THREE.AnimationClip[],
  action: 'Idle' | 'Walk' | 'Run' | 'Sitting',
): THREE.AnimationClip | undefined {
  const re = new RegExp(action + '$', 'i')
  return animations.find((a) => re.test(a.name))
}

/** Build a configured, independent clone. Implemented for real in Task 3. */
export function buildCharacter(_source: THREE.Object3D, _config: CharacterConfig): THREE.Object3D {
  throw new Error('buildCharacter not implemented yet (Task 3)')
}

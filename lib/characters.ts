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

/** Standing height in metres at config.scale === 1 (a touch under the ~1.8 m player capsule). */
export const TARGET_HEIGHT = 1.7
/** Measured rendered height of these models at their baked scale (~4.8 m, see scripts). */
const MODEL_RAW_HEIGHT = 4.8
/** Fixed factor that brings the pack's giant default size down to human height. */
const BASE_SCALE = TARGET_HEIGHT / MODEL_RAW_HEIGHT // ≈ 0.354

/**
 * Build a configured, independent clone scaled to human height. The pack renders
 * at ~4.8 m tall by default, so we apply a fixed BASE_SCALE (no runtime measuring —
 * that proved unreliable on the skinned clones). The model's origin already sits
 * at the feet, so a caller's `position.set(x, 0, z)` grounds it. Wrapped in a group
 * so props the caller attaches (e.g. a balloon) stay at world scale above the head.
 */
export function buildCharacter(source: THREE.Object3D, config: CharacterConfig): THREE.Object3D {
  const model = SkeletonUtils.clone(source)
  const tint = config.accent > 0
    ? new THREE.Color('#ffffff').lerp(new THREE.Color(ACCENT_COLORS[config.accent]), 0.28)
    : null
  model.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.castShadow = true
    m.frustumCulled = false // skinned bounds lag the body; never pop out (matches Crowd/PlayerAvatar)
    // Clone the material so per-instance tints never bleed across clones.
    const mat = (m.material as THREE.MeshStandardMaterial).clone()
    if (tint) mat.color.multiply(tint)
    m.material = mat
  })
  model.scale.setScalar(config.scale * BASE_SCALE)

  const wrapper = new THREE.Group()
  wrapper.add(model)
  return wrapper
}

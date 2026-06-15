import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  randomConfig, defaultConfig, findClip,
  CHARACTER_MODELS, ACCENT_COLORS, type CharacterConfig,
} from '@/lib/characters'
import { mulberry32 } from '@/lib/spawn'

const inBounds = (c: CharacterConfig) => {
  expect(c.model).toBeGreaterThanOrEqual(0)
  expect(c.model).toBeLessThan(CHARACTER_MODELS.length)
  expect(c.accent).toBeGreaterThanOrEqual(0)
  expect(c.accent).toBeLessThan(ACCENT_COLORS.length)
  expect(c.scale).toBeGreaterThan(0.5)
  expect(c.scale).toBeLessThan(1.6)
}

describe('randomConfig', () => {
  it('is deterministic for a given seed', () => {
    expect(randomConfig(mulberry32(42))).toEqual(randomConfig(mulberry32(42)))
  })
  it('produces in-bounds configs for many seeds', () => {
    for (let s = 0; s < 200; s++) inBounds(randomConfig(mulberry32(s)))
  })
  it('defaultConfig is in bounds', () => inBounds(defaultConfig()))
})

describe('findClip', () => {
  const clips = [
    new THREE.AnimationClip('HumanArmature|Man_Idle', 1, []),
    new THREE.AnimationClip('HumanArmature|Man_Walk', 1, []),
    new THREE.AnimationClip('HumanArmature|Female_Walk', 1, []),
  ]
  it('matches by suffix regardless of sex prefix', () => {
    expect(findClip(clips, 'Idle')?.name).toBe('HumanArmature|Man_Idle')
    expect(findClip([clips[2]], 'Walk')?.name).toBe('HumanArmature|Female_Walk')
  })
  it('returns undefined when no clip matches', () => {
    expect(findClip(clips, 'Sitting')).toBeUndefined()
  })
})

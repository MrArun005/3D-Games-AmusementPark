import { create } from 'zustand'
import { defaultConfig, type CharacterConfig } from '@/lib/characters'

const KEY = 'fableland-avatar'

export function loadAvatar(): CharacterConfig | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as CharacterConfig) : null
  } catch {
    return null
  }
}

export function saveAvatar(cfg: CharacterConfig): void {
  try { localStorage.setItem(KEY, JSON.stringify(cfg)) } catch { /* private mode: ignore */ }
}

interface AvatarState {
  config: CharacterConfig
  hasOnboarded: boolean
  /** revision counter — bump to force avatar/preview rebuilds without per-frame state */
  rev: number
  setConfig: (cfg: CharacterConfig) => void
  finishOnboarding: (cfg: CharacterConfig) => void
}

const initial = loadAvatar()

export const useAvatarStore = create<AvatarState>((set) => ({
  config: initial ?? defaultConfig(),
  hasOnboarded: initial !== null,
  rev: 0,
  setConfig: (cfg) => { saveAvatar(cfg); set((s) => ({ config: cfg, rev: s.rev + 1 })) },
  finishOnboarding: (cfg) => { saveAvatar(cfg); set((s) => ({ config: cfg, hasOnboarded: true, rev: s.rev + 1 })) },
}))

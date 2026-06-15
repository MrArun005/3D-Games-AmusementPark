import { describe, it, expect, beforeEach, vi } from 'vitest'

const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  })
})

describe('avatar persistence', () => {
  it('round-trips a config through save/load', async () => {
    const { saveAvatar, loadAvatar } = await import('@/state/useAvatarStore')
    const cfg = { model: 3, accent: 2, scale: 1.1, name: 'Arun' }
    saveAvatar(cfg)
    expect(loadAvatar()).toEqual(cfg)
  })
  it('loadAvatar returns null when nothing is stored', async () => {
    const { loadAvatar } = await import('@/state/useAvatarStore')
    expect(loadAvatar()).toBeNull()
  })
})

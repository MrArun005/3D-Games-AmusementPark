'use client'

import { useEffect, useState } from 'react'
import { useAvatarStore } from '@/state/useAvatarStore'
import { requestPointerLock } from '@/lib/refs'
import { CHARACTER_MODELS, ACCENT_COLORS, defaultConfig, type CharacterConfig } from '@/lib/characters'
import CharacterPreview from '@/components/CharacterPreview'

/** Cross-component flag (no per-frame state) for "open the editor from the pause menu". */
export const creatorControl = { open: () => {} }

function Swatch({ colors, value, onChange }: { colors: string[]; value: number; onChange: (i: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {colors.map((c, i) => (
        <button key={c + i} onClick={() => onChange(i)}
          className={`h-7 w-7 rounded-full border-2 transition ${i === value ? 'border-[#ffd23f] scale-110' : 'border-black/20'}`}
          style={{ background: c === '#ffffff' ? 'repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%)' : c }}
          title={c === '#ffffff' ? 'No tint' : c} />
      ))}
    </div>
  )
}

function Stepper({ label, value, count, display, onChange }: { label: string; value: number; count: number; display: string; onChange: (i: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-semibold">{label}</span>
      <div className="flex items-center gap-2">
        <button onClick={() => onChange((value - 1 + count) % count)} className="h-7 w-7 rounded-full border-2 border-[#8e0c20]/40 font-bold">‹</button>
        <span className="w-24 text-center text-sm">{display}</span>
        <button onClick={() => onChange((value + 1) % count)} className="h-7 w-7 rounded-full border-2 border-[#8e0c20]/40 font-bold">›</button>
      </div>
    </div>
  )
}

export default function CharacterCreator() {
  const hasOnboarded = useAvatarStore((s) => s.hasOnboarded)
  const saved = useAvatarStore((s) => s.config)
  const finishOnboarding = useAvatarStore((s) => s.finishOnboarding)
  const setConfig = useAvatarStore((s) => s.setConfig)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<CharacterConfig>(saved ?? defaultConfig())

  useEffect(() => { creatorControl.open = () => { setDraft(useAvatarStore.getState().config); setEditing(true) } }, [])

  const open = !hasOnboarded || editing
  if (!open) return null
  const set = (patch: Partial<CharacterConfig>) => setDraft((d) => ({ ...d, ...patch }))

  const confirm = () => {
    if (hasOnboarded) { setConfig(draft); setEditing(false) }
    else finishOnboarding(draft)
    requestPointerLock()
  }

  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="flex w-[46rem] max-w-[95vw] overflow-hidden rounded-lg border-4 border-[#8e0c20] bg-[#fff3dc] font-[Georgia,'Times_New_Roman',serif] text-[#8e0c20] shadow-2xl">
        <div className="h-[26rem] w-[18rem] shrink-0 bg-[#241a2e]"><CharacterPreview config={draft} /></div>
        <div className="flex-1 p-6">
          <h1 className="text-center text-2xl font-extrabold uppercase tracking-[0.12em]">{hasOnboarded ? 'Edit Your Look' : 'Create Your Character'}</h1>
          <div className="mx-auto mt-2 h-0.5 w-32 bg-[#f2a900]" />
          <div className="mt-4 space-y-3">
            <Stepper label="Character" value={draft.model} count={CHARACTER_MODELS.length}
              display={CHARACTER_MODELS[draft.model].label} onChange={(i) => set({ model: i })} />
            <div><div className="mb-1 text-sm font-semibold">Accent</div><Swatch colors={ACCENT_COLORS} value={draft.accent} onChange={(i) => set({ accent: i })} /></div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Height</span>
              <input type="range" min={0.9} max={1.2} step={0.01} value={draft.scale}
                onChange={(e) => set({ scale: Number(e.target.value) })} className="w-40" />
            </div>
            <input value={draft.name ?? ''} onChange={(e) => set({ name: e.target.value.slice(0, 16) })} placeholder="Name (optional)"
              className="w-full rounded-md border-2 border-[#8e0c20]/40 bg-white/60 px-3 py-1.5 text-sm" />
          </div>
          {!hasOnboarded && (
            <p className="mt-3 text-center text-xs italic text-[#8e0c20]/70">WASD move · Mouse look · E ride/buy · V view · Esc pause</p>
          )}
          <button onClick={confirm} className="mt-4 w-full rounded-md border-2 border-[#f2a900] bg-[#c8102e] py-3 font-bold uppercase tracking-widest text-[#ffd23f] shadow-md transition hover:bg-[#8e0c20]">
            {hasOnboarded ? 'Save' : 'Enter the Park'}
          </button>
        </div>
      </div>
    </div>
  )
}

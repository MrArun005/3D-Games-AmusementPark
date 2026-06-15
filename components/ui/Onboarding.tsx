'use client'

import { useEffect, useState } from 'react'
import { requestPointerLock } from '@/lib/refs'

const KEY = 'fableland-onboarded'

/** First-visit card explaining the controls; dismiss starts pointer lock. */
export default function Onboarding() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!window.localStorage.getItem(KEY)) setShow(true)
  }, [])

  if (!show) return null

  const enter = () => {
    window.localStorage.setItem(KEY, '1')
    setShow(false)
    requestPointerLock()
  }

  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-[30rem] max-w-[92vw] overflow-hidden rounded-lg border-4 border-[#8e0c20] bg-[#fff3dc] font-[Georgia,'Times_New_Roman',serif] text-[#8e0c20] shadow-2xl">
        <div className="h-4 bg-[repeating-linear-gradient(45deg,#c8102e_0_12px,#fff3dc_12px_24px)]" />

        <div className="p-7">
          <div className="text-center text-xs font-bold uppercase tracking-[0.35em] text-[#c8102e]">
            🎡 Mysuru Exhibition 🎡
          </div>
          <h1 className="mt-1 text-center text-4xl font-extrabold uppercase tracking-[0.12em]">
            Step Right Up!
          </h1>
          <div className="mx-auto mt-2 h-0.5 w-32 bg-[#f2a900]" />
          <p className="mt-3 text-center italic text-[#8e0c20]/80">
            Explore the park, claim tickets at the booth, and hop on all six rides.
          </p>

          <div className="mt-5 rounded-md border-2 border-[#8e0c20]/40 bg-[#fff3dc] p-4">
            <div className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-[#8e0c20]/70">
              — Playbill of Controls —
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-[#8e0c20]/90">
              <span><b className="text-[#c8102e]">WASD</b> — move</span>
              <span><b className="text-[#c8102e]">Mouse</b> — look</span>
              <span><b className="text-[#c8102e]">Shift</b> — sprint</span>
              <span><b className="text-[#c8102e]">Space</b> — jump</span>
              <span><b className="text-[#c8102e]">E</b> — ride / buy tickets</span>
              <span><b className="text-[#c8102e]">V</b> — camera view</span>
              <span><b className="text-[#c8102e]">M</b> — mute</span>
              <span><b className="text-[#c8102e]">Esc</b> — pause</span>
            </div>
          </div>

          <button
            onClick={enter}
            className="mt-6 w-full rounded-md border-2 border-[#f2a900] bg-[#c8102e] py-3 text-lg font-bold uppercase tracking-widest text-[#ffd23f] shadow-md transition hover:bg-[#8e0c20]"
          >
            Enter the Park
          </button>
        </div>

        <div className="h-4 bg-[repeating-linear-gradient(45deg,#c8102e_0_12px,#fff3dc_12px_24px)]" />
      </div>
    </div>
  )
}

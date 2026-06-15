'use client'

import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useControls } from 'leva'
import { useGameStore } from '@/state/useGameStore'
import { RIDES, GAME_STALL_BY_ID, PHOTO_SHOTS } from '@/lib/spawn'
import { parkAudio } from '@/lib/audio'
import { useShooting, useRingToss } from '@/lib/minigame'
import { useFestival } from '@/lib/festival'
import { playerRig, look } from '@/lib/refs'
import { crowdAgents } from '@/lib/crowd'
import { bindKeys } from '@/components/Player/useControls'

/**
 * Frame-level systems that aren't tied to a mesh: the in-game clock, the
 * audio engine, global key bindings (E interact, V view, M mute, Esc) and
 * the leva dev panel.
 */
export default function GameSystems() {
  const muted = useGameStore((s) => s.muted)

  useControls('Park (dev)', {
    timeScale: {
      value: 1,
      min: 0,
      max: 40,
      step: 0.5,
      onChange: (v: number) => useGameStore.getState().setTimeScale(v),
    },
  })

  useEffect(() => {
    parkAudio.setMuted(muted)
  }, [muted])

  useEffect(() => {
    // Dev/debug handle so boarding can be exercised from the console or tests.
    if (process.env.NODE_ENV === 'development') {
      ;(window as unknown as { __park?: object }).__park = { store: useGameStore, rig: playerRig, shooting: useShooting, ringtoss: useRingToss, look, agents: crowdAgents, festival: useFestival }
    }
  }, [])

  useEffect(() => {
    const unbind = bindKeys()
    // Audio contexts may only start after a user gesture.
    const onFirstPointer = () => parkAudio.init()
    window.addEventListener('pointerdown', onFirstPointer)

    const onKey = (e: KeyboardEvent) => {
      const st = useGameStore.getState()
      if (e.code === 'KeyM') st.toggleMuted()
      // V works everywhere except photo mode — including on rides & in games
      if (e.code === 'KeyV' && !st.photoMode && !st.shopMenu) st.toggleView()
      if (e.code === 'KeyP' && !st.activeRide && !st.activeStall && !st.shopMenu && !st.paused) {
        const entering = !st.photoMode
        st.togglePhotoMode()
        if (entering) document.exitPointerLock()
        else playerRig.canvas?.requestPointerLock()
      }
      if (st.photoMode) {
        const n = PHOTO_SHOTS.length
        if (e.code === 'ArrowRight') st.setPhotoShot((st.photoShot + 1) % n)
        if (e.code === 'ArrowLeft') st.setPhotoShot((st.photoShot - 1 + n) % n)
      }
      if (e.code === 'KeyG' && useFestival.getState().phase === 'idle' && !st.activeRide && !st.activeStall && !st.shopMenu && !st.photoMode) {
        useFestival.getState().start()
      }
      if (e.code === 'Escape' && st.shopMenu) {
        st.closeShop()
        playerRig.canvas?.requestPointerLock()
      } else if (e.code === 'Escape' && st.paused) st.setPaused(false)
      if (e.code === 'KeyE' && !st.activeRide && !st.activeStall && !st.shopMenu && !st.paused) {
        if (st.nearbyRide) {
          const spec = RIDES[st.nearbyRide]
          if (st.spendTickets(spec.cost)) {
            st.setActiveRide(spec.id)
            // Release the mouse so the in-ride overlay buttons are clickable.
            document.exitPointerLock()
          }
        } else if (st.nearbyStall) {
          const stall = GAME_STALL_BY_ID[st.nearbyStall]
          if (st.spendTickets(stall.cost)) {
            st.setActiveStall(stall.id)
            if (stall.id === 'shooting') useShooting.getState().start()
            else if (stall.id === 'ringtoss') useRingToss.getState().start()
            // Keep the pointer locked so the mouse aims and clicks throw/shoot.
            playerRig.canvas?.requestPointerLock()
          }
        } else if (st.nearbyShop) {
          // open the buy menu; free the pointer so the menu is clickable
          st.openShop(st.nearbyShop)
          document.exitPointerLock()
        } else if (st.nearbyBooth) {
          st.claimDaily()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      unbind()
      window.removeEventListener('pointerdown', onFirstPointer)
      window.removeEventListener('keydown', onKey)
      parkAudio.dispose()
    }
  }, [])

  useFrame((_, dt) => {
    const st = useGameStore.getState()
    if (!st.paused) st.advanceTime(Math.min(dt, 0.1))
    parkAudio.update(st.playerPos.x, st.playerPos.z)
  })

  return null
}

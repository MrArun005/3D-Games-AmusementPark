import { RIDES, TENT_POS } from '@/lib/spawn'
import { coasterTelemetry } from '@/lib/refs'

/**
 * Fully synthesized "Mysuru exhibition" soundscape — zero audio assets:
 *  - crowd walla (noise rumble + an LFO-wobbled chatter band, like shifting voices)
 *  - a dhol drum loop by the big top, a nasal double-reed fair melody by the carousel
 *  - random street events: bicycle bells, auto horns, vendor whistles, panned around
 *  - the coaster rattle, driven by train speed
 * Positional sources fall off with squared distance (what PositionalAudio would do).
 * Created lazily on the first user gesture to respect autoplay rules.
 */
class ParkAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private melodyGain: GainNode | null = null
  private dholGain: GainNode | null = null
  private coasterGain: GainNode | null = null
  private noiseBuf: AudioBuffer | null = null
  private timers: number[] = []
  private muted = false

  init(): void {
    if (this.ctx) {
      void this.ctx.resume()
      return
    }
    const ctx = new AudioContext()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 0.5
    this.master.connect(ctx.destination)

    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.4
    this.noiseBuf = noiseBuf

    // --- crowd walla: low rumble + voice-band chatter whose center wobbles ---
    const rumbleSrc = ctx.createBufferSource()
    rumbleSrc.buffer = noiseBuf
    rumbleSrc.loop = true
    const rumbleFilter = ctx.createBiquadFilter()
    rumbleFilter.type = 'lowpass'
    rumbleFilter.frequency.value = 320
    const rumbleGain = ctx.createGain()
    rumbleGain.gain.value = 0.1
    rumbleSrc.connect(rumbleFilter)
    rumbleFilter.connect(rumbleGain)
    rumbleGain.connect(this.master)
    rumbleSrc.start()

    const chatterSrc = ctx.createBufferSource()
    chatterSrc.buffer = noiseBuf
    chatterSrc.loop = true
    const chatterFilter = ctx.createBiquadFilter()
    chatterFilter.type = 'bandpass'
    chatterFilter.frequency.value = 550
    chatterFilter.Q.value = 1.5
    const wobble = ctx.createOscillator()
    wobble.frequency.value = 0.13
    const wobbleDepth = ctx.createGain()
    wobbleDepth.gain.value = 200 // 550 ± 200 Hz — drifting voice formants
    wobble.connect(wobbleDepth)
    wobbleDepth.connect(chatterFilter.frequency)
    wobble.start()
    const chatterGain = ctx.createGain()
    chatterGain.gain.value = 0.07
    chatterSrc.connect(chatterFilter)
    chatterFilter.connect(chatterGain)
    chatterGain.connect(this.master)
    chatterSrc.start()

    // --- coaster rattle ---
    const rattleSrc = ctx.createBufferSource()
    rattleSrc.buffer = noiseBuf
    rattleSrc.loop = true
    const rattleFilter = ctx.createBiquadFilter()
    rattleFilter.type = 'bandpass'
    rattleFilter.frequency.value = 140
    this.coasterGain = ctx.createGain()
    this.coasterGain.gain.value = 0
    rattleSrc.connect(rattleFilter)
    rattleFilter.connect(this.coasterGain)
    this.coasterGain.connect(this.master)
    rattleSrc.start()

    // --- dhol loop by the big top ---
    this.dholGain = ctx.createGain()
    this.dholGain.gain.value = 0
    this.dholGain.connect(this.master)
    this.scheduleDhol()

    // --- fair melody (nasal double-reed feel) by the carousel ---
    this.melodyGain = ctx.createGain()
    this.melodyGain.gain.value = 0
    this.melodyGain.connect(this.master)
    this.scheduleMelody()

    // --- scattered street events ---
    this.queueRandomEvent()
  }

  /** 8-step dhol pattern at ~115 BPM, scheduled slightly ahead of time. */
  private scheduleDhol(): void {
    const STEP = 0.26
    const pattern: ('dha' | 'ti' | null)[] = ['dha', 'ti', 'dha', 'dha', 'ti', 'dha', 'ti', 'ti']
    let step = 0
    let nextAt = (this.ctx?.currentTime ?? 0) + 0.2
    const tick = () => {
      const ctx = this.ctx
      const out = this.dholGain
      if (!ctx || !out) return
      while (nextAt < ctx.currentTime + 0.6) {
        const hit = pattern[step % pattern.length]
        if (hit === 'dha' && this.noiseBuf) {
          const thump = ctx.createOscillator()
          thump.type = 'sine'
          thump.frequency.setValueAtTime(80, nextAt)
          thump.frequency.exponentialRampToValueAtTime(55, nextAt + 0.1)
          const env = ctx.createGain()
          env.gain.setValueAtTime(0.55, nextAt)
          env.gain.exponentialRampToValueAtTime(0.001, nextAt + 0.14)
          thump.connect(env)
          env.connect(out)
          thump.start(nextAt)
          thump.stop(nextAt + 0.16)
          const skin = ctx.createBufferSource()
          skin.buffer = this.noiseBuf
          const lp = ctx.createBiquadFilter()
          lp.type = 'lowpass'
          lp.frequency.value = 220
          const skinEnv = ctx.createGain()
          skinEnv.gain.setValueAtTime(0.3, nextAt)
          skinEnv.gain.exponentialRampToValueAtTime(0.001, nextAt + 0.1)
          skin.connect(lp)
          lp.connect(skinEnv)
          skinEnv.connect(out)
          skin.start(nextAt)
          skin.stop(nextAt + 0.12)
        } else if (hit === 'ti' && this.noiseBuf) {
          const tickSrc = ctx.createBufferSource()
          tickSrc.buffer = this.noiseBuf
          const bp = ctx.createBiquadFilter()
          bp.type = 'bandpass'
          bp.frequency.value = 2000
          bp.Q.value = 2
          const env = ctx.createGain()
          env.gain.setValueAtTime(0.22, nextAt)
          env.gain.exponentialRampToValueAtTime(0.001, nextAt + 0.05)
          tickSrc.connect(bp)
          bp.connect(env)
          env.connect(out)
          tickSrc.start(nextAt)
          tickSrc.stop(nextAt + 0.06)
        }
        step++
        nextAt += STEP
      }
    }
    this.timers.push(window.setInterval(tick, 200))
  }

  /** Looping pentatonic phrase with vibrato and small glides between notes. */
  private scheduleMelody(): void {
    const NOTES = [587.33, 659.25, 783.99, 880, 1046.5, 880, 783.99, 659.25]
    const NOTE_LEN = 0.45
    let step = 0
    let nextAt = (this.ctx?.currentTime ?? 0) + 0.3
    const tick = () => {
      const ctx = this.ctx
      const out = this.melodyGain
      if (!ctx || !out) return
      while (nextAt < ctx.currentTime + 0.8) {
        const f = NOTES[step % NOTES.length]
        const next = NOTES[(step + 1) % NOTES.length]
        const osc = ctx.createOscillator()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(f, nextAt)
        osc.frequency.setValueAtTime(f, nextAt + NOTE_LEN - 0.08)
        osc.frequency.linearRampToValueAtTime(next, nextAt + NOTE_LEN) // glide into the next note
        const vibrato = ctx.createOscillator()
        vibrato.frequency.value = 5.5
        const vibratoDepth = ctx.createGain()
        vibratoDepth.gain.value = 9
        vibrato.connect(vibratoDepth)
        vibratoDepth.connect(osc.frequency)
        const reed = ctx.createBiquadFilter()
        reed.type = 'bandpass'
        reed.frequency.value = 1200
        reed.Q.value = 1.2
        const env = ctx.createGain()
        env.gain.setValueAtTime(0.0001, nextAt)
        env.gain.exponentialRampToValueAtTime(0.18, nextAt + 0.04)
        env.gain.setValueAtTime(0.18, nextAt + NOTE_LEN - 0.06)
        env.gain.exponentialRampToValueAtTime(0.001, nextAt + NOTE_LEN)
        osc.connect(reed)
        reed.connect(env)
        env.connect(out)
        osc.start(nextAt)
        osc.stop(nextAt + NOTE_LEN + 0.02)
        vibrato.start(nextAt)
        vibrato.stop(nextAt + NOTE_LEN + 0.02)
        step++
        nextAt += NOTE_LEN
      }
    }
    this.timers.push(window.setInterval(tick, 250))
  }

  /** Bicycle bells, auto horns and vendor whistles, scattered around the player. */
  private queueRandomEvent(): void {
    const delay = 5000 + Math.random() * 9000
    this.timers.push(
      window.setTimeout(() => {
        this.fireRandomEvent()
        this.queueRandomEvent()
      }, delay)
    )
  }

  private fireRandomEvent(): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    const t = ctx.currentTime + 0.05
    const pan = ctx.createStereoPanner()
    pan.pan.value = Math.random() * 2 - 1
    const out = ctx.createGain()
    out.gain.value = 0.05 + Math.random() * 0.13
    out.connect(pan)
    pan.connect(master)

    const kind = Math.floor(Math.random() * 3)
    if (kind === 0) {
      // bicycle bell: two quick dings
      for (const dt of [0, 0.12]) {
        const osc = ctx.createOscillator()
        osc.type = 'triangle'
        osc.frequency.value = 2600
        const env = ctx.createGain()
        env.gain.setValueAtTime(0.6, t + dt)
        env.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.16)
        osc.connect(env)
        env.connect(out)
        osc.start(t + dt)
        osc.stop(t + dt + 0.18)
      }
    } else if (kind === 1) {
      // auto horn: two detuned saws with a little swell
      for (const f of [420, 505]) {
        const osc = ctx.createOscillator()
        osc.type = 'sawtooth'
        osc.frequency.value = f
        const env = ctx.createGain()
        env.gain.setValueAtTime(0.0001, t)
        env.gain.linearRampToValueAtTime(0.3, t + 0.06)
        env.gain.setValueAtTime(0.3, t + 0.28)
        env.gain.exponentialRampToValueAtTime(0.001, t + 0.38)
        osc.connect(env)
        env.connect(out)
        osc.start(t)
        osc.stop(t + 0.4)
      }
    } else {
      // vendor whistle: rising sweep
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(1800, t)
      osc.frequency.linearRampToValueAtTime(2400, t + 0.18)
      const env = ctx.createGain()
      env.gain.setValueAtTime(0.4, t)
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
      osc.connect(env)
      env.connect(out)
      osc.start(t)
      osc.stop(t + 0.24)
    }
  }

  setMuted(m: boolean): void {
    this.muted = m
    if (this.master) this.master.gain.value = m ? 0 : 0.5
  }

  // ---- mini-game one-shot SFX (routed through master so mute applies) ----

  /** Rifle crack: a filtered noise burst plus a low thump. */
  gunshot(): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master || !this.noiseBuf) return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(3500, t)
    lp.frequency.exponentialRampToValueAtTime(280, t + 0.12)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.5, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
    src.connect(lp)
    lp.connect(g)
    g.connect(master)
    src.start(t)
    src.stop(t + 0.16)
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(130, t)
    o.frequency.exponentialRampToValueAtTime(48, t + 0.1)
    const og = ctx.createGain()
    og.gain.setValueAtTime(0.45, t)
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
    o.connect(og)
    og.connect(master)
    o.start(t)
    o.stop(t + 0.13)
  }

  /** Balloon pop: a tight high noise tick. */
  pop(): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master || !this.noiseBuf) return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1700
    bp.Q.value = 0.7
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.5, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08)
    src.connect(bp)
    bp.connect(g)
    g.connect(master)
    src.start(t)
    src.stop(t + 0.09)
  }

  /** Tin-duck clank: two detuned metallic blips. */
  clank(): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    const t = ctx.currentTime
    for (const f of [1180, 1610]) {
      const o = ctx.createOscillator()
      o.type = 'square'
      o.frequency.value = f
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.12, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
      o.connect(g)
      g.connect(master)
      o.start(t)
      o.stop(t + 0.2)
    }
  }

  /** Win jingle (ascending) or lose buzz (descending). */
  fanfare(win: boolean): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    const notes = win ? [523.25, 659.25, 783.99, 1046.5] : [392, 311, 233]
    let at = ctx.currentTime
    for (const f of notes) {
      const o = ctx.createOscillator()
      o.type = win ? 'triangle' : 'sawtooth'
      o.frequency.value = f
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, at)
      g.gain.exponentialRampToValueAtTime(0.28, at + 0.03)
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.22)
      o.connect(g)
      g.connect(master)
      o.start(at)
      o.stop(at + 0.24)
      at += 0.13
    }
  }

  /** Short PA tannoy chime before an announcement. */
  chime(): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    const t = ctx.currentTime
    for (const [f, dt] of [[880, 0], [1174, 0.12]] as [number, number][]) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t + dt)
      g.gain.exponentialRampToValueAtTime(0.2, t + dt + 0.02)
      g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.4)
      o.connect(g)
      g.connect(master)
      o.start(t + dt)
      o.stop(t + dt + 0.42)
    }
  }

  /** Rising blip when the combo grows. */
  comboUp(level: number): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.value = 520 + Math.min(level, 12) * 60
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.18, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
    o.connect(g)
    g.connect(master)
    o.start(t)
    o.stop(t + 0.2)
  }

  /** Deflating downward sweep when the combo is lost. */
  comboLost(): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(440, t)
    o.frequency.exponentialRampToValueAtTime(120, t + 0.5)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.16, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
    o.connect(g)
    g.connect(master)
    o.start(t)
    o.stop(t + 0.52)
  }

  /** Firework boom: a low body + bright crackle tail. */
  boom(): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master || !this.noiseBuf) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(90, t)
    o.frequency.exponentialRampToValueAtTime(40, t + 0.3)
    const og = ctx.createGain()
    og.gain.setValueAtTime(0.5, t)
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
    o.connect(og)
    og.connect(master)
    o.start(t)
    o.stop(t + 0.42)
    const n = ctx.createBufferSource()
    n.buffer = this.noiseBuf
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 2000
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.25, t + 0.05)
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
    n.connect(hp)
    hp.connect(ng)
    ng.connect(master)
    n.start(t + 0.05)
    n.stop(t + 0.55)
  }

  /** A swelling crowd "woooow". */
  crowdWow(): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master || !this.noiseBuf) return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 700
    bp.Q.value = 2
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.22, t + 0.4)
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.6)
    src.connect(bp)
    bp.connect(g)
    g.connect(master)
    src.start(t)
    src.stop(t + 1.7)
  }

  /** Called once per frame with the player's position for distance falloff. */
  update(px: number, pz: number): void {
    if (!this.ctx) return
    if (this.melodyGain) {
      const [cx, , cz] = RIDES.carousel.position
      const d2 = (px - cx) ** 2 + (pz - cz) ** 2
      this.melodyGain.gain.value = 0.9 / (1 + d2 / 60)
    }
    if (this.dholGain) {
      const [tx, , tz] = TENT_POS
      const d2 = (px - tx) ** 2 + (pz - tz) ** 2
      this.dholGain.gain.value = 0.8 / (1 + d2 / 110)
    }
    if (this.coasterGain) {
      const d2 = (px - coasterTelemetry.x) ** 2 + (pz - coasterTelemetry.z) ** 2
      this.coasterGain.gain.value = Math.min(0.5, coasterTelemetry.speed / 20) / (1 + d2 / 250)
    }
  }

  dispose(): void {
    for (const id of this.timers) {
      window.clearInterval(id)
      window.clearTimeout(id)
    }
    this.timers = []
    void this.ctx?.close()
    this.ctx = null
    this.master = null
    this.melodyGain = null
    this.dholGain = null
    this.coasterGain = null
    this.noiseBuf = null
  }
}

export const parkAudio = new ParkAudio()

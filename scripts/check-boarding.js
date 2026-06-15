/* NPC-boarding smoke check (Phase 3): verifies that NPCs pulled from the
   ride queue actually BOARD and RIDE — the Ferris Wheel should be turning with
   seated riders in its cabins. Enters the park, parks the rig a few metres in
   front of the Ferris Wheel face, aims the camera up at the turning wheel
   (framing the queue/boarding station below it too), waits ~8s for NPCs to
   queue + board, and captures the wheel mid-spin with riders.

   Run against an already-running dev server (npm run dev):
     node scripts/check-boarding.js
   Produces scripts/shot-boarding.png. Robust: warns + continues when a control
   or modal isn't found. If :3000 isn't reachable it prints a "run npm run dev"
   message and exits (capture is left to the human). Does NOT start a server and
   does NOT commit the PNG. */
const { chromium } = require('playwright-core')

const URL = process.env.PARK_URL || 'http://localhost:3000'

// Ferris Wheel (lib/spawn.ts RIDES.ferris): position [-30, 0, -16], hub at
// y≈11.6, radius 9 — so the wheel face spans roughly y∈[2.6, 20.6] centred on
// the XZ point (-30, -16). Its queue/boarding station is
// `position + trigger.offset` = [-30,0,-16] + [6,1,5] = (-24, -11); NPCs line
// up there, then board and appear as seated RideRiders in the cabins.
const WHEEL = { x: -30, z: -16 }
const STATION = { x: -24, z: -11 } // ferris queue/board point (proxy for "a line formed")

// Park the rig on the +z side of the wheel face, ~13 m back, looking toward -z
// (yaw 0 ⇒ camera forward is -z under the YXZ `camera.rotation.set(pitch,yaw,0)`
// convention in Player.tsx) and pitched UP so the turning wheel with its seated
// cabins fills the frame while the boarding station sits in the lower frame.
// Mirrors the proven PHOTO_SHOTS "Giant Wheel" framing (cam ~[-30,3,0] → hub).
const RIG = { x: -30, y: 1.5, z: -3 }
const LOOK = { yaw: 0, pitch: 0.42 } // face -z toward the wheel, tilt up at the hub

;(async () => {
  let browser
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true })
  } catch (e) {
    console.error('Could not launch a browser (msedge channel):', e.message)
    process.exit(1)
  }
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))

  // Bail politely if the dev server isn't up — capture is the human's job then.
  try {
    await page.goto(URL, { waitUntil: 'load', timeout: 15000 })
  } catch (e) {
    console.log(`Dev server not reachable at ${URL} (${e.message}).`)
    console.log('Start it with `npm run dev`, then re-run: node scripts/check-boarding.js')
    await browser.close()
    process.exit(0)
  }

  // The debug hook (window.__park) appears once the 3D scene has booted.
  try {
    await page.waitForFunction(() => !!window.__park, null, { timeout: 180000 })
  } catch (e) {
    console.warn('WARN: window.__park never appeared — scene may not have booted:', e.message)
  }
  await page.waitForTimeout(4000) // scene compile + first frames

  // Enter the park (skip the landing/onboarding overlay).
  const enter = page.locator('text=Enter the Park')
  if (await enter.count()) {
    await enter.click()
    await page.waitForTimeout(1500)
  } else {
    console.warn('WARN: "Enter the Park" button not found — proceeding (likely already in-park)')
  }

  // Daytime so cabins + riders read clearly.
  try {
    await page.evaluate(() => window.__park.store.getState().setTimeMode('day'))
  } catch (e) {
    console.warn('WARN: could not set day time mode:', e.message)
  }

  // Park the rig in front of the wheel face.
  try {
    await page.evaluate((rig) => {
      window.__park.rig.body.setTranslation({ x: rig.x, y: rig.y, z: rig.z }, true)
      window.__park.rig.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    }, RIG)
  } catch (e) {
    console.warn('WARN: could not reposition rig in front of the Ferris Wheel:', e.message)
  }

  // Aim the look up at the turning wheel. `look` is the shared yaw/pitch ref.
  try {
    await page.evaluate((l) => {
      if (window.__park.look) {
        window.__park.look.yaw = l.yaw
        window.__park.look.pitch = l.pitch
      }
    }, LOOK)
  } catch (e) {
    console.warn('WARN: could not aim the camera look:', e.message)
  }

  // Give the wandering crowd ~8s to seek the station, queue, and board so the
  // wheel is turning with seated riders by the time we shoot.
  await page.waitForTimeout(8000)

  // Report how many crowd agents are parked near the Ferris boarding station —
  // a rough proxy for "a line formed / NPCs are boarding". (Per-seat occupancy
  // lives in lib/rideOccupancy and isn't exposed on __park; the screenshot is
  // the real evidence of seated riders on the turning wheel.) `__park.agents`
  // is a plain array of { x, z, y, idle }.
  try {
    const nearStation = await page.evaluate((s) => {
      const agents = window.__park.agents
      if (!Array.isArray(agents)) return null
      return agents.filter((a) => a && Math.hypot(a.x - s.x, a.z - s.z) < 10).length
    }, STATION)
    if (nearStation != null) console.log('crowd agents within 10u of the Ferris boarding station:', nearStation)
  } catch {}
  console.log('Ferris Wheel center:', WHEEL, '| boarding station:', STATION)

  await page.screenshot({ path: 'scripts/shot-boarding.png' })
  console.log('captured scripts/shot-boarding.png')

  console.log('page errors:', errors.length ? errors.join(' | ') : '(none)')
  await browser.close()
})().catch((e) => {
  console.error('CHECK FAILED:', e.message)
  process.exit(1)
})

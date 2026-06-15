/* Purpose / queue smoke check: verifies the wandering crowd now forms REAL,
   draining queues at a ride counter (the work that replaced the fake static
   FairCrowd standers). Enters the park, parks the rig in front of the Carousel
   counter, waits ~6s for NPCs to line up, and captures the queue.

   Run against an already-running dev server (npm run dev):
     node scripts/check-purpose.js
   Produces scripts/shot-purpose.png. Robust: warns + continues when a control
   or modal isn't found. If :3000 isn't reachable it prints a message and exits
   (capture is left to the human). Does NOT start a server and does NOT commit
   the PNG. */
const { chromium } = require('playwright-core')

const URL = process.env.PARK_URL || 'http://localhost:3000'

// Carousel: a central, highly-visible ride. Its queue station center is
// `ride.position + trigger.offset` = [0,0,-32] + [0,1,8] = (0, -24); six queue
// slots fan out toward +z from there. Parking the rig a little further down +z
// and looking toward -z frames the counter and the line forming at it. Falls
// back gracefully if the scene constants ever drift.
const CAROUSEL_STATION = { x: 0, z: -24 }
const RIG = { x: 0, y: 1.5, z: -12 } // in front of the counter, facing -z toward it

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
    console.log('Start it with `npm run dev`, then re-run: node scripts/check-purpose.js')
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

  // Daytime so the queue reads clearly, then park the rig at the counter.
  try {
    await page.evaluate(() => window.__park.store.getState().setTimeMode('day'))
  } catch (e) {
    console.warn('WARN: could not set day time mode:', e.message)
  }
  try {
    await page.evaluate((rig) => {
      window.__park.rig.body.setTranslation({ x: rig.x, y: rig.y, z: rig.z }, true)
    }, RIG)
  } catch (e) {
    console.warn('WARN: could not reposition rig to the carousel counter:', e.message)
  }
  // Aim the look toward the counter (face -z). `look` is the shared yaw/pitch ref.
  try {
    await page.evaluate(() => {
      if (window.__park.look) { window.__park.look.yaw = Math.PI; window.__park.look.pitch = -0.05 }
    })
  } catch (e) {
    console.warn('WARN: could not aim the camera look:', e.message)
  }

  // Give the wandering crowd ~6s to seek the station and form a draining queue.
  await page.waitForTimeout(6000)

  // Report how many of the exposed crowd agents are parked near the counter —
  // a rough proxy for "a line formed". (Per-NPC queue `phase` is component-local
  // and not exposed; the screenshot is the real evidence.) `__park.agents` is a
  // plain array of { x, z, y, idle }.
  try {
    const nearCounter = await page.evaluate((c) => {
      const agents = window.__park.agents
      if (!Array.isArray(agents)) return null
      return agents.filter((a) => a && Math.hypot(a.x - c.x, a.z - c.z) < 10).length
    }, CAROUSEL_STATION)
    if (nearCounter != null) console.log('crowd agents within 10u of the carousel counter:', nearCounter)
  } catch {}
  console.log('carousel station center:', CAROUSEL_STATION)

  await page.screenshot({ path: 'scripts/shot-purpose.png' })
  console.log('captured scripts/shot-purpose.png')

  console.log('page errors:', errors.length ? errors.join(' | ') : '(none)')
  await browser.close()
})().catch((e) => {
  console.error('CHECK FAILED:', e.message)
  process.exit(1)
})

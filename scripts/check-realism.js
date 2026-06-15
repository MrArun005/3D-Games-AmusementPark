/* Verifies the PBR ground + paths upgrade (Realism task 6). Captures a wide
   daytime view of the textured ground + walkways, plus an overhead view near
   the plaza. Run against an already-running dev server (npm run dev):
     node scripts/check-realism.js
   Produces scripts/shot-realism-ground.png and shot-realism-plaza.png.
   Robust: warns + continues if the character creator / Enter button is absent. */
const { chromium } = require('playwright-core')

const URL = process.env.PARK_URL || 'http://localhost:3000'

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))

  // First navigation gives us an origin to clear storage on, then wipe so the
  // first-run creator appears predictably and we start from a clean state.
  await page.goto(URL, { waitUntil: 'load', timeout: 180000 })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'load', timeout: 180000 })
  await page.waitForFunction(() => !!window.__park, null, { timeout: 180000 })
  await page.waitForTimeout(4500) // scene compile + first frames + texture decode

  // Dismiss the character creator if it's up (first run). Robust: warn + go on.
  const enter = page.locator('text=Enter the Park')
  if (await enter.count()) {
    await enter.click()
    await page.waitForTimeout(1200)
  } else {
    console.warn('WARN: "Enter the Park" button not found — proceeding (already onboarded?)')
  }

  // Force bright daytime so the PBR ground/paths read clearly.
  try {
    await page.evaluate(() => window.__park.store.getState().setTimeMode('day'))
  } catch (e) {
    console.warn('WARN: could not set time mode to day:', e.message)
  }
  await page.waitForTimeout(800)

  // 1) Wide daytime ground/paths view from the spawn plaza area looking inward.
  try {
    await page.evaluate(() => window.__park.rig.body.setTranslation({ x: 0, y: 1.6, z: 40 }, true))
    await page.waitForTimeout(1400)
  } catch (e) {
    console.warn('WARN: could not reposition rig for ground shot:', e.message)
    await page.waitForTimeout(600)
  }
  await page.screenshot({ path: 'scripts/shot-realism-ground.png' })

  // 2) Overhead-ish plaza shot. Lift the rig up so we see the textured ground +
  //    walkways spread out. Camera looks forward, so elevation gives a broad view.
  try {
    await page.evaluate(() => window.__park.rig.body.setTranslation({ x: 0, y: 18, z: 30 }, true))
    await page.waitForTimeout(1600)
  } catch (e) {
    console.warn('WARN: could not reposition rig for plaza shot:', e.message)
    await page.waitForTimeout(600)
  }
  await page.screenshot({ path: 'scripts/shot-realism-plaza.png' })

  console.log('page errors:', errors.length ? errors.join(' | ') : '(none)')
  await browser.close()
})().catch((e) => {
  console.error('CHECK FAILED:', e.message)
  process.exit(1)
})

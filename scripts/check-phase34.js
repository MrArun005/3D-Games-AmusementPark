/* Smoke test for Columbus ride boarding + Photo Mode + crowd liveliness. */
const { chromium } = require('playwright-core')
const URL = process.env.PARK_URL || 'http://localhost:3001'

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(URL, { waitUntil: 'load', timeout: 180000 })
  await page.waitForFunction(() => !!window.__park, null, { timeout: 180000 })
  await page.waitForTimeout(5000)
  const enter = page.locator('text=Enter the Park')
  if (await enter.count()) await enter.click()
  await page.evaluate(() => window.__park.store.getState().addTickets(20))
  const state = (k) => page.evaluate((kk) => window.__park.store.getState()[kk], k)
  const report = (l, v) => console.log(l + ':', JSON.stringify(v))

  // --- Columbus boarding (ride at -16,-42; trigger ~ -10,-35) ---
  await page.evaluate(() => window.__park.rig.body.setTranslation({ x: -10, y: 1.5, z: -35 }, true))
  await page.waitForTimeout(1200)
  report('nearbyRide', await state('nearbyRide'))
  await page.keyboard.press('KeyE')
  await page.waitForTimeout(1000)
  report('activeRide', await state('activeRide'))
  report('ridePhase', await state('ridePhase'))
  await page.waitForTimeout(4000)
  report('ridePhase mid', await state('ridePhase'))
  await page.screenshot({ path: 'scripts/shot-columbus.png' })
  // exit the ride so photo mode can engage
  await page.evaluate(() => window.__park.store.getState().requestExit())
  await page.waitForTimeout(2500)
  report('activeRide after exit', await state('activeRide'))

  // --- Photo Mode ---
  await page.evaluate(() => window.__park.store.getState().setTimeMode('night'))
  await page.keyboard.press('KeyP')
  await page.waitForTimeout(1500)
  report('photoMode', await state('photoMode'))
  report('photoShot', await state('photoShot'))
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(1800)
  report('photoShot after →', await state('photoShot'))
  await page.screenshot({ path: 'scripts/shot-photo.png' })
  await page.keyboard.press('KeyP')
  await page.waitForTimeout(400)
  report('photoMode after exit', await state('photoMode'))

  console.log('page errors:', errors.length ? errors.join(' | ') : '(none)')
  await browser.close()
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })

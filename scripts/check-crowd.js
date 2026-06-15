/* Close-up checks: queue at the ferris counter and players at a game stall. */
const { chromium } = require('playwright-core')
const URL = process.env.PARK_URL || 'http://localhost:3001'

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(URL, { waitUntil: 'load', timeout: 180000 })
  await page.waitForFunction(() => !!window.__park, null, { timeout: 180000 })
  await page.waitForTimeout(4000)
  const enter = page.locator('text=Enter the Park')
  if (await enter.count()) await enter.click()
  await page.evaluate(() => window.__park.store.getState().setTimeMode('day'))
  await page.waitForTimeout(800)

  // look at the ferris queue from the plaza side (counter ~ -24,-11)
  await page.evaluate(() => window.__park.rig.body.setTranslation({ x: -24, y: 1.5, z: 2 }, true))
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'scripts/shot-queue.png' })

  // balloon game stall players (stall at -7,33; stand in front looking at it)
  await page.evaluate(() => window.__park.rig.body.setTranslation({ x: -7, y: 1.5, z: 39 }, true))
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'scripts/shot-stall.png' })

  console.log('page errors:', errors.length ? errors.join(' | ') : '(none)')
  await browser.close()
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })

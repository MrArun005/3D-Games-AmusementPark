/* End-to-end boarding test: walks the player into the Ferris wheel trigger,
   presses E, and reports the sensor + ride machine state. */
const { chromium } = require('playwright-core')

const URL = process.env.PARK_URL || 'http://localhost:3001'

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const errors = []
  const sensorLogs = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.text().includes('[sensor-contact]')) sensorLogs.push(m.text())
  })
  await page.goto(URL, { waitUntil: 'load', timeout: 180000 })
  // the debug hook appears once the 3D scene has actually booted
  await page.waitForFunction(() => !!window.__park, null, { timeout: 180000 })
  await page.waitForTimeout(3000)

  const enter = page.locator('text=Enter the Park')
  if (await enter.count()) await enter.click()
  await page.waitForTimeout(1500)

  const report = (label, value) => console.log(label + ':', JSON.stringify(value))
  const state = (key) => page.evaluate((k) => window.__park.store.getState()[k], key)

  // 1) teleport just OUTSIDE the ferris trigger, then WALK in (facing -z)
  await page.evaluate(() => {
    window.__park.rig.body.setTranslation({ x: -24, y: 1.5, z: -4 }, true)
  })
  await page.waitForTimeout(500)
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(1600)
  await page.keyboard.up('KeyW')
  await page.waitForTimeout(800)
  report('player pos', await page.evaluate(() => ({ ...window.__park.store.getState().playerPos })))
  report('nearbyRide after walking in', await state('nearbyRide'))
  report('sensor contacts seen', sensorLogs.length)

  // 2) press E
  await page.keyboard.press('KeyE')
  await page.waitForTimeout(800)
  report('activeRide after E', await state('activeRide'))
  report('ridePhase', await state('ridePhase'))
  report('tickets', await state('tickets'))

  await page.waitForTimeout(6000)
  report('phase later', await state('ridePhase'))
  console.log('sensor log sample:', sensorLogs.slice(0, 5))
  console.log('page errors:', errors.length ? errors.join(' | ') : '(none)')
  await browser.close()
})().catch((e) => {
  console.error('CHECK FAILED:', e.message)
  process.exit(1)
})

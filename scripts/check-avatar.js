/* Verifies the third-person avatar + day/night selector: switches to third
   person, screenshots, pins night, screenshots again. */
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
  await page.waitForTimeout(1000)

  // third person + walk a little so the avatar is visible and animating
  await page.evaluate(() => window.__park.store.getState().toggleView())
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(900)
  await page.keyboard.up('KeyW')
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'scripts/shot-avatar.png' })

  // pin night and let lights come on
  await page.evaluate(() => window.__park.store.getState().setTimeMode('night'))
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'scripts/shot-night.png' })

  console.log('view:', await page.evaluate(() => window.__park.store.getState().view))
  console.log('timeMode:', await page.evaluate(() => window.__park.store.getState().timeMode))
  console.log('timeOfDay:', await page.evaluate(() => window.__park.store.getState().timeOfDay))
  console.log('page errors:', errors.length ? errors.join(' | ') : '(none)')
  await browser.close()
})().catch((e) => {
  console.error('CHECK FAILED:', e.message)
  process.exit(1)
})

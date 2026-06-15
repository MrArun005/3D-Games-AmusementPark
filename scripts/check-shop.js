/* Buy flow: walk to a food stall, press E, click Buy; then the balloon stall,
   press E, pick a colour. Confirms tokens spent + inventory set. */
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
  await page.waitForTimeout(500)

  const state = (k) => page.evaluate((kk) => window.__park.store.getState()[kk], k)
  const report = (l, v) => console.log(l + ':', JSON.stringify(v))
  await page.evaluate(() => window.__park.store.getState().addTickets(20))

  // --- food stall (PANI PURI at -12,28) ---
  await page.evaluate(() => window.__park.rig.body.setTranslation({ x: -10.5, y: 1.5, z: 24.5 }, true))
  await page.waitForTimeout(1100)
  report('nearbyShop(food)', await state('nearbyShop'))
  const before = await state('tickets')
  await page.keyboard.press('KeyE')
  await page.waitForTimeout(500)
  report('shopMenu open', !!(await state('shopMenu')))
  await page.locator('button', { hasText: 'Buy' }).first().click()
  await page.waitForTimeout(500)
  report('heldFood', await state('heldFood'))
  report('food tokens spent', before - (await state('tickets')))
  report('shopMenu after buy', await state('shopMenu'))

  // --- balloon stall (12,34) ---
  await page.evaluate(() => window.__park.rig.body.setTranslation({ x: 10.5, y: 1.5, z: 30.5 }, true))
  await page.waitForTimeout(1100)
  report('nearbyShop(balloon)', await state('nearbyShop'))
  await page.keyboard.press('KeyE')
  await page.waitForTimeout(500)
  await page.locator('button[aria-label^="balloon"]').first().click()
  await page.waitForTimeout(500)
  report('balloon', await state('balloon'))
  // third-person + walk a moment so the balloon trails overhead
  await page.evaluate(() => window.__park.store.getState().toggleView())
  await page.evaluate(() => window.__park.store.getState().setTimeMode('day'))
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(1200)
  await page.keyboard.up('KeyW')
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'scripts/shot-balloon.png' })
  console.log('page errors:', errors.length ? errors.join(' | ') : '(none)')
  await browser.close()
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })

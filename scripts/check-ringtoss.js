/* End-to-end ring toss: walk to the stall, press E, charge-and-throw 5 rings,
   confirm rings decrement, results show, payout applies. */
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
  await page.waitForTimeout(600)

  const state = (k) => page.evaluate((kk) => window.__park.store.getState()[kk], k)
  const rt = (k) => page.evaluate((kk) => window.__park.ringtoss.getState()[kk], k)
  const report = (l, v) => console.log(l + ':', JSON.stringify(v))

  await page.evaluate(() => window.__park.store.getState().addTickets(20))
  // front stand point of the ring-toss stall (25,27)
  await page.evaluate(() => window.__park.rig.body.setTranslation({ x: 22.97, y: 1.5, z: 24.79 }, true))
  await page.waitForTimeout(1200)
  report('nearbyStall', await state('nearbyStall'))

  await page.keyboard.press('KeyE')
  await page.waitForTimeout(600)
  report('activeStall', await state('activeStall'))
  report('ringsLeft start', await rt('ringsLeft'))
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'scripts/shot-ringtoss.png' })

  // 5 throws with varied charge times
  const holds = [380, 300, 460, 340, 420]
  for (let i = 0; i < 5; i++) {
    await page.mouse.down()
    await page.waitForTimeout(holds[i]) // charge power
    await page.mouse.up()
    await page.waitForTimeout(900) // flight + resolve
  }
  report('ringsLeft end', await rt('ringsLeft'))
  report('on (landed)', await rt('on'))
  report('result', await rt('result'))
  report('tickets', await state('tickets'))
  report('gamesWon', await state('gamesWon'))
  console.log('page errors:', errors.length ? errors.join(' | ') : '(none)')
  await browser.close()
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })

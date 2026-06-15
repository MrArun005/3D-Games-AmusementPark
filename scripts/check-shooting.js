/* End-to-end shooting gallery: walk to the stall, press E, fire several
   shots at the targets and confirm score/ammo/payout behave. */
const { chromium } = require('playwright-core')
const URL = process.env.PARK_URL || 'http://localhost:3001'

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.text().includes('[shoot]')) console.log(m.text()) })
  await page.goto(URL, { waitUntil: 'load', timeout: 180000 })
  await page.waitForFunction(() => !!window.__park, null, { timeout: 180000 })
  await page.waitForTimeout(4000)
  const enter = page.locator('text=Enter the Park')
  if (await enter.count()) await enter.click()
  await page.waitForTimeout(800)

  const state = (k) => page.evaluate((kk) => window.__park.store.getState()[kk], k)
  const shoot = (k) => page.evaluate((kk) => window.__park.shooting.getState()[kk], k)
  const report = (l, v) => console.log(l + ':', JSON.stringify(v))

  // give plenty of tickets, teleport to the shooting stall (-7,33)
  await page.evaluate(() => window.__park.store.getState().addTickets(20))
  await page.evaluate(() => window.__park.rig.body.setTranslation({ x: -6.4, y: 1.5, z: 30.3 }, true))
  await page.waitForTimeout(1200)
  report('nearbyStall', await state('nearbyStall'))
  report('tickets before', await state('tickets'))

  await page.keyboard.press('KeyE')
  await page.waitForTimeout(600)
  report('activeStall', await state('activeStall'))
  report('shooting.active', await shoot('active'))
  report('ammo start', await shoot('ammo'))
  await page.waitForTimeout(700)
  await page.screenshot({ path: 'scripts/shot-aim.png' }) // gun + targets view

  // drive the aim directly (pointer-lock movement can't be synthesized) and
  // sweep pitch across the two balloon rows + duck row, firing at each
  const pitches = [0.02, -0.02, -0.06, -0.1, -0.14, -0.02, 0.0, -0.08]
  for (let i = 0; i < 8; i++) {
    await page.evaluate((p) => { window.__park.look.pitch = p }, pitches[i])
    await page.waitForTimeout(120)
    await page.mouse.down()
    await page.mouse.up()
    await page.waitForTimeout(220)
  }
  await page.waitForTimeout(600)
  report('ammo after 8', await shoot('ammo'))
  report('hits', await shoot('hits'))
  report('score', await shoot('score'))
  report('result', await shoot('result'))
  report('tickets after', await state('tickets'))
  report('gamesWon', await state('gamesWon'))
  await page.screenshot({ path: 'scripts/shot-shooting.png' })
  console.log('page errors:', errors.length ? errors.join(' | ') : '(none)')
  await browser.close()
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })

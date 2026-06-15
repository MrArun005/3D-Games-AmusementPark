const { chromium } = require('playwright-core')
const URL = process.env.PARK_URL || 'http://localhost:3001'
;(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } })
  const errs = []; page.on('pageerror', e => errs.push(e.message))
  await page.goto(URL, { waitUntil: 'load', timeout: 180000 })
  await page.waitForFunction(() => !!window.__park && !!window.__park.festival, null, { timeout: 180000 })
  // dismiss onboarding — the click is a user gesture that lets requestPointerLock work later
  const enter = page.locator('text=Enter the Park'); if (await enter.count()) await enter.click()
  const F = () => page.evaluate(() => window.__park.festival.getState())
  const call = (fn, ...a) => page.evaluate(([f, args]) => window.__park.festival.getState()[f](...args), [fn, a])
  const r = (l, v) => console.log(l + ':', JSON.stringify(v))

  await call('start')
  r('phase', (await F()).phase)                       // running
  await call('addScore', 100)
  let s = await F(); r('score1', s.score); r('combo1', s.combo) // 100, 1
  await call('addScore', 100)
  s = await F(); r('score2', s.score); r('combo2', s.combo)     // 300, 2
  await call('tick', 13)                              // exceed COMBO_WINDOW
  s = await F(); r('comboAfterTimeout', s.combo)      // 1
  await call('toFinale')
  r('phaseFinale', (await F()).phase)                 // finale

  await call('reset'); await call('start')
  await page.waitForTimeout(1500) // controller ticks the clock (Task 2)
  const tod = await page.evaluate(() => window.__park.store.getState().timeOfDay)
  console.log('timeOfDay during run (expect 18-24):', tod.toFixed(2))

  // ride scoring: start a run, teleport into the ferris trigger, board
  await call('reset'); await call('start')
  await page.evaluate(() => window.__park.rig.body.setTranslation({ x: -24, y: 1.5, z: -11 }, true))
  await page.waitForTimeout(1200)
  await page.keyboard.press('KeyE')
  await page.waitForTimeout(1000)
  console.log('boarded during festival; activeRide:', JSON.stringify(await page.evaluate(() => window.__park.store.getState().activeRide)))
  // clear the ride so later sections (which need pointer lock / E) aren't gated
  await page.evaluate(() => { const s = window.__park.store.getState(); s.setActiveRide(null); s.setRidePhase('idle') })
  await page.waitForTimeout(300)

  // announcer: scoring should set a caption
  await call('reset'); await call('start')
  await call('addScore', 100); await call('addScore', 100); await call('addScore', 100)
  await page.waitForTimeout(200)
  console.log('caption after scoring:', JSON.stringify((await F()).caption))

  // HUD: start button present when idle; score shown during a run
  await call('reset')
  await page.waitForTimeout(200)
  console.log('start button present:', await page.locator('text=Start Festival').count())
  await call('start'); await call('addScore', 200)
  await page.waitForTimeout(200)
  console.log('score visible in HUD:', await page.locator('text=/Festival Score/').count())
  await page.screenshot({ path: 'scripts/shot-festival-hud.png' })

  // shooting near-miss: start festival, play, fire at the sky (guaranteed miss)
  await call('reset'); await call('start')
  await page.evaluate(() => window.__park.rig.body.setTranslation({ x: -6.4, y: 1.5, z: 30.3 }, true))
  await page.waitForTimeout(1100)
  await page.click('canvas'); await page.waitForTimeout(200) // gesture → pointer lock
  await page.keyboard.press('KeyE'); await page.waitForTimeout(700)
  await page.evaluate(() => { window.__park.look.pitch = 1.2 })
  const ammoBefore = await page.evaluate(() => window.__park.shooting.getState().ammo)
  const locked = await page.evaluate(() => document.pointerLockElement ? document.pointerLockElement.tagName : 'NONE')
  await page.mouse.down(); await page.mouse.up()
  await page.waitForTimeout(300)
  const ammoAfter = await page.evaluate(() => window.__park.shooting.getState().ammo)
  console.log('pointerLock:', locked, 'ammo', ammoBefore, '->', ammoAfter)
  console.log('caption after miss:', JSON.stringify((await F()).caption))
  await page.evaluate(() => window.__park.shooting.getState().end())

  console.log('errors:', errs.length ? errs.join(' | ') : '(none)')
  await b.close()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })

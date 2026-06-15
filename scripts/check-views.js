const { chromium } = require('playwright-core')
const URL = process.env.PARK_URL || 'http://localhost:3001'
;(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } })
  const errs=[]; page.on('pageerror',e=>errs.push(e.message))
  await page.goto(URL, { waitUntil:'load', timeout:180000 })
  await page.waitForFunction(()=>!!window.__park, null, {timeout:180000})
  await page.waitForTimeout(4500)
  const enter = page.locator('text=Enter the Park'); if (await enter.count()) await enter.click()
  await page.evaluate(()=>window.__park.store.getState().addTickets(30))
  await page.evaluate(()=>window.__park.store.getState().setTimeMode('day'))
  const S=(k)=>page.evaluate(kk=>window.__park.store.getState()[kk],k)

  // BUMPER CARS: board, let it run, screenshot chase, press V -> FPP
  await page.evaluate(()=>window.__park.rig.body.setTranslation({x:22,y:1.5,z:18},true))
  await page.waitForTimeout(1000)
  console.log('bumper nearbyRide:', JSON.stringify(await S('nearbyRide')))
  await page.keyboard.press('KeyE'); await page.waitForTimeout(4000)
  console.log('bumper phase:', JSON.stringify(await S('ridePhase')), 'view:', JSON.stringify(await S('view')))
  await page.screenshot({ path:'scripts/shot-bumper-chase.png' })
  await page.keyboard.press('KeyV'); await page.waitForTimeout(1500)
  console.log('after V view:', JSON.stringify(await S('view')))
  await page.screenshot({ path:'scripts/shot-bumper-fpp.png' })
  await page.evaluate(()=>window.__park.store.getState().requestExit()); await page.waitForTimeout(2500)
  // reset to third for stall test
  if ((await S('view'))==='first') { await page.keyboard.press('KeyV'); await page.waitForTimeout(300) }

  // SHOOTING gallery TPP: start, press V -> third, screenshot
  await page.evaluate(()=>window.__park.rig.body.setTranslation({x:-6.4,y:1.5,z:30.3},true))
  await page.waitForTimeout(1000)
  await page.keyboard.press('KeyE'); await page.waitForTimeout(800)
  console.log('shooting activeStall:', JSON.stringify(await S('activeStall')))
  await page.keyboard.press('KeyV'); await page.waitForTimeout(1200)
  console.log('shooting view:', JSON.stringify(await S('view')))
  await page.screenshot({ path:'scripts/shot-shoot-tpp.png' })
  console.log('errors:', errs.length?errs.join(' | '):'(none)')
  await b.close()
})().catch(e=>{console.error('FAIL',e.message);process.exit(1)})

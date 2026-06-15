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
  await page.evaluate(()=>window.__park.store.getState().addTickets(20))
  await page.evaluate(()=>window.__park.store.getState().setTimeMode('day'))
  await page.evaluate(()=>window.__park.rig.body.setTranslation({x:-6.4,y:1.5,z:30.3},true))
  await page.waitForTimeout(1000)
  await page.keyboard.press('KeyE'); await page.waitForTimeout(800)
  // force third person
  const v = await page.evaluate(()=>window.__park.store.getState().view)
  if (v==='first') { await page.keyboard.press('KeyV') }
  await page.waitForTimeout(1500)
  console.log('view:', await page.evaluate(()=>window.__park.store.getState().view))
  await page.screenshot({ path:'scripts/shot-shoot-tpp.png' })
  console.log('errors:', errs.length?errs.join(' | '):'(none)')
  await b.close()
})().catch(e=>{console.error('FAIL',e.message);process.exit(1)})

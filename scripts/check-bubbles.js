const { chromium } = require('playwright-core')
const URL = process.env.PARK_URL || 'http://localhost:3001'
;(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } })
  const errs = []; page.on('pageerror', e => errs.push(e.message))
  await page.goto(URL, { waitUntil: 'load', timeout: 180000 })
  await page.waitForFunction(() => !!window.__park, null, { timeout: 180000 })
  await page.waitForTimeout(4000)
  const enter = page.locator('text=Enter the Park'); if (await enter.count()) await enter.click()
  await page.evaluate(() => window.__park.store.getState().setTimeMode('day'))
  await page.evaluate(() => window.__park.rig.body.setTranslation({ x: -12, y: 1.5, z: 27 }, true))
  await page.waitForTimeout(14000) // let crowd gather + bubbles refresh a few times
  const phrases = ['Eshtu','Adu nodu','Super ide','Bombaat','Baa illi','Channagide','Photo','sutthu']
  const found = await page.evaluate((ps) => {
    const txt = document.body.innerText
    return ps.filter(p => txt.includes(p))
  }, phrases)
  console.log('bubble phrases visible:', JSON.stringify(found))
  await page.screenshot({ path: 'scripts/shot-bubbles.png' })
  console.log('errors:', errs.length ? errs.join(' | ') : '(none)')
  await b.close()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })

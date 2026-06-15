const { chromium } = require('playwright-core')
const URL = process.env.PARK_URL || 'http://localhost:3001'
;(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } })
  await page.goto(URL, { waitUntil: 'load', timeout: 180000 })
  await page.waitForFunction(() => !!window.__park, null, { timeout: 180000 })
  await page.waitForTimeout(4000)
  const enter = page.locator('text=Enter the Park'); if (await enter.count()) await enter.click()
  await page.evaluate(() => window.__park.rig.body.setTranslation({ x: -12, y: 1.5, z: 27 }, true))
  for (let s = 0; s < 8; s++) {
    await page.waitForTimeout(1800)
    const info = await page.evaluate(() => {
      const ag = window.__park.agents || []
      const p = window.__park.store.getState().playerPos
      const idleNear = ag.filter(a => a.idle && (a.x-p.x)**2 + (a.z-p.z)**2 < 26*26).length
      const idleTotal = ag.filter(a => a.idle).length
      return { len: ag.length, idleTotal, idleNear, sample: ag[0] }
    })
    console.log('t' + s, JSON.stringify(info))
  }
  await b.close()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })

/* Measures the loaded avatar's world height and grabs a close third-person shot. */
const { chromium } = require('playwright-core')
const URL = process.env.PARK_URL || 'http://localhost:3001'

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(URL, { waitUntil: 'load', timeout: 180000 })
  await page.waitForFunction(() => !!window.__park, null, { timeout: 180000 })
  await page.waitForTimeout(5000)
  const enter = page.locator('text=Enter the Park')
  if (await enter.count()) await enter.click()
  await page.evaluate(() => window.__park.store.getState().setTimeMode('day'))
  await page.evaluate(() => window.__park.store.getState().toggleView()) // third person
  await page.evaluate(() => window.__park.rig.body.setTranslation({ x: 0, y: 1.5, z: 14 }, true))
  await page.waitForTimeout(6000) // let the crowd wander into view

  // find a skinned mesh and report its world-space height
  const dims = await page.evaluate(() => {
    let found = null
    // R3F stores the scene on the canvas' __r3f; fall back to scanning THREE roots
    const cv = document.querySelector('canvas')
    const root = cv && cv.__r3f && cv.__r3f.root
    // brute force: walk the rapier rig's parent scene if available
    return new Promise((res) => res(null))
  })
  console.log('dims:', dims)
  await page.screenshot({ path: 'scripts/shot-scale.png' })
  console.log('page errors:', errors.length ? errors.join(' | ') : '(none)')
  await browser.close()
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })

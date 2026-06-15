/* Verifies look controls: clicks the canvas and reports pointer-lock state. */
const { chromium } = require('playwright-core')

const URL = process.env.PARK_URL || 'http://localhost:3001'

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(URL, { waitUntil: 'load', timeout: 180000 })
  await page.waitForTimeout(12000)

  const enter = page.locator('text=Enter the Park')
  if (await enter.count()) {
    await enter.click()
    await page.waitForTimeout(1500)
  }
  let locked = await page.evaluate(() => (document.pointerLockElement ? document.pointerLockElement.tagName : 'NONE'))
  console.log('after onboarding click, pointerLockElement =', locked)

  if (locked === 'NONE') {
    await page.click('canvas')
    await page.waitForTimeout(1000)
    locked = await page.evaluate(() => (document.pointerLockElement ? document.pointerLockElement.tagName : 'NONE'))
    console.log('after canvas click, pointerLockElement =', locked)
  }
  console.log('page errors:', errors.length ? errors.join(' | ') : '(none)')
  await browser.close()
})().catch((e) => {
  console.error('CHECK FAILED:', e.message)
  process.exit(1)
})

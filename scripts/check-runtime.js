/* Headless runtime check: loads the park, collects console/page errors,
   takes screenshots before and after simulating the onboarding click. */
const { chromium } = require('playwright-core')

const URL = process.env.PARK_URL || 'http://localhost:3001'

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const logs = []
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`)
  })
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))

  await page.goto(URL, { waitUntil: 'load', timeout: 180000 })
  await page.waitForTimeout(20000) // scene compile + first frames
  await page.screenshot({ path: 'scripts/shot-load.png' })

  // dismiss onboarding if present
  const enter = page.locator('text=Enter the Park')
  if (await enter.count()) {
    await enter.click()
    await page.waitForTimeout(3000)
  }
  await page.screenshot({ path: 'scripts/shot-game.png' })

  console.log('=== CONSOLE/PAGE ERRORS (' + logs.length + ') ===')
  console.log(logs.slice(0, 40).join('\n').slice(0, 6000) || '(none)')
  await browser.close()
})().catch((e) => {
  console.error('CHECK FAILED:', e.message)
  process.exit(1)
})

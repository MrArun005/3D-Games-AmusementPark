/* Verifies the living-characters work: captures the first-run "Create Your
   Character" modal, the third-person hero shot, and a wide view of a varied
   crowd. Run against an already-running dev server (npm run dev).
     node scripts/check-characters.js
   Produces scripts/shot-creator.png, shot-hero.png, shot-crowd-humans.png. */
const { chromium } = require('playwright-core')

const URL = process.env.PARK_URL || 'http://localhost:3000'

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))

  // First navigation so we have an origin to clear storage on, then wipe the
  // avatar key so the first-run creator modal is guaranteed to appear.
  await page.goto(URL, { waitUntil: 'load', timeout: 180000 })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'load', timeout: 180000 })
  await page.waitForFunction(() => !!window.__park, null, { timeout: 180000 })
  await page.waitForTimeout(4500) // scene compile + first frames

  // 1) Creator modal (first run). Confirm by its title before shooting.
  const creator = page.locator('text=Create Your Character')
  const haveCreator = await creator.count()
  if (haveCreator) {
    await page.waitForTimeout(800)
    await page.screenshot({ path: 'scripts/shot-creator.png' })
  } else {
    console.warn('WARN: creator modal ("Create Your Character") not found — already onboarded? Skipping shot-creator.png')
  }

  // 2) Enter the park, toggle to third person (V), capture the hero shot.
  const enter = page.locator('text=Enter the Park')
  if (await enter.count()) {
    await enter.click()
    await page.waitForTimeout(1200)
  } else {
    console.warn('WARN: "Enter the Park" button not found — proceeding (likely already in-park)')
  }
  await page.keyboard.press('KeyV') // toggle to third person
  await page.waitForTimeout(900)
  // walk a step so the avatar is animating and clearly visible
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(700)
  await page.keyboard.up('KeyW')
  await page.waitForTimeout(700)
  await page.screenshot({ path: 'scripts/shot-hero.png' })
  try {
    console.log('view:', await page.evaluate(() => window.__park.store.getState().view))
  } catch {}

  // 3) Wide view of the crowd. Move to a busy area if the rig is exposed.
  try {
    await page.evaluate(() => window.__park.store.getState().setTimeMode('day'))
    // balloon game stall area — same busy spot the other crowd scripts use
    await page.evaluate(() => window.__park.rig.body.setTranslation({ x: -7, y: 1.5, z: 39 }, true))
    await page.waitForTimeout(1500)
  } catch (e) {
    console.warn('WARN: could not reposition rig for crowd shot:', e.message)
    await page.waitForTimeout(800)
  }
  await page.screenshot({ path: 'scripts/shot-crowd-humans.png' })

  console.log('page errors:', errors.length ? errors.join(' | ') : '(none)')
  await browser.close()
})().catch((e) => {
  console.error('CHECK FAILED:', e.message)
  process.exit(1)
})

import * as THREE from 'three'

/**
 * Procedural canvas textures — the whole circus look is painted at runtime,
 * zero downloaded assets. All textures repeat-wrap; set `.repeat` as needed.
 */

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const ctx = cv.getContext('2d')
  if (!ctx) throw new Error('2d canvas context unavailable')
  return [cv, ctx]
}

function toTexture(cv: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(cv)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 4
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Circus-poster sign: cream board, gold + red double border, serif lettering. */
export function makeTextTexture(text: string, bg = '#fff3dc', fg = '#8e0c20'): THREE.CanvasTexture {
  const [cv, ctx] = makeCanvas(512, 128)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, 512, 128)
  ctx.strokeStyle = '#f2a900'
  ctx.lineWidth = 10
  ctx.strokeRect(5, 5, 502, 118)
  ctx.strokeStyle = fg
  ctx.lineWidth = 3
  ctx.strokeRect(14, 14, 484, 100)
  ctx.fillStyle = fg
  ctx.font = 'bold 42px Georgia, "Times New Roman", serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text.toUpperCase(), 256, 68, 450)
  return toTexture(cv)
}

/** Vertical big-top stripes. On a cone's curved surface they read as radial. */
export function makeStripesTexture(a: string, b: string, stripes = 12, size = 256): THREE.CanvasTexture {
  const [cv, ctx] = makeCanvas(size, size)
  const w = size / stripes
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 ? b : a
    ctx.fillRect(Math.floor(i * w), 0, Math.ceil(w) + 1, size)
  }
  return toTexture(cv)
}

export function makePolkaTexture(bg: string, dot: string, dots = 5, size = 256): THREE.CanvasTexture {
  const [cv, ctx] = makeCanvas(size, size)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = dot
  const step = size / dots
  for (let y = 0; y < dots; y++) {
    for (let x = 0; x <= dots; x++) {
      const ox = (y % 2) * step * 0.5
      ctx.beginPath()
      ctx.arc(x * step + ox, y * step + step / 2, step * 0.18, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  return toTexture(cv)
}

export function makeCheckerTexture(a: string, b: string, cells = 8, size = 256): THREE.CanvasTexture {
  const [cv, ctx] = makeCanvas(size, size)
  const w = size / cells
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      ctx.fillStyle = (x + y) % 2 ? b : a
      ctx.fillRect(Math.floor(x * w), Math.floor(y * w), Math.ceil(w), Math.ceil(w))
    }
  }
  return toTexture(cv)
}

/** Mottled lawn green — tile it with a high repeat over the terrain. */
export function makeGrassTexture(size = 512): THREE.CanvasTexture {
  const [cv, ctx] = makeCanvas(size, size)
  ctx.fillStyle = '#4d8a50'
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 1400; i++) {
    const g = 110 + Math.floor(Math.random() * 50)
    ctx.fillStyle = `rgb(${50 + Math.floor(Math.random() * 30)}, ${g}, ${60 + Math.floor(Math.random() * 25)})`
    ctx.beginPath()
    ctx.arc(Math.random() * size, Math.random() * size, 2 + Math.random() * 7, 0, Math.PI * 2)
    ctx.fill()
  }
  return toTexture(cv)
}

/** Offset-row cobblestones with mortar gaps, for paths and the plaza. */
export function makeCobbleTexture(size = 512): THREE.CanvasTexture {
  const [cv, ctx] = makeCanvas(size, size)
  ctx.fillStyle = '#8f897e'
  ctx.fillRect(0, 0, size, size)
  const rows = 8
  const cols = 8
  const h = size / rows
  const w = size / cols
  for (let y = 0; y < rows; y++) {
    for (let x = -1; x < cols; x++) {
      const off = (y % 2) * w * 0.5
      const tone = 150 + Math.floor(Math.random() * 50)
      ctx.fillStyle = `rgb(${tone}, ${tone - 8}, ${tone - 18})`
      ctx.beginPath()
      ctx.roundRect(x * w + off + 3, y * h + 3, w - 6, h - 6, 7)
      ctx.fill()
    }
  }
  return toTexture(cv)
}

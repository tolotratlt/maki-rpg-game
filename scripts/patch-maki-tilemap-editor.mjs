import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const editorPath = path.resolve('node_modules', '@tialops', 'maki', 'lib', 'tilemap-editor.html')
const tilemapLauncherPath = path.resolve('node_modules', '@tialops', 'maki', 'src', 'tilemap.js')

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) {
    return source
  }

  if (!source.includes(before)) {
    throw new Error(`Could not patch ${label}`)
  }

  return source.replace(before, after)
}

async function main() {
  let source
  let launcherSource

  try {
    source = await readFile(editorPath, 'utf8')
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      console.log('Maki tilemap editor not found, skipping patch')
      return
    }

    throw error
  }

  try {
    launcherSource = await readFile(tilemapLauncherPath, 'utf8')
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      console.log('Maki tilemap launcher not found, skipping launcher patch')
      launcherSource = null
    } else {
      throw error
    }
  }

  let next = source
  let nextLauncher = launcherSource

  next = replaceRequired(
    next,
    `#tileset-panel {
  min-width: 200px;
  background: #12192e;
  border-right: 1px solid #0f3460;
  overflow-y: auto;
  overflow-x: auto;
  flex-shrink: 0;
}`,
    `#tileset-panel {
  min-width: 200px;
  width: min(420px, 40vw);
  background: #12192e;
  border-right: 1px solid #0f3460;
  overflow-y: auto;
  overflow-x: auto;
  flex-shrink: 0;
}
#splitter {
  width: 8px;
  cursor: col-resize;
  background: #0f3460;
  flex-shrink: 0;
}
#splitter:hover,
#splitter.dragging {
  background: #1f5d99;
}`,
    'tileset panel styles'
  )

  next = replaceRequired(
    next,
    `#map-panel {
  flex: 1;
  overflow: auto;
  background: #0a0a1a;
  padding: 16px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}`,
    `#map-panel {
  flex: 1;
  min-width: 0;
  overflow: auto;
  background: #0a0a1a;
  padding: 16px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}`,
    'map panel styles'
  )

  next = replaceRequired(
    next,
    `  </div>
  <div id="map-panel">
    <canvas id="map-canvas"></canvas>
  </div>`,
    `  </div>
  <div id="splitter"></div>
  <div id="map-panel">
    <canvas id="map-canvas"></canvas>
  </div>`,
    'splitter markup'
  )

  next = replaceRequired(
    next,
    `const tilesetCanvas = document.getElementById('tileset-canvas')
const tilesetCtx    = tilesetCanvas.getContext('2d')
const mapCanvas     = document.getElementById('map-canvas')
const mapCtx        = mapCanvas.getContext('2d')

const TS_ZOOM = 2   // tileset panel display zoom
`,
    `const tilesetCanvas = document.getElementById('tileset-canvas')
const tilesetCtx    = tilesetCanvas.getContext('2d')
const mapPanel      = document.getElementById('map-panel')
const mapCanvas     = document.getElementById('map-canvas')
const mapCtx        = mapCanvas.getContext('2d')
const tilesetPanel  = document.getElementById('tileset-panel')
const splitter      = document.getElementById('splitter')

const TS_ZOOM = 2   // tileset panel display zoom

let isResizingPanels = false
let isPanningMap = false
let mapPanStartX = 0
let mapPanStartY = 0
let mapPanScrollLeft = 0
let mapPanScrollTop = 0

function clampTilesetPanelWidth(width) {
  const minWidth = 200
  const maxWidth = Math.min(Math.floor(window.innerWidth * 0.75), 900)
  return Math.max(minWidth, Math.min(width, maxWidth))
}

function setTilesetPanelWidth(width) {
  tilesetPanel.style.width = clampTilesetPanelWidth(width) + 'px'
}

function shouldPanMap(e) {
  return e.button === 1 || (e.button === 0 && e.shiftKey)
}

function startMapPan(e) {
  isPanningMap = true
  mapPanStartX = e.clientX
  mapPanStartY = e.clientY
  mapPanScrollLeft = mapPanel.scrollLeft
  mapPanScrollTop = mapPanel.scrollTop
  mapPanel.style.cursor = 'grabbing'
  mapCanvas.style.cursor = 'grabbing'
}

function stopMapPan() {
  if (!isPanningMap) return
  isPanningMap = false
  mapPanel.style.cursor = 'crosshair'
  mapCanvas.style.cursor = 'crosshair'
}

splitter.addEventListener('mousedown', e => {
  e.preventDefault()
  isResizingPanels = true
  splitter.classList.add('dragging')
})

window.addEventListener('mousemove', e => {
  if (!isResizingPanels) return
  setTilesetPanelWidth(e.clientX)
})

window.addEventListener('mousemove', e => {
  if (!isPanningMap) return
  mapPanel.scrollLeft = mapPanScrollLeft - (e.clientX - mapPanStartX)
  mapPanel.scrollTop = mapPanScrollTop - (e.clientY - mapPanStartY)
})

window.addEventListener('mouseup', () => {
  if (!isResizingPanels) return
  isResizingPanels = false
  splitter.classList.remove('dragging')
})

window.addEventListener('mouseup', () => {
  stopMapPan()
})

window.addEventListener('resize', () => {
  setTilesetPanelWidth(tilesetPanel.getBoundingClientRect().width)
})
`,
    'splitter script'
  )

  next = replaceRequired(
    next,
    `    tilesetCanvasW = Math.max(...dims.map(d => d.w)) * TS_ZOOM
    tilesetCanvasH = Math.max(...dims.map(d => d.h)) * TS_ZOOM
    document.getElementById('tileset-panel').style.width = tilesetCanvasW + 'px'
`,
    `    tilesetCanvasW = Math.max(...dims.map(d => d.w)) * TS_ZOOM
    tilesetCanvasH = Math.max(...dims.map(d => d.h)) * TS_ZOOM
    const defaultPanelWidth = Math.min(Math.floor(window.innerWidth * 0.4), 420)
    setTilesetPanelWidth(tilesetPanel.getBoundingClientRect().width || defaultPanelWidth)
`,
    'tileset panel width logic'
  )

  next = replaceRequired(
    next,
    `mapCanvas.addEventListener('mousedown', e => {
  e.preventDefault()
  isMouseDown        = true
  undoPushedThisDrag = false
  applyCell(cellFromEvent(e), e.button === 2)
})
`,
    `mapCanvas.addEventListener('mousedown', e => {
  e.preventDefault()
  if (shouldPanMap(e)) {
    startMapPan(e)
    isMouseDown = false
    return
  }
  isMouseDown        = true
  undoPushedThisDrag = false
  applyCell(cellFromEvent(e), e.button === 2)
})
`,
    'map pan mousedown'
  )

  next = replaceRequired(
    next,
    `mapCanvas.addEventListener('mousemove', e => {
  const cell = cellFromEvent(e)
`,
    `mapCanvas.addEventListener('mousemove', e => {
  if (isPanningMap) return
  const cell = cellFromEvent(e)
`,
    'map pan mousemove'
  )

  next = replaceRequired(
    next,
    `mapCanvas.addEventListener('mouseup', () => {
  if (mode === 'collision') applyCollisionRect()
  isMouseDown = false
})
mapCanvas.addEventListener('mouseleave', () => {
  if (mode === 'collision') applyCollisionRect()
  isMouseDown = false
})
`,
    `mapCanvas.addEventListener('mouseup', () => {
  if (isPanningMap) {
    stopMapPan()
    return
  }
  if (mode === 'collision') applyCollisionRect()
  isMouseDown = false
})
mapCanvas.addEventListener('mouseleave', () => {
  if (isPanningMap) {
    stopMapPan()
    return
  }
  if (mode === 'collision') applyCollisionRect()
  isMouseDown = false
})
`,
    'map pan mouseup'
  )

  if (nextLauncher !== null) {
    nextLauncher = replaceRequired(
      nextLauncher,
      `function openBrowser(url) {
    const platform = process.platform
    const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd' : 'xdg-open'
    const args = platform === 'win32' ? ['/c', 'start', '', url] : [url]
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref()
}`,
      `function openBrowser(url) {
    const platform = process.platform
    const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'rundll32.exe' : 'xdg-open'
    const args = platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url]
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref()
}`,
      'windows browser launcher'
    )
  }

  if (next === source && (nextLauncher === launcherSource || nextLauncher === null)) {
    console.log('Maki tilemap patches already applied')
    return
  }

  if (next !== source) {
    await writeFile(editorPath, next, 'utf8')
  }

  if (nextLauncher !== launcherSource && nextLauncher !== null) {
    await writeFile(tilemapLauncherPath, nextLauncher, 'utf8')
  }

  console.log('Applied local patches to Maki tilemap tooling')
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})

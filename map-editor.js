const bootstrapUrl = '/api/map-editor/bootstrap'
const mapApiBase = '/api/map-editor/maps'
const tilesetCanvas = document.getElementById('tileset-canvas')
const tilesetContext = tilesetCanvas.getContext('2d')
const mapCanvas = document.getElementById('map-canvas')
const mapContext = mapCanvas.getContext('2d')
const mapPanel = document.getElementById('map-panel')
const tilesetPanel = document.getElementById('tileset-panel')
const splitter = document.getElementById('splitter')
const statusNode = document.getElementById('status')
const mapSelect = document.getElementById('map-select')
const mapNameInput = document.getElementById('map-name')
const tilesetSelect = document.getElementById('tileset-select')
const mapWidthInput = document.getElementById('map-width')
const mapHeightInput = document.getElementById('map-height')
const tileSizeInput = document.getElementById('tile-size')
const brushSizeInput = document.getElementById('brush-size')
const modeButtons = {
    paint: document.getElementById('mode-paint'),
    erase: document.getElementById('mode-erase'),
    collision: document.getElementById('mode-collision'),
    picker: document.getElementById('mode-picker')
}
const gridButton = document.getElementById('toggle-grid')

const state = {
    availableMaps: [],
    availableTilesets: [],
    mapName: 'default_map',
    tilesetPath: '',
    tileSize: 32,
    mapWidth: 40,
    mapHeight: 30,
    floor: [],
    collision: [],
    furniture: [],
    zoom: 1.5,
    showGrid: true,
    mode: 'paint',
    brushSize: 1,
    selectedTile: 1,
    hoverCell: null,
    tilesetImage: null,
    tilesetColumns: 0,
    tilesetRows: 0,
    tilesetZoom: 2,
    isPainting: false,
    isPanning: false,
    isResizing: false,
    panStartX: 0,
    panStartY: 0,
    panScrollLeft: 0,
    panScrollTop: 0
}

function setStatus(message) {
    statusNode.textContent = message
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value))
}

function createFloorGrid(width, height, fillValue = 0) {
    return Array.from({ length: height }, () => Array(width).fill(fillValue))
}

function createCollisionGrid(width, height) {
    return Array.from({ length: height }, () => Array(width).fill(false))
}

function normalizeFloorGrid(source, width, height) {
    const grid = createFloorGrid(width, height, 0)

    for (let row = 0; row < height; row += 1) {
        for (let col = 0; col < width; col += 1) {
            grid[row][col] = Number(source?.[row]?.[col] ?? 0)
        }
    }

    return grid
}

function normalizeCollisionGrid(collisions, width, height, tileSize) {
    const grid = createCollisionGrid(width, height)

    for (const rect of collisions ?? []) {
        const startCol = Math.floor((rect.x ?? 0) / tileSize)
        const startRow = Math.floor((rect.y ?? 0) / tileSize)
        const cols = Math.max(1, Math.round((rect.w ?? tileSize) / tileSize))
        const rows = Math.max(1, Math.round((rect.h ?? tileSize) / tileSize))

        for (let row = startRow; row < startRow + rows; row += 1) {
            for (let col = startCol; col < startCol + cols; col += 1) {
                if (row >= 0 && row < height && col >= 0 && col < width) {
                    grid[row][col] = true
                }
            }
        }
    }

    return grid
}

function collisionGridToRects(grid, tileSize) {
    const rects = []

    for (let row = 0; row < grid.length; row += 1) {
        for (let col = 0; col < grid[row].length; col += 1) {
            if (!grid[row][col]) {
                continue
            }

            rects.push({
                x: col * tileSize,
                y: row * tileSize,
                w: tileSize,
                h: tileSize
            })
        }
    }

    return rects
}

async function fetchJson(url, options) {
    const response = await fetch(url, options)

    if (!response.ok) {
        const fallback = `Request failed: ${response.status}`
        let message = fallback

        try {
            const payload = await response.json()
            message = payload?.error || fallback
        } catch {
            message = fallback
        }

        throw new Error(message)
    }

    return response.json()
}

function syncInputs() {
    mapNameInput.value = state.mapName
    mapWidthInput.value = String(state.mapWidth)
    mapHeightInput.value = String(state.mapHeight)
    tileSizeInput.value = String(state.tileSize)
    brushSizeInput.value = String(state.brushSize)
    tilesetSelect.value = state.tilesetPath
    mapSelect.value = state.availableMaps.includes(state.mapName) ? state.mapName : ''
    Object.entries(modeButtons).forEach(([mode, button]) => {
        button.classList.toggle('active', state.mode === mode)
    })
    gridButton.classList.toggle('active', state.showGrid)
}

function updateDocumentTitle() {
    document.title = `Map Editor - ${state.mapName}`
}

function setMode(mode) {
    state.mode = mode
    syncInputs()
}

function setBrushSize(nextSize) {
    state.brushSize = clamp(Number(nextSize) || 1, 1, 12)
    syncInputs()
    renderMap()
}

function setZoom(nextZoom, anchor) {
    const previousZoom = state.zoom
    state.zoom = clamp(nextZoom, 0.5, 4)

    if (anchor) {
        const rect = mapCanvas.getBoundingClientRect()
        const localX = anchor.clientX - rect.left
        const localY = anchor.clientY - rect.top
        const worldX = (mapPanel.scrollLeft + localX) / previousZoom
        const worldY = (mapPanel.scrollTop + localY) / previousZoom

        renderMap()

        mapPanel.scrollLeft = worldX * state.zoom - localX
        mapPanel.scrollTop = worldY * state.zoom - localY
        return
    }

    renderMap()
}

function getTileSourceRect(tileId) {
    const zeroBased = tileId - 1
    const sourceCol = zeroBased % state.tilesetColumns
    const sourceRow = Math.floor(zeroBased / state.tilesetColumns)

    return {
        sx: sourceCol * state.tileSize,
        sy: sourceRow * state.tileSize
    }
}

function drawTilePreview() {
    if (!state.tilesetImage || state.selectedTile <= 0) {
        return
    }

    const { sx, sy } = getTileSourceRect(state.selectedTile)
    const previewX = 8
    const previewY = tilesetCanvas.height - state.tileSize * state.tilesetZoom - 8
    const previewSize = state.tileSize * state.tilesetZoom

    tilesetContext.fillStyle = 'rgba(0, 0, 0, 0.72)'
    tilesetContext.fillRect(previewX - 4, previewY - 4, previewSize + 8, previewSize + 8)
    tilesetContext.drawImage(
        state.tilesetImage,
        sx,
        sy,
        state.tileSize,
        state.tileSize,
        previewX,
        previewY,
        previewSize,
        previewSize
    )
}

function renderTileset() {
    if (!state.tilesetImage) {
        return
    }

    const scaledWidth = state.tilesetImage.width * state.tilesetZoom
    const scaledHeight = state.tilesetImage.height * state.tilesetZoom
    tilesetCanvas.width = scaledWidth
    tilesetCanvas.height = scaledHeight + state.tileSize * state.tilesetZoom + 16
    tilesetContext.imageSmoothingEnabled = false
    tilesetContext.clearRect(0, 0, tilesetCanvas.width, tilesetCanvas.height)
    tilesetContext.fillStyle = '#0c121d'
    tilesetContext.fillRect(0, 0, tilesetCanvas.width, tilesetCanvas.height)
    tilesetContext.drawImage(state.tilesetImage, 0, 0, scaledWidth, scaledHeight)

    tilesetContext.strokeStyle = 'rgba(255, 255, 255, 0.15)'
    tilesetContext.lineWidth = 1

    for (let col = 0; col <= state.tilesetColumns; col += 1) {
        const x = col * state.tileSize * state.tilesetZoom + 0.5
        tilesetContext.beginPath()
        tilesetContext.moveTo(x, 0)
        tilesetContext.lineTo(x, scaledHeight)
        tilesetContext.stroke()
    }

    for (let row = 0; row <= state.tilesetRows; row += 1) {
        const y = row * state.tileSize * state.tilesetZoom + 0.5
        tilesetContext.beginPath()
        tilesetContext.moveTo(0, y)
        tilesetContext.lineTo(scaledWidth, y)
        tilesetContext.stroke()
    }

    if (state.selectedTile > 0) {
        const { sx, sy } = getTileSourceRect(state.selectedTile)
        tilesetContext.strokeStyle = '#9be257'
        tilesetContext.lineWidth = 3
        tilesetContext.strokeRect(
            sx * state.tilesetZoom + 1.5,
            sy * state.tilesetZoom + 1.5,
            state.tileSize * state.tilesetZoom - 3,
            state.tileSize * state.tilesetZoom - 3
        )
    }

    drawTilePreview()
}

function renderMap() {
    const scaledTileSize = state.tileSize * state.zoom
    mapCanvas.width = Math.max(1, Math.round(state.mapWidth * scaledTileSize))
    mapCanvas.height = Math.max(1, Math.round(state.mapHeight * scaledTileSize))
    mapContext.imageSmoothingEnabled = false
    mapContext.clearRect(0, 0, mapCanvas.width, mapCanvas.height)
    mapContext.fillStyle = '#101822'
    mapContext.fillRect(0, 0, mapCanvas.width, mapCanvas.height)

    if (state.tilesetImage) {
        for (let row = 0; row < state.mapHeight; row += 1) {
            for (let col = 0; col < state.mapWidth; col += 1) {
                const tileId = state.floor[row][col]

                if (!tileId) {
                    continue
                }

                const { sx, sy } = getTileSourceRect(tileId)
                mapContext.drawImage(
                    state.tilesetImage,
                    sx,
                    sy,
                    state.tileSize,
                    state.tileSize,
                    col * scaledTileSize,
                    row * scaledTileSize,
                    scaledTileSize,
                    scaledTileSize
                )
            }
        }
    }

    for (let row = 0; row < state.mapHeight; row += 1) {
        for (let col = 0; col < state.mapWidth; col += 1) {
            if (state.collision[row][col]) {
                mapContext.fillStyle = 'rgba(255, 110, 110, 0.42)'
                mapContext.fillRect(col * scaledTileSize, row * scaledTileSize, scaledTileSize, scaledTileSize)
            }
        }
    }

    if (state.showGrid) {
        mapContext.strokeStyle = 'rgba(255, 255, 255, 0.12)'
        mapContext.lineWidth = 1

        for (let col = 0; col <= state.mapWidth; col += 1) {
            const x = col * scaledTileSize + 0.5
            mapContext.beginPath()
            mapContext.moveTo(x, 0)
            mapContext.lineTo(x, mapCanvas.height)
            mapContext.stroke()
        }

        for (let row = 0; row <= state.mapHeight; row += 1) {
            const y = row * scaledTileSize + 0.5
            mapContext.beginPath()
            mapContext.moveTo(0, y)
            mapContext.lineTo(mapCanvas.width, y)
            mapContext.stroke()
        }
    }

    if (state.hoverCell) {
        const previewSize = state.brushSize * scaledTileSize
        mapContext.strokeStyle = state.mode === 'collision' ? '#ff7d66' : '#9be257'
        mapContext.lineWidth = 2
        mapContext.strokeRect(
            state.hoverCell.col * scaledTileSize + 1,
            state.hoverCell.row * scaledTileSize + 1,
            previewSize - 2,
            previewSize - 2
        )
    }
}

function loadTilesetImage(path) {
    return new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error(`Failed to load tileset: ${path}`))
        image.src = `/${path.replace(/^assets\//, '')}?t=${Date.now()}`
    })
}

async function applyTileset(path) {
    state.tilesetPath = path
    state.tilesetImage = await loadTilesetImage(path)
    state.tilesetColumns = Math.floor(state.tilesetImage.width / state.tileSize)
    state.tilesetRows = Math.floor(state.tilesetImage.height / state.tileSize)
    renderTileset()
    renderMap()
}

function populateSelect(select, values, placeholder = '') {
    select.innerHTML = ''

    if (placeholder) {
        const emptyOption = document.createElement('option')
        emptyOption.value = ''
        emptyOption.textContent = placeholder
        select.appendChild(emptyOption)
    }

    for (const value of values) {
        const option = document.createElement('option')
        option.value = value
        option.textContent = value
        select.appendChild(option)
    }
}

async function loadBootstrap() {
    const payload = await fetchJson(bootstrapUrl)
    state.availableMaps = payload.maps || []
    state.availableTilesets = payload.tilesets || []
    populateSelect(mapSelect, state.availableMaps, '')
    populateSelect(tilesetSelect, state.availableTilesets, '')

    if (!state.tilesetPath && state.availableTilesets.length > 0) {
        state.tilesetPath = state.availableTilesets[0]
    }
}

async function loadMap(name) {
    const payload = await fetchJson(`${mapApiBase}/${encodeURIComponent(name)}`)
    state.mapName = payload.name || name
    state.tilesetPath = payload.tileset
    state.tileSize = Number(payload.tileSize || 32)
    state.mapWidth = Number(payload.mapWidth || 1)
    state.mapHeight = Number(payload.mapHeight || 1)
    state.floor = normalizeFloorGrid(payload.layers?.floor, state.mapWidth, state.mapHeight)
    state.collision = normalizeCollisionGrid(payload.collisions, state.mapWidth, state.mapHeight, state.tileSize)
    state.furniture = Array.isArray(payload.layers?.furniture) ? payload.layers.furniture : []
    state.hoverCell = null
    await applyTileset(state.tilesetPath)
    syncInputs()
    updateDocumentTitle()
    setStatus(`Loaded assets/maps/${name}.json`)
}

function createNewMap() {
    state.mapName = mapNameInput.value.trim() || 'new_map'
    state.mapWidth = Math.max(1, Number(mapWidthInput.value) || 1)
    state.mapHeight = Math.max(1, Number(mapHeightInput.value) || 1)
    state.tileSize = Math.max(8, Number(tileSizeInput.value) || 32)
    state.tilesetPath = tilesetSelect.value || state.availableTilesets[0] || ''
    state.floor = createFloorGrid(state.mapWidth, state.mapHeight, 0)
    state.collision = createCollisionGrid(state.mapWidth, state.mapHeight)
    state.furniture = []
    state.hoverCell = null
    updateDocumentTitle()
    applyTileset(state.tilesetPath)
    syncInputs()
    setStatus(`Created new map ${state.mapName}`)
}

function resizeMap() {
    const nextWidth = Math.max(1, Number(mapWidthInput.value) || 1)
    const nextHeight = Math.max(1, Number(mapHeightInput.value) || 1)
    const resizedFloor = createFloorGrid(nextWidth, nextHeight, 0)
    const resizedCollision = createCollisionGrid(nextWidth, nextHeight)

    for (let row = 0; row < Math.min(state.mapHeight, nextHeight); row += 1) {
        for (let col = 0; col < Math.min(state.mapWidth, nextWidth); col += 1) {
            resizedFloor[row][col] = state.floor[row][col]
            resizedCollision[row][col] = state.collision[row][col]
        }
    }

    state.mapWidth = nextWidth
    state.mapHeight = nextHeight
    state.floor = resizedFloor
    state.collision = resizedCollision
    renderMap()
    syncInputs()
    setStatus(`Resized map to ${nextWidth} x ${nextHeight}`)
}

async function saveMap() {
    const mapName = mapNameInput.value.trim()

    if (!mapName) {
        setStatus('Map name is required before saving')
        return
    }

    state.mapName = mapName
    state.mapWidth = Math.max(1, Number(mapWidthInput.value) || state.mapWidth)
    state.mapHeight = Math.max(1, Number(mapHeightInput.value) || state.mapHeight)
    state.tileSize = Math.max(8, Number(tileSizeInput.value) || state.tileSize)
    state.tilesetPath = tilesetSelect.value || state.tilesetPath

    const payload = {
        name: state.mapName,
        tileset: state.tilesetPath,
        tileSize: state.tileSize,
        mapWidth: state.mapWidth,
        mapHeight: state.mapHeight,
        layers: {
            floor: state.floor,
            furniture: state.furniture
        },
        collisions: collisionGridToRects(state.collision, state.tileSize)
    }

    await fetchJson(`${mapApiBase}/${encodeURIComponent(state.mapName)}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })

    if (!state.availableMaps.includes(state.mapName)) {
        state.availableMaps.push(state.mapName)
        state.availableMaps.sort((left, right) => left.localeCompare(right))
        populateSelect(mapSelect, state.availableMaps, '')
    }

    syncInputs()
    updateDocumentTitle()
    setStatus(`Saved assets/maps/${state.mapName}.json`)
}

function mapCellFromEvent(event) {
    const rect = mapCanvas.getBoundingClientRect()
    const col = Math.floor((event.clientX - rect.left) / (state.tileSize * state.zoom))
    const row = Math.floor((event.clientY - rect.top) / (state.tileSize * state.zoom))

    if (col < 0 || row < 0 || col >= state.mapWidth || row >= state.mapHeight) {
        return null
    }

    return { row, col }
}

function tilesetCellFromEvent(event) {
    const rect = tilesetCanvas.getBoundingClientRect()
    const col = Math.floor((event.clientX - rect.left) / (state.tileSize * state.tilesetZoom))
    const row = Math.floor((event.clientY - rect.top) / (state.tileSize * state.tilesetZoom))

    if (col < 0 || row < 0 || col >= state.tilesetColumns || row >= state.tilesetRows) {
        return null
    }

    return { row, col }
}

function applyBrush(cell, options = {}) {
    if (!cell) {
        return
    }

    const eraseCollision = options.eraseCollision === true

    for (let row = cell.row; row < Math.min(state.mapHeight, cell.row + state.brushSize); row += 1) {
        for (let col = cell.col; col < Math.min(state.mapWidth, cell.col + state.brushSize); col += 1) {
            if (state.mode === 'paint') {
                state.floor[row][col] = state.selectedTile
            } else if (state.mode === 'erase') {
                state.floor[row][col] = 0
            } else if (state.mode === 'collision') {
                state.collision[row][col] = !eraseCollision
            } else if (state.mode === 'picker') {
                state.selectedTile = state.floor[row][col] || state.selectedTile
                renderTileset()
                setMode('paint')
                return
            }
        }
    }

    renderMap()
}

function shouldPan(event) {
    return event.button === 1 || (event.button === 0 && event.shiftKey) || (event.button === 0 && event.code === 'Space')
}

function startPan(event) {
    state.isPanning = true
    state.panStartX = event.clientX
    state.panStartY = event.clientY
    state.panScrollLeft = mapPanel.scrollLeft
    state.panScrollTop = mapPanel.scrollTop
    mapPanel.style.cursor = 'grabbing'
}

function stopPan() {
    state.isPanning = false
    mapPanel.style.cursor = 'crosshair'
}

function handleMapWheel(event) {
    event.preventDefault()
    const direction = event.deltaY > 0 ? -0.1 : 0.1
    setZoom(state.zoom + direction, event)
    setStatus(`Zoom ${Math.round(state.zoom * 100)}%`)
}

function beginResize() {
    state.isResizing = true
    splitter.classList.add('dragging')
}

function endResize() {
    state.isResizing = false
    splitter.classList.remove('dragging')
}

function handlePointerMove(event) {
    if (state.isResizing) {
        const width = clamp(event.clientX, 240, window.innerWidth * 0.65)
        document.documentElement.style.setProperty('--tileset-width', `${width}px`)
        return
    }

    if (state.isPanning) {
        mapPanel.scrollLeft = state.panScrollLeft - (event.clientX - state.panStartX)
        mapPanel.scrollTop = state.panScrollTop - (event.clientY - state.panStartY)
        return
    }

    const cell = mapCellFromEvent(event)
    state.hoverCell = cell

    if (cell && state.isPainting) {
        applyBrush(cell, { eraseCollision: event.buttons === 2 })
    } else {
        renderMap()
    }
}

function bindEvents() {
    document.getElementById('load-map').addEventListener('click', async () => {
        if (!mapSelect.value) {
            setStatus('Select a map to load')
            return
        }

        await loadMap(mapSelect.value)
    })

    document.getElementById('new-map').addEventListener('click', createNewMap)
    document.getElementById('resize-map').addEventListener('click', resizeMap)
    document.getElementById('save-map').addEventListener('click', async () => {
        try {
            await saveMap()
        } catch (error) {
            setStatus(error.message)
        }
    })

    document.getElementById('zoom-in').addEventListener('click', () => setZoom(state.zoom + 0.25))
    document.getElementById('zoom-out').addEventListener('click', () => setZoom(state.zoom - 0.25))

    gridButton.addEventListener('click', () => {
        state.showGrid = !state.showGrid
        syncInputs()
        renderMap()
    })

    Object.entries(modeButtons).forEach(([mode, button]) => {
        button.addEventListener('click', () => setMode(mode))
    })

    document.getElementById('brush-inc').addEventListener('click', () => setBrushSize(state.brushSize + 1))
    document.getElementById('brush-dec').addEventListener('click', () => setBrushSize(state.brushSize - 1))
    brushSizeInput.addEventListener('change', () => setBrushSize(brushSizeInput.value))

    tilesetSelect.addEventListener('change', async () => {
        state.tilesetPath = tilesetSelect.value
        await applyTileset(state.tilesetPath)
        setStatus(`Tileset ${state.tilesetPath}`)
    })

    tileSizeInput.addEventListener('change', async () => {
        state.tileSize = Math.max(8, Number(tileSizeInput.value) || 32)
        state.floor = normalizeFloorGrid(state.floor, state.mapWidth, state.mapHeight)
        state.collision = normalizeCollisionGrid(collisionGridToRects(state.collision, state.tileSize), state.mapWidth, state.mapHeight, state.tileSize)
        await applyTileset(state.tilesetPath)
        syncInputs()
    })

    tilesetCanvas.addEventListener('mousedown', event => {
        const cell = tilesetCellFromEvent(event)

        if (!cell) {
            return
        }

        state.selectedTile = cell.row * state.tilesetColumns + cell.col + 1
        renderTileset()
        setStatus(`Selected tile ${state.selectedTile}`)
    })

    mapCanvas.addEventListener('mousedown', event => {
        event.preventDefault()

        if (event.button === 1 || (event.button === 0 && event.shiftKey)) {
            startPan(event)
            return
        }

        const cell = mapCellFromEvent(event)
        state.hoverCell = cell
        state.isPainting = true
        applyBrush(cell, { eraseCollision: event.button === 2 })
    })

    mapCanvas.addEventListener('mousemove', handlePointerMove)
    mapCanvas.addEventListener('wheel', handleMapWheel, { passive: false })
    mapCanvas.addEventListener('contextmenu', event => event.preventDefault())
    mapCanvas.addEventListener('mouseleave', () => {
        state.hoverCell = null
        if (!state.isPainting) {
            renderMap()
        }
    })

    splitter.addEventListener('mousedown', event => {
        event.preventDefault()
        beginResize()
    })

    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', () => {
        state.isPainting = false
        stopPan()
        endResize()
    })
}

async function init() {
    bindEvents()
    await loadBootstrap()

    const params = new URLSearchParams(window.location.search)
    const requestedMap = params.get('map') || (state.availableMaps.includes('default_map') ? 'default_map' : state.availableMaps[0])

    if (requestedMap) {
        try {
            await loadMap(requestedMap)
        } catch (error) {
            setStatus(error.message)
            createNewMap()
        }
    } else {
        createNewMap()
    }

    syncInputs()
    updateDocumentTitle()
    setStatus(`Ready: ${state.mapName}`)
}

init().catch(error => {
    console.error(error)
    setStatus(error.message)
})

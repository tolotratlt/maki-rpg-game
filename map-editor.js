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
const singleTileRepeatInput = document.getElementById('single-tile-repeat')
const undoMapButton = document.getElementById('undo-map')
const objectControls = document.getElementById('object-controls')
const objectGrid = document.getElementById('object-grid')
const modeButtons = {
    paint: document.getElementById('mode-paint'),
    erase: document.getElementById('mode-erase'),
    collision: document.getElementById('mode-collision'),
    object: document.getElementById('mode-object'),
    picker: document.getElementById('mode-picker')
}
const gridButton = document.getElementById('toggle-grid')

const state = {
    availableMaps: [],
    availableTilesets: [],
    availableFurnitureAssets: [],
    mapName: 'default_map',
    tilesetPath: '',
    tileSize: 32,
    mapWidth: 40,
    mapHeight: 30,
    floor: [],
    collision: [],
    furniture: [],
    furnitureImages: new Map(),
    zoom: 1.5,
    showGrid: true,
    mode: 'paint',
    brushSize: 1,
    repeatSingleTile: false,
    selectedTile: 1,
    selectedFurnitureAsset: '',
    hoverCell: null,
    undoStack: [],
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
    panScrollTop: 0,
    hasPendingUndoSnapshot: false
}

const MAX_UNDO_STATES = 40

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

function getFurnitureBounds(item) {
    return {
        left: item.x,
        top: item.y,
        right: item.x + item.w,
        bottom: item.y + item.h
    }
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
    singleTileRepeatInput.checked = state.repeatSingleTile
    tilesetSelect.value = state.tilesetPath
    mapSelect.value = state.availableMaps.includes(state.mapName) ? state.mapName : ''
    Object.entries(modeButtons).forEach(([mode, button]) => {
        button.classList.toggle('active', state.mode === mode)
    })
    gridButton.classList.toggle('active', state.showGrid)
    undoMapButton.disabled = state.undoStack.length === 0
    objectControls.classList.toggle('active', state.mode === 'object')
}

function updateDocumentTitle() {
    document.title = `Map Editor - ${state.mapName}`
}

function setMode(mode) {
    state.mode = mode
    syncInputs()
    renderMap()
}

function setBrushSize(nextSize) {
    state.brushSize = clamp(Number(nextSize) || 1, 1, 12)
    syncInputs()
    renderTileset()
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

function cloneMatrix(matrix) {
    return matrix.map(row => [...row])
}

function createUndoSnapshot() {
    return {
        mapName: state.mapName,
        tilesetPath: state.tilesetPath,
        tileSize: state.tileSize,
        mapWidth: state.mapWidth,
        mapHeight: state.mapHeight,
        floor: cloneMatrix(state.floor),
        collision: cloneMatrix(state.collision),
        furniture: Array.isArray(state.furniture)
            ? state.furniture.map(item => ({ ...item }))
            : []
    }
}

function pushUndoSnapshot() {
    state.undoStack.push(createUndoSnapshot())

    if (state.undoStack.length > MAX_UNDO_STATES) {
        state.undoStack.shift()
    }

    syncInputs()
}

async function undoMapChange() {
    const snapshot = state.undoStack.pop()

    if (!snapshot) {
        syncInputs()
        return
    }

    state.mapName = snapshot.mapName
    state.tilesetPath = snapshot.tilesetPath
    state.tileSize = snapshot.tileSize
    state.mapWidth = snapshot.mapWidth
    state.mapHeight = snapshot.mapHeight
    state.floor = cloneMatrix(snapshot.floor)
    state.collision = cloneMatrix(snapshot.collision)
    state.furniture = snapshot.furniture.map(item => ({ ...item }))
    state.hoverCell = null
    state.hasPendingUndoSnapshot = false

    await applyTileset(state.tilesetPath)
    syncInputs()
    updateDocumentTitle()
    setStatus(`Undo restored ${state.mapName}`)
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

function getSelectedBrushTileOrigin() {
    if (state.selectedTile <= 0) {
        return { col: 0, row: 0 }
    }

    const zeroBased = state.selectedTile - 1

    return {
        col: zeroBased % state.tilesetColumns,
        row: Math.floor(zeroBased / state.tilesetColumns)
    }
}

function getSelectedBrushDimensions() {
    if (state.repeatSingleTile) {
        return { width: 1, height: 1 }
    }

    const origin = getSelectedBrushTileOrigin()

    return {
        width: Math.max(1, Math.min(state.brushSize, state.tilesetColumns - origin.col)),
        height: Math.max(1, Math.min(state.brushSize, state.tilesetRows - origin.row))
    }
}

function getBrushTileIdAtOffset(offsetCol, offsetRow) {
    const origin = getSelectedBrushTileOrigin()
    const dimensions = getSelectedBrushDimensions()
    const brushCol = state.repeatSingleTile ? origin.col : origin.col + (offsetCol % dimensions.width)
    const brushRow = state.repeatSingleTile ? origin.row : origin.row + (offsetRow % dimensions.height)

    return brushRow * state.tilesetColumns + brushCol + 1
}

function drawTilePreview() {
    if (!state.tilesetImage || state.selectedTile <= 0) {
        return
    }

    const origin = getSelectedBrushTileOrigin()
    const dimensions = getSelectedBrushDimensions()
    const previewX = 8
    const previewWidth = dimensions.width * state.tileSize * state.tilesetZoom
    const previewHeight = dimensions.height * state.tileSize * state.tilesetZoom
    const previewY = tilesetCanvas.height - previewHeight - 8

    tilesetContext.fillStyle = 'rgba(0, 0, 0, 0.72)'
    tilesetContext.fillRect(previewX - 4, previewY - 4, previewWidth + 8, previewHeight + 8)

    for (let row = 0; row < dimensions.height; row += 1) {
        for (let col = 0; col < dimensions.width; col += 1) {
            const tileId = getBrushTileIdAtOffset(col, row)
            const { sx, sy } = getTileSourceRect(tileId)

            tilesetContext.drawImage(
                state.tilesetImage,
                sx,
                sy,
                state.tileSize,
                state.tileSize,
                previewX + col * state.tileSize * state.tilesetZoom,
                previewY + row * state.tileSize * state.tilesetZoom,
                state.tileSize * state.tilesetZoom,
                state.tileSize * state.tilesetZoom
            )
        }
    }
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
        const origin = getSelectedBrushTileOrigin()
        const dimensions = getSelectedBrushDimensions()
        tilesetContext.strokeStyle = '#9be257'
        tilesetContext.lineWidth = 3
        tilesetContext.strokeRect(
            origin.col * state.tileSize * state.tilesetZoom + 1.5,
            origin.row * state.tileSize * state.tilesetZoom + 1.5,
            dimensions.width * state.tileSize * state.tilesetZoom - 3,
            dimensions.height * state.tileSize * state.tilesetZoom - 3
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

    for (const item of state.furniture) {
        const image = state.furnitureImages.get(item.src)

        if (!image) {
            continue
        }

        mapContext.drawImage(
            image,
            item.x * state.zoom,
            item.y * state.zoom,
            item.w * state.zoom,
            item.h * state.zoom
        )
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
        const previewSize = state.mode === 'object' ? scaledTileSize : state.brushSize * scaledTileSize
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

function ensureFurnitureImage(src) {
    if (state.furnitureImages.has(src)) {
        return Promise.resolve(state.furnitureImages.get(src))
    }

    return new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => {
            state.furnitureImages.set(src, image)
            resolve(image)
        }
        image.onerror = () => reject(new Error(`Failed to load furniture asset: ${src}`))
        image.src = `/${src.replace(/^assets\//, '')}?t=${Date.now()}`
    })
}

async function preloadFurnitureImages() {
    const sources = new Set([
        ...state.availableFurnitureAssets,
        ...state.furniture.map(item => item.src)
    ])

    await Promise.all([...sources].map(async src => {
        try {
            await ensureFurnitureImage(src)
        } catch {
            return null
        }
        return null
    }))
}

function renderObjectGrid() {
    objectGrid.innerHTML = ''

    for (const src of state.availableFurnitureAssets) {
        const card = document.createElement('button')
        card.type = 'button'
        card.className = 'object-card'
        card.classList.toggle('active', src === state.selectedFurnitureAsset)
        const image = document.createElement('img')
        image.src = `/${src.replace(/^assets\//, '')}`
        const label = document.createElement('span')
        label.textContent = src.split('/').pop()
        card.appendChild(image)
        card.appendChild(label)
        card.addEventListener('click', () => {
            state.selectedFurnitureAsset = src
            renderObjectGrid()
            setStatus(`Selected furniture asset ${label.textContent}`)
        })
        objectGrid.appendChild(card)
    }
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
    state.availableFurnitureAssets = payload.furnitureAssets || []
    populateSelect(mapSelect, state.availableMaps, '')
    populateSelect(tilesetSelect, state.availableTilesets, '')

    if (!state.tilesetPath && state.availableTilesets.length > 0) {
        state.tilesetPath = state.availableTilesets[0]
    }

    if (!state.selectedFurnitureAsset && state.availableFurnitureAssets.length > 0) {
        state.selectedFurnitureAsset = state.availableFurnitureAssets[0]
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
    state.undoStack = []
    state.hasPendingUndoSnapshot = false
    await preloadFurnitureImages()
    await applyTileset(state.tilesetPath)
    syncInputs()
    updateDocumentTitle()
    setStatus(`Loaded assets/maps/${name}.json`)
}

function createNewMap() {
    pushUndoSnapshot()
    state.mapName = mapNameInput.value.trim() || 'new_map'
    state.mapWidth = Math.max(1, Number(mapWidthInput.value) || 1)
    state.mapHeight = Math.max(1, Number(mapHeightInput.value) || 1)
    state.tileSize = Math.max(8, Number(tileSizeInput.value) || 32)
    state.tilesetPath = tilesetSelect.value || state.availableTilesets[0] || ''
    state.floor = createFloorGrid(state.mapWidth, state.mapHeight, 0)
    state.collision = createCollisionGrid(state.mapWidth, state.mapHeight)
    state.furniture = []
    state.furnitureImages = new Map()
    state.hoverCell = null
    updateDocumentTitle()
    preloadFurnitureImages()
    applyTileset(state.tilesetPath)
    syncInputs()
    setStatus(`Created new map ${state.mapName}`)
}

function resizeMap() {
    pushUndoSnapshot()
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

function removeTopFurnitureAtCell(row, col) {
    const worldX = col * state.tileSize + state.tileSize / 2
    const worldY = row * state.tileSize + state.tileSize / 2

    for (let index = state.furniture.length - 1; index >= 0; index -= 1) {
        const item = state.furniture[index]
        const bounds = getFurnitureBounds(item)

        if (worldX >= bounds.left && worldX <= bounds.right && worldY >= bounds.top && worldY <= bounds.bottom) {
            state.furniture.splice(index, 1)
            return true
        }
    }

    return false
}

function applyBrush(cell, options = {}) {
    if (!cell) {
        return
    }

    const eraseCollision = options.eraseCollision === true

    for (let row = cell.row; row < Math.min(state.mapHeight, cell.row + state.brushSize); row += 1) {
        for (let col = cell.col; col < Math.min(state.mapWidth, cell.col + state.brushSize); col += 1) {
            if (state.mode === 'paint') {
                state.floor[row][col] = getBrushTileIdAtOffset(col - cell.col, row - cell.row)
            } else if (state.mode === 'erase') {
                state.floor[row][col] = 0
            } else if (state.mode === 'collision') {
                state.collision[row][col] = !eraseCollision
            } else if (state.mode === 'object') {
                if (eraseCollision) {
                    removeTopFurnitureAtCell(row, col)
                } else {
                    const image = state.furnitureImages.get(state.selectedFurnitureAsset)

                    if (!image || !state.selectedFurnitureAsset) {
                        continue
                    }

                    state.furniture.push({
                        src: state.selectedFurnitureAsset,
                        x: col * state.tileSize,
                        y: row * state.tileSize,
                        w: image.naturalWidth,
                        h: image.naturalHeight
                    })
                }
            } else if (state.mode === 'picker') {
                state.selectedTile = state.floor[row][col] || state.selectedTile
                renderTileset()
                setMode('paint')
                return
            }
        }
    }

    renderTileset()
    renderMap()
}

function beginMapMutation() {
    if (state.hasPendingUndoSnapshot || state.mode === 'picker') {
        return
    }

    pushUndoSnapshot()
    state.hasPendingUndoSnapshot = true
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
    undoMapButton.addEventListener('click', async () => {
        await undoMapChange()
    })
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
    singleTileRepeatInput.addEventListener('change', () => {
        state.repeatSingleTile = singleTileRepeatInput.checked
        syncInputs()
        renderTileset()
        renderMap()
    })

    tilesetSelect.addEventListener('change', async () => {
        state.tilesetPath = tilesetSelect.value
        await applyTileset(state.tilesetPath)
        setStatus(`Tileset ${state.tilesetPath}`)
    })

    tileSizeInput.addEventListener('change', async () => {
        pushUndoSnapshot()
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
        const dimensions = getSelectedBrushDimensions()
        setStatus(`Selected tileset brush ${dimensions.width} x ${dimensions.height} from tile ${state.selectedTile}`)
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
        beginMapMutation()
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
        state.hasPendingUndoSnapshot = false
        stopPan()
        endResize()
    })

    window.addEventListener('keydown', async event => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
            event.preventDefault()
            await undoMapChange()
        }
    })
}

async function init() {
    bindEvents()
    await loadBootstrap()
    await preloadFurnitureImages()
    renderObjectGrid()

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

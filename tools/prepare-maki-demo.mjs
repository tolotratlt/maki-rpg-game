import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const tileSize = 32
const mapWidth = 40
const mapHeight = 30
const frameWidth = 64
const frameHeight = 40

const sourceRoot = path.join(
    rootDir,
    'assets',
    'Captain Clown Nose',
    'Sprites',
    'Captain Clown Nose',
    'Captain Clown Nose without Sword'
)

const outputSpritePath = path.join(rootDir, 'assets', 'sprites', 'captain-clown-nose.png')
const outputTilePath = path.join(rootDir, 'assets', 'rooms', 'room1.png')
const outputMapPath = path.join(rootDir, 'assets', 'maps', 'default_map.json')

const idleFrames = [
    '01-Idle/Idle 01.png',
    '01-Idle/Idle 02.png',
    '01-Idle/Idle 03.png',
    '01-Idle/Idle 04.png',
    '01-Idle/Idle 05.png'
]

const runFrames = [
    '02-Run/Run 01.png',
    '02-Run/Run 02.png',
    '02-Run/Run 03.png',
    '02-Run/Run 04.png',
    '02-Run/Run 05.png',
    '02-Run/Run 06.png'
]

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true })
}

function resolveFrames(relativePaths) {
    return relativePaths.map(relativePath => {
        const absolutePath = path.join(sourceRoot, relativePath)
        if (!fs.existsSync(absolutePath)) {
            throw new Error(`Frame introuvable: ${absolutePath}`)
        }
        return absolutePath
    })
}

function repeatLastFrame(framePaths, desiredLength) {
    const frames = [...framePaths]
    while (frames.length < desiredLength) {
        frames.push(frames.at(-1))
    }
    return frames
}

function buildMapJson() {
    const floor = Array.from({ length: mapHeight }, () =>
        Array.from({ length: mapWidth }, () => 1)
    )

    const collisions = []
    let collisionId = 0

    for (let x = 0; x < mapWidth; x += 1) {
        collisions.push({
            id: collisionId++,
            x: x * tileSize,
            y: 0,
            w: tileSize,
            h: tileSize
        })
        collisions.push({
            id: collisionId++,
            x: x * tileSize,
            y: (mapHeight - 1) * tileSize,
            w: tileSize,
            h: tileSize
        })
    }

    for (let y = 1; y < mapHeight - 1; y += 1) {
        collisions.push({
            id: collisionId++,
            x: 0,
            y: y * tileSize,
            w: tileSize,
            h: tileSize
        })
        collisions.push({
            id: collisionId++,
            x: (mapWidth - 1) * tileSize,
            y: y * tileSize,
            w: tileSize,
            h: tileSize
        })
    }

    return {
        name: 'default_map',
        tileset: 'assets/rooms/room1.png',
        tileSize,
        mapWidth,
        mapHeight,
        layers: {
            floor,
            furniture: []
        },
        collisions
    }
}

function buildSpec() {
    const idle = repeatLastFrame(resolveFrames(idleFrames), 6)
    const run = resolveFrames(runFrames)

    return {
        roomTile: {
            output: outputTilePath,
            width: tileSize,
            height: tileSize
        },
        spriteSheet: {
            output: outputSpritePath,
            frameWidth,
            frameHeight,
            cols: 6,
            rows: 4,
            rowsData: [
                { frames: run, flipX: false },
                { frames: idle, flipX: false },
                { frames: run, flipX: true },
                { frames: idle, flipX: false }
            ]
        }
    }
}

function renderImagesWithPowerShell(specPath) {
    const psScript = `
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
$spec = Get-Content -Raw -Path $args[0] | ConvertFrom-Json

function Save-RoomTile {
    param([object]$tileSpec)

    $bitmap = New-Object System.Drawing.Bitmap($tileSpec.width, $tileSpec.height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half

    $base = [System.Drawing.ColorTranslator]::FromHtml('#69a84f')
    $light = [System.Drawing.ColorTranslator]::FromHtml('#78b85c')
    $dark = [System.Drawing.ColorTranslator]::FromHtml('#4a7e37')
    $accent = [System.Drawing.ColorTranslator]::FromHtml('#8cc063')

    $graphics.Clear($base)
    $graphics.FillRectangle((New-Object System.Drawing.SolidBrush($light)), 0, 0, $tileSpec.width, [Math]::Floor($tileSpec.height / 2))
    $graphics.FillRectangle((New-Object System.Drawing.SolidBrush($dark)), 0, [Math]::Floor($tileSpec.height / 2), $tileSpec.width, [Math]::Ceiling($tileSpec.height / 2))

    $pen = New-Object System.Drawing.Pen($accent)
    $graphics.DrawRectangle($pen, 1, 1, $tileSpec.width - 3, $tileSpec.height - 3)
    $graphics.DrawLine($pen, 0, [Math]::Floor($tileSpec.height / 2), $tileSpec.width, [Math]::Floor($tileSpec.height / 2))
    $graphics.FillRectangle((New-Object System.Drawing.SolidBrush($accent)), 6, 6, 3, 3)
    $graphics.FillRectangle((New-Object System.Drawing.SolidBrush($accent)), 22, 12, 2, 2)
    $graphics.FillRectangle((New-Object System.Drawing.SolidBrush($accent)), 14, 22, 2, 2)

    $dir = Split-Path -Parent $tileSpec.output
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $bitmap.Save($tileSpec.output, [System.Drawing.Imaging.ImageFormat]::Png)

    $pen.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}

function Save-SpriteSheet {
    param([object]$sheetSpec)

    $sheetWidth = $sheetSpec.frameWidth * $sheetSpec.cols
    $sheetHeight = $sheetSpec.frameHeight * $sheetSpec.rows
    $sheet = New-Object System.Drawing.Bitmap($sheetWidth, $sheetHeight)
    $graphics = [System.Drawing.Graphics]::FromImage($sheet)

    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half

    for ($row = 0; $row -lt $sheetSpec.rowsData.Count; $row++) {
        $rowSpec = $sheetSpec.rowsData[$row]
        for ($col = 0; $col -lt $rowSpec.frames.Count; $col++) {
            $framePath = [string]$rowSpec.frames[$col]
            $image = [System.Drawing.Image]::FromFile($framePath)
            $destX = $col * $sheetSpec.frameWidth
            $destY = $row * $sheetSpec.frameHeight

            if ($rowSpec.flipX) {
                $graphics.TranslateTransform($destX + $sheetSpec.frameWidth, $destY)
                $graphics.ScaleTransform(-1, 1)
                $graphics.DrawImage($image, 0, 0, $sheetSpec.frameWidth, $sheetSpec.frameHeight)
                $graphics.ResetTransform()
            } else {
                $graphics.DrawImage($image, $destX, $destY, $sheetSpec.frameWidth, $sheetSpec.frameHeight)
            }

            $image.Dispose()
        }
    }

    $dir = Split-Path -Parent $sheetSpec.output
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $sheet.Save($sheetSpec.output, [System.Drawing.Imaging.ImageFormat]::Png)

    $graphics.Dispose()
    $sheet.Dispose()
}

Save-RoomTile $spec.roomTile
Save-SpriteSheet $spec.spriteSheet
`

    const psScriptPath = path.join(os.tmpdir(), `maki-demo-${Date.now()}.ps1`)
    fs.writeFileSync(psScriptPath, psScript, 'utf8')

    const result = spawnSync(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psScriptPath, specPath],
        {
            cwd: rootDir,
            encoding: 'utf8'
        }
    )

    fs.rmSync(psScriptPath, { force: true })

    if (result.status !== 0) {
        throw new Error(result.stderr || result.stdout || 'La génération PowerShell a échoué.')
    }
}

function main() {
    ensureDir(path.dirname(outputSpritePath))
    ensureDir(path.dirname(outputTilePath))
    ensureDir(path.dirname(outputMapPath))

    const spec = buildSpec()
    const tempSpecPath = path.join(os.tmpdir(), `maki-demo-${Date.now()}.json`)
    fs.writeFileSync(tempSpecPath, JSON.stringify(spec, null, 2))

    try {
        renderImagesWithPowerShell(tempSpecPath)
    } finally {
        fs.rmSync(tempSpecPath, { force: true })
    }

    fs.writeFileSync(outputMapPath, `${JSON.stringify(buildMapJson(), null, 2)}\n`, 'utf8')

    console.log('Assets Maki générés :')
    console.log(`- ${path.relative(rootDir, outputSpritePath)}`)
    console.log(`- ${path.relative(rootDir, outputTilePath)}`)
    console.log(`- ${path.relative(rootDir, outputMapPath)}`)
}

main()

import { defineConfig } from 'vite'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const workspaceRoot = process.cwd()
const mapsDir = path.join(workspaceRoot, 'assets', 'maps')
const roomsDir = path.join(workspaceRoot, 'assets', 'rooms')
const spritesDir = path.join(workspaceRoot, 'assets', 'sprites')

function json(res, status, payload) {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(payload, null, 2))
}

async function readRequestBody(req) {
    const chunks = []

    for await (const chunk of req) {
        chunks.push(chunk)
    }

    return Buffer.concat(chunks).toString('utf8')
}

function parseMapName(url) {
    const match = url.pathname.match(/^\/api\/map-editor\/maps\/([^/]+)$/)
    if (!match) {
        return null
    }

    const mapName = decodeURIComponent(match[1])

    if (!/^[a-zA-Z0-9_-]+$/.test(mapName)) {
        return null
    }

    return mapName
}

async function collectImageAssets(rootDir, publicPrefix) {
    const results = []

    async function walk(currentDir) {
        const entries = await fs.readdir(currentDir, { withFileTypes: true })

        for (const entry of entries) {
            const absolutePath = path.join(currentDir, entry.name)

            if (entry.isDirectory()) {
                await walk(absolutePath)
                continue
            }

            if (!/\.(png|jpg|jpeg)$/i.test(entry.name)) {
                continue
            }

            const relativePath = path.relative(rootDir, absolutePath).replaceAll('\\', '/')
            results.push(`${publicPrefix}/${relativePath}`)
        }
    }

    try {
        await walk(rootDir)
    } catch (error) {
        if (!error || error.code !== 'ENOENT') {
            throw error
        }
    }

    return results.sort((left, right) => left.localeCompare(right))
}

function mapEditorApiPlugin() {
    return {
        name: 'map-editor-api',
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                if (!req.url) {
                    next()
                    return
                }

                const url = new URL(req.url, 'http://127.0.0.1')

                if (req.method === 'GET' && url.pathname === '/api/map-editor/bootstrap') {
                    const [mapEntries, tilesetEntries, furnitureAssets] = await Promise.all([
                        fs.readdir(mapsDir, { withFileTypes: true }),
                        fs.readdir(roomsDir, { withFileTypes: true }),
                        collectImageAssets(spritesDir, 'assets/sprites')
                    ])

                    const maps = mapEntries
                        .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
                        .map(entry => entry.name.replace(/\.json$/i, ''))
                        .sort((left, right) => left.localeCompare(right))

                    const tilesets = tilesetEntries
                        .filter(entry => entry.isFile() && /\.(png|jpg|jpeg)$/i.test(entry.name))
                        .map(entry => `assets/rooms/${entry.name}`)
                        .sort((left, right) => left.localeCompare(right))

                    json(res, 200, { maps, tilesets, furnitureAssets })
                    return
                }

                const mapName = parseMapName(url)

                if (!mapName) {
                    next()
                    return
                }

                const filePath = path.join(mapsDir, `${mapName}.json`)

                if (req.method === 'GET') {
                    try {
                        const fileContents = await fs.readFile(filePath, 'utf8')
                        json(res, 200, JSON.parse(fileContents))
                    } catch (error) {
                        if (error && error.code === 'ENOENT') {
                            json(res, 404, { error: `Map not found: ${mapName}` })
                            return
                        }

                        json(res, 500, { error: 'Failed to load map' })
                    }

                    return
                }

                if (req.method === 'POST') {
                    try {
                        const body = await readRequestBody(req)
                        const payload = JSON.parse(body)

                        if (!payload || typeof payload !== 'object') {
                            json(res, 400, { error: 'Invalid map payload' })
                            return
                        }

                        await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
                        json(res, 200, { ok: true, file: `assets/maps/${mapName}.json` })
                    } catch (error) {
                        json(res, 500, { error: 'Failed to save map' })
                    }

                    return
                }

                next()
            })
        }
    }
}

export default defineConfig(({ mode }) => {
    const isItchioBuild = mode === 'itchio'

    return {
        base: isItchioBuild ? './' : '/',
        publicDir: isItchioBuild ? 'assets-itchio' : 'assets',
        plugins: [mapEditorApiPlugin()],
        build: {
            assetsDir: isItchioBuild ? '.' : 'assets',
            rollupOptions: {
                output: isItchioBuild
                    ? {
                        entryFileNames: 'game.js',
                        chunkFileNames: 'chunk-[name].js',
                        assetFileNames: 'asset-[name][extname]'
                    }
                    : undefined,
                input: isItchioBuild
                    ? {
                        main: path.join(workspaceRoot, 'index.html')
                    }
                    : {
                        main: path.join(workspaceRoot, 'index.html'),
                        mapEditor: path.join(workspaceRoot, 'map-editor.html')
                    }
            }
        }
    }
})

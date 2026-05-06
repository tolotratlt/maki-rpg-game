import { promises as fs } from 'node:fs'
import path from 'node:path'
import makiConfig from '../maki.config.js'

const workspaceRoot = process.cwd()
const sourceAssetsDir = path.join(workspaceRoot, 'assets')
const targetAssetsDir = path.join(workspaceRoot, 'assets-itchio')

async function ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true })
}

async function copyRelative(relativePath) {
    const sourcePath = path.join(sourceAssetsDir, relativePath)
    const targetPath = path.join(targetAssetsDir, relativePath)
    await ensureDir(path.dirname(targetPath))
    await fs.copyFile(sourcePath, targetPath)
}

async function copyFolderRecursive(relativeFolder) {
    const sourceFolder = path.join(sourceAssetsDir, relativeFolder)
    const targetFolder = path.join(targetAssetsDir, relativeFolder)
    await ensureDir(targetFolder)

    const entries = await fs.readdir(sourceFolder, { withFileTypes: true })
    for (const entry of entries) {
        const src = path.join(sourceFolder, entry.name)
        const dest = path.join(targetFolder, entry.name)
        if (entry.isDirectory()) {
            await copyFolderRecursive(path.join(relativeFolder, entry.name).replaceAll('\\', '/'))
            continue
        }
        await ensureDir(path.dirname(dest))
        await fs.copyFile(src, dest)
    }
}

async function main() {
    await fs.rm(targetAssetsDir, { recursive: true, force: true })
    await ensureDir(targetAssetsDir)

    const mapNames = Array.isArray(makiConfig.maps) ? makiConfig.maps : ['default_map']
    for (const mapName of mapNames) {
        await copyRelative(`maps/${mapName}.json`)
        const mapPath = path.join(sourceAssetsDir, 'maps', `${mapName}.json`)
        const mapRaw = await fs.readFile(mapPath, 'utf8')
        const mapData = JSON.parse(mapRaw)
        const tilesetRelative = String(mapData.tileset || '').replace(/^assets\//, '')
        if (tilesetRelative) {
            await copyRelative(tilesetRelative)
        }
    }

    const requiredFiles = [
        'sprites/captain-clown-nose.png',
        'sprites/captain-clown-idle.png',
        'sprites/captain-clown-hit.png',
        'sprites/pirate-bomb-spritesheet.png',
        'sprites/ui/play2x-1.png',
        'sprites/ui/repeat.png',
        'sprites/ui/repeat-hover.png',
        'sprites/ui/bomb.png',
        'sprites/ui/bomb-hover.png',
        'sprites/Captain Clown Nose/Sprites/Captain Clown Nose/Captain Clown Nose without Sword/03-Jump/Jump 01.png',
        'sprites/Captain Clown Nose/Sprites/Captain Clown Nose/Captain Clown Nose without Sword/03-Jump/Jump 02.png',
        'sprites/Captain Clown Nose/Sprites/Captain Clown Nose/Captain Clown Nose without Sword/03-Jump/Jump 03.png',
        'sprites/Captain Clown Nose/Sprites/Captain Clown Nose/Captain Clown Nose without Sword/08-Dead Ground/Dead Ground 01.png',
        'sprites/Captain Clown Nose/Sprites/Captain Clown Nose/Captain Clown Nose without Sword/08-Dead Ground/Dead Ground 02.png',
        'sprites/Captain Clown Nose/Sprites/Captain Clown Nose/Captain Clown Nose without Sword/08-Dead Ground/Dead Ground 03.png',
        'sprites/Captain Clown Nose/Sprites/Captain Clown Nose/Captain Clown Nose without Sword/08-Dead Ground/Dead Ground 04.png',
        'audios/24-battle-theme-4.mp3',
        'audios/freesound_community-fart-83471.mp3',
        'audios/apebble-fart-4-228244.mp3'
    ]

    for (const file of requiredFiles) {
        await copyRelative(file)
    }

    const requiredFolders = [
        'sprites/Pirate Bomb/Sprites/2-Enemy-Bald Pirate/1-Idle',
        'sprites/Pirate Bomb/Sprites/2-Enemy-Bald Pirate/2-Run',
        'sprites/Pirate Bomb/Sprites/2-Enemy-Bald Pirate/8-Hit',
        'sprites/Pirate Bomb/Sprites/2-Enemy-Bald Pirate/10-Dead Ground',
        'sprites/Pirate Bomb/Sprites/4-Enemy-Big Guy/1-Idle',
        'sprites/Pirate Bomb/Sprites/4-Enemy-Big Guy/2-Run',
        'sprites/Pirate Bomb/Sprites/4-Enemy-Big Guy/12-Hit',
        'sprites/Pirate Bomb/Sprites/4-Enemy-Big Guy/14-Dead Ground',
        'sprites/Pirate Bomb/Sprites/3-Enemy-Cucumber/1-Idle',
        'sprites/Pirate Bomb/Sprites/3-Enemy-Cucumber/2-Run',
        'sprites/Pirate Bomb/Sprites/3-Enemy-Cucumber/9-Hit',
        'sprites/Pirate Bomb/Sprites/3-Enemy-Cucumber/11-Dead Ground',
        'sprites/Pirate Bomb/Sprites/5-Enemy-Captain/1-Idle',
        'sprites/Pirate Bomb/Sprites/5-Enemy-Captain/2-Run',
        'sprites/Pirate Bomb/Sprites/5-Enemy-Captain/9-Hit',
        'sprites/Pirate Bomb/Sprites/5-Enemy-Captain/11-Dead Ground'
    ]

    for (const folder of requiredFolders) {
        await copyFolderRecursive(folder)
    }

    console.log('Prepared minimal Itch.io assets in assets-itchio')
}

main().catch(error => {
    console.error(error)
    process.exit(1)
})

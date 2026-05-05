import Phaser from 'phaser'
import { Scene, manager } from '@tialops/maki'
import makiConfig from '../maki.config.js'

const TILE_SIZE = 32
const MAP_WIDTH = 40
const MAP_HEIGHT = 30
const MUSIC_BPM = 137.986
const SECONDS_PER_BEAT = 60 / MUSIC_BPM
const MOVE_FRAME_RATE = 6 / SECONDS_PER_BEAT
const IDLE_FRAME_RATE = 5 / SECONDS_PER_BEAT
const HIT_FRAME_RATE = 4 / SECONDS_PER_BEAT
const JUMP_FRAME_RATE = 3 / SECONDS_PER_BEAT
const BOMB_FRAME_WIDTH = 96
const BOMB_FRAME_HEIGHT = 108
const BOMB_TICK_FRAME_RATE = 10 / SECONDS_PER_BEAT
const BOMB_EXPLOSION_FRAME_RATE = 9 / SECONDS_PER_BEAT
const BOMB_FUSE_BEATS = [1.5, 2, 3]
const BOMB_DROP_COOLDOWN_MS = SECONDS_PER_BEAT * 250
const CAPTAIN_HIT_RADIUS = TILE_SIZE * 1.5
const BOMB_KICK_RANGE = 1
const BOMB_KICK_SPEED = TILE_SIZE * 9 * BOMB_KICK_RANGE
const BOMB_KICK_DRAG = TILE_SIZE * 11
const PLAYER_MAX_BOMBS = 5

export default class GameScene extends Scene {
    constructor() {
        super('GameScene')
        this.backgroundMusic = null
        this.bombs = null
        this.captain = null
        this.hud = null
        this.gameOverText = null
        this.startButton = null
        this.replayButton = null
        this.isGameStarted = false
        this.isGameOver = false
        this.hp = 99
        this.bombCount = PLAYER_MAX_BOMBS
        this.lastHorizontalDirection = 'right'
        this.lastBombDropAt = 0
        this.isCaptainHit = false
        this.isCaptainJumping = false
        this.mapFurnitureSprites = []
        this.spaceKey = null
    }

    preload() {
        super.preload()

        this.captain = this.maki.player('captain')
        this.load.spritesheet('captain-idle', 'sprites/captain-clown-idle.png', {
            frameWidth: makiConfig.player.frameWidth,
            frameHeight: makiConfig.player.frameHeight
        })
        this.load.spritesheet('captain-hit', 'sprites/captain-clown-hit.png', {
            frameWidth: makiConfig.player.frameWidth,
            frameHeight: makiConfig.player.frameHeight
        })
        this.load.image('captain-jump-1', 'sprites/Captain Clown Nose/Sprites/Captain Clown Nose/Captain Clown Nose without Sword/03-Jump/Jump 01.png')
        this.load.image('captain-jump-2', 'sprites/Captain Clown Nose/Sprites/Captain Clown Nose/Captain Clown Nose without Sword/03-Jump/Jump 02.png')
        this.load.image('captain-jump-3', 'sprites/Captain Clown Nose/Sprites/Captain Clown Nose/Captain Clown Nose without Sword/03-Jump/Jump 03.png')
        this.load.spritesheet('pirate-bomb', 'sprites/pirate-bomb-spritesheet.png', {
            frameWidth: BOMB_FRAME_WIDTH,
            frameHeight: BOMB_FRAME_HEIGHT
        })
        this.load.image('play-button', 'sprites/ui/play2x-1.png')
        this.load.image('replay-button', 'sprites/ui/repeat.png')
        this.load.image('replay-button-hover', 'sprites/ui/repeat-hover.png')
        this.load.audio('battle-theme', 'audios/24-battle-theme-4.mp3')
        manager.map(this, 'default_map')
        manager.preload(this)
    }

    create() {
        this.resetRunState()
        super.create()
        manager.create(this)
        this.createTilesetFurnitureLayer('default_map')

        this.physics.world.setBounds(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE)
        this.cameras.main.setBounds(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE)
        this.cameras.main.setBackgroundColor('#183221')

        this.captain.speed = 185
        this.captain.sprite.setPosition(TILE_SIZE * 4, TILE_SIZE * 4)
        this.captain.sprite.setScale(1.35)
        this.captain.sprite.setCollideWorldBounds(true)
        this.captain.sprite.body.setSize(24, 20)
        this.captain.sprite.body.setOffset(20, 18)
        this.captain.sprite.setDepth(1)
        this.removeDuplicateCaptainSprites()
        this.placeCaptainAtRandomSafeSpawn('default_map')

        this.captain.keys = this.createMergedMovementKeys()
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
        this.bombs = this.add.group()
        this.configureMoveAnimationTempo()
        this.createIdleAnimations()
        this.createHitAnimation()
        this.createJumpAnimation()
        this.createBombAnimations()
        this.captain.sprite.play('captain-idle-right')
        this.setupBackgroundMusic()

        this.physics.add.collider(
            this.captain.sprite,
            manager.getWallGroup(this, 'default_map')
        )

        this.cameras.main.startFollow(this.captain.sprite, true, 0.08, 0.08)
        this.cameras.main.setZoom(1.8)

        this.hud = this.add.text(14, 14, '', {
            fontFamily: 'monospace',
            fontSize: '22px',
            color: '#fff7d6',
            backgroundColor: '#19311fcc',
            padding: { x: 8, y: 6 }
        })
        this.hud.setOrigin(0.5, 0.5)
        this.hud.setPosition(this.scale.width / 2, this.scale.height / 2 + 120)
        this.hud.setScrollFactor(0)
        this.hud.setDepth(210)
        this.hud.setText(`HP: ${this.hp}`)
        this.gameOverText = this.add.text(this.scale.width / 2, this.scale.height / 2, 'GAME OVER', {
            fontFamily: 'monospace',
            fontSize: '40px',
            color: '#ffe5e5',
            backgroundColor: '#3a1111dd',
            padding: { x: 18, y: 12 }
        })
        this.gameOverText.setOrigin(0.5, 0.5)
        this.gameOverText.setScrollFactor(0)
        this.gameOverText.setDepth(1200)
        this.gameOverText.setVisible(false)
        this.createStartButton()
        this.createReplayButton()
    }

    update() {
        if (!this.captain?.sprite) {
            return
        }

        if (!this.isGameStarted) {
            this.hud.setText(`HP: ${this.hp}`)
            return
        }

        if (this.isGameOver) {
            this.hud.setText(`HP: ${this.hp}`)
            return
        }

        this.reconcileCaptainActionState()
        this.moveCaptain()
        this.updateSceneDepths()
        this.updateBombDepths()
        this.handleBombInput()

        this.hud.setText(`HP: ${this.hp}`)
    }

    _getConfig() {
        return {
            sprite: makiConfig.player
        }
    }

    createMergedMovementKeys() {
        const cursors = this.input.keyboard.createCursorKeys()
        const wasd = this.input.keyboard.addKeys('W,A,S,D,Z,Q')

        const createKeyState = (cursorKey, primaryAlt, secondaryAlt) => ({
            get isDown() {
                return Boolean(
                    cursorKey?.isDown ||
                    primaryAlt?.isDown ||
                    secondaryAlt?.isDown
                )
            }
        })

        return {
            left: createKeyState(cursors.left, wasd.A, wasd.Q),
            right: createKeyState(cursors.right, wasd.D),
            up: createKeyState(cursors.up, wasd.W, wasd.Z),
            down: createKeyState(cursors.down, wasd.S)
        }
    }

    moveCaptain() {
        const { sprite, keys, speed } = this.captain

        if (this.isCaptainHit) {
            sprite.setVelocity(0)
            return
        }
        if (this.isCaptainJumping) {
            sprite.setVelocity(0)
            return
        }

        const horizontal = (keys.right.isDown ? 1 : 0) - (keys.left.isDown ? 1 : 0)
        const vertical = (keys.down.isDown ? 1 : 0) - (keys.up.isDown ? 1 : 0)

        sprite.setFlipX(false)
        sprite.setVelocity(0)

        if (horizontal === 0 && vertical === 0) {
            sprite.anims.play(`captain-idle-${this.lastHorizontalDirection}`, true)
            return
        }

        const direction = new Phaser.Math.Vector2(horizontal, vertical).normalize().scale(speed)
        sprite.setVelocity(direction.x, direction.y)

        if (horizontal < 0) {
            this.lastHorizontalDirection = 'left'
            sprite.anims.play('captain-left', true)
            return
        }

        if (horizontal > 0) {
            this.lastHorizontalDirection = 'right'
            sprite.anims.play('captain-right', true)
            return
        }

        if (vertical !== 0) {
            sprite.anims.play(`captain-${this.lastHorizontalDirection}`, true)
        }
    }

    handleBombInput() {
        if (!this.spaceKey || !Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            return
        }

        const feet = this.getCaptainFeetCell()
        const kickDirection = this.getKickDirection()
        const probeCells = this.getBombProbeCells(kickDirection, feet)
        const bombAtCell = this.findBombAtCells(probeCells)

        if (bombAtCell) {
            this.kickBomb(bombAtCell, kickDirection)
            return
        }

        const now = this.time.now
        if (now - this.lastBombDropAt < BOMB_DROP_COOLDOWN_MS) {
            return
        }
        if (this.bombCount <= 0) {
            return
        }

        this.lastBombDropAt = now
        this.bombCount -= 1
        this.dropBomb(feet.x, feet.y)
    }

    createIdleAnimations() {
        if (!this.anims.exists('captain-idle-right')) {
            this.anims.create({
                key: 'captain-idle-right',
                frames: this.anims.generateFrameNumbers('captain-idle', { start: 0, end: 4 }),
                frameRate: IDLE_FRAME_RATE,
                repeat: -1
            })
        }

        if (!this.anims.exists('captain-idle-left')) {
            this.anims.create({
                key: 'captain-idle-left',
                frames: this.anims.generateFrameNumbers('captain-idle', { start: 5, end: 9 }),
                frameRate: IDLE_FRAME_RATE,
                repeat: -1
            })
        }
    }

    createHitAnimation() {
        if (!this.anims.exists('captain-hit')) {
            this.anims.create({
                key: 'captain-hit',
                frames: this.anims.generateFrameNumbers('captain-hit', { start: 0, end: 3 }),
                frameRate: HIT_FRAME_RATE,
                repeat: 0
            })
        }
    }

    createJumpAnimation() {
        if (!this.anims.exists('captain-jump')) {
            this.anims.create({
                key: 'captain-jump',
                frames: [
                    { key: 'captain-jump-1' },
                    { key: 'captain-jump-2' },
                    { key: 'captain-jump-3' }
                ],
                frameRate: JUMP_FRAME_RATE,
                repeat: 0
            })
        }
    }

    createTilesetFurnitureLayer(mapName) {
        const mapData = this.cache.json.get(mapName)
        const customFurniture = mapData?.custom?.tilesetFurniture ?? []
        const legacyFurniture = (mapData?.layers?.furniture ?? []).filter(item => item?.kind === 'tileset')
        const furniture = customFurniture.length > 0 ? customFurniture : legacyFurniture

        furniture
            .filter(item => item.kind === 'tileset')
            .forEach(item => {
                const brushWidth = item.brushWidth ?? 1
                const brushHeight = item.brushHeight ?? 1
                const repeatSingleTile = item.repeatSingleTile === true
                const originTileId = Math.max(1, item.tileId ?? 1)
                const originZeroBased = originTileId - 1
                const tilesetCols = Math.floor(this.textures.get(`${mapName}_tileset`).getSourceImage().width / TILE_SIZE)
                const originCol = originZeroBased % tilesetCols
                const originRow = Math.floor(originZeroBased / tilesetCols)

                for (let row = 0; row < brushHeight; row += 1) {
                    for (let col = 0; col < brushWidth; col += 1) {
                        const tileCol = repeatSingleTile ? originCol : originCol + col
                        const tileRow = repeatSingleTile ? originRow : originRow + row
                        const tileId = tileRow * tilesetCols + tileCol + 1
                        const sprite = this.add.image(
                            item.x + col * TILE_SIZE,
                            item.y + row * TILE_SIZE,
                            `${mapName}_tileset`,
                            tileId - 1
                        )

                        sprite.setOrigin(0, 0)
                        sprite.setDepth(sprite.y + TILE_SIZE)
                        this.mapFurnitureSprites.push(sprite)
                    }
                }
            })
    }

    updateSceneDepths() {
        if (!this.captain?.sprite) {
            return
        }

        const captainDepth = this.captain.sprite.body?.bottom ?? this.captain.sprite.y
        this.captain.sprite.setDepth(captainDepth)
    }

    updateBombDepths() {
        const bombs = this.bombs?.getChildren?.() ?? []
        for (const bomb of bombs) {
            if (!bomb.active) {
                continue
            }
            bomb.setDepth(bomb.y + 12)
        }
    }

    createStartButton() {
        this.captain.sprite.setVelocity(0)
        this.captain.sprite.anims.pause()

        this.startButton = this.add.image(this.scale.width / 2, this.scale.height / 2, 'play-button')
        this.startButton.setScrollFactor(0)
        this.startButton.setDepth(1000)
        this.startButton.setInteractive({ useHandCursor: true })
        this.startButton.on('pointerdown', () => {
            this.startGame()
        })
    }

    createReplayButton() {
        this.replayButton = this.add.image(this.scale.width / 2 + 200, this.scale.height / 2 - 145, 'replay-button')
        this.replayButton.setOrigin(0.5, 0.5)
        this.replayButton.setScale(0.5)
        this.replayButton.setScrollFactor(0)
        this.replayButton.setDepth(210)
        this.replayButton.setVisible(false)
        this.replayButton.disableInteractive()
        this.replayButton.on('pointerover', () => {
            this.replayButton.setTexture('replay-button-hover')
        })
        this.replayButton.on('pointerout', () => {
            this.replayButton.setTexture('replay-button')
        })
        this.replayButton.on('pointerdown', () => {
            this.scene.restart()
        })
    }

    startGame() {
        if (this.isGameStarted) {
            return
        }

        this.isGameStarted = true
        this.startButton?.destroy()
        this.startButton = null
        if (this.replayButton) {
            this.replayButton.setVisible(true)
            this.replayButton.setTexture('replay-button')
            this.replayButton.setInteractive({ useHandCursor: true })
        }
        this.captain.sprite.anims.resume()
        this.captain.sprite.play(`captain-idle-${this.lastHorizontalDirection}`, true)
        this.startBackgroundMusic()
    }

    resetRunState() {
        this.isGameStarted = false
        this.isGameOver = false
        this.hp = 99
        this.bombCount = PLAYER_MAX_BOMBS
        this.isCaptainHit = false
        this.isCaptainJumping = false
        this.lastHorizontalDirection = 'right'
        this.lastBombDropAt = 0
        this.startButton = null
        this.replayButton = null
        this.mapFurnitureSprites = []
    }

    removeDuplicateCaptainSprites() {
        const duplicates = this.children.list.filter(child =>
            child !== this.captain.sprite &&
            child?.texture?.key === 'captain'
        )

        duplicates.forEach(sprite => {
            sprite.destroy()
        })
    }

    configureMoveAnimationTempo() {
        const moveAnimations = [
            { key: 'captain-right', start: 0, end: 5 },
            { key: 'captain-up', start: 6, end: 11 },
            { key: 'captain-left', start: 12, end: 17 },
            { key: 'captain-down', start: 18, end: 23 }
        ]

        moveAnimations.forEach(({ key, start, end }) => {
            if (this.anims.exists(key)) {
                this.anims.remove(key)
            }

            this.anims.create({
                key,
                frames: this.anims.generateFrameNumbers('captain', { start, end }),
                frameRate: MOVE_FRAME_RATE,
                repeat: -1
            })
        })
    }

    placeCaptainAtRandomSafeSpawn(mapName) {
        const mapData = this.cache.json.get(mapName)
        const collisions = Array.isArray(mapData?.collisions) ? mapData.collisions : []
        const candidates = []

        for (let row = 1; row < MAP_HEIGHT - 1; row += 1) {
            for (let col = 1; col < MAP_WIDTH - 1; col += 1) {
                candidates.push({
                    x: col * TILE_SIZE + TILE_SIZE / 2,
                    y: row * TILE_SIZE + TILE_SIZE / 2
                })
            }
        }

        Phaser.Utils.Array.Shuffle(candidates)
        for (const candidate of candidates) {
            if (!this.isCaptainPositionColliding(candidate.x, candidate.y, collisions)) {
                this.captain.sprite.setPosition(candidate.x, candidate.y)
                this.captain.sprite.body?.updateFromGameObject?.()
                return
            }
        }

        this.captain.sprite.setPosition(TILE_SIZE * 4, TILE_SIZE * 4)
        this.captain.sprite.body?.updateFromGameObject?.()
    }

    isCaptainPositionColliding(x, y, collisionRects) {
        this.captain.sprite.setPosition(x, y)
        this.captain.sprite.body?.updateFromGameObject?.()
        const body = this.captain.sprite.body

        if (!body) {
            return false
        }

        const playerRect = new Phaser.Geom.Rectangle(body.left, body.top, body.width, body.height)
        for (const rect of collisionRects) {
            const collisionRect = new Phaser.Geom.Rectangle(rect.x, rect.y, rect.w, rect.h)
            if (Phaser.Geom.Intersects.RectangleToRectangle(playerRect, collisionRect)) {
                return true
            }
        }

        return false
    }

    createBombAnimations() {
        if (!this.anims.exists('pirate-bomb-ticking')) {
            this.anims.create({
                key: 'pirate-bomb-ticking',
                frames: this.anims.generateFrameNumbers('pirate-bomb', { start: 1, end: 10 }),
                frameRate: BOMB_TICK_FRAME_RATE,
                repeat: 0
            })
        }

        if (!this.anims.exists('pirate-bomb-explosion')) {
            this.anims.create({
                key: 'pirate-bomb-explosion',
                frames: this.anims.generateFrameNumbers('pirate-bomb', { start: 11, end: 19 }),
                frameRate: BOMB_EXPLOSION_FRAME_RATE,
                repeat: 0
            })
        }
    }

    dropBomb(feetX, feetY) {
        const fuseBeats = Phaser.Utils.Array.GetRandom(BOMB_FUSE_BEATS)
        const offDelayMs = Math.max(0, fuseBeats - 1) * SECONDS_PER_BEAT * 1000
        const bomb = this.physics.add.sprite(feetX, feetY, 'pirate-bomb', 0)

        bomb.setOrigin(0.5, 1)
        bomb.setScale(0.5)
        bomb.setDepth(feetY + 12)
        bomb.setCollideWorldBounds(true)
        bomb.body.setAllowGravity(false)
        bomb.body.setDrag(BOMB_KICK_DRAG, BOMB_KICK_DRAG)
        bomb.body.setBounce(0.1, 0.1)
        bomb.body.setMaxVelocity(BOMB_KICK_SPEED, BOMB_KICK_SPEED)
        bomb.setData('spawnedByPlayer', true)
        this.bombs.add(bomb)

        this.physics.add.collider(bomb, manager.getWallGroup(this, 'default_map'))

        this.time.delayedCall(offDelayMs, () => {
            if (!bomb.active) {
                return
            }

            bomb.play('pirate-bomb-ticking')
            bomb.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
                if (!bomb.active) {
                    return
                }

                this.handleCaptainBombHit(bomb.x, bomb.y)
                bomb.play('pirate-bomb-explosion')
                bomb.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
                    bomb.body?.setVelocity(0, 0)
                    if (bomb.getData('spawnedByPlayer')) {
                        this.bombCount = Math.min(PLAYER_MAX_BOMBS, this.bombCount + 1)
                    }
                    this.bombs.remove(bomb, true, true)
                })
            })
        })
    }

    findBombAtCell(cellX, cellY) {
        const bombs = this.bombs?.getChildren?.() ?? []
        for (const bomb of bombs) {
            if (!bomb.active) {
                continue
            }

            const bombCellX = Phaser.Math.Snap.To(bomb.x, TILE_SIZE)
            const bombCellY = Phaser.Math.Snap.To(bomb.y, TILE_SIZE)
            if (bombCellX === cellX && bombCellY === cellY) {
                return bomb
            }
        }

        return null
    }

    findBombAtCells(cells) {
        for (const cell of cells) {
            const bomb = this.findBombAtCell(cell.x, cell.y)
            if (bomb) {
                return bomb
            }
        }

        return null
    }

    kickBomb(bomb, direction) {
        bomb.body?.setVelocity(direction.x * BOMB_KICK_SPEED, direction.y * BOMB_KICK_SPEED)
        this.playCaptainJumpForKick(direction.x)
    }

    getKickDirection() {
        const { keys } = this.captain
        const horizontal = (keys.right.isDown ? 1 : 0) - (keys.left.isDown ? 1 : 0)
        const vertical = (keys.down.isDown ? 1 : 0) - (keys.up.isDown ? 1 : 0)

        if (horizontal !== 0 || vertical !== 0) {
            return new Phaser.Math.Vector2(horizontal, vertical).normalize()
        }

        return this.lastHorizontalDirection === 'left'
            ? new Phaser.Math.Vector2(-1, 0)
            : new Phaser.Math.Vector2(1, 0)
    }

    getBombProbeCells(direction, feetCell) {
        const probes = [{ x: feetCell.x, y: feetCell.y }]
        const body = this.captain.sprite.body

        if (!body) {
            return probes
        }

        if (direction.y < 0) {
            const topY = Phaser.Math.Snap.To(body.top, TILE_SIZE)
            const topCenterX = Phaser.Math.Snap.To(body.center.x, TILE_SIZE)
            probes.push({ x: topCenterX, y: topY })

            if (direction.x < 0) {
                const topLeftX = Phaser.Math.Snap.To(body.left + 2, TILE_SIZE)
                probes.push({ x: topLeftX, y: topY })
            } else if (direction.x > 0) {
                const topRightX = Phaser.Math.Snap.To(body.right - 2, TILE_SIZE)
                probes.push({ x: topRightX, y: topY })
            }
        }

        return probes
    }

    getCaptainFeetCell() {
        const body = this.captain.sprite.body
        const feetX = body?.center?.x ?? this.captain.sprite.x
        const feetY = body?.bottom ?? this.captain.sprite.y

        return {
            x: Phaser.Math.Snap.To(feetX, TILE_SIZE),
            y: Phaser.Math.Snap.To(feetY, TILE_SIZE)
        }
    }

    playCaptainJumpForKick(horizontalDirection) {
        if (this.isCaptainHit || this.isCaptainJumping) {
            return
        }

        this.isCaptainJumping = true
        this.captain.sprite.setVelocity(0, 0)
        this.captain.sprite.setFlipX(horizontalDirection < 0)
        this.captain.sprite.play('captain-jump', true)
        this.captain.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, animation => {
            if (animation.key !== 'captain-jump') {
                return
            }

            this.isCaptainJumping = false
            this.captain.sprite.setFlipX(false)
            this.captain.sprite.play(`captain-idle-${this.lastHorizontalDirection}`, true)
        })
    }

    reconcileCaptainActionState() {
        const currentAnimKey = this.captain?.sprite?.anims?.currentAnim?.key
        if (this.isCaptainJumping && currentAnimKey !== 'captain-jump') {
            this.isCaptainJumping = false
        }
    }

    handleCaptainBombHit(explosionX, explosionY) {
        if (this.isCaptainHit || this.isGameOver || !this.captain?.sprite) {
            return
        }

        const distance = Phaser.Math.Distance.Between(
            this.captain.sprite.x,
            this.captain.sprite.y,
            explosionX,
            explosionY
        )

        if (distance > CAPTAIN_HIT_RADIUS) {
            return
        }

        this.hp = Math.max(0, this.hp - 33)
        if (this.hp === 0) {
            this.triggerGameOver()
            return
        }

        this.isCaptainJumping = false
        this.isCaptainHit = true
        this.captain.sprite.setVelocity(0)
        this.captain.sprite.setFlipX(this.lastHorizontalDirection === 'left')
        this.captain.sprite.play('captain-hit', true)
        this.captain.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, animation => {
            if (animation.key !== 'captain-hit') {
                return
            }

            this.isCaptainHit = false
            this.captain.sprite.setFlipX(false)
            this.captain.sprite.play(`captain-idle-${this.lastHorizontalDirection}`, true)
        })
    }

    triggerGameOver() {
        this.isGameOver = true
        this.isCaptainHit = false
        this.isCaptainJumping = false
        this.captain.sprite.setVelocity(0, 0)
        this.captain.sprite.play(`captain-idle-${this.lastHorizontalDirection}`, true)
        this.gameOverText?.setVisible(true)
    }

    setupBackgroundMusic() {
        this.backgroundMusic = this.sound.add('battle-theme', {
            loop: true,
            volume: 0.35
        })
        this.events.once('shutdown', () => {
            if (this.backgroundMusic?.isPlaying) {
                this.backgroundMusic.stop()
            }
        })
    }

    startBackgroundMusic() {
        if (!this.backgroundMusic || this.backgroundMusic.isPlaying) {
            return
        }

        const playMusic = () => {
            if (!this.backgroundMusic.isPlaying) {
                this.backgroundMusic.play()
            }
        }

        const soundContext = this.sound.context

        if (soundContext?.state === 'suspended') {
            soundContext.resume().then(playMusic).catch(playMusic)
            return
        }

        playMusic()
    }
}

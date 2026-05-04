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
const BOMB_FRAME_WIDTH = 96
const BOMB_FRAME_HEIGHT = 108
const BOMB_TICK_FRAME_RATE = 10 / SECONDS_PER_BEAT
const BOMB_EXPLOSION_FRAME_RATE = 9 / SECONDS_PER_BEAT
const BOMB_FUSE_BEATS = [1, 2, 3]
const BOMB_DROP_COOLDOWN_MS = SECONDS_PER_BEAT * 250
const CAPTAIN_HIT_RADIUS = TILE_SIZE * 1.5

export default class GameScene extends Scene {
    constructor() {
        super('GameScene')
        this.backgroundMusic = null
        this.bombs = null
        this.captain = null
        this.hud = null
        this.lastHorizontalDirection = 'right'
        this.lastBombDropAt = 0
        this.isCaptainHit = false
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
        this.load.spritesheet('pirate-bomb', 'sprites/pirate-bomb-spritesheet.png', {
            frameWidth: BOMB_FRAME_WIDTH,
            frameHeight: BOMB_FRAME_HEIGHT
        })
        this.load.audio('battle-theme', 'audios/24-battle-theme-4.mp3')
        manager.map(this, 'default_map')
        manager.preload(this)
    }

    create() {
        super.create()
        manager.create(this)

        this.physics.world.setBounds(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE)
        this.cameras.main.setBounds(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE)
        this.cameras.main.setBackgroundColor('#183221')

        this.captain.speed = 185
        this.captain.sprite.setPosition(TILE_SIZE * 4, TILE_SIZE * 4)
        this.captain.sprite.setScale(1.35)
        this.captain.sprite.setDepth(10)
        this.captain.sprite.setCollideWorldBounds(true)
        this.captain.sprite.body.setSize(24, 20)
        this.captain.sprite.body.setOffset(20, 18)

        this.captain.keys = this.createMergedMovementKeys()
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
        this.bombs = this.add.group()
        this.configureMoveAnimationTempo()
        this.createIdleAnimations()
        this.createHitAnimation()
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
            fontSize: '12px',
            color: '#fff7d6',
            backgroundColor: '#19311fcc',
            padding: { x: 8, y: 6 }
        })
        this.hud.setScrollFactor(0)
        this.hud.setDepth(100)
    }

    update() {
        if (!this.captain?.sprite) {
            return
        }

        this.moveCaptain()
        this.handleBombInput()

        const { x, y } = this.captain.sprite
        this.hud.setText([
            'Captain Clown Nose',
            'Fleches ou WASD/ZQSD, Espace',
            `Position: ${Math.round(x)}, ${Math.round(y)}`
        ])
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

        const now = this.time.now
        if (now - this.lastBombDropAt < BOMB_DROP_COOLDOWN_MS) {
            return
        }

        this.lastBombDropAt = now
        this.dropBomb()
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

    dropBomb() {
        const worldX = Phaser.Math.Snap.To(this.captain.sprite.x, TILE_SIZE)
        const worldY = Phaser.Math.Snap.To(this.captain.sprite.y, TILE_SIZE)
        const fuseBeats = Phaser.Utils.Array.GetRandom(BOMB_FUSE_BEATS)
        const offDelayMs = Math.max(0, fuseBeats - 1) * SECONDS_PER_BEAT * 1000
        const bomb = this.add.sprite(worldX, worldY + 10, 'pirate-bomb', 0)

        bomb.setScale(0.5)
        bomb.setDepth(worldY + 12)
        this.bombs.add(bomb)

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
                    this.bombs.remove(bomb, true, true)
                })
            })
        })
    }

    handleCaptainBombHit(explosionX, explosionY) {
        if (this.isCaptainHit || !this.captain?.sprite) {
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

    setupBackgroundMusic() {
        this.backgroundMusic = this.sound.add('battle-theme', {
            loop: true,
            volume: 0.35
        })

        const startMusic = () => {
            if (!this.backgroundMusic?.isPlaying) {
                this.backgroundMusic.play()
            }
        }

        const startMusicFromKeyboard = () => {
            startMusic()
            window.removeEventListener('keydown', startMusicFromKeyboard, true)
        }

        this.input.once('pointerdown', startMusic)
        this.input.keyboard.once('keydown', startMusic)
        window.addEventListener('keydown', startMusicFromKeyboard, true)
        this.events.once('shutdown', () => {
            if (this.backgroundMusic?.isPlaying) {
                this.backgroundMusic.stop()
            }
            window.removeEventListener('keydown', startMusicFromKeyboard, true)
        })
    }
}

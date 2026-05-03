import Phaser from 'phaser'
import { Scene, manager } from '@tialops/maki'
import makiConfig from '../maki.config.js'

const TILE_SIZE = 32
const MAP_WIDTH = 40
const MAP_HEIGHT = 30

export default class GameScene extends Scene {
    constructor() {
        super('GameScene')
        this.backgroundMusic = null
        this.captain = null
        this.hud = null
        this.lastHorizontalDirection = 'right'
    }

    preload() {
        super.preload()

        this.captain = this.maki.player('captain')
        this.load.spritesheet('captain-idle', 'sprites/captain-clown-idle.png', {
            frameWidth: makiConfig.player.frameWidth,
            frameHeight: makiConfig.player.frameHeight
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
        this.createIdleAnimations()
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

        const { x, y } = this.captain.sprite
        this.hud.setText([
            'Captain Clown Nose',
            'Fleches ou WASD/ZQSD',
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
        const horizontal = (keys.right.isDown ? 1 : 0) - (keys.left.isDown ? 1 : 0)
        const vertical = (keys.down.isDown ? 1 : 0) - (keys.up.isDown ? 1 : 0)

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

    createIdleAnimations() {
        if (!this.anims.exists('captain-idle-right')) {
            this.anims.create({
                key: 'captain-idle-right',
                frames: this.anims.generateFrameNumbers('captain-idle', { start: 0, end: 4 }),
                frameRate: 7,
                repeat: -1
            })
        }

        if (!this.anims.exists('captain-idle-left')) {
            this.anims.create({
                key: 'captain-idle-left',
                frames: this.anims.generateFrameNumbers('captain-idle', { start: 5, end: 9 }),
                frameRate: 7,
                repeat: -1
            })
        }
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

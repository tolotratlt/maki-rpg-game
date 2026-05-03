import Phaser from 'phaser'
import { Scene, manager } from '@tialops/maki'
import makiConfig from '../maki.config.js'

const TILE_SIZE = 32
const MAP_WIDTH = 40
const MAP_HEIGHT = 30

export default class GameScene extends Scene {
    constructor() {
        super('GameScene')
        this.captain = null
        this.hud = null
    }

    preload() {
        super.preload()

        this.captain = this.maki.player('captain')
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
        this.maki.move(this.captain)

        if (!this.captain?.sprite) {
            return
        }

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
}

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
const DEAD_GROUND_FRAME_RATE = 4 / SECONDS_PER_BEAT
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
const ENEMY1_COUNT_WAVE_1 = 2
const ENEMY1_CHASE_SPEED = 120
const ENEMY1_FLEE_SPEED = 165
const ENEMY1_SCALE = 0.72
const ENEMY1_PATH_RECALC_MS_MIN = 2000
const ENEMY1_PATH_RECALC_MS_MAX = 3000
const ENEMY1_PAUSE_MS_MIN = 2000
const ENEMY1_PAUSE_MS_MAX = 4000
const ENEMY1_BOMB_RANGE = TILE_SIZE * 1.6
const ENEMY1_BOMB_ATTEMPT_COOLDOWN_MAX_MS = 2000
const ENEMY1_MAX_BOMBS = 5
const ENEMY1_HIT_RADIUS = TILE_SIZE * 1.5
const ENEMY1_HIT_REQUIRED = 2
const ENEMY1_FLEE_BOMB_RADIUS = TILE_SIZE * 4
const ENEMY1_FLIP_X_THRESHOLD = 12
const ENEMY2_COUNT_WAVE_2 = 6
const ENEMY2_CHASE_SPEED = 120
const ENEMY2_FLEE_SPEED = 165
const ENEMY2_SCALE = 0.72
const ENEMY2_PATH_RECALC_MS_MIN = 2000
const ENEMY2_PATH_RECALC_MS_MAX = 3000
const ENEMY2_PAUSE_MS_MIN = 2000
const ENEMY2_PAUSE_MS_MAX = 4000
const ENEMY2_BOMB_RANGE = TILE_SIZE * 2
const ENEMY2_BOMB_ATTEMPT_COOLDOWN_MAX_MS = 2000
const ENEMY2_MAX_BOMBS = 5
const ENEMY2_HIT_RADIUS = TILE_SIZE * 1.5
const ENEMY2_HIT_REQUIRED = 2
const ENEMY2_FLEE_BOMB_RADIUS = TILE_SIZE * 4
const ENEMY2_FLIP_X_THRESHOLD = 12
const WAVE2_SPAWN_DELAY_MS = 4000

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
        this.isRestarting = false
        this.lastHorizontalDirection = 'right'
        this.lastBombDropAt = 0
        this.isCaptainHit = false
        this.isCaptainJumping = false
        this.mapFurnitureSprites = []
        this.spaceKey = null
        this.enemies = []
        this.enemyBlockedGrid = []
        this.nextEnemyId = 1
        this.currentWave = 1
        this.wave2SpawnScheduled = false
        this.wave2SpawnTimer = null
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
        this.load.image('captain-dead-ground-1', 'sprites/Captain Clown Nose/Sprites/Captain Clown Nose/Captain Clown Nose without Sword/08-Dead Ground/Dead Ground 01.png')
        this.load.image('captain-dead-ground-2', 'sprites/Captain Clown Nose/Sprites/Captain Clown Nose/Captain Clown Nose without Sword/08-Dead Ground/Dead Ground 02.png')
        this.load.image('captain-dead-ground-3', 'sprites/Captain Clown Nose/Sprites/Captain Clown Nose/Captain Clown Nose without Sword/08-Dead Ground/Dead Ground 03.png')
        this.load.image('captain-dead-ground-4', 'sprites/Captain Clown Nose/Sprites/Captain Clown Nose/Captain Clown Nose without Sword/08-Dead Ground/Dead Ground 04.png')
        this.load.spritesheet('pirate-bomb', 'sprites/pirate-bomb-spritesheet.png', {
            frameWidth: BOMB_FRAME_WIDTH,
            frameHeight: BOMB_FRAME_HEIGHT
        })
        this.load.image('play-button', 'sprites/ui/play2x-1.png')
        this.load.image('replay-button', 'sprites/ui/repeat.png')
        this.load.image('replay-button-hover', 'sprites/ui/repeat-hover.png')
        this.preloadEnemyFrames('enemy-idle', 'sprites/Pirate Bomb/Sprites/2-Enemy-Bald Pirate/1-Idle', 34)
        this.preloadEnemyFrames('enemy-run', 'sprites/Pirate Bomb/Sprites/2-Enemy-Bald Pirate/2-Run', 14)
        this.preloadEnemyFrames('enemy-hit', 'sprites/Pirate Bomb/Sprites/2-Enemy-Bald Pirate/8-Hit', 8)
        this.preloadEnemyFrames('enemy-dead-ground', 'sprites/Pirate Bomb/Sprites/2-Enemy-Bald Pirate/10-Dead Ground', 4)
        this.preloadEnemyFrames('enemy2-idle', 'sprites/Pirate Bomb/Sprites/4-Enemy-Big Guy/1-Idle', 38)
        this.preloadEnemyFrames('enemy2-run', 'sprites/Pirate Bomb/Sprites/4-Enemy-Big Guy/2-Run', 16)
        this.preloadEnemyFrames('enemy2-hit', 'sprites/Pirate Bomb/Sprites/4-Enemy-Big Guy/12-Hit', 8)
        this.preloadEnemyFrames('enemy2-dead-ground', 'sprites/Pirate Bomb/Sprites/4-Enemy-Big Guy/14-Dead Ground', 4)
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
        this.createDeadGroundAnimation()
        this.createBombAnimations()
        this.createEnemyAnimations()
        this.captain.sprite.play('captain-idle-right')
        this.setupBackgroundMusic()
        this.setupEnemyCollisionGrid('default_map')
        this.spawnWaveOneEnemies()

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
        if (this.isRestarting || !this.captain?.sprite) {
            return
        }

        if (!this.isGameStarted) {
            this.hud.setText(`HP: ${this.hp}`)
            return
        }

        if (this.isGameOver) {
            this.hud.setText(`HP: ${this.hp}\nWave ${this.currentWave}`)
            return
        }

        this.reconcileCaptainActionState()
        this.moveCaptain()
        this.updateSceneDepths()
        this.updateBombDepths()
        this.updateEnemies()
        this.handleBombInput()

        this.hud.setText(`HP: ${this.hp}\nWave ${this.currentWave}`)
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

    createDeadGroundAnimation() {
        if (!this.anims.exists('captain-dead-ground')) {
            this.anims.create({
                key: 'captain-dead-ground',
                frames: [
                    { key: 'captain-dead-ground-1' },
                    { key: 'captain-dead-ground-2' },
                    { key: 'captain-dead-ground-3' },
                    { key: 'captain-dead-ground-4' }
                ],
                frameRate: DEAD_GROUND_FRAME_RATE,
                repeat: 0
            })
        }
    }

    preloadEnemyFrames(prefix, folderPath, count) {
        for (let i = 1; i <= count; i += 1) {
            this.load.image(`${prefix}-${i}`, `${folderPath}/${i}.png`)
        }
    }

    createEnemyAnimations() {
        if (!this.anims.exists('enemy-idle')) {
            this.anims.create({
                key: 'enemy-idle',
                frames: Array.from({ length: 34 }, (_, index) => ({ key: `enemy-idle-${index + 1}` })),
                frameRate: 10,
                repeat: -1
            })
        }

        if (!this.anims.exists('enemy-run')) {
            this.anims.create({
                key: 'enemy-run',
                frames: Array.from({ length: 14 }, (_, index) => ({ key: `enemy-run-${index + 1}` })),
                frameRate: 12,
                repeat: -1
            })
        }

        if (!this.anims.exists('enemy-hit')) {
            this.anims.create({
                key: 'enemy-hit',
                frames: Array.from({ length: 8 }, (_, index) => ({ key: `enemy-hit-${index + 1}` })),
                frameRate: 12,
                repeat: 0
            })
        }

        if (!this.anims.exists('enemy-dead-ground')) {
            this.anims.create({
                key: 'enemy-dead-ground',
                frames: Array.from({ length: 4 }, (_, index) => ({ key: `enemy-dead-ground-${index + 1}` })),
                frameRate: 8,
                repeat: 0
            })
        }

        if (!this.anims.exists('enemy2-idle')) {
            this.anims.create({
                key: 'enemy2-idle',
                frames: Array.from({ length: 38 }, (_, index) => ({ key: `enemy2-idle-${index + 1}` })),
                frameRate: 10,
                repeat: -1
            })
        }

        if (!this.anims.exists('enemy2-run')) {
            this.anims.create({
                key: 'enemy2-run',
                frames: Array.from({ length: 16 }, (_, index) => ({ key: `enemy2-run-${index + 1}` })),
                frameRate: 12,
                repeat: -1
            })
        }

        if (!this.anims.exists('enemy2-hit')) {
            this.anims.create({
                key: 'enemy2-hit',
                frames: Array.from({ length: 8 }, (_, index) => ({ key: `enemy2-hit-${index + 1}` })),
                frameRate: 12,
                repeat: 0
            })
        }

        if (!this.anims.exists('enemy2-dead-ground')) {
            this.anims.create({
                key: 'enemy2-dead-ground',
                frames: Array.from({ length: 4 }, (_, index) => ({ key: `enemy2-dead-ground-${index + 1}` })),
                frameRate: 8,
                repeat: 0
            })
        }
    }

    spawnWaveOneEnemies() {
        this.currentWave = 1
        this.wave2SpawnScheduled = false
        this.wave2SpawnTimer = null
        for (let i = 0; i < ENEMY1_COUNT_WAVE_1; i += 1) {
            this.spawnEnemy(1)
        }
    }

    spawnWaveTwoEnemies() {
        this.currentWave = 2
        this.wave2SpawnScheduled = false
        this.wave2SpawnTimer = null
        for (let i = 0; i < ENEMY2_COUNT_WAVE_2; i += 1) {
            this.spawnEnemy(2)
        }
    }

    spawnEnemy(waveNumber) {
        const isWave2 = waveNumber === 2
        const stats = isWave2
            ? {
                wave: 2,
                chaseSpeed: ENEMY2_CHASE_SPEED,
                fleeSpeed: ENEMY2_FLEE_SPEED,
                pathRecalcMsMin: ENEMY2_PATH_RECALC_MS_MIN,
                pathRecalcMsMax: ENEMY2_PATH_RECALC_MS_MAX,
                pauseMsMin: ENEMY2_PAUSE_MS_MIN,
                pauseMsMax: ENEMY2_PAUSE_MS_MAX,
                bombRange: ENEMY2_BOMB_RANGE,
                bombAttemptCooldownMaxMs: ENEMY2_BOMB_ATTEMPT_COOLDOWN_MAX_MS,
                maxBombs: ENEMY2_MAX_BOMBS,
                hitRadius: ENEMY2_HIT_RADIUS,
                hitRequired: ENEMY2_HIT_REQUIRED,
                fleeBombRadius: ENEMY2_FLEE_BOMB_RADIUS,
                flipXThreshold: ENEMY2_FLIP_X_THRESHOLD,
                scale: ENEMY2_SCALE,
                bodySize: { width: 36, height: 42 },
                bodyOffset: { x: 45, y: 86 },
                animations: {
                    idle: 'enemy2-idle',
                    run: 'enemy2-run',
                    hit: 'enemy2-hit',
                    dead: 'enemy2-dead-ground'
                },
                spawnTexture: 'enemy2-idle-1'
            }
            : {
                wave: 1,
                chaseSpeed: ENEMY1_CHASE_SPEED,
                fleeSpeed: ENEMY1_FLEE_SPEED,
                pathRecalcMsMin: ENEMY1_PATH_RECALC_MS_MIN,
                pathRecalcMsMax: ENEMY1_PATH_RECALC_MS_MAX,
                pauseMsMin: ENEMY1_PAUSE_MS_MIN,
                pauseMsMax: ENEMY1_PAUSE_MS_MAX,
                bombRange: ENEMY1_BOMB_RANGE,
                bombAttemptCooldownMaxMs: ENEMY1_BOMB_ATTEMPT_COOLDOWN_MAX_MS,
                maxBombs: ENEMY1_MAX_BOMBS,
                hitRadius: ENEMY1_HIT_RADIUS,
                hitRequired: ENEMY1_HIT_REQUIRED,
                fleeBombRadius: ENEMY1_FLEE_BOMB_RADIUS,
                flipXThreshold: ENEMY1_FLIP_X_THRESHOLD,
                scale: ENEMY1_SCALE,
                bodySize: { width: 36, height: 42 },
                bodyOffset: { x: 45, y: 86 },
                animations: {
                    idle: 'enemy-idle',
                    run: 'enemy-run',
                    hit: 'enemy-hit',
                    dead: 'enemy-dead-ground'
                },
                spawnTexture: 'enemy-idle-1'
            }

        const spawn = this.findRandomFreeCellCenter()
        const sprite = this.physics.add.sprite(spawn.x, spawn.y, stats.spawnTexture)
        sprite.setOrigin(0.5, 1)
        sprite.setScale(stats.scale)
        sprite.setCollideWorldBounds(true)
        sprite.body.setAllowGravity(false)
        sprite.body.setSize(stats.bodySize.width, stats.bodySize.height)
        sprite.body.setOffset(stats.bodyOffset.x, stats.bodyOffset.y)
        sprite.play(stats.animations.idle)

        this.physics.add.collider(sprite, manager.getWallGroup(this, 'default_map'))

        const enemy = {
            id: this.nextEnemyId++,
            sprite,
            stats,
            hp: stats.hitRequired,
            bombCount: stats.maxBombs,
            alive: true,
            isHit: false,
            isDead: false,
            isPaused: false,
            pauseUntil: 0,
            nextThinkAt: this.time.now + Phaser.Math.Between(stats.pathRecalcMsMin, stats.pathRecalcMsMax),
            nextPathAt: this.time.now,
            nextBombAttemptAt: this.time.now + Phaser.Math.Between(0, stats.bombAttemptCooldownMaxMs),
            path: [],
            facing: 1
        }

        this.enemies.push(enemy)
    }

    updateEnemies() {
        const now = this.time.now
        const claimedNextCells = new Set()
        for (const enemy of this.enemies) {
            if (!enemy.alive || enemy.isDead) {
                continue
            }

            if (enemy.isHit) {
                enemy.sprite.setVelocity(0, 0)
                continue
            }

            if (now >= enemy.nextThinkAt) {
                enemy.nextThinkAt = now + Phaser.Math.Between(enemy.stats.pathRecalcMsMin, enemy.stats.pathRecalcMsMax)
                if (Math.random() < 0.45) {
                    enemy.isPaused = true
                    enemy.pauseUntil = now + Phaser.Math.Between(enemy.stats.pauseMsMin, enemy.stats.pauseMsMax)
                }
            }

            if (enemy.isPaused && now >= enemy.pauseUntil) {
                enemy.isPaused = false
            }

            if (enemy.isPaused) {
                enemy.path = []
            }

            const nearbyBomb = this.findNearestBomb(enemy.sprite.x, enemy.sprite.y, enemy.stats.fleeBombRadius)
            if (nearbyBomb) {
                enemy.isPaused = false
                enemy.path = this.computeFleePath(enemy, nearbyBomb, claimedNextCells)
                this.moveEnemyAlongPath(enemy, claimedNextCells, enemy.stats.fleeSpeed)
                continue
            }

            if (enemy.isPaused) {
                enemy.sprite.setVelocity(0, 0)
                enemy.sprite.play(enemy.stats.animations.idle, true)
                continue
            }

            const playerDistance = Phaser.Math.Distance.Between(
                enemy.sprite.x,
                enemy.sprite.y,
                this.captain.sprite.x,
                this.captain.sprite.y
            )
            if (playerDistance <= enemy.stats.bombRange) {
                enemy.path = []
                enemy.sprite.setVelocity(0, 0)
                enemy.sprite.play(enemy.stats.animations.idle, true)
                this.enemyTrySpawnBomb(enemy, now)
                continue
            }

            if (now >= enemy.nextPathAt) {
                enemy.nextPathAt = now + Phaser.Math.Between(enemy.stats.pathRecalcMsMin, enemy.stats.pathRecalcMsMax)
                enemy.path = this.computePathToPlayer(enemy)
            }

            this.moveEnemyAlongPath(enemy, claimedNextCells, enemy.stats.chaseSpeed)
        }
    }

    computePathToPlayer(enemy) {
        const from = this.worldToCell(enemy.sprite.x, enemy.sprite.y)
        const playerCell = this.worldToCell(this.captain.sprite.x, this.captain.sprite.y)
        const approachCells = this.getApproachCellsForEnemy(enemy, playerCell)

        for (const target of approachCells) {
            if (!this.isWalkableCell(target.col, target.row)) {
                continue
            }
            const path = this.findPathBfs(from.col, from.row, target.col, target.row)
            if (path.length > 0) {
                return path
            }
        }

        if (this.isWalkableCell(playerCell.col, playerCell.row)) {
            return this.findPathBfs(from.col, from.row, playerCell.col, playerCell.row)
        }

        return []
    }

    moveEnemyAlongPath(enemy, claimedNextCells, speed) {
        const sprite = enemy.sprite
        if (!enemy.path || enemy.path.length === 0) {
            sprite.setVelocity(0, 0)
            sprite.play(enemy.stats.animations.idle, true)
            return
        }

        const next = enemy.path[0]
        const nextKey = `${next.col}:${next.row}`
        if (claimedNextCells.has(nextKey)) {
            sprite.setVelocity(0, 0)
            sprite.play(enemy.stats.animations.idle, true)
            return
        }
        const targetX = next.col * TILE_SIZE + TILE_SIZE / 2
        const targetY = next.row * TILE_SIZE + TILE_SIZE / 2
        const delta = new Phaser.Math.Vector2(targetX - sprite.x, targetY - sprite.y)
        if (delta.length() < 6) {
            enemy.path.shift()
            sprite.setVelocity(0, 0)
            if (enemy.path.length === 0) {
                sprite.play(enemy.stats.animations.idle, true)
            }
            return
        }

        delta.normalize().scale(speed)
        sprite.setVelocity(delta.x, delta.y)
        if (Math.abs(delta.x) > enemy.stats.flipXThreshold) {
            enemy.facing = delta.x < 0 ? -1 : 1
        }
        sprite.setFlipX(enemy.facing < 0)
        sprite.play(enemy.stats.animations.run, true)
        claimedNextCells.add(nextKey)
    }

    enemyTrySpawnBomb(enemy, now) {
        if (enemy.bombCount <= 0 || now < enemy.nextBombAttemptAt) {
            return
        }

        enemy.nextBombAttemptAt = now + Phaser.Math.Between(0, enemy.stats.bombAttemptCooldownMaxMs)
        const distanceToPlayer = Phaser.Math.Distance.Between(
            enemy.sprite.x,
            enemy.sprite.y,
            this.captain.sprite.x,
            this.captain.sprite.y
        )
        if (distanceToPlayer > enemy.stats.bombRange) {
            return
        }

        const cell = this.worldToCell(enemy.sprite.x, enemy.sprite.y)
        const bombCellX = cell.col * TILE_SIZE + TILE_SIZE / 2
        const bombCellY = cell.row * TILE_SIZE + TILE_SIZE
        if (this.findBombAtCell(bombCellX, bombCellY)) {
            return
        }

        enemy.bombCount -= 1
        this.dropBombFromOwner(bombCellX, bombCellY, { type: 'enemy', id: enemy.id })
    }

    findNearestBomb(x, y, maxDistance) {
        const bombs = this.bombs?.getChildren?.() ?? []
        let nearest = null
        let nearestDistance = maxDistance
        for (const bomb of bombs) {
            if (!bomb.active) {
                continue
            }

            const distance = Phaser.Math.Distance.Between(x, y, bomb.x, bomb.y)
            if (distance <= nearestDistance) {
                nearestDistance = distance
                nearest = bomb
            }
        }

        return nearest
    }

    computeFleePath(enemy, bomb, claimedNextCells) {
        const from = this.worldToCell(enemy.sprite.x, enemy.sprite.y)
        const bombCell = this.worldToCell(bomb.x, bomb.y)
        const dirs = [
            { c: -1, r: 0 }, { c: 1, r: 0 }, { c: 0, r: -1 }, { c: 0, r: 1 },
            { c: -1, r: -1 }, { c: 1, r: -1 }, { c: -1, r: 1 }, { c: 1, r: 1 }
        ]

        const candidates = []
        for (const dir of dirs) {
            const nextCol = from.col + dir.c
            const nextRow = from.row + dir.r
            if (!this.isWalkableCell(nextCol, nextRow)) {
                continue
            }

            if (dir.c !== 0 && dir.r !== 0) {
                if (!this.isWalkableCell(from.col + dir.c, from.row) || !this.isWalkableCell(from.col, from.row + dir.r)) {
                    continue
                }
            }

            const key = `${nextCol}:${nextRow}`
            const distanceBomb = Phaser.Math.Distance.Between(nextCol, nextRow, bombCell.col, bombCell.row)
            const crowdPenalty = claimedNextCells.has(key) ? 1000 : 0
            const randomTie = Math.random() * 0.25
            const score = distanceBomb - crowdPenalty + randomTie
            candidates.push({ col: nextCol, row: nextRow, score })
        }

        candidates.sort((a, b) => b.score - a.score)
        const best = candidates[0]
        return best ? [{ col: best.col, row: best.row }] : []
    }

    getApproachCellsForEnemy(enemy, playerCell) {
        const offsets = [
            { col: 0, row: -1 },
            { col: 1, row: 0 },
            { col: 0, row: 1 },
            { col: -1, row: 0 },
            { col: 1, row: -1 },
            { col: 1, row: 1 },
            { col: -1, row: 1 },
            { col: -1, row: -1 }
        ]
        const start = enemy.id % offsets.length
        const rotated = offsets.slice(start).concat(offsets.slice(0, start))
        return rotated.map(offset => ({
            col: playerCell.col + offset.col,
            row: playerCell.row + offset.row
        }))
    }

    setupEnemyCollisionGrid(mapName) {
        this.enemyBlockedGrid = Array.from({ length: MAP_HEIGHT }, () =>
            Array.from({ length: MAP_WIDTH }, () => false)
        )
        const mapData = this.cache.json.get(mapName)
        const collisions = Array.isArray(mapData?.collisions) ? mapData.collisions : []
        for (const rect of collisions) {
            const startCol = Math.max(0, Math.floor(rect.x / TILE_SIZE))
            const endCol = Math.min(MAP_WIDTH - 1, Math.ceil((rect.x + rect.w) / TILE_SIZE) - 1)
            const startRow = Math.max(0, Math.floor(rect.y / TILE_SIZE))
            const endRow = Math.min(MAP_HEIGHT - 1, Math.ceil((rect.y + rect.h) / TILE_SIZE) - 1)
            for (let row = startRow; row <= endRow; row += 1) {
                for (let col = startCol; col <= endCol; col += 1) {
                    this.enemyBlockedGrid[row][col] = true
                }
            }
        }
    }

    isWalkableCell(col, row) {
        if (col < 0 || row < 0 || col >= MAP_WIDTH || row >= MAP_HEIGHT) {
            return false
        }
        return !this.enemyBlockedGrid[row][col]
    }

    findPathBfs(startCol, startRow, goalCol, goalRow) {
        if (!this.isWalkableCell(startCol, startRow) || !this.isWalkableCell(goalCol, goalRow)) {
            return []
        }

        const queue = [{ col: startCol, row: startRow }]
        const visited = Array.from({ length: MAP_HEIGHT }, () =>
            Array.from({ length: MAP_WIDTH }, () => false)
        )
        const parent = Array.from({ length: MAP_HEIGHT }, () =>
            Array.from({ length: MAP_WIDTH }, () => null)
        )

        visited[startRow][startCol] = true
        const dirs = [
            { c: -1, r: 0 }, { c: 1, r: 0 }, { c: 0, r: -1 }, { c: 0, r: 1 },
            { c: -1, r: -1 }, { c: 1, r: -1 }, { c: -1, r: 1 }, { c: 1, r: 1 }
        ]

        while (queue.length > 0) {
            const cur = queue.shift()
            if (cur.col === goalCol && cur.row === goalRow) {
                break
            }

            for (const dir of dirs) {
                const nextCol = cur.col + dir.c
                const nextRow = cur.row + dir.r
                if (!this.isWalkableCell(nextCol, nextRow) || visited[nextRow][nextCol]) {
                    continue
                }

                if (dir.c !== 0 && dir.r !== 0) {
                    if (!this.isWalkableCell(cur.col + dir.c, cur.row) || !this.isWalkableCell(cur.col, cur.row + dir.r)) {
                        continue
                    }
                }

                visited[nextRow][nextCol] = true
                parent[nextRow][nextCol] = cur
                queue.push({ col: nextCol, row: nextRow })
            }
        }

        if (!visited[goalRow][goalCol]) {
            return []
        }

        const path = []
        let node = { col: goalCol, row: goalRow }
        while (node && !(node.col === startCol && node.row === startRow)) {
            path.push(node)
            node = parent[node.row][node.col]
        }
        path.reverse()
        return path
    }

    worldToCell(x, y) {
        return {
            col: Phaser.Math.Clamp(Math.floor(x / TILE_SIZE), 0, MAP_WIDTH - 1),
            row: Phaser.Math.Clamp(Math.floor(y / TILE_SIZE), 0, MAP_HEIGHT - 1)
        }
    }

    findRandomFreeCellCenter() {
        const cells = []
        for (let row = 1; row < MAP_HEIGHT - 1; row += 1) {
            for (let col = 1; col < MAP_WIDTH - 1; col += 1) {
                if (this.isWalkableCell(col, row)) {
                    cells.push({ col, row })
                }
            }
        }
        Phaser.Utils.Array.Shuffle(cells)
        const pick = cells[0] ?? { col: 4, row: 4 }
        return {
            x: pick.col * TILE_SIZE + TILE_SIZE / 2,
            y: pick.row * TILE_SIZE + TILE_SIZE
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
        this.startButton.on('pointerup', () => {
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
        this.replayButton.on('pointerup', () => {
            this.safeRestartScene()
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
        this.isRestarting = false
        this.isCaptainHit = false
        this.isCaptainJumping = false
        this.lastHorizontalDirection = 'right'
        this.lastBombDropAt = 0
        this.startButton = null
        if (this.replayButton) {
            this.replayButton.disableInteractive()
            this.replayButton.setVisible(false)
            this.replayButton.destroy()
        }
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
        this.dropBombFromOwner(feetX, feetY, { type: 'player' })
    }

    dropBombFromOwner(feetX, feetY, owner) {
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
        bomb.setData('ownerType', owner.type)
        bomb.setData('ownerId', owner.id ?? null)
        this.bombs.add(bomb)

        this.physics.add.collider(bomb, manager.getWallGroup(this, 'default_map'))

        this.time.delayedCall(offDelayMs, () => {
            if (!this.sys?.isActive()) {
                return
            }
            if (!bomb.active) {
                return
            }

            bomb.play('pirate-bomb-ticking')
            bomb.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
                if (!this.sys?.isActive()) {
                    return
                }
                if (!bomb.active) {
                    return
                }

                this.handleBombExplosionDamage(bomb.x, bomb.y)
                bomb.play('pirate-bomb-explosion')
                bomb.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
                    if (!this.sys?.isActive()) {
                        return
                    }
                    bomb.body?.setVelocity(0, 0)
                    if (bomb.getData('ownerType') === 'player') {
                        this.bombCount = Math.min(PLAYER_MAX_BOMBS, this.bombCount + 1)
                    } else if (bomb.getData('ownerType') === 'enemy') {
                        const ownerId = bomb.getData('ownerId')
                        const owner = this.enemies.find(enemy => enemy.id === ownerId)
                        if (owner && owner.alive) {
                            owner.bombCount = Math.min(owner.stats.maxBombs, owner.bombCount + 1)
                        }
                    }
                    this.bombs.remove(bomb, true, true)
                })
            })
        })
    }

    safeRestartScene() {
        if (this.isRestarting) {
            return
        }

        this.isRestarting = true
        this.replayButton?.disableInteractive()
        this.startButton?.disableInteractive()
        this.backgroundMusic?.stop()
        this.resetGameplaySession()
    }

    resetGameplaySession() {
        this.time.removeAllEvents()
        this.cleanupBombs()
        this.cleanupEnemies()

        this.physics.world.resume()

        this.isGameStarted = false
        this.isGameOver = false
        this.hp = 99
        this.bombCount = PLAYER_MAX_BOMBS
        this.isCaptainHit = false
        this.isCaptainJumping = false
        this.lastHorizontalDirection = 'right'
        this.lastBombDropAt = 0
        this.nextEnemyId = 1
        this.currentWave = 1
        this.wave2SpawnScheduled = false
        this.wave2SpawnTimer = null

        this.captain.sprite.removeAllListeners()
        this.captain.sprite.setActive(true)
        this.captain.sprite.setVisible(true)
        this.captain.sprite.setVelocity(0, 0)
        this.captain.sprite.setFlipX(false)
        this.captain.sprite.body.enable = true
        this.placeCaptainAtRandomSafeSpawn('default_map')
        this.captain.sprite.play('captain-idle-right', true)
        this.captain.sprite.anims.pause()

        this.gameOverText?.setVisible(false)
        this.hud?.setText(`HP: ${this.hp}`)

        if (this.startButton) {
            this.startButton.destroy()
            this.startButton = null
        }
        this.createStartButton()

        if (this.replayButton) {
            this.replayButton.setTexture('replay-button')
            this.replayButton.setVisible(false)
            this.replayButton.disableInteractive()
        } else {
            this.createReplayButton()
        }

        this.spawnWaveOneEnemies()
        this.isRestarting = false
    }

    cleanupBombs() {
        const bombs = this.bombs?.getChildren?.() ?? []
        bombs.forEach(bomb => {
            bomb.removeAllListeners?.()
            bomb.destroy()
        })
        this.bombs?.clear?.(true, true)
    }

    cleanupEnemies() {
        this.enemies.forEach(enemy => {
            enemy.sprite?.removeAllListeners?.()
            enemy.sprite?.destroy()
        })
        this.enemies = []
    }

    handleBombExplosionDamage(explosionX, explosionY) {
        this.handleCaptainBombHit(explosionX, explosionY)
        this.handleEnemyBombHit(explosionX, explosionY)
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

    handleEnemyBombHit(explosionX, explosionY) {
        for (const enemy of this.enemies) {
            if (!enemy.alive || enemy.isDead || !enemy.sprite?.active) {
                continue
            }

            const distance = Phaser.Math.Distance.Between(
                enemy.sprite.x,
                enemy.sprite.y,
                explosionX,
                explosionY
            )
            if (distance > enemy.stats.hitRadius) {
                continue
            }

            enemy.hp -= 1
            if (enemy.hp <= 0) {
                this.killEnemy(enemy)
                continue
            }

            this.hitEnemy(enemy)
        }
    }

    hitEnemy(enemy) {
        enemy.isHit = true
        enemy.sprite.setVelocity(0, 0)
        enemy.sprite.play(enemy.stats.animations.hit, true)
        enemy.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, animation => {
            if (!enemy.alive || animation.key !== enemy.stats.animations.hit) {
                return
            }

            enemy.isHit = false
            enemy.sprite.play(enemy.stats.animations.idle, true)
        })
    }

    killEnemy(enemy) {
        enemy.alive = false
        enemy.isDead = true
        enemy.sprite.setVelocity(0, 0)
        enemy.sprite.play(enemy.stats.animations.dead, true)
        enemy.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, animation => {
            if (animation.key !== enemy.stats.animations.dead) {
                return
            }
            enemy.sprite.destroy()
            this.tryScheduleWaveTwoSpawn()
        })
    }

    tryScheduleWaveTwoSpawn() {
        if (this.wave2SpawnScheduled || this.currentWave !== 1 || this.isGameOver) {
            return
        }

        const wave1StillPresent = this.enemies.some(enemy =>
            enemy.stats.wave === 1 &&
            (enemy.alive || enemy.sprite?.active)
        )
        if (wave1StillPresent) {
            return
        }

        this.wave2SpawnScheduled = true
        this.wave2SpawnTimer = this.time.delayedCall(WAVE2_SPAWN_DELAY_MS, () => {
            if (this.isGameOver || this.isRestarting) {
                return
            }
            this.spawnWaveTwoEnemies()
        })
    }

    triggerGameOver() {
        this.isGameOver = true
        this.isCaptainHit = false
        this.isCaptainJumping = false
        this.captain.sprite.setVelocity(0, 0)
        this.captain.sprite.play('captain-dead-ground', true)
        this.gameOverText?.setVisible(true)
    }

    setupBackgroundMusic() {
        if (!this.cache.audio.exists('battle-theme')) {
            this.backgroundMusic = null
            return
        }

        this.backgroundMusic = this.sound.get('battle-theme') ?? this.sound.add('battle-theme', {
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

import Phaser from 'phaser'
import GameScene from './scenes/GameScene.js'
import makiConfig from './maki.config.js'

new Phaser.Game({
    type: Phaser.AUTO,
    width: makiConfig.width,
    height: makiConfig.height,
    backgroundColor: '#183221',
    pixelArt: true,
    physics: {
        default: 'arcade',
        arcade: {
            debug: makiConfig.debug
        }
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [GameScene]
})

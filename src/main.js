import GameScene from "./scenes/GameScene.js";
import MenuScene from "./scenes/MenuScene.js";

const config = {
    type: Phaser.AUTO,
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: window.innerWidth,
        height: window.innerHeight,
    },
    backgroundColor: "#222",
    parent: "game-container",
    input: {
        gamepad: true
    },
    physics: {
        default: "arcade",
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [MenuScene, GameScene]
};

new Phaser.Game(config);




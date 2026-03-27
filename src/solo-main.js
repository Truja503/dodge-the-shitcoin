import SoloScene from "./scenes/SoloScene.js";

const config = {
    type: Phaser.AUTO,
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: window.innerWidth,
        height: window.innerHeight,
    },
    backgroundColor: "#0b0f1a",
    parent: "solo-container",
    input: {
        gamepad: true,
        touch: true
    },
    physics: {
        default: "arcade",
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [SoloScene]
};

new Phaser.Game(config);

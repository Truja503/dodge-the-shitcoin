import TournamentMatchScene from "./scenes/TournamentMatchScene.js";

const config = {
    type: Phaser.AUTO,
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: window.innerWidth,
        height: window.innerHeight,
    },
    backgroundColor: "#0b0f1a",
    parent: "match-container",
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
    scene: [TournamentMatchScene]
};

new Phaser.Game(config);

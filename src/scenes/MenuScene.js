export default class MenuScene extends Phaser.Scene {
    constructor() {
        super("MenuScene");
    }

    preload() {
        // Puedes cargar un background o logo si quieres
        this.load.image("bg_chaos", "assets/backgrounds/bg_chaos.png");
    }

    create() {

        this.bg_chaos = this.add.image(0, 0, "bg_chaos").setOrigin(0, 0);
        this.bg_chaos.setDisplaySize(this.scale.width, this.scale.height);
        this.bg_chaos.setDepth(-10);

        const startButton = this.add.text(this.scale.width / 2, this.scale.height - 300, "START GAME", {
            fontFamily: "CinzelBold",
            fontSize: "28px",
            color: "#cbd5e1",
            stroke: "#000",
            strokeThickness: 4
        }).setOrigin(0.5).setInteractive();

        startButton.on("pointerdown", () => {
            this.scene.start("GameScene");
        });
    }
}

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super("MenuScene");
    }

    preload() {
        // Puedes cargar un background o logo si quieres
        this.load.image("bg_chaos", "assets/backgrounds/bg7.png");
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

        const tournamentButton = this.add.text(this.scale.width / 2, this.scale.height - 240, "TOURNAMENT", {
            fontFamily: "CinzelBold",
            fontSize: "24px",
            color: "#f5a623",
            stroke: "#000",
            strokeThickness: 4
        }).setOrigin(0.5).setInteractive();

        tournamentButton.on("pointerover", () => tournamentButton.setColor("#ffd700"));
        tournamentButton.on("pointerout", () => tournamentButton.setColor("#f5a623"));
        tournamentButton.on("pointerdown", () => {
            window.open("tournament/join.html", "_blank");
        });

        const soloButton = this.add.text(this.scale.width / 2, this.scale.height - 180, "SOLO MODE", {
            fontFamily: "CinzelBold",
            fontSize: "24px",
            color: "#38bdf8",
            stroke: "#000",
            strokeThickness: 4
        }).setOrigin(0.5).setInteractive();

        soloButton.on("pointerover", () => soloButton.setColor("#7dd3fc"));
        soloButton.on("pointerout", () => soloButton.setColor("#38bdf8"));
        soloButton.on("pointerdown", () => {
            window.open("solo.html", "_self");
        });

        // Show logged-in user
        const user = JSON.parse(localStorage.getItem('dts_user') || '{}');
        if (user.username) {
            this.add.text(this.scale.width / 2, 60, `⚡ ${user.username}`, {
                fontFamily: "CinzelBold",
                fontSize: "18px",
                color: "#38bdf8",
                stroke: "#000",
                strokeThickness: 2
            }).setOrigin(0.5);
        }

        // Logout
        const logoutBtn = this.add.text(this.scale.width / 2, this.scale.height - 120, "LOGOUT", {
            fontFamily: "Cinzel",
            fontSize: "16px",
            color: "#64748b",
            stroke: "#000",
            strokeThickness: 2
        }).setOrigin(0.5).setInteractive();

        logoutBtn.on("pointerover", () => logoutBtn.setColor("#ef4444"));
        logoutBtn.on("pointerout", () => logoutBtn.setColor("#64748b"));
        logoutBtn.on("pointerdown", () => {
            localStorage.removeItem('dts_token');
            localStorage.removeItem('dts_user');
            window.location.href = 'login.html';
        });
    }
}

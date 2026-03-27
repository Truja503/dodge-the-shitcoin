export default class MenuScene extends Phaser.Scene {
    constructor() {
        super("MenuScene");
    }

    preload() {
        this.load.image("bg_chaos", "assets/backgrounds/bg7.png");
    }

    create() {
        // Hide the game header when in menu
        const header = document.querySelector("header");
        if (header) header.style.display = "none";

        // Background
        this.bg_chaos = this.add.image(0, 0, "bg_chaos").setOrigin(0, 0);
        this.bg_chaos.setDisplaySize(this.scale.width, this.scale.height);
        this.bg_chaos.setDepth(-10);

        // Dark overlay for contrast
        this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.5)
            .setOrigin(0, 0).setDepth(-9);

        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;

        // ── User display with floating animation ──
        const user = JSON.parse(localStorage.getItem('dts_user') || '{}');
        const isLoggedIn = !!user.username;

        const userText = this.add.text(centerX, 60, isLoggedIn ? `⚡ ${user.username}` : '⚡ Guest', {
            fontFamily: "CinzelBold",
            fontSize: "18px",
            color: isLoggedIn ? "#38bdf8" : "#64748b",
            stroke: "#000",
            strokeThickness: 2
        }).setOrigin(0.5);

        // Floating animation for user text
        this.tweens.add({
            targets: userText,
            y: userText.y + 6,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // ── Buttons ──
        const buttons = [
            { label: "START GAME", color: 0x38bdf8, textColor: "#38bdf8", hoverColor: "#7dd3fc", y: centerY - 40, action: () => this.scene.start("GameScene") },
            { label: "TOURNAMENT", color: 0xf5a623, textColor: "#f5a623", hoverColor: "#ffd700", y: centerY + 30, action: () => window.open("tournament/join.html", "_blank") },
            { label: "SOLO MODE", color: 0x0ea5e9, textColor: "#0ea5e9", hoverColor: "#38bdf8", y: centerY + 100, action: () => window.open("solo.html", "_self") },
            { label: isLoggedIn ? "LOGOUT" : "LOGIN", color: 0x475569, textColor: "#94a3b8", hoverColor: isLoggedIn ? "#ef4444" : "#4ade80", y: centerY + 170, action: () => {
                if (isLoggedIn) {
                    localStorage.removeItem('dts_token');
                    localStorage.removeItem('dts_user');
                }
                window.location.href = 'login.html';
            }}
        ];

        buttons.forEach((btn) => {
            const btnW = 260;
            const btnH = 48;
            const x = centerX;
            const y = btn.y;

            // Button background using graphics
            const bg = this.add.graphics();
            bg.fillStyle(btn.color, 0.1);
            bg.lineStyle(1, btn.color, 0.4);
            bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 12);
            bg.strokeRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 12);

            // Glow bg (hidden by default)
            const glowBg = this.add.graphics();
            glowBg.fillStyle(btn.color, 0.2);
            glowBg.lineStyle(2, btn.color, 0.7);
            glowBg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 12);
            glowBg.strokeRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 12);
            glowBg.setAlpha(0);

            // Button text
            const text = this.add.text(x, y, btn.label, {
                fontFamily: "CinzelBold",
                fontSize: "20px",
                color: btn.textColor,
                stroke: "#000",
                strokeThickness: 3
            }).setOrigin(0.5);

            // Create interactive zone
            const hitArea = this.add.rectangle(x, y, btnW, btnH, 0x000000, 0)
                .setInteractive({ useHandCursor: true });

            // Container-like group for scaling
            const container = this.add.container(0, 0, [bg, glowBg, text, hitArea]);

            hitArea.on("pointerover", () => {
                this.tweens.add({
                    targets: container,
                    scaleX: 1.05,
                    scaleY: 1.05,
                    duration: 150,
                    ease: 'Back.easeOut'
                });
                glowBg.setAlpha(1);
                text.setColor(btn.hoverColor);
            });

            hitArea.on("pointerout", () => {
                this.tweens.add({
                    targets: container,
                    scaleX: 1,
                    scaleY: 1,
                    duration: 150,
                    ease: 'Back.easeOut'
                });
                glowBg.setAlpha(0);
                text.setColor(btn.textColor);
            });

            hitArea.on("pointerdown", () => {
                this.tweens.add({
                    targets: container,
                    scaleX: 0.95,
                    scaleY: 0.95,
                    duration: 80,
                    yoyo: true,
                    ease: 'Quad.easeInOut',
                    onComplete: () => btn.action()
                });
            });
        });
    }
}

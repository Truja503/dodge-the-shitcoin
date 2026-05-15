import Player from "../entities/Player.js";
import Player2 from "../entities/Player2.js";
import Spawner from "../systems/Spawner.js";
import CollisionManager from "../systems/CollisionManager.js";
import { GAME_WIDTH, GAME_HEIGHT, BASE_ENEMY_SPEED } from "../utils/constants.js";
import Bitcoin from "../entities/Bitcoin.js";
import { loadPlayerAssets, createPlayerAnimations } from "../animations/playerAnimations.js";
import Dollar from "../entities/Dollar.js";
import OrangePill from "../entities/OrangePill.js";

var player1Score = document.getElementById("player1-score");
var player2Score = document.getElementById("player2-score");
const header = document.querySelector("header");

// Orange Pill: aparece 5s, se va, reaparece cada 50s
const PILL_VISIBLE_DURATION  = 5000;
const PILL_RESPAWN_DELAY     = 50000;

export default class GameScene extends Phaser.Scene {
    constructor() {
        super("GameScene");
    }

    preload() {
        loadPlayerAssets(this);
        this.load.image("eth_enemy",  "../assets/enemy/eth_enemy.png");
        this.load.image("bg_dark",    "assets/backgrounds/bg4.png");
        this.load.image("magicParticle", "assets/effects/particle.png");
        this.load.image("cloud",      "assets/backgrounds/fog_bg.png");
        this.load.image("bitcoin",    "assets/items/bitcoin.png");
        this.load.image("dollar",     "assets/items/dollar.png");
        this.load.image("orangepill", "assets/items/orangepill.png"); // placeholder naranja
    }

    create() {
        // Re-fetch DOM refs (they might be stale after scene restart)
        player1Score = document.getElementById("player1-score");
        player2Score = document.getElementById("player2-score");

        // ── Grupos ───────────────────────────────────────────────
        this.dollars      = this.physics.add.group();
        this.thrownDollars = this.physics.add.group();
        this.orangePills  = this.physics.add.group();

        // ── Fondo ────────────────────────────────────────────────
        this.bg = this.add.image(
            this.scale.width / 2, this.scale.height / 2, "bg_dark"
        ).setDepth(-30);

        this.darkOverlay = this.add.rectangle(
            0, 0, this.scale.width, this.scale.height, 0x000000, 0.8
        ).setOrigin(0, 0).setDepth(-29);

        this.scale.on("resize", (gameSize) => {
            const { width, height } = gameSize;
            this.darkOverlay.setSize(width, height);
            this.bg.setPosition(width / 2, height / 2);
            this.bg.setScale(Math.max(width / this.bg.width, height / this.bg.height));
        });

        const scaleX = this.scale.width  / this.bg.width;
        const scaleY = this.scale.height / this.bg.height;
        this.bg.setScale(Math.max(scaleX, scaleY));

        // ── Nubes ─────────────────────────────────────────────────
        this.cloud1 = this.add.image(this.scale.width / 2, this.scale.height / 2, "cloud")
            .setOrigin(0.5).setScale(2).setAlpha(0.13).setBlendMode(Phaser.BlendModes.SCREEN);
        this.cloud2 = this.add.image(this.scale.width / 2, this.scale.height / 2, "cloud")
            .setOrigin(0.5).setScale(2).setAlpha(0.18).setBlendMode(Phaser.BlendModes.ADD);

        // ── Estado ───────────────────────────────────────────────
        this.bitcoinsCollected = { player1: 0, player2: 0 };
        this.collectedCount = 0;
        this.gameStarted    = true;

        // ── Timer (1.5 minutes) ──────────────────────────────────
        this.matchDuration = 90000; // 1.5 minutes in ms
        this.matchTimer = 0;
        this.domTimer = document.getElementById('game-timer');
        if (this.domTimer) {
            this.domTimer.textContent = '1:30';
            this.domTimer.classList.remove('urgent');
        }

        // ── Greed Mechanic ───────────────────────────────────────
        this.recentCollections = [];
        this.greedLevel = 0;
        this._baseDifficultySpeed = BASE_ENEMY_SPEED;

        // ── Greed overlay (red tint) ─────────────────────────────
        this.greedOverlay = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0xff0000, 0)
            .setOrigin(0, 0).setDepth(50).setScrollFactor(0);

        // ── Input ────────────────────────────────────────────────
        this.cursors  = this.input.keyboard.createCursorKeys();
        this.wasdKeys = this.input.keyboard.addKeys({
            W: Phaser.Input.Keyboard.KeyCodes.W,
            A: Phaser.Input.Keyboard.KeyCodes.A,
            S: Phaser.Input.Keyboard.KeyCodes.S,
            D: Phaser.Input.Keyboard.KeyCodes.D
        });
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.eKey     = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

        // ── Jugadores ────────────────────────────────────────────
        createPlayerAnimations(this);
        this.player  = new Player(this);
        this.player2 = new Player2(this);
        this.player.canMove = true;
        header.style.display = "flex";

        // Reset score display
        if (player1Score) player1Score.textContent = '0';
        if (player2Score) player2Score.textContent = '0';

        // ── Gamepad — auto-detected in Player.update(), no flag needed ──

        // ── Spawner ──────────────────────────────────────────────
        this.spawner = new Spawner(this);
        this.spawner.currentEnemySpeed = BASE_ENEMY_SPEED;

        // ── Scalable Difficulty ──────────────────────────────────
        this.enemySpawnDelay = 800; // start slower

        this.enemySpawnEvent = this.time.addEvent({
            delay: this.enemySpawnDelay,
            loop: true,
            callback: () => this.spawner.spawnEnemy()
        });

        // Progressive difficulty: every 5 seconds
        this.time.addEvent({
            delay: 5000,
            loop: true,
            callback: () => {
                // Increase base difficulty speed
                this._baseDifficultySpeed += 30;

                // Decrease spawn interval (faster spawning) — minimum 200ms
                if (this.enemySpawnDelay > 200) {
                    this.enemySpawnDelay -= 30;
                    // Recreate the spawn timer with new delay
                    if (this.enemySpawnEvent) this.enemySpawnEvent.remove();
                    this.enemySpawnEvent = this.time.addEvent({
                        delay: this.enemySpawnDelay,
                        loop: true,
                        callback: () => this.spawner.spawnEnemy()
                    });
                }
            }
        });

        // Dólar: cada 8s si no hay uno activo
        this.time.addEvent({ delay: 8000, loop: true, callback: () => this._spawnDollarIfNone() });
        this.time.delayedCall(5000, () => this._spawnDollarIfNone());

        // Orange Pill: primer spawn a los 15s
        this.time.delayedCall(15000, () => this._spawnOrangePill());

        // Infinite bitcoins — spawn first one
        this.spawnNextBitcoin();

        // ── Colisiones ───────────────────────────────────────────
        new CollisionManager(this, this.player,  this.spawner, this, "player1");
        new CollisionManager(this, this.player2, this.spawner, this, "player2");
        new CollisionManager(this, this.player,  this.spawner, this, "player1", this.player2);
        new CollisionManager(this, this.player2, this.spawner, this, "player2", this.player);

        // Dólares del mapa
        this.physics.add.overlap(this.player.sprite,  this.dollars, this._onCollectDollar, null, this);
        this.physics.add.overlap(this.player2.sprite, this.dollars, this._onCollectDollar, null, this);

        // Orange pills
        this.physics.add.overlap(this.player.sprite,  this.orangePills, this._onCollectPill, null, this);
        this.physics.add.overlap(this.player2.sprite, this.orangePills, this._onCollectPill, null, this);

        // Proyectiles dólar vs jugadores
        this.physics.add.overlap(
            this.thrownDollars, this.player.sprite,
            (a, b) => {
                const proj = this.thrownDollars.contains(a) ? a : b;
                this._dollarHitPlayer(proj, this.player);
            },
            null, this
        );
        this.physics.add.overlap(
            this.thrownDollars, this.player2.sprite,
            (a, b) => {
                const proj = this.thrownDollars.contains(a) ? a : b;
                this._dollarHitPlayer(proj, this.player2);
            },
            null, this
        );

        // ── Partículas ───────────────────────────────────────────
        this.magicEmitter = this.add.particles(0, 0, "magicParticle", {
            x: { min: 0, max: this.game.config.width },
            y: { min: 0, max: this.game.config.height },
            speed: { min: -15, max: 15 },
            lifespan: 2200,
            quantity: 1,
            scale: { start: 0.8, end: 0 },
            alpha: { start: 0.25, end: 0 },
            blendMode: "ADD",
            frequency: 40,
            tint: [0x7dd3fc, 0x38bdf8, 0x0ea5e9],
        });
    }

    update() {
        if (!this.gameStarted) return;

        // ── Match Timer ──────────────────────────────────────────
        this.matchTimer += this.game.loop.delta;
        const remaining = Math.max(0, this.matchDuration - this.matchTimer);
        const sec = Math.ceil(remaining / 1000);
        if (this.domTimer) {
            this.domTimer.textContent = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
            if (remaining <= 30000) {
                this.domTimer.classList.add('urgent');
            }
        }
        if (remaining <= 0) {
            this.endGame();
            return;
        }

        // ── Greed update ─────────────────────────────────────────
        this._updateGreed();
        this.spawner.currentEnemySpeed = this._baseDifficultySpeed + (this.greedLevel * 80);

        // Pad 0 = Player1, Pad 1 = Player2 (any controller type)
        const pad1 = this.input.gamepad.getPad(0);
        const pad2 = this.input.gamepad.getPad(1);
        this.player.update(this.cursors, pad1);
        this.player2.update(this.wasdKeys, pad2);

        // Lanzar dólar
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.player.throwDollar();
        if (Phaser.Input.Keyboard.JustDown(this.eKey))     this.player2.throwDollar();

        // Nubes
        this.cloud1.x += 0.02; this.cloud1.y += 0.01;
        this.cloud2.x -= 0.015; this.cloud2.y += 0.02;
        if (this.cloud1.x > this.scale.width) this.cloud1.x = -200;
        if (this.cloud2.x < -200)             this.cloud2.x = this.scale.width + 200;

        // Enemigos
        this.spawner.enemyObjects.forEach(enemy => enemy.update());

        // Limpiar proyectiles fuera de pantalla
        this.thrownDollars.getChildren().forEach(proj => {
            if (proj.active && (
                proj.x < -60 || proj.x > this.scale.width + 60 ||
                proj.y < -60 || proj.y > this.scale.height + 60
            )) proj.destroy();
        });
    }

    // ── Greed Mechanic ───────────────────────────────────────────
    _updateGreed() {
        const now = Date.now();
        this.recentCollections = this.recentCollections.filter(t => now - t < 10000);
        const recentCount = this.recentCollections.filter(t => now - t < 5000).length;

        if (recentCount >= 4) {
            this.greedLevel = 2;
        } else if (recentCount >= 2) {
            this.greedLevel = 1;
        } else {
            this.greedLevel = 0;
        }

        // Visual feedback: tint the screen slightly red when greedy
        if (this.greedLevel >= 2 && this.greedOverlay) {
            this.greedOverlay.setAlpha(0.08);
        } else if (this.greedLevel === 1 && this.greedOverlay) {
            this.greedOverlay.setAlpha(0.03);
        } else if (this.greedOverlay) {
            this.greedOverlay.setAlpha(0);
        }
    }

    // ── Spawn dólar (max 1 en pantalla) ─────────────────────────
    _spawnDollarIfNone() {
        if (!this.gameStarted) return;
        if (this.dollars.countActive(true) > 0) return;
        const x = Phaser.Math.Between(80, this.scale.width - 80);
        const y = Phaser.Math.Between(80, this.scale.height - 80);
        const dollar = new Dollar(this, x, y);
        this.dollars.add(dollar);
    }

    // ── Spawn Orange Pill (aparece 5s, desaparece, vuelve en 50s) ─
    _spawnOrangePill() {
        if (!this.gameStarted) return;

        const x = Phaser.Math.Between(80, this.scale.width - 80);
        const y = Phaser.Math.Between(80, this.scale.height - 80);
        const pill = new OrangePill(this, x, y);
        this.orangePills.add(pill);

        // Desaparece a los 5s si nadie la agarró
        this.time.delayedCall(PILL_VISIBLE_DURATION, () => {
            if (pill && pill.active) {
                pill.destroy();
            }
            // Reaparece en 50s
            this.time.delayedCall(PILL_RESPAWN_DELAY, () => this._spawnOrangePill());
        });
    }

    // ── Recoger dólar ────────────────────────────────────────────
    _onCollectDollar(playerSprite, dollar) {
        if (!dollar || !dollar.active) return;
        dollar.destroy();

        const playerObj = (playerSprite === this.player.sprite) ? this.player : this.player2;
        playerObj.dollarCount++;
        playerObj.applyDollarSlow();
    }

    // ── Recoger Orange Pill ──────────────────────────────────────
    _onCollectPill(playerSprite, pill) {
        if (!pill || !pill.active) return;
        pill.destroy();

        const playerObj = (playerSprite === this.player.sprite) ? this.player : this.player2;
        playerObj.applyOrangePill();

        // Efecto visual: flash naranja
        this.cameras.main.flash(200, 255, 140, 0);

        // Reaparece después de 50s (desde que la agarraron)
        this.time.delayedCall(PILL_RESPAWN_DELAY, () => this._spawnOrangePill());
    }

    // ── Proyectil dólar golpea jugador ───────────────────────────
    _dollarHitPlayer(proj, playerObj) {
        if (!proj || !proj.active) return;
        if (proj._thrower === playerObj) return;
        if (!playerObj || !playerObj.sprite || !playerObj.sprite.active) return;

        // Invencible bloquea el proyectil sin efecto
        if (playerObj.isInvincible) {
            proj.destroy();
            return;
        }

        const hitX = proj.x;
        const hitY = proj.y;
        proj.destroy();

        playerObj.sprite.x += (playerObj.sprite.x < hitX) ? -70 : 70;
        playerObj.sprite.y += (playerObj.sprite.y < hitY) ? -70 : 70;

        this.cameras.main.flash(100, 255, 255, 255);
        this.cameras.main.shake(150, 0.01);

        playerObj.canMove = false;
        this.time.delayedCall(1000, () => {
            if (playerObj && playerObj.sprite && playerObj.sprite.body) playerObj.canMove = true;
        });

        this.hitByEnemy(playerObj);
    }

    // ── Recolectar bitcoin ───────────────────────────────────────
    collectBitcoin(player, bitcoin) {
        if (!bitcoin || !bitcoin.active) return;
        bitcoin.destroy();
        this.collectedCount++;

        // Track for greed mechanic
        this.recentCollections.push(Date.now());

        if (player === "player1") {
            this.bitcoinsCollected.player1++;
            if (player1Score) {
                player1Score.textContent = this.bitcoinsCollected.player1;
                player1Score.classList.remove("score-pop");
                // Force reflow for re-triggering animation
                void player1Score.offsetWidth;
                player1Score.classList.add("score-pop");
            }
        } else {
            this.bitcoinsCollected.player2++;
            if (player2Score) {
                player2Score.textContent = this.bitcoinsCollected.player2;
                player2Score.classList.remove("score-pop");
                void player2Score.offsetWidth;
                player2Score.classList.add("score-pop");
            }
        }

        // Always spawn next bitcoin (infinite)
        this.spawnNextBitcoin();
    }

    // ── Golpe de enemy ───────────────────────────────────────────
    hitByEnemy(playerObj) {
        if (!playerObj || !playerObj.sprite || !playerObj.sprite.active) return;

        // Enemies stun but do NOT reduce score
        if (playerObj.sprite && playerObj.sprite.body) playerObj.sprite.setVelocity(0, 0);
        playerObj.canMove = false;
        this.time.delayedCall(1000, () => {
            if (playerObj && playerObj.sprite && playerObj.sprite.body) playerObj.canMove = true;
        });
    }

    spawnNextBitcoin() {
        const x = Phaser.Math.Between(50, this.scale.width - 100);
        const y = Phaser.Math.Between(50, this.scale.height - 100);
        const btc = new Bitcoin(this, x, y);
        this.spawner.bitcoins.add(btc.sprite);
    }

    endGame() {
        this.gameStarted = false;

        const W  = this.scale.width;
        const H  = this.scale.height;
        const cx = W / 2;
        const cy = H / 2;

        // ── Determine winner ──
        const p1Score = this.bitcoinsCollected.player1;
        const p2Score = this.bitcoinsCollected.player2;
        const isDraw  = p1Score === p2Score;
        const p1Wins  = p1Score > p2Score;

        const winnerLabel = isDraw  ? "DRAW"
                          : p1Wins  ? "PLAYER  1" : "PLAYER  2";
        const winnerColor = isDraw  ? 0xe2e8f0
                          : p1Wins  ? 0x38bdf8    : 0xf5a623;
        const winnerHex   = isDraw  ? "#e2e8f0"
                          : p1Wins  ? "#38bdf8"    : "#f5a623";
        const winnerSprite = isDraw ? null
                           : p1Wins ? this.player?.sprite : this.player2?.sprite;

        // ── Tournament report (fire immediately) ──
        try {
            const tKey   = localStorage.getItem('tournamentKey');
            const tAdmin = localStorage.getItem('tournamentAdminKey');
            const tMatch = localStorage.getItem('tournamentMatchId');
            if (tKey && tAdmin && tMatch) {
                const isLocal = !window.location.hostname || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                const apiBase = isLocal ? 'http://localhost:3001/api' : `${window.location.origin}/api`;
                fetch(`${apiBase}/tournaments/${tKey}/match/${tMatch}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ adminKey: tAdmin, player1Score: p1Score, player2Score: p2Score })
                }).catch(() => {});
            }
        } catch (e) { /* ignore */ }

        // ── 1. Black overlay fade-in ──
        const overlay = this.add.rectangle(cx, cy, W, H, 0x000000, 0).setDepth(50);
        this.tweens.add({ targets: overlay, fillAlpha: 0.75, duration: 600, ease: 'Sine.easeIn' });

        // ── 2. Freeze & zoom winner sprite to center ──
        if (winnerSprite && winnerSprite.active) {
            winnerSprite.setDepth(60);
            if (winnerSprite.anims) winnerSprite.anims.stop();

            // camera-shake punch
            this.cameras.main.shake(400, 0.018);

            this.time.delayedCall(250, () => {
                this.tweens.add({
                    targets: winnerSprite,
                    x: cx, y: cy - 40,
                    scaleX: 3.5, scaleY: 3.5,
                    duration: 700,
                    ease: 'Back.easeOut'
                });
            });
        }

        // ── 3. Particle EXPLOSION burst (Phaser emitters) ──
        this.time.delayedCall(200, () => {
            // Gold burst
            const emitter = this.add.particles(cx, cy - 40, "magicParticle", {
                speed:    { min: 120, max: 520 },
                angle:    { min: 0, max: 360 },
                scale:    { start: 1.4, end: 0 },
                alpha:    { start: 1, end: 0 },
                lifespan: 900,
                gravityY: 280,
                tint:     [winnerColor, 0xffd700, 0xffffff],
                quantity: 5,
                frequency: 25,
                blendMode: 'ADD',
            }).setDepth(70);

            // Secondary scatter — higher arc
            const emitter2 = this.add.particles(cx, cy - 40, "magicParticle", {
                speed:    { min: 200, max: 700 },
                angle:    { min: -110, max: -70 },
                scale:    { start: 0.9, end: 0 },
                alpha:    { start: 0.9, end: 0 },
                lifespan: 1200,
                gravityY: 380,
                tint:     [winnerColor, 0xffffff],
                quantity: 3,
                frequency: 20,
                blendMode: 'ADD',
            }).setDepth(70);

            // Stop emitters after 1.4s
            this.time.delayedCall(1400, () => {
                emitter.stop();
                emitter2.stop();
            });
        });

        // ── 4. Continuous ambient particles rising ──
        this.time.delayedCall(400, () => {
            const ambient = this.add.particles(0, H, "magicParticle", {
                x:        { min: 0, max: W },
                y:        { min: H + 10, max: H + 10 },
                speed:    { min: 40, max: 150 },
                angle:    { min: -100, max: -80 },
                scale:    { start: 0.7, end: 0 },
                alpha:    { start: 0.6, end: 0 },
                lifespan: { min: 1200, max: 2400 },
                tint:     [winnerColor, 0xffd700, 0xffeaa0],
                quantity: 2,
                frequency: 40,
                blendMode: 'ADD',
            }).setDepth(65);
        });

        // ── 5. Screen flash ──
        this.time.delayedCall(280, () => {
            const flash = this.add.rectangle(cx, cy, W, H, 0xffffff, 0).setDepth(80);
            this.tweens.add({
                targets: flash, fillAlpha: 0.35, duration: 80, yoyo: true,
                onComplete: () => flash.destroy()
            });
        });

        // ── 6. WINNER title — dramatic entry ──
        this.time.delayedCall(550, () => {
            // Glow layer
            const glow = this.add.text(cx, cy - 140, isDraw ? "DRAW" : "WINNER", {
                fontFamily: "CinzelBold",
                fontSize: "72px",
                color: winnerHex,
            }).setOrigin(0.5).setDepth(90).setAlpha(0).setScale(3);

            this.tweens.add({
                targets: glow,
                alpha: { from: 0.25, to: 0.08 },
                scaleX: 1, scaleY: 1,
                duration: 500, ease: 'Expo.easeOut'
            });
            this.tweens.add({
                targets: glow,
                alpha: { from: 0.15, to: 0.25 },
                duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 600
            });

            // Main title
            const title = this.add.text(cx, cy - 140, isDraw ? "DRAW" : "WINNER", {
                fontFamily: "CinzelBold",
                fontSize: "72px",
                color: winnerHex,
                stroke: "#000000",
                strokeThickness: 8,
                shadow: { offsetX: 0, offsetY: 0, color: winnerHex, blur: 30, fill: true }
            }).setOrigin(0.5).setDepth(91).setAlpha(0).setScale(0.1);

            this.tweens.add({
                targets: title,
                alpha: 1, scaleX: 1, scaleY: 1,
                duration: 500, ease: 'Back.easeOut',
                onComplete: () => {
                    this.tweens.add({
                        targets: title,
                        scaleX: 1.06, scaleY: 1.06,
                        duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
                    });
                }
            });

            // Player name
            if (!isDraw) {
                const nameText = this.add.text(cx, cy - 60, winnerLabel + "  WINS!", {
                    fontFamily: "CinzelBold",
                    fontSize: "36px",
                    color: winnerHex,
                    stroke: "#000000",
                    strokeThickness: 5,
                    shadow: { offsetX: 0, offsetY: 0, color: winnerHex, blur: 20, fill: true }
                }).setOrigin(0.5).setDepth(91).setAlpha(0).setY(cy - 40);

                this.tweens.add({
                    targets: nameText, alpha: 1, y: cy - 60,
                    duration: 400, delay: 150, ease: 'Back.easeOut'
                });
            }
        });

        // ── 7. Score display ──
        this.time.delayedCall(900, () => {
            const score = this.add.text(cx, cy + 80,
                `${p1Score}  ─  ${p2Score}`, {
                fontFamily: "CinzelBold",
                fontSize: "32px",
                color: "#c8a060",
                stroke: "#000",
                strokeThickness: 4,
            }).setOrigin(0.5).setDepth(91).setAlpha(0).setY(cy + 100);

            this.tweens.add({ targets: score, alpha: 0.85, y: cy + 80, duration: 400, ease: 'Back.easeOut' });
        });

        // ── 8. "REMATCH" hint ──
        this.time.delayedCall(1800, () => {
            const hint = this.add.text(cx, cy + 150, "↩  Returning to menu...", {
                fontFamily: "Cinzel",
                fontSize: "14px",
                color: "#6b5a30",
            }).setOrigin(0.5).setDepth(91).setAlpha(0);

            this.tweens.add({ targets: hint, alpha: 0.6, duration: 600, ease: 'Sine.easeOut' });
            this.tweens.add({
                targets: hint, alpha: { from: 0.3, to: 0.7 },
                duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 700
            });
        });

        // ── 9. Return to menu ──
        this.time.delayedCall(6000, () => this.scene.start("MenuScene"));
    }
}

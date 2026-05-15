import Player from "../entities/Player.js";
import Player2 from "../entities/Player2.js";
import Spawner from "../systems/Spawner.js";
import CollisionManager from "../systems/CollisionManager.js";
import { GAME_WIDTH, GAME_HEIGHT, BASE_ENEMY_SPEED } from "../utils/constants.js";
import Bitcoin from "../entities/Bitcoin.js";
import { loadPlayerAssets, createPlayerAnimations } from "../animations/playerAnimations.js";
import Dollar from "../entities/Dollar.js";
import OrangePill from "../entities/OrangePill.js";

// Orange Pill: aparece 5s, se va, reaparece cada 50s
const PILL_VISIBLE_DURATION  = 5000;
const PILL_RESPAWN_DELAY     = 50000;

export default class TournamentMatchScene extends Phaser.Scene {
    constructor() {
        super("TournamentMatchScene");
    }

    preload() {
        loadPlayerAssets(this);
        this.load.image("eth_enemy",  "../assets/enemy/eth_enemy.png");
        this.load.image("bg_dark",    "../assets/backgrounds/bg4.png");
        this.load.image("magicParticle", "../assets/effects/particle.png");
        this.load.image("cloud",      "../assets/backgrounds/fog_bg.png");
        this.load.image("bitcoin",    "../assets/items/bitcoin.png");
        this.load.image("dollar",     "../assets/items/dollar.png");
        this.load.image("orangepill", "../assets/items/dollar.png"); // placeholder naranja
    }

    create() {
        // ── Read URL params ──────────────────────────────────────
        const params = new URLSearchParams(window.location.search);
        this.p1Name = params.get('p1') || 'Player 1';
        this.p2Name = params.get('p2') || 'Player 2';
        this.matchId = params.get('matchId');
        this.tournamentKey = params.get('tournamentKey');
        this.adminKeyParam = params.get('adminKey');
        this.isSpectator = params.get('spectator') === 'true';

        // ── DOM refs ─────────────────────────────────────────────
        this.domP1Score = document.getElementById('match-p1-score');
        this.domP2Score = document.getElementById('match-p2-score');
        this.domTimer   = document.getElementById('match-timer');

        // Show player names in DOM header
        const p1El = document.getElementById('match-p1-name');
        const p2El = document.getElementById('match-p2-name');
        if (p1El) p1El.textContent = this.p1Name;
        if (p2El) p2El.textContent = this.p2Name;

        // If spectator: show badge
        if (this.isSpectator) {
            const badge = document.getElementById('spectator-badge');
            if (badge) badge.style.display = 'block';
        }

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
        this.gameStarted    = false; // starts when START is clicked

        // ── Timer (1.5 minutes) ──────────────────────────────────
        this.matchDuration = 90000;
        this.matchTimer = 0;
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
        if (!this.isSpectator) {
            this.cursors  = this.input.keyboard.createCursorKeys();
            this.wasdKeys = this.input.keyboard.addKeys({
                W: Phaser.Input.Keyboard.KeyCodes.W,
                A: Phaser.Input.Keyboard.KeyCodes.A,
                S: Phaser.Input.Keyboard.KeyCodes.S,
                D: Phaser.Input.Keyboard.KeyCodes.D
            });
            this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
            this.eKey     = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
        }

        // ── Jugadores ────────────────────────────────────────────
        createPlayerAnimations(this);
        this.player  = new Player(this);
        this.player2 = new Player2(this);
        this.player.canMove  = false;
        this.player2.canMove = false;

        // Reset score display
        if (this.domP1Score) this.domP1Score.textContent = '0';
        if (this.domP2Score) this.domP2Score.textContent = '0';

        // ── Spawner ──────────────────────────────────────────────
        this.spawner = new Spawner(this);
        this.spawner.currentEnemySpeed = BASE_ENEMY_SPEED;

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

        // ── Show START overlay ───────────────────────────────────
        this._showStartOverlay();
    }

    // ═════════════════════════════════════════════════════════════
    // START OVERLAY
    // ═════════════════════════════════════════════════════════════
    _showStartOverlay() {
        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;

        this._overlayElements = [];

        const bg = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.7)
            .setOrigin(0, 0).setDepth(300);
        this._overlayElements.push(bg);

        const p1Text = this.add.text(cx, cy - 60, this.p1Name, {
            fontFamily: 'Orbitron', fontSize: '28px', color: '#38bdf8', stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5).setDepth(301);
        this._overlayElements.push(p1Text);

        const vsText = this.add.text(cx, cy, 'VS', {
            fontFamily: 'Cinzel', fontSize: '24px', color: '#64748b', stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(301);
        this._overlayElements.push(vsText);

        const p2Text = this.add.text(cx, cy + 60, this.p2Name, {
            fontFamily: 'Orbitron', fontSize: '28px', color: '#f5a623', stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5).setDepth(301);
        this._overlayElements.push(p2Text);

        const controlsP1 = this.add.text(cx, cy - 90, '⌨ Arrow Keys + SPACE', {
            fontFamily: 'Inter', fontSize: '12px', color: '#38bdf8', stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(301).setAlpha(0.7);
        this._overlayElements.push(controlsP1);

        const controlsP2 = this.add.text(cx, cy + 90, '⌨ WASD + E', {
            fontFamily: 'Inter', fontSize: '12px', color: '#f5a623', stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(301).setAlpha(0.7);
        this._overlayElements.push(controlsP2);

        if (!this.isSpectator) {
            const startBtn = this.add.text(cx, cy + 150, '▶ START', {
                fontFamily: 'Cinzel', fontSize: '32px', color: '#22c55e', stroke: '#000', strokeThickness: 5
            }).setOrigin(0.5).setDepth(301).setInteractive({ useHandCursor: true });
            this._overlayElements.push(startBtn);

            startBtn.on('pointerover', () => startBtn.setColor('#4ade80'));
            startBtn.on('pointerout', () => startBtn.setColor('#22c55e'));
            startBtn.on('pointerdown', () => {
                this._destroyOverlay();
                this._beginMatch();
            });
        } else {
            const specText = this.add.text(cx, cy + 150, '👁 SPECTATING', {
                fontFamily: 'Cinzel', fontSize: '20px', color: '#f5a623', stroke: '#000', strokeThickness: 3
            }).setOrigin(0.5).setDepth(301);
            this._overlayElements.push(specText);

            // Spectator auto-starts after 3s
            this.time.delayedCall(3000, () => {
                this._destroyOverlay();
                this._beginMatch();
            });
        }
    }

    _destroyOverlay() {
        if (this._overlayElements) {
            this._overlayElements.forEach(el => { if (el && el.destroy) el.destroy(); });
            this._overlayElements = null;
        }
    }

    _beginMatch() {
        this.gameStarted = true;
        this.player.canMove  = !this.isSpectator;
        this.player2.canMove = !this.isSpectator;

        // ── Scalable Difficulty ──────────────────────────────────
        this.enemySpawnDelay = 800;
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
                this._baseDifficultySpeed += 30;
                if (this.enemySpawnDelay > 200) {
                    this.enemySpawnDelay -= 30;
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
    }

    // ═════════════════════════════════════════════════════════════
    // UPDATE
    // ═════════════════════════════════════════════════════════════
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

        // ── Player input (only if not spectator) ─────────────────
        if (!this.isSpectator) {
            const pad1 = this.input.gamepad.getPad(0);
            const pad2 = this.input.gamepad.getPad(1);
            this.player.update(this.cursors, pad1);
            this.player2.update(this.wasdKeys, pad2);

            // Lanzar dólar
            if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.player.throwDollar();
            if (Phaser.Input.Keyboard.JustDown(this.eKey))     this.player2.throwDollar();
        }

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

        // ── Update DOM scores ────────────────────────────────────
        if (this.domP1Score) this.domP1Score.textContent = this.bitcoinsCollected.player1;
        if (this.domP2Score) this.domP2Score.textContent = this.bitcoinsCollected.player2;
    }

    // ═════════════════════════════════════════════════════════════
    // GREED MECHANIC
    // ═════════════════════════════════════════════════════════════
    _updateGreed() {
        const now = Date.now();
        this.recentCollections = this.recentCollections.filter(t => now - t < 10000);
        const recentCount = this.recentCollections.filter(t => now - t < 5000).length;

        if (recentCount >= 4)      this.greedLevel = 2;
        else if (recentCount >= 2) this.greedLevel = 1;
        else                       this.greedLevel = 0;

        if (this.greedLevel >= 2 && this.greedOverlay) this.greedOverlay.setAlpha(0.08);
        else if (this.greedLevel === 1 && this.greedOverlay) this.greedOverlay.setAlpha(0.03);
        else if (this.greedOverlay) this.greedOverlay.setAlpha(0);
    }

    // ═════════════════════════════════════════════════════════════
    // SPAWNING
    // ═════════════════════════════════════════════════════════════
    _spawnDollarIfNone() {
        if (!this.gameStarted) return;
        if (this.dollars.countActive(true) > 0) return;
        const x = Phaser.Math.Between(80, this.scale.width - 80);
        const y = Phaser.Math.Between(80, this.scale.height - 80);
        const dollar = new Dollar(this, x, y);
        this.dollars.add(dollar);
    }

    _spawnOrangePill() {
        if (!this.gameStarted) return;
        const x = Phaser.Math.Between(80, this.scale.width - 80);
        const y = Phaser.Math.Between(80, this.scale.height - 80);
        const pill = new OrangePill(this, x, y);
        this.orangePills.add(pill);

        this.time.delayedCall(PILL_VISIBLE_DURATION, () => {
            if (pill && pill.active) pill.destroy();
            this.time.delayedCall(PILL_RESPAWN_DELAY, () => this._spawnOrangePill());
        });
    }

    // ═════════════════════════════════════════════════════════════
    // COLLECTIBLES
    // ═════════════════════════════════════════════════════════════
    _onCollectDollar(playerSprite, dollar) {
        if (!dollar || !dollar.active) return;
        dollar.destroy();
        const playerObj = (playerSprite === this.player.sprite) ? this.player : this.player2;
        playerObj.dollarCount++;
        playerObj.applyDollarSlow();
    }

    _onCollectPill(playerSprite, pill) {
        if (!pill || !pill.active) return;
        pill.destroy();
        const playerObj = (playerSprite === this.player.sprite) ? this.player : this.player2;
        playerObj.applyOrangePill();
        this.cameras.main.flash(200, 255, 140, 0);
        this.time.delayedCall(PILL_RESPAWN_DELAY, () => this._spawnOrangePill());
    }

    _dollarHitPlayer(proj, playerObj) {
        if (!proj || !proj.active) return;
        if (proj._thrower === playerObj) return;
        if (!playerObj || !playerObj.sprite || !playerObj.sprite.active) return;

        if (playerObj.isInvincible) { proj.destroy(); return; }

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

    // ═════════════════════════════════════════════════════════════
    // BITCOIN
    // ═════════════════════════════════════════════════════════════
    collectBitcoin(player, bitcoin) {
        if (!bitcoin || !bitcoin.active) return;
        bitcoin.destroy();
        this.collectedCount++;
        this.recentCollections.push(Date.now());

        if (player === "player1") {
            this.bitcoinsCollected.player1++;
        } else {
            this.bitcoinsCollected.player2++;
        }

        this.spawnNextBitcoin();
    }

    hitByEnemy(playerObj) {
        if (!playerObj || !playerObj.sprite || !playerObj.sprite.active) return;
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

    // ═════════════════════════════════════════════════════════════
    // END GAME
    // ═════════════════════════════════════════════════════════════
    endGame() {
        this.gameStarted = false;

        const W  = this.scale.width;
        const H  = this.scale.height;
        const cx = W / 2;
        const cy = H / 2;

        const p1Score = this.bitcoinsCollected.player1;
        const p2Score = this.bitcoinsCollected.player2;
        const isDraw  = p1Score === p2Score;
        const p1Wins  = p1Score > p2Score;

        const winnerLabel = isDraw ? "DRAW" : p1Wins ? this.p1Name : this.p2Name;
        const winnerColor = isDraw ? 0xe2e8f0 : p1Wins ? 0x38bdf8 : 0xf5a623;
        const winnerHex   = isDraw ? "#e2e8f0" : p1Wins ? "#38bdf8" : "#f5a623";
        const winnerSprite = isDraw ? null : p1Wins ? this.player?.sprite : this.player2?.sprite;

        // ── Auto-report to tournament API ──
        if (this.adminKeyParam && this.tournamentKey && this.matchId) {
            const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
            const apiBase = isLocal
                ? `${window.location.protocol}//${window.location.hostname}:3001/api`
                : `${window.location.origin}/api`;
            fetch(`${apiBase}/tournaments/${this.tournamentKey}/match/${this.matchId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    adminKey: this.adminKeyParam,
                    player1Score: p1Score,
                    player2Score: p2Score
                })
            }).catch(() => {});
        }

        // ── PostMessage to parent frame ──
        try {
            window.parent.postMessage({
                type: 'match_complete',
                matchId: this.matchId,
                p1Score: p1Score,
                p2Score: p2Score,
                winner: winnerLabel
            }, '*');
        } catch (e) {}

        // ── 1. Black overlay fade-in ──
        const overlay = this.add.rectangle(cx, cy, W, H, 0x000000, 0).setDepth(50);
        this.tweens.add({ targets: overlay, fillAlpha: 0.75, duration: 600, ease: 'Sine.easeIn' });

        // ── 2. Freeze & zoom winner sprite to center ──
        if (winnerSprite && winnerSprite.active) {
            winnerSprite.setDepth(60);
            if (winnerSprite.anims) winnerSprite.anims.stop();
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

        // ── 3. Particle EXPLOSION burst ──
        this.time.delayedCall(200, () => {
            const emitter = this.add.particles(cx, cy - 40, "magicParticle", {
                speed: { min: 120, max: 520 },
                angle: { min: 0, max: 360 },
                scale: { start: 1.4, end: 0 },
                alpha: { start: 1, end: 0 },
                lifespan: 900,
                gravityY: 280,
                tint: [winnerColor, 0xffd700, 0xffffff],
                quantity: 5,
                frequency: 25,
                blendMode: 'ADD',
            }).setDepth(70);

            const emitter2 = this.add.particles(cx, cy - 40, "magicParticle", {
                speed: { min: 200, max: 700 },
                angle: { min: -110, max: -70 },
                scale: { start: 0.9, end: 0 },
                alpha: { start: 0.9, end: 0 },
                lifespan: 1200,
                gravityY: 380,
                tint: [winnerColor, 0xffffff],
                quantity: 3,
                frequency: 20,
                blendMode: 'ADD',
            }).setDepth(70);

            this.time.delayedCall(1400, () => { emitter.stop(); emitter2.stop(); });
        });

        // ── 4. Continuous ambient particles rising ──
        this.time.delayedCall(400, () => {
            this.add.particles(0, H, "magicParticle", {
                x: { min: 0, max: W },
                y: { min: H + 10, max: H + 10 },
                speed: { min: 40, max: 150 },
                angle: { min: -100, max: -80 },
                scale: { start: 0.7, end: 0 },
                alpha: { start: 0.6, end: 0 },
                lifespan: { min: 1200, max: 2400 },
                tint: [winnerColor, 0xffd700, 0xffeaa0],
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

        // ── 6. WINNER title ──
        this.time.delayedCall(550, () => {
            const glow = this.add.text(cx, cy - 140, isDraw ? "DRAW" : "WINNER", {
                fontFamily: "Cinzel", fontSize: "72px", color: winnerHex,
            }).setOrigin(0.5).setDepth(90).setAlpha(0).setScale(3);

            this.tweens.add({
                targets: glow, alpha: { from: 0.25, to: 0.08 },
                scaleX: 1, scaleY: 1, duration: 500, ease: 'Expo.easeOut'
            });

            const title = this.add.text(cx, cy - 140, isDraw ? "DRAW" : "WINNER", {
                fontFamily: "Cinzel", fontSize: "72px", color: winnerHex,
                stroke: "#000000", strokeThickness: 8,
                shadow: { offsetX: 0, offsetY: 0, color: winnerHex, blur: 30, fill: true }
            }).setOrigin(0.5).setDepth(91).setAlpha(0).setScale(0.1);

            this.tweens.add({
                targets: title, alpha: 1, scaleX: 1, scaleY: 1,
                duration: 500, ease: 'Back.easeOut',
                onComplete: () => {
                    this.tweens.add({
                        targets: title, scaleX: 1.06, scaleY: 1.06,
                        duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
                    });
                }
            });

            if (!isDraw) {
                const nameText = this.add.text(cx, cy - 60, winnerLabel + "  WINS!", {
                    fontFamily: "Cinzel", fontSize: "36px", color: winnerHex,
                    stroke: "#000000", strokeThickness: 5,
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
                `${this.p1Name}: ${p1Score}  ─  ${this.p2Name}: ${p2Score}`, {
                fontFamily: "Cinzel", fontSize: "28px", color: "#c8a060",
                stroke: "#000", strokeThickness: 4,
            }).setOrigin(0.5).setDepth(91).setAlpha(0).setY(cy + 100);

            this.tweens.add({ targets: score, alpha: 0.85, y: cy + 80, duration: 400, ease: 'Back.easeOut' });
        });

        // ── 8. "Returning to bracket..." ──
        this.time.delayedCall(1800, () => {
            const hint = this.add.text(cx, cy + 150, "↩  Returning to bracket...", {
                fontFamily: "Cinzel", fontSize: "14px", color: "#6b5a30",
            }).setOrigin(0.5).setDepth(91).setAlpha(0);

            this.tweens.add({ targets: hint, alpha: 0.6, duration: 600, ease: 'Sine.easeOut' });
            this.tweens.add({
                targets: hint, alpha: { from: 0.3, to: 0.7 },
                duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 700
            });
        });

        // ── 9. PostMessage close after 5s ──
        this.time.delayedCall(5000, () => {
            try {
                window.parent.postMessage({ type: 'match_close' }, '*');
            } catch (e) {}
        });
    }
}

import Player from "../entities/Player.js";
import Spawner from "../systems/Spawner.js";
import DifficultyManager from "../systems/DifficultyManager.js";
import Enemy from "../entities/Enemy.js";
import Bitcoin from "../entities/Bitcoin.js";
import Dollar from "../entities/Dollar.js";
import OrangePill from "../entities/OrangePill.js";
import { loadPlayerAssets, createPlayerAnimations } from "../animations/playerAnimations.js";
import { GAME_WIDTH, GAME_HEIGHT } from "../utils/constants.js";

const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || ('ontouchstart' in window);

const PILL_VISIBLE_DURATION  = 5000;
const PILL_RESPAWN_DELAY     = 50000;

export default class SoloScene extends Phaser.Scene {
    constructor() {
        super("SoloScene");
    }

    preload() {
        loadPlayerAssets(this);
        this.load.image("eth_enemy",    "../assets/enemy/eth_enemy.png");
        this.load.image("bg_dark",      "assets/backgrounds/bg4.png");
        this.load.image("magicParticle","assets/effects/particle.png");
        this.load.image("cloud",        "assets/backgrounds/fog_bg.png");
        this.load.image("bitcoin",      "assets/items/bitcoin.png");
        this.load.image("dollar",       "assets/items/dollar.png");
        this.load.image("orangepill",   "assets/items/dollar.png");
    }

    create() {
        // ── Estado ───────────────────────────────────────────────
        this.lives          = 3;
        this.bitcoinCount   = 0;
        this.elapsedTime    = 0;
        this.gameOver       = false;
        this.gameStarted    = true;

        // ── Grupos ───────────────────────────────────────────────
        this.dollars       = this.physics.add.group();
        this.thrownDollars = this.physics.add.group();
        this.orangePills   = this.physics.add.group();

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

        // ── Input ────────────────────────────────────────────────
        this.cursors  = this.input.keyboard.createCursorKeys();
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // ── Jugador ──────────────────────────────────────────────
        createPlayerAnimations(this);
        this.player = new Player(this);
        this.player.sprite.setPosition(this.scale.width / 2, this.scale.height / 2);
        this.player.canMove = true;

        // Slightly slower speed for mobile
        if (isMobile) {
            this.player.speed = 400;
        }

        // ── Gamepad ──────────────────────────────────────────────
        this.input.gamepad.once('connected', (pad) => {
            this.player.controller = true;
        });

        // ── Spawner y dificultad ─────────────────────────────────
        this.spawner    = new Spawner(this);
        this.difficulty = new DifficultyManager(this.spawner);

        this.time.addEvent({ delay: 500,  loop: true, callback: () => { if (!this.gameOver) this.spawner.spawnEnemy(); } });
        this.time.addEvent({ delay: 5000, loop: true, callback: () => { if (!this.gameOver) this.difficulty.increaseDifficulty(); } });

        // Dólar: cada 8s si no hay uno activo
        this.time.addEvent({ delay: 8000, loop: true, callback: () => this._spawnDollarIfNone() });
        this.time.delayedCall(5000, () => this._spawnDollarIfNone());

        // Orange Pill: primer spawn a los 15s
        this.time.delayedCall(15000, () => this._spawnOrangePill());

        // Primer bitcoin
        this.spawnNextBitcoin();

        // ── Colisiones ───────────────────────────────────────────
        // Jugador vs enemigos
        this.physics.add.overlap(
            this.player.sprite,
            this.spawner.enemies,
            (playerSprite, enemySprite) => this._hitEnemy(enemySprite),
            null,
            this
        );

        // Jugador vs bitcoins
        this.physics.add.overlap(
            this.player.sprite,
            this.spawner.bitcoins,
            (playerSprite, coinSprite) => this._collectBitcoin(coinSprite),
            null,
            this
        );

        // Dólares del mapa
        this.physics.add.overlap(this.player.sprite, this.dollars, this._onCollectDollar, null, this);

        // Orange pills
        this.physics.add.overlap(this.player.sprite, this.orangePills, this._onCollectPill, null, this);

        // Proyectiles dólar vs enemigos
        this.physics.add.overlap(
            this.thrownDollars,
            this.spawner.enemies,
            (projSprite, enemySprite) => this._dollarHitEnemy(projSprite, enemySprite),
            null,
            this
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

        // ── Touch controls (mobile only) ─────────────────────────
        this.joystickActive = false;
        this.joystickVector = { x: 0, y: 0 };
        this.joystickOrigin = { x: 0, y: 0 };

        if (isMobile) {
            this.joystickBase = this.add.circle(120, this.scale.height - 120, 60, 0xffffff, 0.15)
                .setDepth(100).setScrollFactor(0);
            this.joystickThumb = this.add.circle(120, this.scale.height - 120, 30, 0xffffff, 0.3)
                .setDepth(101).setScrollFactor(0);

            this.input.on('pointerdown', (pointer) => {
                if (pointer.x < this.scale.width / 2) {
                    this.joystickActive = true;
                    this.joystickOrigin = { x: pointer.x, y: pointer.y };
                    this.joystickBase.setPosition(pointer.x, pointer.y);
                    this.joystickThumb.setPosition(pointer.x, pointer.y);
                }
            });
            this.input.on('pointermove', (pointer) => {
                if (this.joystickActive && pointer.x < this.scale.width * 0.6) {
                    const dx = pointer.x - this.joystickOrigin.x;
                    const dy = pointer.y - this.joystickOrigin.y;
                    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), 60);
                    const angle = Math.atan2(dy, dx);
                    this.joystickThumb.setPosition(
                        this.joystickOrigin.x + Math.cos(angle) * dist,
                        this.joystickOrigin.y + Math.sin(angle) * dist
                    );
                    this.joystickVector = {
                        x: Math.cos(angle) * (dist / 60),
                        y: Math.sin(angle) * (dist / 60)
                    };
                }
            });
            this.input.on('pointerup', (pointer) => {
                if (this.joystickActive) {
                    this.joystickActive = false;
                    this.joystickThumb.setPosition(this.joystickBase.x, this.joystickBase.y);
                    this.joystickVector = { x: 0, y: 0 };
                }
            });

            // Throw button (bottom-right)
            this.throwBtn = this.add.circle(this.scale.width - 80, this.scale.height - 120, 40, 0x00ff00, 0.25)
                .setDepth(100).setScrollFactor(0).setInteractive();
            this.throwBtnText = this.add.text(this.scale.width - 80, this.scale.height - 120, '💵', { fontSize: '28px' })
                .setOrigin(0.5).setDepth(101).setScrollFactor(0);
            this.throwBtn.on('pointerdown', () => {
                if (!this.gameOver) this.player.throwDollar();
            });
        }

        // ── DOM HUD refs ─────────────────────────────────────────
        this.domLives = document.getElementById('solo-lives');
        this.domTimer = document.getElementById('solo-timer');
        this.domBtc   = document.getElementById('solo-btc');
        this._updateLivesHUD();
    }

    update(time, delta) {
        if (this.gameOver) return;

        // Timer
        this.elapsedTime += delta;
        this._updateTimerHUD();

        const pad = this.input.gamepad.getPad(0);

        // ── Mobile joystick movement ─────────────────────────────
        if (isMobile && this.joystickActive) {
            const speed = this.player.speed;
            this.player.sprite.setVelocity(
                this.joystickVector.x * speed,
                this.joystickVector.y * speed
            );
            if (this.joystickVector.x !== 0 || this.joystickVector.y !== 0) {
                this.player.lastDirectionX = Math.sign(this.joystickVector.x);
                this.player.lastDirectionY = Math.sign(this.joystickVector.y);
                if (this.player.currentAnim !== 'player_move') {
                    this.player.sprite.play('player_move', true);
                    this.player.currentAnim = 'player_move';
                }
                if (this.joystickVector.x < 0) this.player.sprite.setFlipX(true);
                else if (this.joystickVector.x > 0) this.player.sprite.setFlipX(false);
            }
        } else if (isMobile && !this.joystickActive) {
            // Joystick released — stop
            this.player.sprite.setVelocity(0, 0);
            if (this.player.currentAnim !== 'player_idle') {
                this.player.sprite.play('player_idle', true);
                this.player.currentAnim = 'player_idle';
            }
        } else {
            // Desktop: keyboard + gamepad
            this.player.update(this.cursors, pad);
        }

        // Lanzar dólar (desktop)
        if (!isMobile && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this.player.throwDollar();
        }

        // Nubes
        this.cloud1.x += 0.02; this.cloud1.y += 0.01;
        this.cloud2.x -= 0.015; this.cloud2.y += 0.02;
        if (this.cloud1.x > this.scale.width)  this.cloud1.x = -200;
        if (this.cloud2.x < -200)              this.cloud2.x = this.scale.width + 200;

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

    // ── Spawn dólar (max 1 en pantalla) ─────────────────────────
    _spawnDollarIfNone() {
        if (this.gameOver) return;
        if (this.dollars.countActive(true) > 0) return;
        const x = Phaser.Math.Between(80, this.scale.width - 80);
        const y = Phaser.Math.Between(80, this.scale.height - 80);
        const dollar = new Dollar(this, x, y);
        this.dollars.add(dollar);
    }

    // ── Spawn Orange Pill ────────────────────────────────────────
    _spawnOrangePill() {
        if (this.gameOver) return;

        const x = Phaser.Math.Between(80, this.scale.width - 80);
        const y = Phaser.Math.Between(80, this.scale.height - 80);
        const pill = new OrangePill(this, x, y);
        this.orangePills.add(pill);

        this.time.delayedCall(PILL_VISIBLE_DURATION, () => {
            if (pill && pill.active) {
                pill.destroy();
            }
            this.time.delayedCall(PILL_RESPAWN_DELAY, () => this._spawnOrangePill());
        });
    }

    // ── Recoger dólar ────────────────────────────────────────────
    _onCollectDollar(playerSprite, dollar) {
        if (!dollar || !dollar.active) return;
        dollar.destroy();
        this.player.dollarCount++;
        this.player.applyDollarSlow();
    }

    // ── Recoger Orange Pill ──────────────────────────────────────
    _onCollectPill(playerSprite, pill) {
        if (!pill || !pill.active) return;
        pill.destroy();
        this.player.applyOrangePill();
        this.cameras.main.flash(200, 255, 140, 0);
        this.time.delayedCall(PILL_RESPAWN_DELAY, () => this._spawnOrangePill());
    }

    // ── Enemy hit player ─────────────────────────────────────────
    _hitEnemy(enemySprite) {
        if (this.gameOver || this.lives <= 0) return;
        const enemyObj = enemySprite._enemyRef;
        if (!enemyObj) return;

        // Invencible: destroy enemy, no damage
        if (this.player.isInvincible) {
            enemyObj.kill();
            this.spawner.enemyObjects = this.spawner.enemyObjects.filter(e => e !== enemyObj);
            return;
        }

        const ex = enemySprite.x;
        const ey = enemySprite.y;
        const hitForce     = enemyObj.getHitForce();
        const stunDuration = enemyObj.getStunDuration();
        const canSplit     = enemyObj.canSplit();

        if (canSplit) {
            const children = enemyObj.split();
            this.spawner.enemyObjects = this.spawner.enemyObjects.filter(e => e !== enemyObj);
            children.forEach(child => {
                this.spawner.enemies.add(child.sprite);
                this.spawner.enemyObjects.push(child);
            });
        } else {
            enemyObj.kill();
            this.spawner.enemyObjects = this.spawner.enemyObjects.filter(e => e !== enemyObj);
        }

        // Knockback
        const pushDirX = (this.player.sprite.x < ex) ? -1 : 1;
        const pushDirY = (this.player.sprite.y < ey) ? -1 : 1;
        this.player.sprite.x += pushDirX * hitForce;
        this.player.sprite.y += pushDirY * hitForce;

        const shakeIntensity = Phaser.Math.Clamp(hitForce / 7000, 0.005, 0.02);
        this.cameras.main.flash(100, 255, 255, 255);
        this.cameras.main.shake(stunDuration * 0.15, shakeIntensity);

        this.player.canMove = false;
        this.time.delayedCall(stunDuration, () => {
            if (this.player && this.player.sprite && this.player.sprite.body) {
                this.player.canMove = true;
            }
        });

        // Lose a life
        this.lives--;
        if (this.lives < 0) this.lives = 0;
        this._updateLivesHUD();

        if (this.lives <= 0) {
            this._endGame();
        } else {
            // Reset position to center after stun
            this.time.delayedCall(stunDuration + 100, () => {
                if (this.player && this.player.sprite && this.player.sprite.body) {
                    this.player.sprite.setPosition(this.scale.width / 2, this.scale.height / 2);
                }
            });
        }
    }

    // ── Dollar projectile hits enemy ─────────────────────────────
    _dollarHitEnemy(projSprite, enemySprite) {
        if (!projSprite || !projSprite.active) return;
        const enemyObj = enemySprite._enemyRef;
        if (!enemyObj) return;

        projSprite.destroy();
        enemyObj.kill();
        this.spawner.enemyObjects = this.spawner.enemyObjects.filter(e => e !== enemyObj);
    }

    // ── Collect bitcoin ──────────────────────────────────────────
    _collectBitcoin(coinSprite) {
        if (!coinSprite || !coinSprite.active) return;
        coinSprite.destroy();
        this.bitcoinCount++;
        this._updateBtcHUD();
        this.spawnNextBitcoin();
    }

    spawnNextBitcoin() {
        const x = Phaser.Math.Between(50, this.scale.width - 100);
        const y = Phaser.Math.Between(50, this.scale.height - 100);
        const btc = new Bitcoin(this, x, y);
        this.spawner.bitcoins.add(btc.sprite);
    }

    // ── HUD updates ──────────────────────────────────────────────
    _updateLivesHUD() {
        if (this.domLives) {
            this.domLives.textContent = '❤️'.repeat(this.lives);
        }
    }

    _updateTimerHUD() {
        if (!this.domTimer) return;
        const totalSec = Math.floor(this.elapsedTime / 1000);
        const hrs  = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const secs = totalSec % 60;
        if (hrs > 0) {
            this.domTimer.textContent =
                String(hrs).padStart(2, '0') + ':' +
                String(mins).padStart(2, '0') + ':' +
                String(secs).padStart(2, '0');
        } else {
            this.domTimer.textContent =
                String(mins).padStart(2, '0') + ':' +
                String(secs).padStart(2, '0');
        }
    }

    _updateBtcHUD() {
        if (this.domBtc) {
            this.domBtc.textContent = `₿ ${this.bitcoinCount}`;
        }
    }

    // ── Game over ────────────────────────────────────────────────
    _endGame() {
        this.gameOver = true;
        this.player.canMove = false;
        this.player.sprite.setVelocity(0, 0);

        // Format time
        const totalSec = Math.floor(this.elapsedTime / 1000);
        const hrs  = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const secs = totalSec % 60;
        let timeStr;
        if (hrs > 0) {
            timeStr = String(hrs).padStart(2, '0') + ':' +
                      String(mins).padStart(2, '0') + ':' +
                      String(secs).padStart(2, '0');
        } else {
            timeStr = String(mins).padStart(2, '0') + ':' +
                      String(secs).padStart(2, '0');
        }

        // Dark overlay
        const overlay = this.add.rectangle(
            0, 0, this.scale.width, this.scale.height, 0x000000, 0.75
        ).setOrigin(0, 0).setDepth(200);

        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;

        this.add.text(cx, cy - 100, "GAME OVER", {
            fontFamily: "CinzelBold",
            fontSize: "42px",
            color: "#ff4444",
            stroke: "#000",
            strokeThickness: 6
        }).setOrigin(0.5).setDepth(201);

        this.add.text(cx, cy - 30, `⏱ ${timeStr}`, {
            fontFamily: "CinzelBold",
            fontSize: "28px",
            color: "#38bdf8",
            stroke: "#000",
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(201);

        this.add.text(cx, cy + 20, `₿ ${this.bitcoinCount} collected`, {
            fontFamily: "CinzelBold",
            fontSize: "24px",
            color: "#f5a623",
            stroke: "#000",
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(201);

        const playAgain = this.add.text(cx, cy + 90, "PLAY AGAIN", {
            fontFamily: "CinzelBold",
            fontSize: "28px",
            color: "#4ade80",
            stroke: "#000",
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(201).setInteractive();

        playAgain.on("pointerover", () => playAgain.setColor("#86efac"));
        playAgain.on("pointerout",  () => playAgain.setColor("#4ade80"));
        playAgain.on("pointerdown", () => {
            window.location.reload();
        });
    }
}

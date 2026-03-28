import Player from "../entities/Player.js";
import Player2 from "../entities/Player2.js";
import Spawner from "../systems/Spawner.js";
import CollisionManager from "../systems/CollisionManager.js";
import { GAME_WIDTH, GAME_HEIGHT, BASE_ENEMY_SPEED, PLAYER_SPEED } from "../utils/constants.js";
import Bitcoin from "../entities/Bitcoin.js";
import { loadPlayerAssets, createPlayerAnimations } from "../animations/playerAnimations.js";
import Dollar from "../entities/Dollar.js";
import OrangePill from "../entities/OrangePill.js";

const PILL_VISIBLE_DURATION = 5000;
const PILL_RESPAWN_DELAY = 50000;
const STATE_SEND_INTERVAL = 50; // 20 ticks/sec

export default class OnlineScene extends Phaser.Scene {
    constructor() {
        super("OnlineScene");
    }

    init(data) {
        this.isHost = data.isHost;
        this.roomId = data.roomId;
        this.ws = data.ws;
        this.username = data.username;
        this.opponentName = data.opponentName || 'Opponent';
    }

    preload() {
        loadPlayerAssets(this);
        this.load.image("eth_enemy", "../assets/enemy/eth_enemy.png");
        this.load.image("bg_dark", "assets/backgrounds/bg4.png");
        this.load.image("magicParticle", "assets/effects/particle.png");
        this.load.image("cloud", "assets/backgrounds/fog_bg.png");
        this.load.image("bitcoin", "assets/items/bitcoin.png");
        this.load.image("dollar", "assets/items/dollar.png");
        this.load.image("orangepill", "assets/items/dollar.png");
    }

    create() {
        // DOM refs
        this.domP1Score = document.getElementById("player1-score");
        this.domP2Score = document.getElementById("player2-score");
        this.domTimer = document.getElementById("game-timer");
        const header = document.querySelector("header");
        if (header) header.style.display = "flex";

        // Update labels
        const p1Label = document.querySelector('.score-block.p1 .score-label');
        const p2Label = document.querySelector('.score-block.p2 .score-label');
        if (this.isHost) {
            if (p1Label) p1Label.textContent = this.username;
            if (p2Label) p2Label.textContent = this.opponentName;
        } else {
            if (p1Label) p1Label.textContent = this.opponentName;
            if (p2Label) p2Label.textContent = this.username;
        }

        // Reset scores
        if (this.domP1Score) this.domP1Score.textContent = '0';
        if (this.domP2Score) this.domP2Score.textContent = '0';
        if (this.domTimer) {
            this.domTimer.textContent = '1:30';
            this.domTimer.classList.remove('urgent');
        }

        // ── Background ──
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
        const scaleX = this.scale.width / this.bg.width;
        const scaleY = this.scale.height / this.bg.height;
        this.bg.setScale(Math.max(scaleX, scaleY));

        // ── Clouds ──
        this.cloud1 = this.add.image(this.scale.width / 2, this.scale.height / 2, "cloud")
            .setOrigin(0.5).setScale(2).setAlpha(0.13).setBlendMode(Phaser.BlendModes.SCREEN);
        this.cloud2 = this.add.image(this.scale.width / 2, this.scale.height / 2, "cloud")
            .setOrigin(0.5).setScale(2).setAlpha(0.18).setBlendMode(Phaser.BlendModes.ADD);

        // ── Particles ──
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

        // ── Animations ──
        createPlayerAnimations(this);

        if (this.isHost) {
            this._createHostGame();
        } else {
            this._createClientGame();
        }
    }

    // ═══════════════════════════════════════════════════════════
    // HOST MODE — Full game logic
    // ═══════════════════════════════════════════════════════════
    _createHostGame() {
        // Groups
        this.dollars = this.physics.add.group();
        this.thrownDollars = this.physics.add.group();
        this.orangePills = this.physics.add.group();

        // State
        this.bitcoinsCollected = { player1: 0, player2: 0 };
        this.collectedCount = 0;
        this.gameStarted = true;
        this.matchDuration = 90000;
        this.matchTimer = 0;
        this.recentCollections = [];
        this.greedLevel = 0;
        this._baseDifficultySpeed = BASE_ENEMY_SPEED;

        // Greed overlay
        this.greedOverlay = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0xff0000, 0)
            .setOrigin(0, 0).setDepth(50).setScrollFactor(0);

        // Input
        this.cursors = this.input.keyboard.createCursorKeys();
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // Players — host is player1 (arrows), remote is player2
        this.player = new Player(this);
        this.player2 = new Player2(this);
        this.player.canMove = true;

        // Gamepad
        this.input.gamepad.once('connected', (pad) => {
            this.player.controller = true;
        });

        // Spawner
        this.spawner = new Spawner(this);
        this.spawner.currentEnemySpeed = BASE_ENEMY_SPEED;

        // Progressive difficulty
        this.enemySpawnDelay = 800;
        this.enemySpawnEvent = this.time.addEvent({
            delay: this.enemySpawnDelay,
            loop: true,
            callback: () => this.spawner.spawnEnemy()
        });
        this.time.addEvent({
            delay: 5000, loop: true,
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

        // Dollar spawn
        this.time.addEvent({ delay: 8000, loop: true, callback: () => this._spawnDollarIfNone() });
        this.time.delayedCall(5000, () => this._spawnDollarIfNone());

        // Orange pill
        this.time.delayedCall(15000, () => this._spawnOrangePill());

        // First bitcoin
        this.spawnNextBitcoin();

        // Collisions
        new CollisionManager(this, this.player, this.spawner, this, "player1");
        new CollisionManager(this, this.player2, this.spawner, this, "player2");
        new CollisionManager(this, this.player, this.spawner, this, "player1", this.player2);
        new CollisionManager(this, this.player2, this.spawner, this, "player2", this.player);

        // Dollars from map
        this.physics.add.overlap(this.player.sprite, this.dollars, this._onCollectDollar, null, this);
        this.physics.add.overlap(this.player2.sprite, this.dollars, this._onCollectDollar, null, this);

        // Orange pills
        this.physics.add.overlap(this.player.sprite, this.orangePills, this._onCollectPill, null, this);
        this.physics.add.overlap(this.player2.sprite, this.orangePills, this._onCollectPill, null, this);

        // Thrown dollars vs players
        this.physics.add.overlap(this.thrownDollars, this.player.sprite,
            (a, b) => {
                const proj = this.thrownDollars.contains(a) ? a : b;
                this._dollarHitPlayer(proj, this.player);
            }, null, this);
        this.physics.add.overlap(this.thrownDollars, this.player2.sprite,
            (a, b) => {
                const proj = this.thrownDollars.contains(a) ? a : b;
                this._dollarHitPlayer(proj, this.player2);
            }, null, this);

        // Remote input from client
        this._remoteInput = null;

        // WS message handler
        this.ws.onmessage = (e) => {
            let msg;
            try { msg = JSON.parse(e.data); } catch (err) { return; }

            if (msg.type === 'player_input') {
                this._remoteInput = msg.input;
            } else if (msg.type === 'opponent_disconnected') {
                this._onOpponentDisconnected();
            }
        };

        // Send state every 50ms
        this._stateInterval = setInterval(() => this._sendState(), STATE_SEND_INTERVAL);
    }

    // ═══════════════════════════════════════════════════════════
    // CLIENT MODE — Visual only, receives state from host
    // ═══════════════════════════════════════════════════════════
    _createClientGame() {
        this.gameStarted = true;
        this._gameEnded = false;

        // Input for local responsiveness
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasdKeys = this.input.keyboard.addKeys({
            W: Phaser.Input.Keyboard.KeyCodes.W,
            A: Phaser.Input.Keyboard.KeyCodes.A,
            S: Phaser.Input.Keyboard.KeyCodes.S,
            D: Phaser.Input.Keyboard.KeyCodes.D
        });
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // Gamepad
        this.input.gamepad.once('connected', (pad) => {
            this._clientGamepad = true;
        });

        // Self player (player2 position in host state) — uses physics for responsive feel
        this.selfSprite = this.physics.add.sprite(200, GAME_HEIGHT / 2, 'idle_1')
            .setScale(0.1).setTint(0xe4b320).setCollideWorldBounds(true);
        this.selfSprite.body.setSize(700, 1000);
        this.selfSprite.body.setOffset(900, 300);
        this.selfSprite.play('player_idle');

        // Opponent sprite (player1 in host state) — no physics, just visual
        this.opponentSprite = this.add.sprite(GAME_WIDTH - 300, GAME_HEIGHT / 2, 'idle_1')
            .setScale(0.1).setTint(0xaaaaaa);
        this.opponentSprite.play('player_idle');

        // Sprite pools for enemies, bitcoins, dollars, etc.
        this._enemySprites = [];
        this._bitcoinSprites = [];
        this._dollarSprites = [];
        this._orangePillSprites = [];
        this._thrownDollarSprites = [];

        // Self movement state
        this._selfSpeed = PLAYER_SPEED;
        this._selfLastDirX = -1;
        this._selfLastDirY = 0;
        this._wantsThrow = false;

        // Last state for interpolation
        this._lastState = null;
        this._stateTimestamp = 0;

        // WS message handler
        this.ws.onmessage = (e) => {
            let msg;
            try { msg = JSON.parse(e.data); } catch (err) { return; }

            if (msg.type === 'game_state') {
                this._applyState(msg.state);
            } else if (msg.type === 'game_over') {
                this._showGameOver(msg);
            } else if (msg.type === 'opponent_disconnected') {
                this._onOpponentDisconnected();
            }
        };
    }

    // ═══════════════════════════════════════════════════════════
    // UPDATE
    // ═══════════════════════════════════════════════════════════
    update(time, delta) {
        if (!this.gameStarted) return;

        // Clouds
        this.cloud1.x += 0.02; this.cloud1.y += 0.01;
        this.cloud2.x -= 0.015; this.cloud2.y += 0.02;
        if (this.cloud1.x > this.scale.width) this.cloud1.x = -200;
        if (this.cloud2.x < -200) this.cloud2.x = this.scale.width + 200;

        if (this.isHost) {
            this._updateHost(time, delta);
        } else {
            this._updateClient(time, delta);
        }
    }

    _updateHost(time, delta) {
        // Match timer
        this.matchTimer += this.game.loop.delta;
        const remaining = Math.max(0, this.matchDuration - this.matchTimer);
        const sec = Math.ceil(remaining / 1000);
        if (this.domTimer) {
            this.domTimer.textContent = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
            if (remaining <= 30000) this.domTimer.classList.add('urgent');
        }
        if (remaining <= 0) {
            this._endGame();
            return;
        }

        // Greed
        this._updateGreed();
        this.spawner.currentEnemySpeed = this._baseDifficultySpeed + (this.greedLevel * 80);

        // Update local player (host = player1, arrows)
        const pad = this.input.gamepad.getPad(0);
        this.player.update(this.cursors, pad);

        // Throw dollar (host)
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.player.throwDollar();

        // Apply remote input to player2
        if (this._remoteInput) {
            const inp = this._remoteInput;
            if (this.player2.sprite && this.player2.sprite.body) {
                this.player2.sprite.setVelocity(inp.vx || 0, inp.vy || 0);

                if (inp.vx !== 0 || inp.vy !== 0) {
                    this.player2.lastDirectionX = Math.sign(inp.vx || inp.lastDirX || -1);
                    this.player2.lastDirectionY = Math.sign(inp.vy || inp.lastDirY || 0);
                    if (this.player2.currentAnim !== 'player_move') {
                        this.player2.sprite.play('player_move', true);
                        this.player2.currentAnim = 'player_move';
                    }
                    if (inp.vx < 0) this.player2.sprite.setFlipX(true);
                    else if (inp.vx > 0) this.player2.sprite.setFlipX(false);
                } else {
                    if (this.player2.currentAnim !== 'player_idle') {
                        this.player2.sprite.play('player_idle', true);
                        this.player2.currentAnim = 'player_idle';
                    }
                }

                if (inp.throwDollar) {
                    this.player2.throwDollar();
                }
            }
        }

        // Update enemies
        this.spawner.enemyObjects.forEach(enemy => enemy.update());

        // Clean projectiles
        this.thrownDollars.getChildren().forEach(proj => {
            if (proj.active && (
                proj.x < -60 || proj.x > this.scale.width + 60 ||
                proj.y < -60 || proj.y > this.scale.height + 60
            )) proj.destroy();
        });

        // Update DOM scores
        if (this.domP1Score) this.domP1Score.textContent = this.bitcoinsCollected.player1;
        if (this.domP2Score) this.domP2Score.textContent = this.bitcoinsCollected.player2;
    }

    _updateClient(time, delta) {
        if (this._gameEnded) return;

        // Local movement for self (responsive feel)
        const pad = this.input.gamepad.getPad(0);
        let vx = 0, vy = 0;

        if (this._clientGamepad && pad && pad.axes && pad.axes.length >= 2) {
            const axisX = pad.axes[0].value;
            const axisY = pad.axes[1].value;
            if (Math.abs(axisX) > 0.1) vx = axisX * this._selfSpeed;
            if (Math.abs(axisY) > 0.1) vy = axisY * this._selfSpeed;
        } else {
            // Accept both arrow keys and WASD
            const left = this.cursors.left.isDown || this.wasdKeys.A.isDown;
            const right = this.cursors.right.isDown || this.wasdKeys.D.isDown;
            const up = this.cursors.up.isDown || this.wasdKeys.W.isDown;
            const down = this.cursors.down.isDown || this.wasdKeys.S.isDown;

            vx = left ? -this._selfSpeed : right ? this._selfSpeed : 0;
            vy = up ? -this._selfSpeed : down ? this._selfSpeed : 0;
        }

        if (this.selfSprite && this.selfSprite.body) {
            this.selfSprite.setVelocity(vx, vy);

            if (vx !== 0 || vy !== 0) {
                this._selfLastDirX = Math.sign(vx);
                this._selfLastDirY = Math.sign(vy);
                if (this.selfSprite.anims.currentAnim?.key !== 'player_move') {
                    this.selfSprite.play('player_move', true);
                }
                if (vx < 0) this.selfSprite.setFlipX(true);
                else if (vx > 0) this.selfSprite.setFlipX(false);
            } else {
                if (this.selfSprite.anims.currentAnim?.key !== 'player_idle') {
                    this.selfSprite.play('player_idle', true);
                }
            }
        }

        // Throw dollar
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this._wantsThrow = true;
        }

        // Send input to host
        this._sendInput();
    }

    // ═══════════════════════════════════════════════════════════
    // HOST: State serialization & sending
    // ═══════════════════════════════════════════════════════════
    _serializePlayer(playerObj) {
        if (!playerObj || !playerObj.sprite) {
            return { x: 0, y: 0, flipX: false, anim: 'player_idle', tint: 0xaaaaaa, isInvincible: false };
        }
        return {
            x: playerObj.sprite.x,
            y: playerObj.sprite.y,
            flipX: playerObj.sprite.flipX,
            anim: playerObj.currentAnim || 'player_idle',
            tint: playerObj.sprite.tintTopLeft || 0xaaaaaa,
            isInvincible: playerObj.isInvincible || false
        };
    }

    _sendState() {
        if (!this.gameStarted || !this.ws || this.ws.readyState !== 1) return;

        const state = {
            player1: this._serializePlayer(this.player),
            player2: this._serializePlayer(this.player2),
            enemies: this.spawner.enemyObjects.filter(e => e.sprite).map(e => ({
                x: e.sprite.x,
                y: e.sprite.y,
                rotation: e.sprite.rotation,
                scale: e.enemyScale,
                vx: e.sprite.vx || 0,
                vy: e.sprite.vy || 0
            })),
            bitcoins: this.spawner.bitcoins.getChildren().filter(b => b.active).map(b => ({
                x: b.x, y: b.y
            })),
            dollars: this.dollars.getChildren().filter(d => d.active).map(d => ({
                x: d.x, y: d.y
            })),
            orangePills: this.orangePills.getChildren().filter(p => p.active).map(p => ({
                x: p.x, y: p.y
            })),
            thrownDollars: this.thrownDollars.getChildren().filter(t => t.active).map(t => ({
                x: t.x, y: t.y,
                vx: t.body ? t.body.velocity.x : 0,
                vy: t.body ? t.body.velocity.y : 0,
                rotation: t.rotation || 0
            })),
            scores: { player1: this.bitcoinsCollected.player1, player2: this.bitcoinsCollected.player2 },
            timer: Math.max(0, this.matchDuration - this.matchTimer),
            greedLevel: this.greedLevel
        };

        this.ws.send(JSON.stringify({ type: 'game_state', roomId: this.roomId, state }));
    }

    // ═══════════════════════════════════════════════════════════
    // CLIENT: Apply state from host
    // ═══════════════════════════════════════════════════════════
    _applyState(state) {
        if (!state) return;

        // Update opponent (player1 in host = opponent for client)
        if (state.player1 && this.opponentSprite) {
            // Smooth interpolation
            const lerp = 0.3;
            this.opponentSprite.x += (state.player1.x - this.opponentSprite.x) * lerp;
            this.opponentSprite.y += (state.player1.y - this.opponentSprite.y) * lerp;
            this.opponentSprite.setFlipX(state.player1.flipX);

            if (state.player1.anim && this.opponentSprite.anims.currentAnim?.key !== state.player1.anim) {
                this.opponentSprite.play(state.player1.anim, true);
            }
            if (state.player1.isInvincible) {
                this.opponentSprite.setTint(0xff8c00);
            } else {
                this.opponentSprite.setTint(0xaaaaaa);
            }
        }

        // Correct self position (player2 in host) — gentle correction
        if (state.player2 && this.selfSprite) {
            const dx = state.player2.x - this.selfSprite.x;
            const dy = state.player2.y - this.selfSprite.y;
            // Only correct if deviation is significant
            if (Math.abs(dx) > 50 || Math.abs(dy) > 50) {
                this.selfSprite.x += dx * 0.2;
                this.selfSprite.y += dy * 0.2;
            }
            if (state.player2.isInvincible) {
                this.selfSprite.setTint(0xff8c00);
            } else {
                this.selfSprite.setTint(0xe4b320);
            }
        }

        // Enemies — sync sprite pool
        this._syncSpritePool(this._enemySprites, state.enemies || [], (data) => {
            const sprite = this.add.sprite(data.x, data.y, 'eth_enemy')
                .setScale(data.scale || 0.08).setDepth(5);
            return sprite;
        }, (sprite, data) => {
            sprite.x += (data.x - sprite.x) * 0.4;
            sprite.y += (data.y - sprite.y) * 0.4;
            sprite.rotation = data.rotation || 0;
            sprite.setScale(data.scale || 0.08);
        });

        // Bitcoins
        this._syncSpritePool(this._bitcoinSprites, state.bitcoins || [], (data) => {
            return this.add.sprite(data.x, data.y, 'bitcoin').setScale(0.03).setDepth(10);
        }, (sprite, data) => {
            sprite.x = data.x;
            sprite.y = data.y;
        });

        // Dollars (map items)
        this._syncSpritePool(this._dollarSprites, state.dollars || [], (data) => {
            return this.add.sprite(data.x, data.y, 'dollar').setScale(0.03).setTint(0x00ff00).setDepth(10);
        }, (sprite, data) => {
            sprite.x = data.x;
            sprite.y = data.y;
        });

        // Orange pills
        this._syncSpritePool(this._orangePillSprites, state.orangePills || [], (data) => {
            return this.add.sprite(data.x, data.y, 'orangepill').setScale(0.03).setTint(0xff8c00).setDepth(10);
        }, (sprite, data) => {
            sprite.x = data.x;
            sprite.y = data.y;
        });

        // Thrown dollars
        this._syncSpritePool(this._thrownDollarSprites, state.thrownDollars || [], (data) => {
            return this.add.sprite(data.x, data.y, 'dollar').setScale(0.04).setTint(0x00ff00).setDepth(15);
        }, (sprite, data) => {
            sprite.x += (data.x - sprite.x) * 0.5;
            sprite.y += (data.y - sprite.y) * 0.5;
            sprite.rotation = data.rotation || 0;
        });

        // Scores
        if (state.scores) {
            if (this.domP1Score) this.domP1Score.textContent = state.scores.player1;
            if (this.domP2Score) this.domP2Score.textContent = state.scores.player2;
        }

        // Timer
        if (state.timer !== undefined && this.domTimer) {
            const sec = Math.ceil(state.timer / 1000);
            this.domTimer.textContent = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
            if (state.timer <= 30000) {
                this.domTimer.classList.add('urgent');
            }
        }
    }

    _syncSpritePool(pool, dataArray, createFn, updateFn) {
        // Remove excess sprites
        while (pool.length > dataArray.length) {
            const sprite = pool.pop();
            sprite.destroy();
        }
        // Update existing and create new
        for (let i = 0; i < dataArray.length; i++) {
            if (i < pool.length) {
                pool[i].setVisible(true);
                updateFn(pool[i], dataArray[i]);
            } else {
                const sprite = createFn(dataArray[i]);
                pool.push(sprite);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    // CLIENT: Send input to host
    // ═══════════════════════════════════════════════════════════
    _sendInput() {
        if (!this.ws || this.ws.readyState !== 1) return;

        const vx = this.selfSprite && this.selfSprite.body ? this.selfSprite.body.velocity.x : 0;
        const vy = this.selfSprite && this.selfSprite.body ? this.selfSprite.body.velocity.y : 0;

        this.ws.send(JSON.stringify({
            type: 'player_input',
            roomId: this.roomId,
            input: {
                vx,
                vy,
                throwDollar: this._wantsThrow,
                lastDirX: this._selfLastDirX,
                lastDirY: this._selfLastDirY
            }
        }));
        this._wantsThrow = false;
    }

    // ═══════════════════════════════════════════════════════════
    // HOST: Game mechanics (copied from GameScene)
    // ═══════════════════════════════════════════════════════════
    _updateGreed() {
        const now = Date.now();
        this.recentCollections = this.recentCollections.filter(t => now - t < 10000);
        const recentCount = this.recentCollections.filter(t => now - t < 5000).length;
        if (recentCount >= 4) this.greedLevel = 2;
        else if (recentCount >= 2) this.greedLevel = 1;
        else this.greedLevel = 0;

        if (this.greedOverlay) {
            if (this.greedLevel >= 2) this.greedOverlay.setAlpha(0.08);
            else if (this.greedLevel === 1) this.greedOverlay.setAlpha(0.03);
            else this.greedOverlay.setAlpha(0);
        }
    }

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
        const playerId = playerObj === this.player ? "player1" : "player2";
        if (this.bitcoinsCollected[playerId] > 0) {
            this.bitcoinsCollected[playerId]--;
        }
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

    // ═══════════════════════════════════════════════════════════
    // END GAME
    // ═══════════════════════════════════════════════════════════
    _endGame() {
        this.gameStarted = false;

        if (this._stateInterval) {
            clearInterval(this._stateInterval);
            this._stateInterval = null;
        }

        let winner = "Draw!";
        let winColor = "#e2e8f0";
        if (this.bitcoinsCollected.player1 > this.bitcoinsCollected.player2) {
            winner = (this.isHost ? this.username : this.opponentName) + " Wins!";
            winColor = "#38bdf8";
        } else if (this.bitcoinsCollected.player2 > this.bitcoinsCollected.player1) {
            winner = (this.isHost ? this.opponentName : this.username) + " Wins!";
            winColor = "#f5a623";
        }

        // Send game_over to server
        if (this.ws && this.ws.readyState === 1) {
            this.ws.send(JSON.stringify({
                type: 'game_over',
                roomId: this.roomId,
                scores: { ...this.bitcoinsCollected },
                winner
            }));
        }

        // Save stats to DB
        this._saveMatchResult(winner);

        this._showWinScreen(winner, winColor);
    }

    _showGameOver(msg) {
        if (this._gameEnded) return;
        this._gameEnded = true;
        this.gameStarted = false;

        const winner = msg.winner || 'Game Over';
        let winColor = '#e2e8f0';
        if (winner.includes(this.username)) winColor = '#4ade80';
        else if (winner !== 'Draw!') winColor = '#ef4444';

        this._showWinScreen(winner, winColor);
    }

    _showWinScreen(winner, winColor) {
        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;

        const overlay = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.7)
            .setOrigin(0, 0).setDepth(200);

        this.add.text(cx, cy - 30, winner, {
            fontFamily: "Orbitron",
            fontSize: "42px",
            color: winColor,
            stroke: "#000",
            strokeThickness: 6
        }).setOrigin(0.5).setDepth(201);

        const backBtn = this.add.text(cx, cy + 40, "BACK TO MENU", {
            fontFamily: "CinzelBold",
            fontSize: "22px",
            color: "#f5a623",
            stroke: "#000",
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(201).setInteractive({ useHandCursor: true });

        backBtn.on('pointerover', () => backBtn.setColor('#ffd700'));
        backBtn.on('pointerout', () => backBtn.setColor('#f5a623'));
        backBtn.on('pointerdown', () => {
            this._cleanup();
            window.location.href = 'index.html';
        });

        // Auto return after 8s
        this.time.delayedCall(8000, () => {
            this._cleanup();
            window.location.href = 'index.html';
        });
    }

    _onOpponentDisconnected() {
        if (this._gameEnded || !this.gameStarted) return;
        this._gameEnded = true;
        this.gameStarted = false;

        if (this._stateInterval) {
            clearInterval(this._stateInterval);
            this._stateInterval = null;
        }

        this._showWinScreen('Opponent Disconnected', '#f5a623');
    }

    async _saveMatchResult(winner) {
        try {
            const API = `${window.location.protocol}//${window.location.hostname}:3001/api`;
            
            // Record stats for host player (player1)
            const hostUser = this.isHost ? this.username : this.opponentName;
            const clientUser = this.isHost ? this.opponentName : this.username;
            const p1Score = this.isHost ? this.bitcoinsCollected.player1 : this.bitcoinsCollected.player2;
            const p2Score = this.isHost ? this.bitcoinsCollected.player2 : this.bitcoinsCollected.player1;
            
            // Ensure both users exist
            await fetch(`${API}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: hostUser })
            });
            await fetch(`${API}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: clientUser })
            });
            
            // Record match result via a new endpoint
            await fetch(`${API}/online-match`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    player1: hostUser,
                    player2: clientUser,
                    player1Score: this.bitcoinsCollected.player1,
                    player2Score: this.bitcoinsCollected.player2
                })
            });
        } catch (e) {
            console.warn('Failed to save match result:', e);
        }
    }

    _cleanup() {
        if (this._stateInterval) {
            clearInterval(this._stateInterval);
            this._stateInterval = null;
        }
        if (this.ws) {
            this.ws.onmessage = null;
            this.ws.close();
            this.ws = null;
        }
    }

    shutdown() {
        this._cleanup();
    }
}

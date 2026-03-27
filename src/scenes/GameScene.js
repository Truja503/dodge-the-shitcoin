import Player from "../entities/Player.js";
import Player2 from "../entities/Player2.js";
import Spawner from "../systems/Spawner.js";
import DifficultyManager from "../systems/DifficultyManager.js";
import CollisionManager from "../systems/CollisionManager.js";
import { GAME_WIDTH, GAME_HEIGHT } from "../utils/constants.js";
import Bitcoin from "../entities/Bitcoin.js";
import { loadPlayerAssets, createPlayerAnimations } from "../animations/playerAnimations.js";
import Dollar from "../entities/Dollar.js";

var player1Score = document.getElementById("player1-score");
var player2Score = document.getElementById("player2-score");

const header = document.querySelector("header");

export default class GameScene extends Phaser.Scene {
    constructor() {
        super("GameScene");
    }

    preload() {
        loadPlayerAssets(this);
        this.load.image("eth_enemy", "../assets/enemy/eth_enemy.png");
        this.load.image("bg_dark", "assets/backgrounds/bg4.png");
        this.load.image('magicParticle', 'assets/effects/particle.png');
        this.load.image('cloud', 'assets/backgrounds/fog_bg.png');
        this.load.image("bitcoin", "assets/items/bitcoin.png");
        this.load.image("dollar", "assets/items/dollar.png");
    }

    create() {
        // ── Dólares (ítems en mapa) ───────────────────────────────
        this.dollars = this.physics.add.group();

        // Grupo de dólares lanzados (proyectiles)
        this.thrownDollars = this.physics.add.group();

        // ── Fondo ────────────────────────────────────────────────
        this.bg = this.add.image(
            this.scale.width / 2,
            this.scale.height / 2,
            "bg_dark"
        ).setDepth(-30);

        this.darkOverlay = this.add.rectangle(
            0, 0,
            this.scale.width, this.scale.height,
            0x000000, 0.8
        ).setOrigin(0, 0).setDepth(-29);

        this.scale.on("resize", (gameSize) => {
            const { width, height } = gameSize;
            this.darkOverlay.setSize(width, height);
            this.bg.setPosition(width / 2, height / 2);
            const scaleX = width / this.bg.width;
            const scaleY = height / this.bg.height;
            this.bg.setScale(Math.max(scaleX, scaleY));
        });

        const scaleX = this.scale.width / this.bg.width;
        const scaleY = this.scale.height / this.bg.height;
        this.bg.setScale(Math.max(scaleX, scaleY));

        // ── Nubes ────────────────────────────────────────────────
        this.cloud1 = this.add.image(this.scale.width / 2, this.scale.height / 2, "cloud")
            .setOrigin(0.5).setScale(2).setAlpha(0.13).setBlendMode(Phaser.BlendModes.SCREEN);
        this.cloud2 = this.add.image(this.scale.width / 2, this.scale.height / 2, "cloud")
            .setOrigin(0.5).setScale(2).setAlpha(0.18).setBlendMode(Phaser.BlendModes.ADD);

        // ── Estado ───────────────────────────────────────────────
        this.bitcoinsCollected = { player1: 0, player2: 0 };
        this.collectedCount = 0;
        this.totalBitcoins = 21;
        this.gameStarted = true;

        // ── Input ────────────────────────────────────────────────
        this.wasdKeys = this.input.keyboard.addKeys({
            W: Phaser.Input.Keyboard.KeyCodes.W,
            A: Phaser.Input.Keyboard.KeyCodes.A,
            S: Phaser.Input.Keyboard.KeyCodes.S,
            D: Phaser.Input.Keyboard.KeyCodes.D
        });

        createPlayerAnimations(this);

        // ── Jugadores ────────────────────────────────────────────
        this.player  = new Player(this);
        this.player2 = new Player2(this);
        this.player.canMove = true;

        header.style.display = "flex";

        // ── Spawner y dificultad ─────────────────────────────────
        this.spawner    = new Spawner(this);
        this.difficulty = new DifficultyManager(this.spawner);

        // Teclas de lanzar dólar: SPACE para P1, E para P2
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.eKey     = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

        // Spawn enemigos
        this.time.addEvent({ delay: 500,  loop: true, callback: () => this.spawner.spawnEnemy() });
        this.time.addEvent({ delay: 6000, loop: true, callback: () => this.difficulty.increaseDifficulty() });

        // Spawn dólares cada 8s (solo uno a la vez)
        this.time.addEvent({ delay: 8000, loop: true, callback: () => this._spawnDollarIfNone() });
        // Primer dólar a los 5s de empezar
        this.time.delayedCall(5000, () => this._spawnDollarIfNone());

        // 21 bitcoins
        this.spawnNextBitcoin();

        // ── Teclas Player1 ───────────────────────────────────────
        this.cursors = this.input.keyboard.createCursorKeys();

        this.input.gamepad.once('connected', (pad) => {
            console.log('Gamepad conectado:', pad.id);
            this.player.controller = true;
        });

        // ── Colisiones ───────────────────────────────────────────
        new CollisionManager(this, this.player,  this.spawner, this, "player1");
        new CollisionManager(this, this.player2, this.spawner, this, "player2");
        new CollisionManager(this, this.player,  this.spawner, this, "player1", this.player2);
        new CollisionManager(this, this.player2, this.spawner, this, "player2", this.player);

        // Jugadores recogen dólares del mapa
        this.physics.add.overlap(this.player.sprite,  this.dollars, this.collectDollar, null, this);
        this.physics.add.overlap(this.player2.sprite, this.dollars, this.collectDollar, null, this);

        // Proyectiles dólar golpean jugadores
        this.physics.add.overlap(
            this.thrownDollars,
            this.player.sprite,
            (proj, _ps) => this._dollarHitPlayer(proj, this.player),
            null, this
        );
        this.physics.add.overlap(
            this.thrownDollars,
            this.player2.sprite,
            (proj, _ps) => this._dollarHitPlayer(proj, this.player2),
            null, this
        );

        // ── Partículas ───────────────────────────────────────────
        this.magicEmitter = this.add.particles(0, 0, 'magicParticle', {
            x: { min: 0, max: this.game.config.width },
            y: { min: 0, max: this.game.config.height },
            speed: { min: -15, max: 15 },
            lifespan: 2200,
            quantity: 1,
            scale: { start: 0.8, end: 0 },
            alpha: { start: 0.25, end: 0 },
            blendMode: 'ADD',
            frequency: 40,
            tint: [0x7dd3fc, 0x38bdf8, 0x0ea5e9],
        });
    }

    update() {
        if (!this.gameStarted) return;

        const pad = this.input.gamepad.getPad(0);
        this.player.update(this.cursors, pad);
        this.player2.update(this.wasdKeys);

        // Lanzar dólar: SPACE = Player1, E = Player2
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

    // ── Spawn dólar (solo uno en pantalla) ──────────────────────
    _spawnDollarIfNone() {
        if (!this.gameStarted) return;
        if (this.dollars.countActive(true) > 0) return;

        const x = Phaser.Math.Between(80, this.scale.width - 80);
        const y = Phaser.Math.Between(80, this.scale.height - 80);
        const dollar = new Dollar(this, x, y);
        this.dollars.add(dollar);
    }

    // ── Recoger dólar del mapa ───────────────────────────────────
    collectDollar(playerSprite, dollar) {
        if (!dollar.active) return;
        dollar.destroy();

        if (playerSprite === this.player.sprite) {
            this.player.dollarCount++;
            this.player.applyDollarSlow();
        } else if (playerSprite === this.player2.sprite) {
            this.player2.dollarCount++;
            this.player2.applyDollarSlow();
        }
    }

    // ── Proyectil dólar golpea jugador ───────────────────────────
    _dollarHitPlayer(proj, playerObj) {
        // No golpear al que lanzó
        if (proj._thrower === playerObj) return;
        if (!proj.active) return;

        proj.destroy();

        // Mismo efecto que un golpe de enemy
        const enemyFakeX = proj.x;
        const enemyFakeY = proj.y;
        playerObj.sprite.x += (playerObj.sprite.x < enemyFakeX) ? -70 : 70;
        playerObj.sprite.y += (playerObj.sprite.y < enemyFakeY) ? -70 : 70;

        this.cameras.main.flash(100, 255, 255, 255);
        this.cameras.main.shake(150, 0.01);

        playerObj.canMove = false;
        this.time.delayedCall(1000, () => { playerObj.canMove = true; });

        // Restar bitcoin
        this.hitByEnemy(playerObj);
    }

    // ── Recolectar bitcoin ───────────────────────────────────────
    collectBitcoin(player, bitcoin) {
        bitcoin.destroy();
        this.collectedCount++;

        if (player === "player1") {
            this.bitcoinsCollected.player1++;
            player1Score.textContent = `Satoshi 1: ${this.bitcoinsCollected.player1}`;
            const el = document.getElementById("player1-score");
            el.classList.add("score-pop");
            setTimeout(() => el.classList.remove("score-pop"), 200);
        } else {
            this.bitcoinsCollected.player2++;
            player2Score.textContent = `Satoshi 2: ${this.bitcoinsCollected.player2}`;
        }

        if (this.collectedCount < this.totalBitcoins) {
            this.spawnNextBitcoin();
        } else {
            this.endGame();
        }
    }

    // ── Golpe de enemy (o proyectil dólar) ──────────────────────
    hitByEnemy(playerObj) {
        const playerId = playerObj === this.player ? "player1" : "player2";

        if (this.bitcoinsCollected[playerId] > 0) {
            this.bitcoinsCollected[playerId]--;
        }

        if (playerId === "player1") {
            player1Score.textContent = `Satoshi 1: ${this.bitcoinsCollected.player1}`;
        } else {
            player2Score.textContent = `Satoshi 2: ${this.bitcoinsCollected.player2}`;
        }

        playerObj.sprite.setVelocity(0, 0);
        playerObj.canMove = false;
        this.time.delayedCall(1000, () => { playerObj.canMove = true; });
    }

    spawnNextBitcoin() {
        if (this.collectedCount >= this.totalBitcoins) return;
        const x = Phaser.Math.Between(50, this.scale.width - 100);
        const y = Phaser.Math.Between(50, this.scale.height - 100);
        const btc = new Bitcoin(this, x, y);
        this.spawner.bitcoins.add(btc.sprite);
    }

    // ── Fin del juego ────────────────────────────────────────────
    endGame() {
        this.gameStarted = false;
        let winner = "Empate";
        if (this.bitcoinsCollected.player1 > this.bitcoinsCollected.player2) winner = "Jugador 1 gana!";
        else if (this.bitcoinsCollected.player2 > this.bitcoinsCollected.player1) winner = "Jugador 2 gana!";

        this.add.text(GAME_WIDTH / 2 - 100, GAME_HEIGHT / 2, winner, { fontSize: "32px", color: "#fff" });
        this.time.delayedCall(5000, () => this.scene.start("MenuScene"));
    }
}

import Player from "../entities/Player.js";
import Player2 from "../entities/Player2.js";
import Spawner from "../systems/Spawner.js";
import DifficultyManager from "../systems/DifficultyManager.js";
import CollisionManager from "../systems/CollisionManager.js";
import { GAME_WIDTH, GAME_HEIGHT } from "../utils/constants.js";
import Bitcoin from "../entities/Bitcoin.js";
import { loadPlayerAssets, createPlayerAnimations } from "../animations/playerAnimations.js";




export default class GameScene extends Phaser.Scene {
    constructor() {
        super("GameScene");
    }
    preload() {
        loadPlayerAssets(this);
        this.load.image("eth_enemy", "../assets/enemy/eth_enemy.png");
        this.load.image("bg_dark", "assets/backgrounds/bg.png");
        this.load.image('magicParticle', 'assets/effects/particle.png');
        this.load.image('cloud', 'assets/backgrounds/fog_bg.png');
        this.load.image("bitcoin", "assets/items/bitcoin.png");



    }

    create() {
        this.bg = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, "bg_dark")
            .setOrigin(0, 0)
            .setDepth(-30);
        this.bg.setDisplaySize(this.scale.width, this.scale.height);
        //nube
        this.cloud1 = this.add.image(0, 0, "cloud").setOrigin(0.5);
        this.cloud2 = this.add.image(0, 0, "cloud").setOrigin(0.5);

        this.cloud1.setScale(2);
        this.cloud2.setScale(2);

        this.cloud1.setAlpha(0.13);
        this.cloud2.setAlpha(0.18);

        this.cloud1.setBlendMode(Phaser.BlendModes.SCREEN);
        this.cloud2.setBlendMode(Phaser.BlendModes.ADD);

        // posiciones iniciales
        this.cloud1.x = this.scale.width / 2;
        this.cloud1.y = this.scale.height / 2;

        this.cloud2.x = this.scale.width / 2;
        this.cloud2.y = this.scale.height / 2;



        this.bitcoinsCollected = { player1: 0, player2: 0 };
        this.collectedCount = 0; // total de bitcoins recogidos hasta ahora

        // Teclas Player2
        this.wasdKeys = this.input.keyboard.addKeys({
            W: Phaser.Input.Keyboard.KeyCodes.W,
            A: Phaser.Input.Keyboard.KeyCodes.A,
            S: Phaser.Input.Keyboard.KeyCodes.S,
            D: Phaser.Input.Keyboard.KeyCodes.D
        });

        this.gameStarted = true;
        createPlayerAnimations(this);

        // Jugadores

        this.player = new Player(this);
        this.player2 = new Player2(this);

        // Spawner y dificultad
        this.spawner = new Spawner(this);
        this.difficulty = new DifficultyManager(this.spawner);

        // Enemigos y dificultad
        this.time.addEvent({
            delay: 500,
            loop: true,
            callback: () => this.spawner.spawnEnemy()
        });
        this.time.addEvent({
            delay: 6000,
            loop: true,
            callback: () => this.difficulty.increaseDifficulty()
        });
        //21 bitcoins aleatorios
        this.totalBitcoins = 21;
        this.spawnNextBitcoin();



        // Teclas Player1
        this.cursors = this.input.keyboard.createCursorKeys();

        // UI
        this.player1Text = this.add.text(16, 16, "Player1: 0", { fontSize: "24px", color: "#0f0" });
        this.player2Text = this.add.text(16, 48, "Player2: 0", { fontSize: "24px", color: "#00f" });

        // Collisions
        new CollisionManager(this, this.player, this.spawner, this, "player1");
        new CollisionManager(this, this.player2, this.spawner, this, "player2");
        new CollisionManager(this, this.player, this.spawner, this, "player1", this.player2);
        new CollisionManager(this, this.player2, this.spawner, this, "player2", this.player);

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

        this.player.update(this.cursors);
        this.player2.update(this.wasdKeys);

        this.bg.tilePositionX += 0.05;
        this.bg.tilePositionY += 0.03;

        //howgarts effects: 
        this.cloud1.x += 0.02;
this.cloud1.y += 0.01;

this.cloud2.x -= 0.015;
this.cloud2.y += 0.02;

// ciclo infinito
if (this.cloud1.x > this.scale.width) this.cloud1.x = -200;
if (this.cloud2.x < -200) this.cloud2.x = this.scale.width + 200;


        this.spawner.enemyObjects.forEach(enemy => enemy.update());
        for (const enemy of this.spawner.enemyObjects) {
        enemy.update();
    }

    }

    // Recolectar bitcoin
    collectBitcoin(player, bitcoin) {
        bitcoin.destroy();
        this.collectedCount++;

        if (player === "player1") this.bitcoinsCollected.player1++;
        else this.bitcoinsCollected.player2++;

        // Actualizar UI
        this.player1Text.setText(`Player1: ${this.bitcoinsCollected.player1}`);
        this.player2Text.setText(`Player2: ${this.bitcoinsCollected.player2}`);

        // Si quedan bitcoins por colocar, spawn next
        if (this.collectedCount < this.totalBitcoins) {
            this.spawnNextBitcoin();
        } else {
            this.endGame();
        }
    }


    // Golpeado por enemigo → reset posición
    hitByEnemy(playerObj) {
        let playerId;
        if (playerObj === this.player) playerId = "player1";
        else playerId = "player2";

        // Restar 1 bitcoin si tiene
        if (this.bitcoinsCollected[playerId] > 0) {
            this.bitcoinsCollected[playerId]--;
        }

        // Actualizar UI
        this.player1Text.setText(`Player1: ${this.bitcoinsCollected.player1}`);
        this.player2Text.setText(`Player2: ${this.bitcoinsCollected.player2}`);

        // Reset posición
        if (playerObj === this.player) {
            this.player.sprite.x = GAME_WIDTH - 300;
            this.player.sprite.y = GAME_HEIGHT / 2;
        } else {
            this.player2.sprite.x = 200;
            this.player2.sprite.y = GAME_HEIGHT / 2;
        }
    }
    spawnNextBitcoin() {
        if (this.collectedCount >= this.totalBitcoins) return;

        const x = Phaser.Math.Between(50, this.scale.width - 100);
        const y = Phaser.Math.Between(50, this.scale.height - 100);
        const btc = new Bitcoin(this, x, y);
        this.spawner.bitcoins.add(btc.sprite);
    }

    // Fin del juego
    endGame() {
        this.gameStarted = false;
        let winner = "Empate";

        if (this.bitcoinsCollected.player1 > this.bitcoinsCollected.player2) winner = "Jugador 1 gana!";
        else if (this.bitcoinsCollected.player2 > this.bitcoinsCollected.player1) winner = "Jugador 2 gana!";

        this.add.text(GAME_WIDTH / 2 - 100, GAME_HEIGHT / 2, winner, { fontSize: "32px", color: "#fff" });
        this.time.delayedCall(5000, () => this.scene.start("MenuScene"));
    }
}

import Player from "../entities/Player.js";
import Player2 from "../entities/Player2.js";
import Spawner from "../systems/Spawner.js";
import DifficultyManager from "../systems/DifficultyManager.js";
import CollisionManager from "../systems/CollisionManager.js";
import { GAME_WIDTH, GAME_HEIGHT } from "../utils/constants.js";
import Bitcoin from "../entities/Bitcoin.js";
import { loadPlayerAssets, createPlayerAnimations } from "../animations/playerAnimations.js";

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
    }

    create() {
    this.bg = this.add.image(
    this.scale.width / 2,
    this.scale.height / 2,
    "bg_dark"
)
.setDepth(-30);

this.darkOverlay = this.add.rectangle(
    0,
    0,
    this.scale.width,
    this.scale.height,
    0x000000,
    0.8
)
.setOrigin(0, 0)
.setDepth(-29);

this.scale.on("resize", (gameSize) => {
    const { width, height } = gameSize;
    this.darkOverlay.setSize(width, height);
});
this.scale.on("resize", (gameSize) => {
    const { width, height } = gameSize;

    this.bg.setPosition(width / 2, height / 2);

    const scaleX = width / this.bg.width;
    const scaleY = height / this.bg.height;
    const scale = Math.max(scaleX, scaleY);

    this.bg.setScale(scale);
});


// Escalar proporcionalmente para cubrir toda la pantalla
const scaleX = this.scale.width / this.bg.width;
const scaleY = this.scale.height / this.bg.height;
const scale = Math.max(scaleX, scaleY);

this.bg.setScale(scale);
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

        this.player.canMove = true;
        //header 
        header.style.display = "flex";
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


        if (player === "player1") {
            this.bitcoinsCollected.player1++;
            player1Score.textContent = `Satoshi 1: ${this.bitcoinsCollected.player1}`;
            const el = document.getElementById("player1-score");
            el.classList.add("score-pop");

            setTimeout(() => {
                el.classList.remove("score-pop");
            }, 200);
        }
        else {
            this.bitcoinsCollected.player2++;
            player2Score.textContent = `Satoshi 2: ${this.bitcoinsCollected.player2}`;
        }

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


        // Push back y stun 
        playerObj.sprite.setVelocity(0, 0);
        playerObj.canMove = false;
        this.time.delayedCall(1000, () => {
            playerObj.canMove = true;
        });

        
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

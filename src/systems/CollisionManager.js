export default class CollisionManager {
    constructor(scene, player, spawner, gameScene, playerId, otherPlayer) {
        this.scene = scene;
        this.player = player;
        this.spawner = spawner;
        this.gameScene = gameScene; // referencia al GameScene
        this.playerId = playerId;   // "player1" o "player2"
        this.otherPlayer = otherPlayer; // referencia al otro jugador

        // Colisión contra enemigos
        scene.physics.add.overlap(
            player.sprite,
            spawner.enemies,
            (playerSprite, enemySprite) => this.hitEnemy(playerSprite, enemySprite),
            null,
            this
        );

        // Colisión contra bitcoin
        scene.physics.add.overlap(
            player.sprite,
            spawner.bitcoins,
            (playerSprite, coinSprite) => this.hitCoin(coinSprite),
            null,
            this
        );

        // Colisión contra el otro jugador
        if (this.otherPlayer) {
            scene.physics.add.overlap(
                player.sprite,
                otherPlayer.sprite,
                (playerSprite, otherSprite) => this.hitOtherPlayer(),
                null,
                this
            );
        }
    }

    hitEnemy(playerSprite, enemySprite) {
        const enemyObj = this.spawner.enemyObjects.find(e => e.sprite === enemySprite);
        if (!enemyObj) return;

        enemyObj.kill();
        this.spawner.enemyObjects = this.spawner.enemyObjects.filter(e => e !== enemyObj);

        // Regresar al jugador a su posición inicial
        this.gameScene.hitByEnemy(this.player);
    }

    hitCoin(coinSprite) {
        this.gameScene.collectBitcoin(this.playerId, coinSprite);
    }

    hitOtherPlayer() {
        // Cuando se tocan, el jugador golpeado (this.player) se resetea
        this.gameScene.hitByEnemy(this.player); // reutilizamos la función de reset
    }
}

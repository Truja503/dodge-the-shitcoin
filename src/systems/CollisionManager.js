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
                (playerSprite, otherSprite) => this.hitOtherPlayer(playerSprite, otherSprite),
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

        // move a little bit the player and can't move for a short time (stun)
        playerSprite.x += (playerSprite.x < enemySprite.x) ? -70 : 70; // push back
        playerSprite.y += (playerSprite.y < enemySprite.y) ? -70 : 70;
    
        this.scene.cameras.main.flash(100, 255, 255, 255);
        this.scene.cameras.main.shake(150, 0.01);

        // Stun effect: disable movement for 1 second
        this.player.canMove = false;
        this.scene.time.delayedCall(1000, () => {
            this.player.canMove = true;
        });
    }

    hitCoin(coinSprite) {
        this.gameScene.collectBitcoin(this.playerId, coinSprite);
    }

    hitOtherPlayer(playerSprite, otherSprite) {
        playerSprite.x += (playerSprite.x < otherSprite.x) ? -70 : 70; // push back
        playerSprite.y += (playerSprite.y < otherSprite.y) ? -70 : 70;

        otherSprite.x += (otherSprite.x < playerSprite.x) ? -70 : 70; // push back
        otherSprite.y += (otherSprite.y < playerSprite.y) ? -70 : 70;

        // Stun effect: disable movement for 1 second
        this.player.canMove = false;
        this.scene.time.delayedCall(1000, () => {
            this.player.canMove = true;
        });

        this.otherPlayer.canMove = false;
        this.scene.time.delayedCall(1000, () => {
            this.otherPlayer.canMove = true;
        });
    }
}

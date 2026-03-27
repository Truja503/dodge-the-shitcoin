export default class CollisionManager {
    constructor(scene, player, spawner, gameScene, playerId, otherPlayer) {
        this.scene      = scene;
        this.player     = player;
        this.spawner    = spawner;
        this.gameScene  = gameScene;
        this.playerId   = playerId;
        this.otherPlayer = otherPlayer;

        // Jugador vs enemigos
        scene.physics.add.overlap(
            player.sprite,
            spawner.enemies,
            (playerSprite, enemySprite) => this.hitEnemy(playerSprite, enemySprite),
            null,
            this
        );

        // Jugador vs bitcoins
        scene.physics.add.overlap(
            player.sprite,
            spawner.bitcoins,
            (playerSprite, coinSprite) => this.hitCoin(coinSprite),
            null,
            this
        );

        // Jugador vs otro jugador
        if (otherPlayer) {
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
        // Invencible = ignora el golpe pero destruye el enemigo
        if (this.player.isInvincible) {
            const enemyObj = this.spawner.enemyObjects.find(e => e.sprite === enemySprite);
            if (!enemyObj) return;
            enemyObj.kill();
            this.spawner.enemyObjects = this.spawner.enemyObjects.filter(e => e !== enemyObj);
            return;
        }

        const enemyObj = this.spawner.enemyObjects.find(e => e.sprite === enemySprite);
        if (!enemyObj) return;

        enemyObj.kill();
        this.spawner.enemyObjects = this.spawner.enemyObjects.filter(e => e !== enemyObj);

        playerSprite.x += (playerSprite.x < enemySprite.x) ? -70 : 70;
        playerSprite.y += (playerSprite.y < enemySprite.y) ? -70 : 70;

        this.scene.cameras.main.flash(100, 255, 255, 255);
        this.scene.cameras.main.shake(150, 0.01);

        this.player.canMove = false;
        this.scene.time.delayedCall(1000, () => {
            if (this.player) this.player.canMove = true;
        });

        this.gameScene.hitByEnemy(this.player);
    }

    hitCoin(coinSprite) {
        this.gameScene.collectBitcoin(this.playerId, coinSprite);
    }

    hitOtherPlayer(playerSprite, otherSprite) {
        // Si ambos son invencibles, no pasa nada
        if (this.player.isInvincible && this.otherPlayer.isInvincible) return;

        playerSprite.x += (playerSprite.x < otherSprite.x) ? -70 : 70;
        playerSprite.y += (playerSprite.y < otherSprite.y) ? -70 : 70;
        otherSprite.x  += (otherSprite.x < playerSprite.x) ? -70 : 70;
        otherSprite.y  += (otherSprite.y < playerSprite.y) ? -70 : 70;

        if (!this.player.isInvincible) {
            this.player.canMove = false;
            this.scene.time.delayedCall(1000, () => {
                if (this.player) this.player.canMove = true;
            });
        }
        if (!this.otherPlayer.isInvincible) {
            this.otherPlayer.canMove = false;
            this.scene.time.delayedCall(1000, () => {
                if (this.otherPlayer) this.otherPlayer.canMove = true;
            });
        }
    }
}

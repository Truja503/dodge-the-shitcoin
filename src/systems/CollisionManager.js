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
        const enemyObj = enemySprite._enemyRef;
        if (!enemyObj) return;

        // ── Invencible: destruye sin daño, sin split ──
        if (this.player.isInvincible) {
            enemyObj.kill();
            this.spawner.enemyObjects = this.spawner.enemyObjects.filter(e => e !== enemyObj);
            return;
        }

        // Guardar datos ANTES de tocar el enemy
        const ex = enemySprite.x;
        const ey = enemySprite.y;
        const hitForce    = enemyObj.getHitForce();
        const stunDuration = enemyObj.getStunDuration();
        const canSplit    = enemyObj.canSplit();

        // ── Dividir o matar ──
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

        // ── Daño al jugador proporcional al tamaño ──
        const pushDirX = (playerSprite.x < ex) ? -1 : 1;
        const pushDirY = (playerSprite.y < ey) ? -1 : 1;
        playerSprite.x += pushDirX * hitForce;
        playerSprite.y += pushDirY * hitForce;

        // Shake proporcional
        const shakeIntensity = Phaser.Math.Clamp(hitForce / 7000, 0.005, 0.02);
        this.scene.cameras.main.flash(100, 255, 255, 255);
        this.scene.cameras.main.shake(stunDuration * 0.15, shakeIntensity);

        this.player.canMove = false;
        this.scene.time.delayedCall(stunDuration, () => {
            if (this.player && this.player.sprite && this.player.sprite.body) {
                this.player.canMove = true;
            }
        });

        this.gameScene.hitByEnemy(this.player);
    }

    hitCoin(coinSprite) {
        this.gameScene.collectBitcoin(this.playerId, coinSprite);
    }

    hitOtherPlayer(playerSprite, otherSprite) {
        if (this.player.isInvincible && this.otherPlayer.isInvincible) return;

        playerSprite.x += (playerSprite.x < otherSprite.x) ? -70 : 70;
        playerSprite.y += (playerSprite.y < otherSprite.y) ? -70 : 70;
        otherSprite.x  += (otherSprite.x < playerSprite.x) ? -70 : 70;
        otherSprite.y  += (otherSprite.y < playerSprite.y) ? -70 : 70;

        if (!this.player.isInvincible) {
            this.player.canMove = false;
            this.scene.time.delayedCall(1000, () => {
                if (this.player && this.player.sprite && this.player.sprite.body) {
                    this.player.canMove = true;
                }
            });
        }
        if (!this.otherPlayer.isInvincible) {
            this.otherPlayer.canMove = false;
            this.scene.time.delayedCall(1000, () => {
                if (this.otherPlayer && this.otherPlayer.sprite && this.otherPlayer.sprite.body) {
                    this.otherPlayer.canMove = true;
                }
            });
        }
    }
}

import Enemy from "../entities/Enemy.js";
import Bitcoin from "../entities/Bitcoin.js";
import { BASE_ENEMY_SPEED } from "../utils/constants.js";

export default class Spawner {
    constructor(scene) {
        this.scene = scene;
        this.enemies = scene.physics.add.group();
        
        // Arreglo REAL donde guardás los objetos Enemy
        this.enemyObjects = [];

        this.bitcoins = scene.physics.add.group();
        this.currentEnemySpeed = BASE_ENEMY_SPEED;
    }

    spawnEnemy() {
        const side = Phaser.Math.Between(0, 3);

        let x, y, vx, vy;

        const randX = Phaser.Math.Between(-50, 50);
        const randY = Phaser.Math.Between(-50, 50);

        switch (side) {
            case 0: x = Phaser.Math.Between(0, this.scene.scale.width); y = -50; vx = randX; vy = this.currentEnemySpeed; break;
            case 1: x = Phaser.Math.Between(0, this.scene.scale.width); y = this.scene.scale.height + 50; vx = randX; vy = -this.currentEnemySpeed; break;
            case 2: x = -50; y = Phaser.Math.Between(0, this.scene.scale.height); vx = this.currentEnemySpeed; vy = randY; break;
            case 3: x = this.scene.scale.width + 50; y = Phaser.Math.Between(0, this.scene.scale.height); vx = -this.currentEnemySpeed; vy = randY; break;
        }

        const enemy = new Enemy(this.scene, x, y, vx, vy);

        // group solo para colisiones
        this.enemies.add(enemy.sprite);

        // guardás la lógica completa
        this.enemyObjects.push(enemy);
    }

    spawnBitcoin() {
        if (this.bitcoins.countActive(true) > 0) return;

        const x = Phaser.Math.Between(50, this.scene.scale.width - 100);
        const y = Phaser.Math.Between(50, this.scene.scale.height - 100);

        const btc = new Bitcoin(this.scene, x, y);
        this.bitcoins.add(btc.sprite);
    }
}

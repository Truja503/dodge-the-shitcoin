export default class Enemy {
    constructor(scene, x, y, vx, vy) {
        this.scene = scene;

        // Lista de enemigos disponibles
        const enemyKeys = ["eth_enemy"];
        const key = Phaser.Utils.Array.GetRandom(enemyKeys);

        this.sprite = scene.add.sprite(x, y, key);
        scene.physics.add.existing(this.sprite);
        this.sprite.body.setCircle(this.sprite.width / 2);

        // Tamaño aleatorio para variedad (0.1 a 0.25)
        const randomScale = Phaser.Math.FloatBetween(0.11, 0.17);
        this.sprite.setScale(randomScale);

        // Rotación aleatoria (más o menos rápida)
        this.rotationSpeed = Phaser.Math.FloatBetween(0.01, 0.04);

        this.sprite.body.setAllowGravity(false);
        this.sprite.vx = vx;
        this.sprite.vy = vy;
    }

    update() {
        if (!this.sprite || !this.sprite.body) return;

        // Movimiento
        this.sprite.body.setVelocity(this.sprite.vx, this.sprite.vy);

        // Rotación constante (como bola giratoria)
        this.sprite.rotation += this.rotationSpeed;

        // Destrucción fuera de pantalla
        if (
            this.sprite.x < -60 || this.sprite.x > this.scene.scale.width + 60 ||
            this.sprite.y < -60 || this.sprite.y > this.scene.scale.height + 60
        ) {
            this.kill();
        }
    }

    kill() {
        if (this.sprite) {
            this.sprite.destroy();
            this.sprite = null;
        }
    }
}

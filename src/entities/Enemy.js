const MIN_SPLIT_SCALE = 0.07;  // debajo de esto no se divide, muere

export default class Enemy {
    constructor(scene, x, y, vx, vy, scale) {
        this.scene = scene;

        const enemyKeys = ["eth_enemy"];
        const key = Phaser.Utils.Array.GetRandom(enemyKeys);

        this.sprite = scene.add.sprite(x, y, key);
        scene.physics.add.existing(this.sprite);
        this.sprite.body.setCircle(this.sprite.width / 2);

        // Scale: pasado explícitamente (split) o aleatorio (spawn)
        this.enemyScale = scale || Phaser.Math.FloatBetween(0.11, 0.17);
        this.sprite.setScale(this.enemyScale);

        this.rotationSpeed = Phaser.Math.FloatBetween(0.01, 0.04);

        this.sprite.body.setAllowGravity(false);
        this.sprite.vx = vx;
        this.sprite.vy = vy;

        // Referencia inversa para CollisionManager
        this.sprite._enemyRef = this;
    }

    update() {
        if (!this.sprite || !this.sprite.body) return;

        this.sprite.body.setVelocity(this.sprite.vx, this.sprite.vy);
        this.sprite.rotation += this.rotationSpeed;

        if (
            this.sprite.x < -60 || this.sprite.x > this.scene.scale.width + 60 ||
            this.sprite.y < -60 || this.sprite.y > this.scene.scale.height + 60
        ) {
            this.kill();
        }
    }

    /** ¿Puede dividirse? */
    canSplit() {
        return this.enemyScale > MIN_SPLIT_SCALE;
    }

    /**
     * Divide este enemigo en 2 más chicos que salen disparados
     * en ángulos opuestos. Retorna array de nuevos Enemy.
     */
    split() {
        if (!this.sprite) return [];

        const x = this.sprite.x;
        const y = this.sprite.y;
        const newScale = this.enemyScale * 0.6;  // 60% del tamaño original
        const speed = 180;

        // Ángulo random, los dos hijos salen en direcciones opuestas
        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const children = [];

        for (let i = 0; i < 2; i++) {
            const a = angle + (i * Math.PI);  // 180° de diferencia
            const vx = Math.cos(a) * speed;
            const vy = Math.sin(a) * speed;
            const child = new Enemy(this.scene, x, y, vx, vy, newScale);
            children.push(child);
        }

        this.kill();
        return children;
    }

    /**
     * Fuerza del impacto: proporcional al tamaño.
     * Rango aprox: 40 (chiquito) – 120 (grande)
     */
    getHitForce() {
        return Math.round(Phaser.Math.Clamp(this.enemyScale * 700, 40, 120));
    }

    /**
     * Duración del stun en ms: proporcional al tamaño.
     * 400ms (chiquito) – 1200ms (grande)
     */
    getStunDuration() {
        return Math.round(Phaser.Math.Clamp(this.enemyScale * 7000, 400, 1200));
    }

    kill() {
        if (this.sprite) {
            this.sprite._enemyRef = null;
            this.sprite.destroy();
            this.sprite = null;
        }
    }
}

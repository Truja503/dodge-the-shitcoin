export default class Dollar extends Phaser.Physics.Arcade.Sprite {

    constructor(scene, x, y) {
        super(scene, x, y, "dollar");

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setTint(0x00ff00);
        this.setScale(0.03);
        this.setDepth(10);

        this.body.setAllowGravity(false);
        this.setImmovable(true);
        this.body.setCircle(40);

        // Tween flotante
        scene.tweens.add({
            targets: this,
            y: y - 12,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

}

export default class OrangePill extends Phaser.Physics.Arcade.Sprite {

    constructor(scene, x, y) {
        super(scene, x, y, "orangepill");

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setTint(0xff8c00);
        this.setScale(0.03);
        this.setDepth(10);

        this.body.setAllowGravity(false);
        this.setImmovable(true);
        this.body.setCircle(40);

        // Tween: pulsa y flota
        scene.tweens.add({
            targets: this,
            y: y - 14,
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        scene.tweens.add({
            targets: this,
            scaleX: 0.035,
            scaleY: 0.035,
            duration: 400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

}

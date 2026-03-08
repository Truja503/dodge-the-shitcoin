export default class Dollar extends Phaser.Physics.Arcade.Sprite {

    constructor(scene, x, y){

        super(scene, x, y, null);

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setTint(0x00ff00);
        this.setDisplaySize(30,30);

        this.body.setAllowGravity(false);
        this.setImmovable(true);
    }

}
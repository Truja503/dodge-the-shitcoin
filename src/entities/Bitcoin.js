export default class Bitcoin {
    constructor(scene, x, y) {
        this.scene = scene;

        this.sprite = scene.physics.add.sprite(x, y, "bitcoin")
    .setScale(0.12)          // ajusta tamaño según tu PNG
    .setDepth(10)
    .setCircle(40);          // hitbox redonda (opcional)


        


        this.sprite.setScale(0.03)
        this.sprite.body.setAllowGravity(false);
        this.sprite.body.setImmovable(true);
    }
}

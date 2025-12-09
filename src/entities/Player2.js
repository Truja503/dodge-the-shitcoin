import { PLAYER_SPEED } from "../utils/constants.js";
import { GAME_WIDTH, GAME_HEIGHT } from "../utils/constants.js";

export default class Player2 {
    constructor(scene) {
        this.scene = scene;

        // Mismo sprite base que el Player1
        this.sprite = scene.physics.add.sprite(
            200,
            GAME_HEIGHT / 2,
            'idle_1'
        );

        // Misma escala
        this.sprite.setScale(0.1);

        // Misma hitbox para que ambos players sean justos
        this.sprite.body.setSize(500, 900);
        this.sprite.body.setOffset(1000, 400);

        // Color único para el Player2
        this.sprite.setTint(0xe4b320); 

        this.sprite.setCollideWorldBounds(true);

        // Animación inicial
        this.currentAnim = 'player_idle';
        this.sprite.play('player_idle');
    }

    update(keys) {
        if (!keys) return;

        let vx = 0;
        let vy = 0;

        if (keys.A.isDown) vx -= PLAYER_SPEED;
        if (keys.D.isDown) vx += PLAYER_SPEED;
        if (keys.W.isDown) vy -= PLAYER_SPEED;
        if (keys.S.isDown) vy += PLAYER_SPEED;

        // Normalizar diagonal
        if (vx !== 0 && vy !== 0) {
            vx *= Math.SQRT1_2;
            vy *= Math.SQRT1_2;
        }

        // Aplicar movimiento
        this.sprite.setVelocity(vx, vy);

        // Animación
        if (vx !== 0 || vy !== 0) {
            if (this.currentAnim !== 'player_move') {
                this.sprite.play('player_move', true);
                this.currentAnim = 'player_move';
            }

            // Flip lateral
            if (vx < 0) this.sprite.setFlipX(true);
            else if (vx > 0) this.sprite.setFlipX(false);

        } else {
            if (this.currentAnim !== 'player_idle') {
                this.sprite.play('player_idle', true);
                this.currentAnim = 'player_idle';
            }
        }
    }
}

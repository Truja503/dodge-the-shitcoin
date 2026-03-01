import { PLAYER_SPEED } from "../utils/constants.js";
import {GAME_WIDTH } from "../utils/constants.js";
import {GAME_HEIGHT} from "../utils/constants.js";

export default class Player {
    constructor(scene) {
        this.scene = scene;
        this.sprite = scene.physics.add.sprite(
            GAME_WIDTH - 300,
            GAME_HEIGHT / 2,
            'idle_1'
        );
        this.sprite.setScale(0.1);
        this.sprite.body.setSize(500, 900); 
        this.sprite.body.setOffset(1000, 400);
        this.canMove = true; // flag para controlar el movimiento

        this.sprite.setTint(0xaaaaaa); 
        this.sprite.setCollideWorldBounds(true);

        this.currentAnim = 'player_idle';
        this.sprite.play('player_idle');
    }

    update(cursors) {
        var vx;
        var vy;
        if (!cursors) return;
        if (!this.canMove) {
            this.sprite.setVelocity(0, 0);
            return;
        }
        else{
            vx = cursors.left.isDown ? -PLAYER_SPEED : cursors.right.isDown ? PLAYER_SPEED : 0;

            vy =
            cursors.up.isDown ? -PLAYER_SPEED :
            cursors.down.isDown ? PLAYER_SPEED : 0;

            this.sprite.setVelocity(vx, vy);
        }
        
        // Animación
        if (vx !== 0 || vy !== 0) {
            if (this.currentAnim !== 'player_move') {
                this.sprite.play('player_move', true);
                this.currentAnim = 'player_move';
            }

                // flip para izquierda/derecha
                if (vx < 0) this.sprite.setFlipX(true);
            else if (vx > 0) this.sprite.setFlipX(false);
        } 
        else {
            if (this.currentAnim !== 'player_idle') {
                this.sprite.play('player_idle', true);
                this.currentAnim = 'player_idle';
            }
        }
    }
}


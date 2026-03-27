import { PLAYER_SPEED } from "../utils/constants.js";
import { GAME_WIDTH, GAME_HEIGHT } from "../utils/constants.js";

const DOLLAR_SLOW_SPEED   = 180;
const DOLLAR_SLOW_DURATION  = 4000;
const DOLLAR_THROW_WINDOW   = 2000;
const DOLLAR_THROW_SPEED    = 600;

export default class Player2 {
    constructor(scene) {
        this.scene = scene;

        this.sprite = scene.physics.add.sprite(
            200,
            GAME_HEIGHT / 2,
            'idle_1'
        );

        this.sprite.setScale(0.1);
        this.sprite.body.setSize(500, 900);
        this.sprite.body.setOffset(1000, 400);
        this.canMove = true;

        this.dollarCount = 0;
        this.isSlowed = false;

        this.lastDirectionX = -1;
        this.lastDirectionY = 0;

        this.speed = PLAYER_SPEED;

        this.sprite.setTint(0xe4b320);
        this.sprite.setCollideWorldBounds(true);

        this.currentAnim = 'player_idle';
        this.sprite.play('player_idle');
    }

    update(keys) {
        if (!keys) return;

        if (!this.canMove) {
            this.sprite.setVelocity(0, 0);
            return;
        }

        let vx = 0;
        let vy = 0;

        if (keys.A.isDown) vx -= this.speed;
        if (keys.D.isDown) vx += this.speed;
        if (keys.W.isDown) vy -= this.speed;
        if (keys.S.isDown) vy += this.speed;

        // Normalizar diagonal
        if (vx !== 0 && vy !== 0) {
            vx *= Math.SQRT1_2;
            vy *= Math.SQRT1_2;
        }

        this.sprite.setVelocity(vx, vy);

        if (vx !== 0 || vy !== 0) {
            this.lastDirectionX = Math.sign(vx);
            this.lastDirectionY = Math.sign(vy);
        }

        if (vx !== 0 || vy !== 0) {
            if (this.currentAnim !== 'player_move') {
                this.sprite.play('player_move', true);
                this.currentAnim = 'player_move';
            }
            if (vx < 0) this.sprite.setFlipX(true);
            else if (vx > 0) this.sprite.setFlipX(false);
        } else {
            if (this.currentAnim !== 'player_idle') {
                this.sprite.play('player_idle', true);
                this.currentAnim = 'player_idle';
            }
        }
    }

    /** Aplica el slow de 4s y abre ventana de 2s para lanzar */
    applyDollarSlow() {
        this.isSlowed = true;
        this.speed = DOLLAR_SLOW_SPEED;

        this.scene.time.delayedCall(DOLLAR_THROW_WINDOW, () => {
            if (this.dollarCount > 0) {
                this.dollarCount = 0;
            }
        });

        this.scene.time.delayedCall(DOLLAR_SLOW_DURATION, () => {
            this.isSlowed = false;
            this.speed = PLAYER_SPEED;
        });
    }

    throwDollar() {
        if (this.dollarCount <= 0) return;

        const dollar = this.scene.add.rectangle(
            this.sprite.x,
            this.sprite.y,
            20,
            20,
            0x00ff00
        );

        this.scene.physics.add.existing(dollar);
        this.scene.thrownDollars.add(dollar);
        dollar._thrower = this;

        const dx = this.lastDirectionX || -1;
        const dy = this.lastDirectionY || 0;
        const mag = Math.sqrt(dx * dx + dy * dy) || 1;

        dollar.body.setAllowGravity(false);
        dollar.body.setVelocity(
            (dx / mag) * DOLLAR_THROW_SPEED,
            (dy / mag) * DOLLAR_THROW_SPEED
        );

        this.dollarCount--;
    }
}

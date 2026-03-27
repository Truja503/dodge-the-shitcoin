import { PLAYER_SPEED } from "../utils/constants.js";
import { GAME_WIDTH } from "../utils/constants.js";
import { GAME_HEIGHT } from "../utils/constants.js";

const DOLLAR_SLOW_SPEED   = 180;   // velocidad mientras está enlentecido
const DOLLAR_SLOW_DURATION  = 4000; // ms que dura el slow
const DOLLAR_THROW_WINDOW   = 2000; // ms de ventana para tirar el dólar
const DOLLAR_THROW_SPEED    = 600;

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
        this.canMove = true;

        this.dollarCount = 0;
        this.isSlowed = false;

        this.lastDirectionX = 1;
        this.lastDirectionY = 0;

        this.sprite.setTint(0xaaaaaa);
        this.sprite.setCollideWorldBounds(true);

        this.speed = PLAYER_SPEED;

        this.currentAnim = 'player_idle';
        this.sprite.play('player_idle');

        this.controller = false;
    }

    update(cursors, pad) {
        if (!this.canMove) {
            this.sprite.setVelocity(0, 0);
            return;
        }

        let vx = 0;
        let vy = 0;

        if (this.controller && pad && pad.axes && pad.axes.length >= 2) {
            const axisX = pad.axes[0].value;
            const axisY = pad.axes[1].value;
            if (Math.abs(axisX) > 0.1) vx = axisX * this.speed;
            if (Math.abs(axisY) > 0.1) vy = axisY * this.speed;
        } else {
            vx = cursors.left.isDown  ? -this.speed :
                 cursors.right.isDown ?  this.speed : 0;
            vy = cursors.up.isDown    ? -this.speed :
                 cursors.down.isDown  ?  this.speed : 0;
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

        // Cierra la ventana de tiro después de 2s
        this.scene.time.delayedCall(DOLLAR_THROW_WINDOW, () => {
            if (this.dollarCount > 0) {
                // No lo tiró — lo pierde
                this.dollarCount = 0;
            }
        });

        // Recupera velocidad después de 4s
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
        dollar._thrower = this; // para no autogolpearse

        // Si no se movió, tirar a la derecha por defecto
        const dx = this.lastDirectionX || 1;
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

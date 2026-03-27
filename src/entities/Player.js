import { PLAYER_SPEED } from "../utils/constants.js";
import { GAME_WIDTH } from "../utils/constants.js";
import { GAME_HEIGHT } from "../utils/constants.js";

const DOLLAR_SLOW_SPEED    = 180;
const DOLLAR_SLOW_DURATION = 4000;
const DOLLAR_THROW_WINDOW  = 2000;
const DOLLAR_THROW_SPEED   = 450;

const PILL_BOOST_SPEED     = 900;
const PILL_DURATION        = 3000;

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

        this.dollarCount  = 0;
        this.isSlowed     = false;
        this.isInvincible = false;

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
        if (!this.sprite || !this.sprite.body) return;

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

    /** Slow 4s + ventana 2s para tirar */
    applyDollarSlow() {
        // Si está en modo pill, no aplica slow
        if (this.isInvincible) return;

        this.isSlowed = true;
        this.speed = DOLLAR_SLOW_SPEED;

        this.scene.time.delayedCall(DOLLAR_THROW_WINDOW, () => {
            if (this.dollarCount > 0) this.dollarCount = 0;
        });

        this.scene.time.delayedCall(DOLLAR_SLOW_DURATION, () => {
            if (!this.isInvincible) {
                this.isSlowed = false;
                this.speed = PLAYER_SPEED;
            }
        });
    }

    /** Orange Pill: 3s invencible + rápido */
    applyOrangePill() {
        this.isInvincible = true;
        this.isSlowed = false;
        this.speed = PILL_BOOST_SPEED;

        // Tint naranja mientras dura
        this.sprite.setTint(0xff8c00);

        this.scene.time.delayedCall(PILL_DURATION, () => {
            this.isInvincible = false;
            this.speed = PLAYER_SPEED;
            this.sprite.setTint(0xaaaaaa); // tint original P1
        });
    }

    throwDollar() {
        if (this.dollarCount <= 0) return;

        const dx = this.lastDirectionX || 1;
        const dy = this.lastDirectionY || 0;
        const mag = Math.sqrt(dx * dx + dy * dy) || 1;
        const ndx = dx / mag;
        const ndy = dy / mag;

        // Spawn 60px adelante para no autogolpearse en frame 0
        const proj = this.scene.physics.add.image(
            this.sprite.x + ndx * 60,
            this.sprite.y + ndy * 60,
            "dollar"
        );
        proj.setScale(0.04).setTint(0x00ff00).setDepth(15);
        proj.body.setAllowGravity(true);
        proj.body.setGravityY(300);  // arco parabólico
        proj._thrower = this;

        // Lanzamiento: velocidad en dirección + impulso vertical hacia arriba
        proj.body.setVelocity(
            ndx * DOLLAR_THROW_SPEED,
            ndy * DOLLAR_THROW_SPEED - 150  // arco hacia arriba
        );

        // Rotación visual mientras vuela
        this.scene.tweens.add({
            targets: proj,
            rotation: Math.PI * 4,
            duration: 2000,
            ease: 'Linear'
        });

        // Auto-destruir después de 3s si no pega
        this.scene.time.delayedCall(3000, () => {
            if (proj && proj.active) proj.destroy();
        });

        this.scene.thrownDollars.add(proj);
        this.dollarCount--;
    }
}

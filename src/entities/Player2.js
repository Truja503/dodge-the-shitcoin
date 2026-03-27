import { PLAYER_SPEED } from "../utils/constants.js";
import { GAME_WIDTH, GAME_HEIGHT } from "../utils/constants.js";

const DOLLAR_SLOW_SPEED    = 180;
const DOLLAR_SLOW_DURATION = 4000;
const DOLLAR_THROW_WINDOW  = 2000;
const DOLLAR_THROW_SPEED   = 450;

const PILL_BOOST_SPEED     = 900;
const PILL_DURATION        = 3000;

export default class Player2 {
    constructor(scene) {
        this.scene = scene;

        this.sprite = scene.physics.add.sprite(
            200,
            GAME_HEIGHT / 2,
            'idle_1'
        );

        this.sprite.setScale(0.1);
        // Hitbox: tighter, centered on character body
        this.sprite.body.setSize(700, 1000);
        this.sprite.body.setOffset(900, 300);
        this.canMove = true;

        this.dollarCount  = 0;
        this.isSlowed     = false;
        this.isInvincible = false;

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
        if (!this.sprite || !this.sprite.body) return;

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

    /** Slow 4s + ventana 2s para tirar */
    applyDollarSlow() {
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

        this.sprite.setTint(0xff8c00);

        this.scene.time.delayedCall(PILL_DURATION, () => {
            this.isInvincible = false;
            this.speed = PLAYER_SPEED;
            this.sprite.setTint(0xe4b320); // tint original P2
        });
    }

    throwDollar() {
        if (this.dollarCount <= 0) return;

        const dx = this.lastDirectionX || -1;
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
        proj._thrower = this;

        // Agregar al grupo ANTES de setVelocity
        this.scene.thrownDollars.add(proj);

        proj.body.setAllowGravity(false);
        proj.body.setVelocity(
            ndx * DOLLAR_THROW_SPEED,
            ndy * DOLLAR_THROW_SPEED
        );

        this.scene.tweens.add({
            targets: proj,
            rotation: Math.PI * 4,
            duration: 2000,
            ease: 'Linear'
        });

        this.scene.time.delayedCall(3000, () => {
            if (proj && proj.active) proj.destroy();
        });

        this.dollarCount--;
    }
}

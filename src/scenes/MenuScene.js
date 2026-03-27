export default class MenuScene extends Phaser.Scene {
    constructor() {
        super("MenuScene");
    }

    preload() {
        this.load.image("menu_bg",   "assets/backgrounds/bg_chaos.png");
        this.load.image("menu_char", "assets/player1/idle_1.png");
    }

    create() {
        const header = document.querySelector("header");
        if (header) header.style.display = "none";

        this._injectParticleCanvas();

        const W  = this.scale.width;
        const H  = this.scale.height;
        const cx = W / 2;

        // ── Background ──
        this.add.image(0, 0, "menu_bg")
            .setOrigin(0, 0)
            .setDisplaySize(W, H)
            .setDepth(-2);

        // Dark vignette so text stays legible
        this.add.rectangle(cx, H / 2, W, H, 0x000000, 0.55).setDepth(-1);

        // Scanlines
        const scanGfx = this.add.graphics().setDepth(0).setAlpha(0.06);
        for (let y = 0; y < H; y += 4) {
            scanGfx.fillStyle(0x000000, 1);
            scanGfx.fillRect(0, y, W, 2);
        }

        // ── Character (left side) ──
        const char = this.add.image(cx * 0.38, H * 0.62, "menu_char")
            .setScale(2.8)
            .setDepth(3)
            .setAlpha(0);

        this.tweens.add({
            targets: char, alpha: 0.92, duration: 800, delay: 400, ease: 'Sine.easeOut'
        });
        // gentle float
        this.tweens.add({
            targets: char, y: char.y - 10,
            duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 1200
        });

        // ── Title ──
        const titleY = H * 0.22;

        // Gold glow layer
        const titleGlow = this.add.text(cx, titleY, 'DODGE THE\nSHITCOIN', {
            fontFamily: 'CinzelBold',
            fontSize: '54px',
            color: '#f5a623',
            align: 'center',
            lineSpacing: 6,
        }).setOrigin(0.5).setAlpha(0).setDepth(2);

        // Main title
        const title = this.add.text(cx, titleY, 'DODGE THE\nSHITCOIN', {
            fontFamily: 'CinzelBold',
            fontSize: '54px',
            color: '#ffeaa0',
            stroke: '#1a0e00',
            strokeThickness: 5,
            align: 'center',
            lineSpacing: 6,
            shadow: { offsetX: 0, offsetY: 0, color: '#f5a623', blur: 30, fill: true }
        }).setOrigin(0.5).setAlpha(0).setDepth(3);

        // Entry
        [title, titleGlow].forEach(t => {
            t.setY(titleY - 22);
            this.tweens.add({ targets: t, y: titleY, alpha: t === title ? 1 : 0.2, duration: 850, delay: 80, ease: 'Back.easeOut' });
        });

        // Pulse glow
        this.tweens.add({ targets: titleGlow, alpha: { from: 0.12, to: 0.3 }, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        // Subtitle
        const sub = this.add.text(cx, titleY + 92, '— Bitcoin Arena Protocol —', {
            fontFamily: 'Cinzel',
            fontSize: '12px',
            color: '#c8a060',
            letterSpacing: 3,
        }).setOrigin(0.5).setAlpha(0).setDepth(3);
        this.tweens.add({ targets: sub, alpha: 0.7, duration: 700, delay: 650, ease: 'Sine.easeOut' });

        // Divider
        const div = this.add.graphics().setDepth(3).setAlpha(0);
        div.lineStyle(1, 0xf5a623, 0.3);
        div.beginPath();
        div.moveTo(cx - 170, titleY + 112);
        div.lineTo(cx + 170, titleY + 112);
        div.strokePath();
        this.tweens.add({ targets: div, alpha: 1, duration: 600, delay: 700 });

        // ── User badge ──
        const user = JSON.parse(localStorage.getItem('dts_user') || '{}');
        const isLoggedIn = !!user.username;

        const badge = this.add.text(cx, H * 0.4, isLoggedIn ? `⚡ ${user.username}` : '⚡ Guest', {
            fontFamily: 'Cinzel',
            fontSize: '13px',
            color: isLoggedIn ? '#ffd700' : '#6b5a30',
            stroke: '#000',
            strokeThickness: 2,
        }).setOrigin(0.5).setAlpha(0).setDepth(3);
        this.tweens.add({ targets: badge, alpha: 0.8, duration: 600, delay: 850 });
        this.tweens.add({ targets: badge, y: badge.y + 5, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        // ── Buttons ──
        // Palette: gold border for primary, muted warm white for secondary
        const btnDefs = [
            { label: 'START GAME', borderCol: 0xf5a623, textCol: '#ffd700',  hoverCol: '#fff0a0', action: () => this.scene.start('GameScene') },
            { label: 'ONLINE 1v1', borderCol: 0xf56b23, textCol: '#ff8040',  hoverCol: '#ffaa70', action: () => window.location.href = 'online.html' },
            { label: 'TOURNAMENT', borderCol: 0xd4883a, textCol: '#e8a050',  hoverCol: '#ffd090', action: () => window.open('tournament/join.html', '_blank') },
            { label: 'SOLO MODE',  borderCol: 0x9a7a40, textCol: '#c8a060',  hoverCol: '#e8d090', action: () => window.open('solo.html', '_self') },
            {
                label: isLoggedIn ? 'LOGOUT' : 'LOGIN',
                borderCol: 0x4a3a20, textCol: '#6b5a30', hoverCol: isLoggedIn ? '#ef6644' : '#c8a060',
                action: () => {
                    if (isLoggedIn) { localStorage.removeItem('dts_token'); localStorage.removeItem('dts_user'); }
                    window.location.href = 'login.html';
                }
            },
        ];

        const btnStartY = H * 0.46;
        const btnGap    = 54;
        const btnW      = 270;
        const btnH      = 44;
        const cSz       = 9;

        btnDefs.forEach((def, i) => {
            const by    = btnStartY + i * btnGap;
            const delay = 300 + i * 90;
            const bx1   = cx - btnW / 2;
            const by1   = by - btnH / 2;
            const bx2   = cx + btnW / 2;
            const by2   = by + btnH / 2;

            // Fill bg
            const bgFill = this.add.graphics().setDepth(3).setAlpha(0);
            bgFill.fillStyle(def.borderCol, 0.07);
            bgFill.fillRect(bx1, by1, btnW, btnH);

            // Border
            const border = this.add.graphics().setDepth(3).setAlpha(0);
            border.lineStyle(1, def.borderCol, 0.3);
            border.strokeRect(bx1, by1, btnW, btnH);

            // Terminal corner accents
            const corners = this.add.graphics().setDepth(3).setAlpha(0);
            corners.lineStyle(2, def.borderCol, 0.85);
            const drawCorner = (ax, ay, dx, dy) => {
                corners.beginPath();
                corners.moveTo(ax, ay + dy * cSz);
                corners.lineTo(ax, ay);
                corners.lineTo(ax + dx * cSz, ay);
                corners.strokePath();
            };
            drawCorner(bx1, by1,  1,  1);
            drawCorner(bx2, by1, -1,  1);
            drawCorner(bx1, by2,  1, -1);
            drawCorner(bx2, by2, -1, -1);

            // Hover fill
            const hoverFill = this.add.graphics().setDepth(3).setAlpha(0);
            hoverFill.fillStyle(def.borderCol, 0.16);
            hoverFill.fillRect(bx1, by1, btnW, btnH);

            // Prompt
            const marker = this.add.text(bx1 + 14, by, '▸', {
                fontFamily: 'Cinzel', fontSize: '11px', color: def.textCol
            }).setOrigin(0, 0.5).setDepth(3).setAlpha(0);

            // Label
            const label = this.add.text(cx, by, def.label, {
                fontFamily: 'CinzelBold',
                fontSize: '18px',
                color: def.textCol,
                stroke: '#0a0500',
                strokeThickness: 3,
            }).setOrigin(0.5).setDepth(3).setAlpha(0);

            // Animate in from left
            [bgFill, border, corners, label, marker].forEach(obj => {
                obj.x -= 16;
                this.tweens.add({ targets: obj, x: obj.x + 16, alpha: 1, duration: 480, delay, ease: 'Back.easeOut' });
            });

            // Interaction
            const hit = this.add.rectangle(cx, by, btnW, btnH, 0x000000, 0)
                .setInteractive({ useHandCursor: true }).setDepth(4);

            hit.on('pointerover', () => {
                hoverFill.setAlpha(1);
                marker.setAlpha(1);
                label.setColor(def.hoverCol);
                corners.setAlpha(1);
                border.setAlpha(0.7);
                this.tweens.add({ targets: label, scaleX: 1.04, scaleY: 1.04, duration: 120, ease: 'Back.easeOut' });
            });
            hit.on('pointerout', () => {
                hoverFill.setAlpha(0);
                marker.setAlpha(0);
                label.setColor(def.textCol);
                border.setAlpha(0.5);
                this.tweens.add({ targets: label, scaleX: 1, scaleY: 1, duration: 120 });
            });
            hit.on('pointerdown', () => {
                this.tweens.add({
                    targets: label, scaleX: 0.93, scaleY: 0.93, duration: 80,
                    yoyo: true, ease: 'Quad.easeInOut',
                    onComplete: () => def.action()
                });
            });
        });

        // ── Genesis hash at bottom ──
        const hash = this.add.text(cx, H - 20,
            '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f',
            { fontFamily: 'Cinzel', fontSize: '8px', color: '#7a5a20', letterSpacing: 1 }
        ).setOrigin(0.5).setAlpha(0).setDepth(3);
        this.tweens.add({ targets: hash, alpha: 0.35, duration: 1000, delay: 1400 });
        this.tweens.add({ targets: hash, alpha: { from: 0.2, to: 0.45 }, duration: 3200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 2400 });
    }

    _injectParticleCanvas() {
        const existing = document.getElementById('menu-particle-canvas');
        if (existing) existing.remove();

        const canvas = document.createElement('canvas');
        canvas.id = 'menu-particle-canvas';
        canvas.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;`;
        document.body.insertBefore(canvas, document.body.firstChild);
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
        const ctx = canvas.getContext('2d');

        const BITCOIN_STRINGS = [
            'The Times 03/Jan/2009',
            'Chancellor on brink of second bailout for banks',
            '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b',
            '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f',
            'KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn',
            '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
            'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
            'nonce:2083236893  bits:486604799',
            'block:0  prev:0000...0000',
            'sha256d:genesis block',
        ];

        // Warm amber/gold palette only — no green
        const COLS_PAL = ['245,166,35', '200,130,40', '255,220,100', '160,100,30'];

        class Bit {
            constructor(init = false) { this.reset(init); }
            reset(init = false) {
                this.x = Math.random() * canvas.width;
                this.y = init ? Math.random() * canvas.height : canvas.height + 10;
                this.char = Math.random() < 0.78 ? (Math.random() < 0.5 ? '0' : '1') : (Math.random() < 0.5 ? '₿' : '⚡');
                this.size = 9 + Math.random() * 7;
                this.vy = -(0.12 + Math.random() * 0.5);
                this.vx = (Math.random() - 0.5) * 0.2;
                this.life = 0;
                this.maxLife = 200 + Math.random() * 200;
                this.col = COLS_PAL[Math.floor(Math.random() * COLS_PAL.length)];
                this.bright = Math.random() < 0.1;
            }
            tick() { this.life++; this.x += this.vx; this.y += this.vy; if (this.life >= this.maxLife || this.y < -20) this.reset(); }
            draw() {
                const p = this.life / this.maxLife;
                const a = (p < 0.15 ? p / 0.15 : p > 0.8 ? 1 - (p - 0.8) / 0.2 : 1) * (this.bright ? 0.75 : 0.22);
                ctx.save();
                ctx.globalAlpha = a;
                if (this.bright) { ctx.shadowColor = `rgba(${this.col},0.8)`; ctx.shadowBlur = 10; }
                ctx.fillStyle = `rgba(${this.col},1)`;
                ctx.font = `bold ${this.size}px 'Cinzel', serif`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(this.char, this.x, this.y);
                ctx.restore();
            }
        }

        class StrParticle {
            constructor(init = false) { this.reset(init); }
            reset(init = false) {
                this.text = BITCOIN_STRINGS[Math.floor(Math.random() * BITCOIN_STRINGS.length)];
                this.x = Math.random() * canvas.width;
                this.y = init ? Math.random() * canvas.height : canvas.height + 20;
                this.size = 7 + Math.random() * 3;
                this.vy = -(0.07 + Math.random() * 0.18);
                this.vx = (Math.random() - 0.5) * 0.1;
                this.life = 0;
                this.maxLife = 400 + Math.random() * 350;
                this.col = COLS_PAL[Math.floor(Math.random() * COLS_PAL.length)];
                this.maxA = 0.08 + Math.random() * 0.07;
            }
            tick() { this.life++; this.x += this.vx; this.y += this.vy; if (this.life >= this.maxLife || this.y < -20) this.reset(); }
            draw() {
                const p = this.life / this.maxLife;
                const a = (p < 0.1 ? p / 0.1 : p > 0.85 ? 1 - (p - 0.85) / 0.15 : 1) * this.maxA;
                ctx.save();
                ctx.globalAlpha = a;
                ctx.fillStyle = `rgba(${this.col},1)`;
                ctx.font = `${this.size}px 'Cinzel', serif`;
                ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
                ctx.fillText(this.text, this.x, this.y);
                ctx.restore();
            }
        }

        // Binary column rain — warm amber only
        const colW   = 18;
        const numCols = Math.floor(canvas.width / colW);
        const drops  = Array.from({ length: numCols }, (_, i) => ({
            x: i * colW + 9,
            y: Math.random() * canvas.height,
            speed: 0.4 + Math.random() * 0.9,
            alpha: 0.03 + Math.random() * 0.04,
        }));

        const bits = Array.from({ length: 85 }, () => new Bit(true));
        const strs = Array.from({ length: 14 }, () => new StrParticle(true));

        let animId;
        const loop = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drops.forEach(d => {
                ctx.save();
                ctx.globalAlpha = d.alpha;
                ctx.fillStyle = 'rgba(200,130,40,1)';
                ctx.font = `bold 11px 'Cinzel', serif`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(Math.random() < 0.5 ? '0' : '1', d.x, d.y);
                ctx.restore();
                d.y += d.speed;
                if (d.y > canvas.height + 20) d.y = -10;
            });
            strs.forEach(s => { s.tick(); s.draw(); });
            bits.forEach(b => { b.tick(); b.draw(); });
            animId = requestAnimationFrame(loop);
        };
        loop();

        this.events.once('shutdown', () => { cancelAnimationFrame(animId); canvas.remove(); });
        this.events.once('destroy',  () => { cancelAnimationFrame(animId); canvas.remove(); });
    }
}

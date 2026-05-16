export function playShitcoinerIntro(scene, done, options = {}) {
    const W = scene.scale.width;
    const H = scene.scale.height;
    const cx = W / 2;
    const cy = H / 2;
    const depth = options.depth || 320;
    const words = ["DON'T", "BE", "A", "SHITCOINER!"];
    const colors = ["#38bdf8", "#e2e8f0", "#f5a623", "#ffd700"];
    const introElements = [];

    const shade = scene.add.rectangle(0, 0, W, H, 0x000000, 0.72)
        .setOrigin(0, 0)
        .setDepth(depth);
    introElements.push(shade);

    const line = scene.add.rectangle(cx, cy + 72, 0, 2, 0xf5a623, 0.65)
        .setDepth(depth + 1);
    introElements.push(line);

    scene.tweens.add({
        targets: line,
        width: Math.min(520, W * 0.72),
        duration: 450,
        ease: "Expo.easeOut"
    });

    words.forEach((word, index) => {
        const delay = index * 520;
        const fontSize = W < 520
            ? (index === 3 ? "38px" : "54px")
            : (index === 3 ? "58px" : "72px");
        const text = scene.add.text(cx, -120, word, {
            fontFamily: "CinzelBold",
            fontSize,
            color: colors[index],
            stroke: "#000000",
            strokeThickness: 8,
            shadow: { offsetX: 0, offsetY: 0, color: colors[index], blur: 22, fill: true }
        }).setOrigin(0.5).setDepth(depth + 2).setAlpha(0).setScale(1.35);
        introElements.push(text);

        scene.time.delayedCall(delay, () => {
            scene.cameras.main.shake(120, 0.006 + index * 0.002);
            scene.tweens.add({
                targets: text,
                y: cy - 18,
                alpha: 1,
                scaleX: 1,
                scaleY: 1,
                duration: 360,
                ease: "Bounce.easeOut"
            });

            scene.time.delayedCall(360, () => {
                if (index < words.length - 1) {
                    scene.tweens.add({
                        targets: text,
                        y: cy + 95,
                        alpha: 0,
                        scaleX: 0.82,
                        scaleY: 0.82,
                        duration: 180,
                        ease: "Quad.easeIn"
                    });
                } else {
                    scene.tweens.add({
                        targets: text,
                        scaleX: 1.08,
                        scaleY: 1.08,
                        duration: 160,
                        yoyo: true,
                        repeat: 1,
                        ease: "Sine.easeInOut"
                    });
                }
            });
        });
    });

    scene.time.delayedCall(2520, () => {
        scene.cameras.main.flash(220, 245, 166, 35);
        scene.tweens.add({
            targets: introElements,
            alpha: 0,
            duration: 260,
            ease: "Quad.easeOut",
            onComplete: () => {
                introElements.forEach(el => { if (el && el.destroy) el.destroy(); });
                done();
            }
        });
    });
}

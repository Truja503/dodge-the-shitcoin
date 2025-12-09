
export function loadPlayerAssets(scene) {
    // IDLE (5 frames)
    for (let i = 1; i <= 5; i++) {
        scene.load.image(`idle_${i}`, `../assets/player1/idle_${i}.png`);
    }

    // MOVE (5 frames)
    for (let i = 1; i <= 5; i++) {
        scene.load.image(`move_${i}`, `../assets/player1/move_${i}.png`);
    }
}

export function createPlayerAnimations(scene) {

    // IDLE animation
    scene.anims.create({
        key: 'player_idle',
        frames: [
            { key: 'idle_1' },
            { key: 'idle_2' },
            { key: 'idle_3' },
            { key: 'idle_4' },
            { key: 'idle_5' },
        ],
        frameRate: 8,
        repeat: -1
    });

    // MOVE animation
    scene.anims.create({
        key: 'player_move',
        frames: [
            { key: 'move_1' },
            { key: 'move_2' },
            { key: 'move_3' },
            { key: 'move_4' },
            { key: 'move_5' },
        ],
        frameRate: 12,
        repeat: -1
    });
}

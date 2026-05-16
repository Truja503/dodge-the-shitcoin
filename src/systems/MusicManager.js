const GAME_MUSIC_KEY = "dts_bg_music";
const LETTERS_SFX_KEY = "dts_letters_sfx";
const HIT_SFX_KEY = "dts_hit_sfx";

function getAssetPath(fileName) {
    const prefix = window.location.pathname.includes("/tournament/") ? "../" : "";
    return `${prefix}assets/items/${fileName}`;
}

export function preloadGameMusic(scene) {
    if (!scene.cache.audio.exists(GAME_MUSIC_KEY)) {
        scene.load.audio(GAME_MUSIC_KEY, [getAssetPath("bg_music.mp3")]);
    }
}

export function preloadGameSfx(scene) {
    if (!scene.cache.audio.exists(LETTERS_SFX_KEY)) {
        scene.load.audio(LETTERS_SFX_KEY, [getAssetPath("letters.mp3")]);
    }

    if (!scene.cache.audio.exists(HIT_SFX_KEY)) {
        scene.load.audio(HIT_SFX_KEY, [getAssetPath("hit.mp3")]);
    }
}

export function startGameMusic(scene) {
    const play = () => {
        let music = window.__dtsGameMusic;

        if (!music || music.manager !== scene.sound) {
            music = scene.sound.add(GAME_MUSIC_KEY, {
                loop: true,
                volume: 0.42
            });
            window.__dtsGameMusic = music;
        }

        if (!music.isPlaying) {
            music.play();
        }

        return music;
    };

    if (!scene.cache.audio.exists(GAME_MUSIC_KEY)) return null;

    if (scene.sound.locked) {
        scene.sound.once(Phaser.Sound.Events.UNLOCKED, play);
        return window.__dtsGameMusic || null;
    }

    return play();
}

function playOneShot(scene, key, config = {}) {
    if (scene.sound.locked) return null;
    if (!scene.cache.audio.exists(key)) return null;

    return scene.sound.play(key, config);
}

export function playLettersSfx(scene) {
    return playOneShot(scene, LETTERS_SFX_KEY, { volume: 0.62 });
}

export function playHitSfx(scene) {
    return playOneShot(scene, HIT_SFX_KEY, { volume: 0.72 });
}

const GAMEPAD_DEADZONE = 0.22;
const THROW_BUTTONS = [0, 1, 2, 5, 7];
function valueOf(input) {
    if (input == null) return 0;
    if (typeof input === "number") return input;
    if (typeof input === "boolean") return input ? 1 : 0;
    if (typeof input.getValue === "function") return input.getValue();
    if (typeof input.value === "number") return input.value;
    if (input.pressed || input.isDown) return 1;
    return 0;
}

function isDown(input) {
    return valueOf(input) > 0.5;
}

function axisValue(pad, index) {
    if (!pad || !pad.axes) return 0;
    const raw = valueOf(pad.axes[index]);
    return Math.abs(raw) >= GAMEPAD_DEADZONE ? raw : 0;
}

function buttonDown(pad, index) {
    if (!pad || !pad.buttons) return false;
    return isDown(pad.buttons[index]);
}

function dpadValue(pad) {
    let x = 0;
    let y = 0;

    if (isDown(pad?.left) || buttonDown(pad, 14)) x -= 1;
    if (isDown(pad?.right) || buttonDown(pad, 15)) x += 1;
    if (isDown(pad?.up) || buttonDown(pad, 12)) y -= 1;
    if (isDown(pad?.down) || buttonDown(pad, 13)) y += 1;

    return { x, y };
}

export function getConnectedGamepads(scene) {
    const phaserPads = scene?.input?.gamepad?.gamepads || [];
    const pads = phaserPads.filter(Boolean);

    const rawPads = typeof navigator !== "undefined" && navigator.getGamepads
        ? Array.from(navigator.getGamepads()).filter(Boolean)
        : [];

    rawPads.forEach(rawPad => {
        if (!pads.some(pad => pad.index === rawPad.index)) pads.push(rawPad);
    });

    return pads.filter(pad => pad && pad.connected !== false);
}

export function getGamepadForPlayer(scene, playerIndex) {
    const pads = getConnectedGamepads(scene);
    return pads[playerIndex] || null;
}

export function readGamepadInput(pad, speed) {
    let x = axisValue(pad, 0);
    let y = axisValue(pad, 1);

    if (x === 0 && y === 0) {
        const dpad = dpadValue(pad);
        x = dpad.x;
        y = dpad.y;
    }

    if (x !== 0 && y !== 0) {
        x *= Math.SQRT1_2;
        y *= Math.SQRT1_2;
    }

    return {
        vx: x * speed,
        vy: y * speed,
        throwPressed: THROW_BUTTONS.some(index => buttonDown(pad, index)),
    };
}

export function readCursorInput(cursors, speed) {
    let x = 0;
    let y = 0;
    if (cursors?.left?.isDown) x -= 1;
    if (cursors?.right?.isDown) x += 1;
    if (cursors?.up?.isDown) y -= 1;
    if (cursors?.down?.isDown) y += 1;
    if (x !== 0 && y !== 0) {
        x *= Math.SQRT1_2;
        y *= Math.SQRT1_2;
    }
    return { vx: x * speed, vy: y * speed };
}

export function readWasdInput(keys, speed) {
    let x = 0;
    let y = 0;
    if (keys?.A?.isDown) x -= 1;
    if (keys?.D?.isDown) x += 1;
    if (keys?.W?.isDown) y -= 1;
    if (keys?.S?.isDown) y += 1;
    if (x !== 0 && y !== 0) {
        x *= Math.SQRT1_2;
        y *= Math.SQRT1_2;
    }
    return { vx: x * speed, vy: y * speed };
}

export function enableKeyboardCapture(scene) {
    const keyboard = scene?.input?.keyboard;
    if (!keyboard || typeof keyboard.addCapture !== "function") return;
    const keyCodes = globalThis.Phaser?.Input?.Keyboard?.KeyCodes;
    if (!keyCodes) return;
    keyboard.addCapture([
        keyCodes.UP, keyCodes.DOWN, keyCodes.LEFT, keyCodes.RIGHT,
        keyCodes.SPACE, keyCodes.W, keyCodes.A, keyCodes.S, keyCodes.D, keyCodes.E
    ]);
}

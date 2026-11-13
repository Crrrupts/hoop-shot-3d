// ---------- State ----------
let charging = false;
let power = 0;

// Power comes from how long the key has been held, measured with the
// browser's clock, not counted up frame by frame. So holding for the same
// time always gives the same power, even if the game drops frames.
let chargeStart = 0;            // when Space went down (milliseconds)
let chargeRate = 0;             // percent per second for this charge
function chargedPower(start, rate, now) {
    return Math.max(0, Math.min(100, (now - start) / 1000 * rate));
}
let lastTime = 0;

// Aim: -1 (left/down) to 1 (right/up), 0 = center
let aimX = 0;
let aimY = 0;

// Shooting spots
const TOTAL_SPOTS = 5;
let currentSpot = 3;                    // start at the top of the key (the easiest shot)

// Cameras
const CAMERAS = ['Shooter', 'Ball Follow', 'Orbit'];
let currentCamera = 0;

// Difficulty (1 = Easy, 2 = Medium, 3 = Hard)
// These numbers are starting values, we tune them later.
// Harder = faster meter and a stronger rival (see RIVALS in game.js).
// Easy also shows the golden aim dot. Hard hides the meter's green zone.
// The moving hoop is a power-up, not part of Hard.
const DIFFICULTY_SETTINGS = {
    // chargeSpeed = how fast the power meter fills, in percent per second
    1: { name: 'Easy',   chargeSpeed: 60 },
    2: { name: 'Medium', chargeSpeed: 80 },
    3: { name: 'Hard',   chargeSpeed: 110 }
};
let difficulty = 2;

const GAME_SECONDS = 120;
const gameCanvas = document.getElementById('game-canvas');
const diffSlider = document.getElementById('difficulty-slider');

// Game code can call this to read the current settings
function getDifficultySettings() {
    return DIFFICULTY_SETTINGS[difficulty];
}

// ---------- Keyboard ----------
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        // only charge while a game is running (not in menus or a power-up pick)
        const playing = typeof Game === 'undefined' || Game.state.mode === 'playing';
        if (!e.repeat && playing) {
            charging = true;
            chargeStart = e.timeStamp;
            // game.js sets chargeSpeedScale for the Steady Hands and Fast Meter power-ups
            chargeRate = getDifficultySettings().chargeSpeed * (window.chargeSpeedScale || 1);
        }
    }

    // A = previous spot, D = next spot (wraps around). Only in the sandbox:
    // in a match the game moves you on after 5 shots from each spot.
    const freeSpots = typeof Game === 'undefined' || Game.state.freeSpots;
    if (!e.repeat && freeSpots && e.code === 'KeyA') changeSpot(-1);
    if (!e.repeat && freeSpots && e.code === 'KeyD') changeSpot(1);

    // C = next camera
    if (!e.repeat && e.code === 'KeyC') switchCamera();

    // R = restart
    if (!e.repeat && e.code === 'KeyR') restartGame();
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        if (!charging) return;          // Space was not charging a shot
        charging = false;
        power = chargedPower(chargeStart, chargeRate, e.timeStamp);     // exactly how long it was held
        // Hand the shot to the game code (game.js)
        if (typeof window.onShoot === 'function') window.onShoot(power, aimX, aimY);
        power = 0;
        updatePowerMeter(power);
    }
});

// ---------- Spots ----------
function changeSpot(direction) {
    currentSpot += direction;
    if (currentSpot > TOTAL_SPOTS) currentSpot = 1;
    if (currentSpot < 1) currentSpot = TOTAL_SPOTS;
}

// ---------- Cameras ----------
function switchCamera() {
    currentCamera = (currentCamera + 1) % CAMERAS.length;
    updateCamera(CAMERAS[currentCamera]);
}

// ---------- Difficulty ----------
diffSlider.addEventListener('input', (e) => {
    difficulty = Number(e.target.value);
    diffSlider.blur(); // so Space and A/D keep working after using the slider
});

// ---------- Restart ----------
function restartGame() {
    // Input state
    charging = false;
    power = 0;
    currentSpot = 3;
    currentCamera = 0;
    charging2 = false;
    power2 = 0;
    aim2X = 0;
    aim2Y = 0;

    // HUD
    updateScore(0);
    updateStreak(0);
    updateTime(GAME_SECONDS);
    updateCamera(CAMERAS[currentCamera]);
    updatePowerMeter(0);

    // Let the game code (Justin's) reset ball, score and timer too
    if (typeof window.onRestart === 'function') window.onRestart();

}

// ---------- Aiming with a crosshair ----------
// Each player has a crosshair on the screen (canvas pixels). Putting it on
// the rim is perfect aim; main.js turns its position into aimX / aimY.
// After every shot it jumps to a random place, so you have to aim again.
// Player 1 moves it with the mouse, Player 2 with the arrow keys.
const crosshairs = [{ x: 400, y: 300 }, { x: 600, y: 300 }];

// The part of the canvas a player sees: everything, or one half in two-player
function viewRect(index) {
    const two = typeof Game !== 'undefined' && Game.state.twoPlayer;
    const w = gameCanvas.width, h = gameCanvas.height;
    if (!two) return { x: 0, y: 0, width: w, height: h };
    return { x: index === 0 ? 0 : w / 2, y: 0, width: w / 2, height: h };
}
function keepCrosshairInView(index) {
    const r = viewRect(index), c = crosshairs[index];
    c.x = Math.max(r.x + 8, Math.min(r.x + r.width - 8, c.x));
    c.y = Math.max(r.y + 8, Math.min(r.y + r.height - 8, c.y));
}

// Move a crosshair to a new place (main.js does this after every shot)
function moveCrosshair(index, x, y) {
    crosshairs[index].x = x;
    crosshairs[index].y = y;
    keepCrosshairInView(index);
    if (index === 0) {
        // remember how far the crosshair now is from the real mouse pointer
        drift.x = crosshairs[0].x - mouseSpot.x;
        drift.y = crosshairs[0].y - mouseSpot.y;
    }
}

// Player 1's mouse. There are two ways it can drive the crosshair:
//
// 1. Pointer lock (the normal way). The browser hides the pointer and keeps
//    it inside the game, and tells us only how far the mouse moved. The
//    pointer can never leave the game or hit the edge of the screen.
//    Press Esc to get the mouse back.
//
// 2. No lock (the browser refused, or you pressed Esc). The crosshair sits at
//    the mouse pointer plus a "drift". A jump after a shot sets the drift, and
//    the drift then fades away in about a second, so the crosshair always
//    comes back to the pointer and you can never get stuck.
const mouseSpot = { x: 400, y: 300 };       // where the real pointer is, in canvas pixels
const drift = { x: 0, y: 0 };               // crosshair minus pointer (only used without the lock)
let wantLock = false;                       // lock again at the next key or click (after a pick)

function pointerLocked() {
    return document.pointerLockElement === gameCanvas;
}
function lockPointer() {
    if (pointerLocked() || !gameCanvas.requestPointerLock) return;
    try {
        const asked = gameCanvas.requestPointerLock();
        if (asked && asked.catch) asked.catch(() => {});       // refused: we carry on without the lock
    } catch (e) { /* refused */ }
}
function unlockPointer() {
    if (pointerLocked()) document.exitPointerLock();
}

document.addEventListener('mousemove', (e) => {
    const rect = gameCanvas.getBoundingClientRect();
    if (pointerLocked()) {
        if (typeof Game === 'undefined' || Game.state.mode !== 'playing') return;
        crosshairs[0].x += e.movementX;
        crosshairs[0].y += e.movementY;
    } else {
        mouseSpot.x = e.clientX - rect.left;
        mouseSpot.y = e.clientY - rect.top;
        crosshairs[0].x = mouseSpot.x + drift.x;
        crosshairs[0].y = mouseSpot.y + drift.y;
    }
    keepCrosshairInView(0);
});

// Clicking the game locks the pointer. A match also locks it when it starts
// (main.js), except in the sandbox, where you need the mouse for the panel.
gameCanvas.addEventListener('mousedown', () => {
    if (typeof Game !== 'undefined' && Game.state.mode === 'playing') lockPointer();
});
// After a power-up pick the lock comes back at your next key press
document.addEventListener('keydown', () => {
    if (wantLock && typeof Game !== 'undefined' && Game.state.mode === 'playing') { wantLock = false; lockPointer(); }
});
// When the lock ends, carry on from where the crosshair is
document.addEventListener('pointerlockchange', () => {
    if (!pointerLocked()) { drift.x = 0; drift.y = 0; mouseSpot.x = crosshairs[0].x; mouseSpot.y = crosshairs[0].y; }
});

// ---------- Loop ----------
function inputLoop(time) {
    const dt = (time - lastTime) / 1000;
    lastTime = time;

    // Free the mouse whenever a match is not being played (menus, power-up picks, results)
    const playing = typeof Game !== 'undefined' && Game.state.mode === 'playing';
    if (!playing && pointerLocked()) { unlockPointer(); wantLock = true; }
    // Without the lock, the crosshair drifts back to the real pointer
    if (!pointerLocked() && (drift.x || drift.y)) {
        const keep = Math.exp(-Math.min(dt, 0.1) / 0.45);
        drift.x *= keep; drift.y *= keep;
        if (Math.abs(drift.x) < 0.5 && Math.abs(drift.y) < 0.5) { drift.x = 0; drift.y = 0; }
        crosshairs[0].x = mouseSpot.x + drift.x;
        crosshairs[0].y = mouseSpot.y + drift.y;
        keepCrosshairInView(0);
    }

    if (charging) {
        power = chargedPower(chargeStart, chargeRate, performance.now());
        updatePowerMeter(power);
    }
    requestAnimationFrame(inputLoop);
}
requestAnimationFrame(inputLoop);

// ---------- Player 2 (two-player mode, same keyboard) ----------
// Arrow keys: move the crosshair | hold Enter: power, release to shoot
let charging2 = false;
let power2 = 0;
let chargeStart2 = 0;           // Player 2's charge, timed the same way as Player 1's
let chargeRate2 = 0;
let aim2X = 0;                  // -1..1 like aimX / aimY (set by main.js from Player 2's crosshair)
let aim2Y = 0;
const AIM2_SPEED = 260;         // how fast the arrow keys move Player 2's crosshair (pixels per second)
const held2 = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false };

function twoPlayerPlaying() {
    return typeof Game !== 'undefined' && Game.state.twoPlayer && Game.state.mode === 'playing';
}

document.addEventListener('keydown', (e) => {
    if (typeof Game === 'undefined' || !Game.state.twoPlayer) return;
    if (e.code in held2 || e.code === 'Enter') e.preventDefault();      // no page scrolling or button presses
    if (!twoPlayerPlaying()) return;
    if (e.code in held2) held2[e.code] = true;
    if (e.code === 'Enter' && !e.repeat) {
        charging2 = true;
        chargeStart2 = e.timeStamp;
        chargeRate2 = getDifficultySettings().chargeSpeed * (window.chargeSpeedScale2 || 1);
    }
});

document.addEventListener('keyup', (e) => {
    if (e.code in held2) held2[e.code] = false;
    if (e.code === 'Enter') {
        if (!charging2) return;
        charging2 = false;
        power2 = chargedPower(chargeStart2, chargeRate2, e.timeStamp);
        if (typeof window.onShoot2 === 'function') window.onShoot2(power2, aim2X, aim2Y);
        power2 = 0;
        updatePowerMeter2(power2);
    }
});


let lastTime2 = 0;
function inputLoop2(time) {
    const dt = Math.min((time - lastTime2) / 1000, 0.1);
    lastTime2 = time;
    if (twoPlayerPlaying()) {
        // arrow keys slide Player 2's crosshair
        crosshairs[1].x += ((held2.ArrowRight ? 1 : 0) - (held2.ArrowLeft ? 1 : 0)) * AIM2_SPEED * dt;
        crosshairs[1].y += ((held2.ArrowDown ? 1 : 0) - (held2.ArrowUp ? 1 : 0)) * AIM2_SPEED * dt;
        keepCrosshairInView(1);
        if (charging2) {
            power2 = chargedPower(chargeStart2, chargeRate2, performance.now());
            updatePowerMeter2(power2);
        }
    }
    requestAnimationFrame(inputLoop2);
}
requestAnimationFrame(inputLoop2);

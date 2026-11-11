// ---------- State ----------
let charging = false;
let power = 0;
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
// Harder = faster meter, shakier aim and a stronger rival (see RIVALS in game.js).
// Easy also shows the aim arc. The moving hoop is now a power-up, not part of Hard.
const DIFFICULTY_SETTINGS = {
    1: { name: 'Easy',   chargeSpeed: 60,  aimWobble: 0.00 },
    2: { name: 'Medium', chargeSpeed: 80,  aimWobble: 0.02 },
    3: { name: 'Hard',   chargeSpeed: 110, aimWobble: 0.05 }
};
let difficulty = 2;

const GAME_SECONDS = 180;
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
        if (!e.repeat && playing) charging = true;
    }

    // A = previous spot, D = next spot (wraps around)
    if (!e.repeat && e.code === 'KeyA') changeSpot(-1);
    if (!e.repeat && e.code === 'KeyD') changeSpot(1);

    // C = next camera
    if (!e.repeat && e.code === 'KeyC') switchCamera();

    // R = restart
    if (!e.repeat && e.code === 'KeyR') restartGame();
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        if (!charging) return;          // Space was not charging a shot
        charging = false;
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
    updateSpot(currentSpot, TOTAL_SPOTS);
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
    currentSpot2 = 3;

    // HUD
    updateScore(0);
    updateStreak(0);
    updateTime(GAME_SECONDS);
    updateSpot(currentSpot, TOTAL_SPOTS);
    updateCamera(CAMERAS[currentCamera]);
    updatePowerMeter(0);

    // Let the game code (Justin's) reset ball, score and timer too
    if (typeof window.onRestart === 'function') window.onRestart();

}

// ---------- Mouse: aim ----------
gameCanvas.addEventListener('mousemove', (e) => {
    const rect = gameCanvas.getBoundingClientRect();
    // in two-player your view is the left half of the canvas
    const width = (typeof Game !== 'undefined' && Game.state.twoPlayer) ? rect.width / 2 : rect.width;
    aimX = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / width) * 2 - 1));
    aimY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
});

// ---------- Loop ----------
function inputLoop(time) {
    const dt = (time - lastTime) / 1000;
    lastTime = time;

    if (charging) {
        // game.js sets chargeSpeedScale for the Steady Hands and Fast Meter power-ups
        const scale = window.chargeSpeedScale || 1;
        power = Math.min(100, power + getDifficultySettings().chargeSpeed * scale * dt);
        updatePowerMeter(power);
    }
    requestAnimationFrame(inputLoop);
}
requestAnimationFrame(inputLoop);

// ---------- Player 2 (two-player mode, same keyboard) ----------
// Arrow keys: aim | hold Enter: power, release to shoot | J / L: change spot
let charging2 = false;
let power2 = 0;
let aim2X = 0;                  // -1..1 like aimX / aimY, moved with the arrow keys
let aim2Y = 0;
let currentSpot2 = 3;
const AIM2_SPEED = 0.9;         // how fast the arrow keys move the aim (per second)
const held2 = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false };

function twoPlayerPlaying() {
    return typeof Game !== 'undefined' && Game.state.twoPlayer && Game.state.mode === 'playing';
}

document.addEventListener('keydown', (e) => {
    if (typeof Game === 'undefined' || !Game.state.twoPlayer) return;
    if (e.code in held2 || e.code === 'Enter') e.preventDefault();      // no page scrolling or button presses
    if (!twoPlayerPlaying()) return;
    if (e.code in held2) held2[e.code] = true;
    if (e.code === 'Enter' && !e.repeat) charging2 = true;
    if (!e.repeat && e.code === 'KeyJ') changeSpot2(-1);
    if (!e.repeat && e.code === 'KeyL') changeSpot2(1);
});

document.addEventListener('keyup', (e) => {
    if (e.code in held2) held2[e.code] = false;
    if (e.code === 'Enter') {
        if (!charging2) return;
        charging2 = false;
        if (typeof window.onShoot2 === 'function') window.onShoot2(power2, aim2X, aim2Y);
        power2 = 0;
        updatePowerMeter2(power2);
    }
});

function changeSpot2(direction) {
    currentSpot2 += direction;
    if (currentSpot2 > TOTAL_SPOTS) currentSpot2 = 1;
    if (currentSpot2 < 1) currentSpot2 = TOTAL_SPOTS;
}

let lastTime2 = 0;
function inputLoop2(time) {
    const dt = Math.min((time - lastTime2) / 1000, 0.1);
    lastTime2 = time;
    if (twoPlayerPlaying()) {
        // arrow keys slide the aim; it stays where you leave it
        aim2X += ((held2.ArrowRight ? 1 : 0) - (held2.ArrowLeft ? 1 : 0)) * AIM2_SPEED * dt;
        aim2Y += ((held2.ArrowUp ? 1 : 0) - (held2.ArrowDown ? 1 : 0)) * AIM2_SPEED * dt;
        aim2X = Math.max(-1, Math.min(1, aim2X));
        aim2Y = Math.max(-1, Math.min(1, aim2Y));
        updateAim2(aim2X, aim2Y);
        if (charging2) {
            const scale = window.chargeSpeedScale2 || 1;
            power2 = Math.min(100, power2 + getDifficultySettings().chargeSpeed * scale * dt);
            updatePowerMeter2(power2);
        }
    }
    requestAnimationFrame(inputLoop2);
}
requestAnimationFrame(inputLoop2);

// ---------- State ----------
let charging = false;
let power = 0;
let lastTime = 0;

// Aim: -1 (left/down) to 1 (right/up), 0 = center
let aimX = 0;
let aimY = 0;

// Shooting spots
const TOTAL_SPOTS = 5;
let currentSpot = 1;

// Cameras
const CAMERAS = ['Shooter', 'Ball Follow', 'Orbit'];
let currentCamera = 0;

// Difficulty (1 = Easy, 2 = Medium, 3 = Hard)
// These numbers are starting values, we tune them later.
const DIFFICULTY_SETTINGS = {
    1: { name: 'Easy',   chargeSpeed: 60,  aimWobble: 0.00, movingHoop: false },
    2: { name: 'Medium', chargeSpeed: 80,  aimWobble: 0.02, movingHoop: false },
    3: { name: 'Hard',   chargeSpeed: 110, aimWobble: 0.05, movingHoop: true  }
};
let difficulty = 2;

const GAME_SECONDS = 60;
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
        if (!e.repeat) charging = true;
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
        charging = false;
        console.log('Shot power:', Math.round(power), 'aimX:', aimX.toFixed(2), 'aimY:', aimY.toFixed(2), 'spot:', currentSpot, 'camera:', CAMERAS[currentCamera], 'difficulty:', getDifficultySettings().name);
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
    console.log('Difficulty set to', getDifficultySettings().name, getDifficultySettings());
    diffSlider.blur(); // so Space and A/D keep working after using the slider
});

// ---------- Restart ----------
function restartGame() {
    // Input state
    charging = false;
    power = 0;
    currentSpot = 1;
    currentCamera = 0;

    // HUD
    updateScore(0);
    updateStreak(0);
    updateTime(GAME_SECONDS);
    updateSpot(currentSpot, TOTAL_SPOTS);
    updateCamera(CAMERAS[currentCamera]);
    updatePowerMeter(0);

    // Let the game code (Justin's) reset ball, score and timer too
    if (typeof window.onRestart === 'function') window.onRestart();

    console.log('Game restarted');
}

// ---------- Mouse: aim ----------
gameCanvas.addEventListener('mousemove', (e) => {
    const rect = gameCanvas.getBoundingClientRect();
    aimX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    aimY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
});

// ---------- Loop ----------
function inputLoop(time) {
    const dt = (time - lastTime) / 1000;
    lastTime = time;

    if (charging) {
        power = Math.min(100, power + getDifficultySettings().chargeSpeed * dt);
        updatePowerMeter(power);
    }
    requestAnimationFrame(inputLoop);
}
requestAnimationFrame(inputLoop);
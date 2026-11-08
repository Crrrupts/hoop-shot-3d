// DOM Elements
const menuOverlay = document.getElementById('menu-overlay');
const playBtn = document.getElementById('play-btn');
const startBtn = document.getElementById('start-btn');
const difficultySlider = document.getElementById('difficulty-slider');
const diffLabel = document.getElementById('diff-label');

const scoreDisplay = document.getElementById('score-display');
const streakDisplay = document.getElementById('streak-display');
const timeDisplay = document.getElementById('time-display');
const spotDisplay = document.getElementById('spot-display');
const cameraDisplay = document.getElementById('camera-display');
const powerBarFill = document.getElementById('power-bar-fill');

// Difficulty Mapping
const difficultyNames = {
    1: "Easy",
    2: "Medium",
    3: "Hard"
};

// Event Listeners for UI interaction
difficultySlider.addEventListener('input', (e) => {
    const val = e.target.value;
    diffLabel.textContent = difficultyNames[val];
});

// Hide the menu when the game starts
playBtn.addEventListener('click', startGame);
startBtn.addEventListener('click', startGame);

function startGame() {
    menuOverlay.style.display = 'none';

    // Note: Once the WebGL logic is ready, I will trigger the game loop here.
    // e.g., window.gameInstance.start();
}

// API Functions for the Game Loop
// Justin and Amit call these functions to update the UI when the ball scores or time passes.

function updateScore(points) {
    scoreDisplay.textContent = `SCORE ${points}`;
}

function updateStreak(count) {
    streakDisplay.textContent = `Streak x${count}`;
}

function updateTime(secondsLeft) {
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    timeDisplay.textContent = `TIME ${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function updateSpot(current, total) {
    spotDisplay.textContent = `Spot ${current} of ${total}`;
}

function updateCamera(cameraName) {
    cameraDisplay.textContent = `Camera: ${cameraName} (C to switch)`;
}

function updatePowerMeter(percentage) {
    // Ensures the fill stays within 0% and 100%
    const fill = Math.max(0, Math.min(percentage, 100));
    powerBarFill.style.height = `${fill}%`;
}

// --- TESTING ---
// updateScore(12);
// updateStreak(3);
// updatePowerMeter(65);
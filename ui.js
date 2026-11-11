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
const powerMeter = document.getElementById('power-bar-bg');
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
    difficultySlider.setAttribute('aria-valuetext', difficultyNames[val]);
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
    scoreDisplay.textContent = `YOU ${points}`;
}

// The rival's live score (top-left box and the label on the small rival view)
function updateRivalScore(points, name) {
    const label = `${(name || 'Rival').toUpperCase()} ${points}`;
    document.getElementById('rival-display').textContent = label;
    document.getElementById('rival-view-label').textContent = label;
}

// tierName is '', 'HEATING UP', 'ON FIRE' or 'INFERNO'; hint is e.g. "1 more for ON FIRE"
function updateStreak(count, tierName, hint) {
    streakDisplay.textContent = tierName ? `${tierName} x${count}` : `Streak x${count}`;
    streakDisplay.className = tierName ? 'tier-' + tierName.toLowerCase().replace(' ', '-') : '';
    document.getElementById('streak-hint').textContent = hint || '';
}

function updateTime(secondsLeft, overtime) {
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    timeDisplay.textContent = `${overtime ? 'OT' : 'TIME'} ${minutes}:${seconds.toString().padStart(2, '0')}`;
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
    powerMeter.setAttribute('aria-valuenow', fill);
}

// ---------- Match HUD: banner, toast, power-ups ----------

// Big text in the middle of the screen (streak tiers, overtime). kind picks the color.
const bannerEl = document.getElementById('banner');
let bannerTimer = null;
function showBanner(text, kind) {
    bannerEl.textContent = text;
    bannerEl.className = '';
    void bannerEl.offsetWidth;                  // restart the CSS animation
    bannerEl.className = 'show ' + (kind || '') + ' ' + text.toLowerCase().replace(' ', '-');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { bannerEl.className = ''; }, 1600);
}

// Small message near the top (the rival picked a card)
const toastEl = document.getElementById('toast');
let toastTimer = null;
function showToast(text, kind) {
    toastEl.textContent = text;
    toastEl.className = 'show ' + (kind || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.className = ''; }, 3000);
}

// Chips for the active power-ups. effects = [{ name, side, label }, ...]
const effectsEl = document.getElementById('effects-list');
let effectsShown = '';
function updateEffects(effects) {
    const html = effects.map((e) =>
        `<div class="effect ${e.side}">${e.name} <b>${e.label}</b></div>`).join('');
    if (html === effectsShown) return;          // nothing changed, leave the page alone
    effectsShown = html;
    effectsEl.innerHTML = html;
}

// Sweet Spot power-up: green band on the power meter from lo% to hi% (null hides it)
const sweetZoneEl = document.getElementById('sweet-zone');
function setSweetZone(zone) {
    if (!zone) { sweetZoneEl.style.display = 'none'; return; }
    sweetZoneEl.style.display = 'block';
    sweetZoneEl.style.bottom = zone.lo + '%';
    sweetZoneEl.style.height = Math.max(2, zone.hi - zone.lo) + '%';
}

// ---------- Power-up pick screen ----------
// game.js calls showPick(pick, choose). pick = { buff: card, sabotage: card }.
// The cards "spin" through the rarities like a slot machine, then land.
const pickOverlay = document.getElementById('pick-overlay');
const pickCards = { buff: document.getElementById('pick-buff'), sabotage: document.getElementById('pick-sabotage') };
const RARITY_NAMES = ['common', 'rare', 'epic', 'legendary', 'mythic'];
let pickChoose = null;
let pickSpinning = false;
let pickSpinTimer = null;

function fillCard(el, card, rarity, showDetails) {
    el.className = 'pick-card ' + rarity;
    el.querySelector('.pick-rarity').textContent = rarity.toUpperCase();
    el.querySelector('.pick-name').textContent = showDetails ? card.name : '?';
    el.querySelector('.pick-text').textContent = showDetails ? card.text : '';
}

function showPick(pick, choose) {
    pickChoose = choose;
    pickOverlay.style.display = 'flex';
    pickSpinning = true;
    let ticks = 0;
    clearInterval(pickSpinTimer);
    pickSpinTimer = setInterval(() => {
        ticks++;
        if (ticks < 10) {
            // still spinning: flash through the rarity colors
            fillCard(pickCards.buff, pick.buff, RARITY_NAMES[ticks % 4], false);
            fillCard(pickCards.sabotage, pick.sabotage, RARITY_NAMES[(ticks + 2) % 4], false);
        } else {
            // land on the real cards
            clearInterval(pickSpinTimer);
            fillCard(pickCards.buff, pick.buff, pick.buff.rarity, true);
            fillCard(pickCards.sabotage, pick.sabotage, pick.sabotage.rarity, true);
            pickCards.buff.classList.add('landed');
            pickCards.sabotage.classList.add('landed');
            pickSpinning = false;
        }
    }, 80);
    fillCard(pickCards.buff, pick.buff, 'common', false);
    fillCard(pickCards.sabotage, pick.sabotage, 'common', false);
}

function hidePick() {
    clearInterval(pickSpinTimer);
    pickSpinning = false;
    pickOverlay.style.display = 'none';
    pickChoose = null;
}

// fraction goes from 1 (8 seconds left) down to 0
function updatePickTimer(fraction) {
    document.getElementById('pick-timer-fill').style.width = (fraction * 100) + '%';
}

function choosePickCard(side) {
    if (!pickChoose || pickSpinning) return;    // wait for the cards to land
    pickChoose(side);
}
pickCards.buff.addEventListener('click', () => choosePickCard('buff'));
pickCards.sabotage.addEventListener('click', () => choosePickCard('sabotage'));
document.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'Digit1') choosePickCard('buff');
    if (e.code === 'ArrowRight' || e.code === 'Digit2') choosePickCard('sabotage');
});
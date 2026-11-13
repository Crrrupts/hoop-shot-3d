// ui.js — the HUD: score, streak, time, power meter, power-up pick screen,
// court picker and small effects. The menus are in menus.js.

// DOM Elements
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

// API Functions for the Game Loop
// Justin and Amit call these functions to update the UI when the ball scores or time passes.

// Scores count up instead of jumping. Each counter has the number on screen
// and the real number it is climbing toward.
const counters = {
    you:   { shown: 0, target: 0, show: (n) => { scoreDisplay.textContent = `${twoPlayerHud ? 'P1' : 'YOU'} ${n}`; } },
    rival: { shown: 0, target: 0, show: () => {} }      // filled in by updateRivalScore
};
setInterval(() => {
    for (const key in counters) {
        const c = counters[key];
        if (c.shown === c.target) continue;
        c.shown += c.shown < c.target ? 1 : c.target - c.shown;     // up one at a time; drop at once (new game)
        c.show(c.shown);
    }
}, 70);

function updateScore(points) {
    counters.you.target = points;
    if (points < counters.you.shown) { counters.you.shown = points; counters.you.show(points); }
}

// The rival's live score (top-left box and the label on the small rival view)
function updateRivalScore(points, name) {
    counters.rival.show = (n) => {
        const label = `${(name || 'Rival').toUpperCase()} ${n}`;
        document.getElementById('rival-display').textContent = label;
        document.getElementById('rival-view-label').textContent = label;
        document.getElementById('p2-score').textContent = label;
    };
    counters.rival.target = points;
    if (points <= counters.rival.shown) { counters.rival.shown = points; counters.rival.show(points); }
}

// tierName is '', 'HEATING UP', 'ON FIRE' or 'INFERNO'; hint is e.g. "1 more for ON FIRE"
function updateStreak(count, tierName, hint) {
    streakDisplay.textContent = tierName ? `${tierName} x${count}` : `Streak x${count}`;
    streakDisplay.className = tierName ? 'tier-' + tierName.toLowerCase().replace(' ', '-') : '';
    document.getElementById('streak-hint').textContent = hint || '';
    // glowing border around the screen that changes with the tier
    document.getElementById('glow').className = streakDisplay.className;
}

function updateTime(secondsLeft, overtime) {
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    timeDisplay.textContent = `${overtime ? 'OT' : 'TIME'} ${minutes}:${seconds.toString().padStart(2, '0')}`;
    // last 10 seconds: the timer turns red and pulses
    timeDisplay.className = secondsLeft <= 10 && secondsLeft > 0 ? 'urgent' : '';
    // two-player shows the clock in the middle
    const center = document.getElementById('time-center');
    center.textContent = `${overtime ? 'OT ' : ''}${minutes}:${seconds.toString().padStart(2, '0')}`;
    center.className = timeDisplay.className;
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
    // the meter pulses, faster near full
    powerMeter.className = fill > 75 ? 'pulse-fast' : fill > 0 ? 'pulse' : '';
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
// zone = { lo, hi } in percent, or null to hide: the green band on the
// meter, the power that scores for where you are aiming right now.
// which: 0 = your meter, 1 = Player 2's meter
function setSweetZone(zone, which) {
    const green = document.getElementById(which ? 'sweet-zone-2' : 'sweet-zone');
    green.style.display = zone ? 'block' : 'none';
    if (!zone) return;
    green.style.bottom = zone.lo + '%';
    green.style.height = Math.max(2, zone.hi - zone.lo) + '%';
}

// ---------- Crosshair and golden aim dot ----------
// index: 0 = you, 1 = Player 2. position = { x, y } in canvas pixels, or null to hide.
function showCrosshair(index, position) {
    placeMark(document.getElementById('crosshair-' + index), position);
}
function showAimDot(index, position) {
    placeMark(document.getElementById('aimdot-' + index), position);
}
function placeMark(el, position) {
    if (!position) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.style.left = position.x + 'px';
    el.style.top = position.y + 'px';
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
    pick2Overlay.style.display = 'none';
    pick2Choose = null;
}

// fraction goes from 1 (5 seconds left) down to 0
function updatePickTimer(fraction) {
    document.getElementById('pick-timer-fill').style.width = (fraction * 100) + '%';
    document.getElementById('pick2-timer-fill').style.width = (fraction * 100) + '%';
}

// ---------- Two-player pick screen ----------
// pick = { buff, sabotage (Player 1's cards), p2: { buff, sabotage } }
const pick2Overlay = document.getElementById('pick2-overlay');
let pick2Choose = null;
let pick2Spinning = false;

function smallCard(card, key) {
    return `<div class="pick-card small ${card.rarity}" data-side="${card.side}">` +
        `<span class="pick-side">${card.side === 'buff' ? 'BUFF FOR YOU' : 'SABOTAGE THEM'}</span>` +
        `<span class="pick-rarity">${card.rarity.toUpperCase()}</span>` +
        `<span class="pick-name">${card.name}</span><span class="pick-text">${card.text}</span>` +
        `<span class="pick-key">${key}</span></div>`;
}

function showPick2(pick, choose) {
    pick2Choose = choose;
    pick2Overlay.style.display = 'flex';
    document.querySelector('#pick2-player .pick2-cards').innerHTML =
        smallCard(pick.buff, 'Press 1') + smallCard(pick.sabotage, 'Press 2');
    document.querySelector('#pick2-rival .pick2-cards').innerHTML =
        smallCard(pick.p2.buff, 'Left arrow') + smallCard(pick.p2.sabotage, 'Right arrow');
    // a short pause before choosing, so a key held from shooting does not pick by accident
    pick2Spinning = true;
    setTimeout(() => { pick2Spinning = false; }, 800);
}

// Show which card a player locked in. who is 'player' or 'rival'.
function markPick2(who, side) {
    for (const el of document.querySelectorAll(`#pick2-${who} .pick-card`)) {
        el.classList.add(el.dataset.side === side ? 'chosen' : 'not-chosen');
    }
}

// ---------- Two-player HUD ----------
// Player 2's power meter, aim marker, power-ups and streak
function updatePowerMeter2(percentage) {
    const fill = Math.max(0, Math.min(percentage, 100));
    document.getElementById('power-bar-fill-2').style.height = `${fill}%`;
}

let effects2Shown = '';
function updateEffects2(effects) {
    const html = effects.map((e) =>
        `<div class="effect ${e.side}">${e.name} <b>${e.label}</b></div>`).join('');
    if (html === effects2Shown) return;
    effects2Shown = html;
    document.getElementById('effects-list-2').innerHTML = html;
}

function updateStreak2(count, tierName) {
    const el = document.getElementById('p2-streak');
    el.textContent = tierName ? `${tierName} x${count}` : `Streak x${count}`;
    el.className = tierName ? 'tier-' + tierName.toLowerCase().replace(' ', '-') : '';
}

// Switch the HUD between one-player and two-player layouts (style.css does the moving)
let twoPlayerHud = false;
function setTwoPlayer(on) {
    twoPlayerHud = on;
    document.getElementById('ui-layer').classList.toggle('two-player', on);
    updateEffects2([]);
    counters.you.show(counters.you.shown);
}

function choosePickCard(side) {
    if (!pickChoose || pickSpinning) return;    // wait for the cards to land
    pickChoose(side);
}
pickCards.buff.addEventListener('click', () => choosePickCard('buff'));
pickCards.sabotage.addEventListener('click', () => choosePickCard('sabotage'));
document.addEventListener('keydown', (e) => {
    if (pick2Choose) {
        // two-player: Player 1 uses 1 / 2, Player 2 uses the arrow keys
        if (pick2Spinning) return;
        if (e.code === 'Digit1') pick2Choose('buff', Game.player);
        if (e.code === 'Digit2') pick2Choose('sabotage', Game.player);
        if (e.code === 'ArrowLeft') pick2Choose('buff', Game.rival);
        if (e.code === 'ArrowRight') pick2Choose('sabotage', Game.rival);
        return;
    }
    if (e.code === 'ArrowLeft' || e.code === 'Digit1') choosePickCard('buff');
    if (e.code === 'ArrowRight' || e.code === 'Digit2') choosePickCard('sabotage');
});

// ---------- Court picker (menu) and wind display ----------
const courtSelect = document.getElementById('court-select');
const courtBlurb = document.getElementById('court-blurb');
for (const court of Courts.LIST) {
    const option = document.createElement('option');
    option.value = court.id;
    option.textContent = `${court.name} (${court.difficulty})`;
    courtSelect.appendChild(option);
}
function showCourt(court) {
    courtSelect.value = court.id;
    courtBlurb.textContent = court.blurb;
    document.getElementById('court-display').textContent = court.name;
    // style the scoreboard to match the court (see SCOREBOARDS in courts.js)
    const layer = document.getElementById('ui-layer'), board = court.look.scoreboard;
    layer.style.setProperty('--sb-bg', board.bg);
    layer.style.setProperty('--sb-text', board.text);
    layer.style.setProperty('--sb-accent', board.accent);
    layer.style.setProperty('--sb-border', board.border);
    layer.style.setProperty('--sb-font', board.font);
    layer.style.setProperty('--sb-glow', board.glow);
}
showCourt(Courts.LIST[0]);          // the first court is the default
courtSelect.addEventListener('change', () => {
    window.gameInstance.setCourt(courtSelect.value);    // game.js loads the court
    courtSelect.blur();                                 // so the keys go back to the game
});

// Wind for the spot you are standing on. side: push to your right (+) or
// left (-); along: tailwind (+) or headwind (-). Both in m/s^2.
let windShown = '';
function updateWind(side, along) {
    let text = '';
    if (Math.abs(side) > 0.03 || Math.abs(along) > 0.03) {
        const arrows = Math.min(3, 1 + Math.floor(Math.abs(side) / 0.15));
        text = 'WIND ';
        if (Math.abs(side) > 0.03) text += (side > 0 ? '\u2192' : '\u2190').repeat(arrows) + ' ';
        if (along > 0.08) text += 'tailwind';
        if (along < -0.08) text += 'headwind';
    }
    if (text === windShown) return;
    windShown = text;
    document.getElementById('wind-display').textContent = text;
}


// ---------- Game feel: hype meter, floating text, screen flash ----------

// fraction is 0..1
let hypeShown = -1;
function updateHype(fraction) {
    const percent = Math.round(fraction * 100);
    if (percent === hypeShown) return;
    hypeShown = percent;
    document.getElementById('hype-fill').style.width = percent + '%';
}

// Text that floats up from a spot on the screen and fades (x, y in canvas pixels).
// kind: 'points', 'swish', 'bank', 'close' or 'bad' (sets the color in style.css)
const popupsEl = document.getElementById('popups');
function showPopup(text, x, y, kind) {
    const el = document.createElement('div');
    el.className = 'popup ' + (kind || '');
    el.textContent = text;
    el.style.left = Math.max(40, Math.min(760, x)) + 'px';
    el.style.top = Math.max(60, Math.min(560, y)) + 'px';
    popupsEl.appendChild(el);
    setTimeout(() => el.remove(), 1100);
}

// A quick flash over the whole screen. color: 'white', 'orange' or 'gold'
const flashEl = document.getElementById('flash');
function flashScreen(color) {
    flashEl.className = '';
    void flashEl.offsetWidth;                   // restart the CSS animation
    flashEl.className = 'show ' + color;
}

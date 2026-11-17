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

// "Spot 2, shot 3 of 5". shot is 0 in the sandbox (free movement).
// moneySpot is your money spot (0 = none); onMoney = you are standing on it.
function updateSpot(current, total, shot, perSpot, moneySpot, onMoney) {
    let text = shot ? `Spot ${current}, shot ${shot} of ${perSpot}` : `Spot ${current} of ${total}`;
    // the money spot goes on its own line (style.css keeps the line break)
    if (onMoney) text += '\nMONEY SPOT: makes x2';
    else if (moneySpot) text += `\nMoney spot: ${moneySpot}`;
    spotDisplay.textContent = text;
    spotDisplay.className = onMoney ? 'on-money' : '';
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
    // Restart the CSS animation: take the class off, and put it back on the
    // next frame. (Reading offsetWidth would also work, but it makes the
    // browser lay out the whole page in the middle of a frame, which was slow.)
    bannerEl.className = '';
    requestAnimationFrame(() => { bannerEl.className = 'show ' + (kind || '') + ' ' + text.toLowerCase().replace(' ', '-'); });
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
// Each card spins like a slot-machine reel: it flicks through rarities fast,
// slows down, teases one rarity higher, then lands (PowerUps.reelFrames). The
// left card lands first, then the right. Every flick ticks; a landing card
// glows in its rarity's color, and rare or better cards flash with a fanfare.
// A card can be chosen as soon as it has landed. The whole spin takes
// 1.5 seconds of the 5 second pick.
const pickOverlay = document.getElementById('pick-overlay');
const pickCards = { buff: document.getElementById('pick-buff'), sabotage: document.getElementById('pick-sabotage') };
const RARITY_NAMES = ['common', 'rare', 'epic', 'legendary', 'mythic'];
const REEL_LAND = [1.0, 1.5];           // seconds until the left and right cards land
let pickChoose = null;
let reelTimers = [];                    // so a new pick or hiding the screen stops old spins

function stopReels() {
    for (const t of reelTimers) clearTimeout(t);
    reelTimers = [];
}

// Show a card at one frame of its spin. While spinning it shows a random
// card name of that rarity flicking past; a tease shows "???".
function fillCard(el, card, rarity, frame) {
    el.className = 'pick-card' + (el.classList.contains('small') ? ' small' : '') + ' ' + rarity;
    el.querySelector('.pick-rarity').textContent = rarity.toUpperCase();
    const text = el.querySelector('.pick-text');
    if (frame === 'landed') {
        el.querySelector('.pick-name').textContent = card.name;
        text.textContent = card.text;
        el.classList.add('landed', 'glow-' + rarity);
        if (RARITY_NAMES.indexOf(rarity) >= 1) el.classList.add('jackpot');      // rare or better
    } else {
        const others = PowerUps.LIST.filter((c) => c.side === card.side && c.rarity === rarity);
        el.querySelector('.pick-name').textContent = frame === 'tease' || !others.length ? '???'
            : others[Math.floor(Math.random() * others.length)].name;
        text.textContent = '';
        el.classList.add('spinning');
    }
}

// Spin one card element and land it on `card` after `landAt` seconds.
function spinReel(el, card, landAt, onLand) {
    el.dataset.landed = '';
    fillCard(el, card, 'common', 'spin');
    for (const frame of PowerUps.reelFrames(card.rarity, landAt)) {
        reelTimers.push(setTimeout(() => {
            if (frame.landed) {
                fillCard(el, card, card.rarity, 'landed');
                el.dataset.landed = 'yes';
                playSound('land');
                const rank = RARITY_NAMES.indexOf(card.rarity);
                if (rank >= 1) playSound('fanfare', { rarity: card.rarity });
                if (rank === 2) flashScreen('purple');
                if (rank >= 3) flashScreen('gold');
                if (onLand) onLand();
            } else {
                fillCard(el, card, frame.rarity, frame.tease ? 'tease' : 'spin');
                playSound('reel');
            }
        }, frame.at * 1000));
    }
}

function showPick(pick, choose) {
    stopReels();
    pickChoose = choose;
    pickOverlay.style.display = 'flex';
    spinReel(pickCards.buff, pick.buff, REEL_LAND[0]);
    spinReel(pickCards.sabotage, pick.sabotage, REEL_LAND[1]);
}

function hidePick() {
    stopReels();
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

function choosePickCard(side) {
    if (!pickChoose || pickCards[side].dataset.landed !== 'yes') return;     // wait for that card to land
    pickChoose(side);
}
pickCards.buff.addEventListener('click', () => choosePickCard('buff'));
pickCards.sabotage.addEventListener('click', () => choosePickCard('sabotage'));
document.addEventListener('keydown', (e) => {
    if (pick2Choose) {
        // two-player: Player 1 uses 1 / 2, Player 2 uses the arrow keys
        const pickFor = (who, side) => {
            const el = document.querySelector(`#pick2-${who === Game.player ? 'player' : 'rival'} .pick-card[data-side="${side}"]`);
            if (el && el.dataset.landed === 'yes') pick2Choose(side, who);
        };
        if (e.code === 'Digit1') pickFor(Game.player, 'buff');
        if (e.code === 'Digit2') pickFor(Game.player, 'sabotage');
        if (e.code === 'ArrowLeft') pickFor(Game.rival, 'buff');
        if (e.code === 'ArrowRight') pickFor(Game.rival, 'sabotage');
        return;
    }
    if (e.code === 'ArrowLeft' || e.code === 'Digit1') choosePickCard('buff');
    if (e.code === 'ArrowRight' || e.code === 'Digit2') choosePickCard('sabotage');
});

// ---------- Two-player pick screen ----------
// pick = { buff, sabotage (Player 1's cards), p2: { buff, sabotage } }
// Both players' cards spin at once, the left ones landing first.
const pick2Overlay = document.getElementById('pick2-overlay');
let pick2Choose = null;

function smallCard(card, key) {
    return `<div class="pick-card small ${card.rarity}" data-side="${card.side}">` +
        `<span class="pick-side">${card.side === 'buff' ? 'BUFF FOR YOU' : 'SABOTAGE THEM'}</span>` +
        `<span class="pick-rarity"></span><span class="pick-name"></span><span class="pick-text"></span>` +
        `<span class="pick-key">${key}</span></div>`;
}

function showPick2(pick, choose) {
    stopReels();
    pick2Choose = choose;
    pick2Overlay.style.display = 'flex';
    const p1 = document.querySelector('#pick2-player .pick2-cards'), p2 = document.querySelector('#pick2-rival .pick2-cards');
    p1.innerHTML = smallCard(pick.buff, 'Press 1') + smallCard(pick.sabotage, 'Press 2');
    p2.innerHTML = smallCard(pick.p2.buff, 'Left arrow') + smallCard(pick.p2.sabotage, 'Right arrow');
    spinReel(p1.children[0], pick.buff, REEL_LAND[0]);
    spinReel(p1.children[1], pick.sabotage, REEL_LAND[1]);
    spinReel(p2.children[0], pick.p2.buff, REEL_LAND[0]);
    spinReel(p2.children[1], pick.p2.sabotage, REEL_LAND[1]);
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
    flashEl.className = '';                     // restart the CSS animation (see showBanner)
    requestAnimationFrame(() => { flashEl.className = 'show ' + color; });
}


// ---------- Fan meter ----------
// value is -1..1: +1 = the crowd is all for the left player (you / Player 1),
// -1 = all for the right player (the rival / Player 2).
let fansShown = '';
function updateFans(value, leftName, rightName) {
    const key = value.toFixed(3) + leftName + rightName;
    if (key === fansShown) return;                  // nothing changed
    fansShown = key;
    document.getElementById('fan-left').textContent = leftName;
    document.getElementById('fan-right').textContent = rightName.toUpperCase();
    const at = 50 - value * 50;                     // percent from the left edge
    document.getElementById('fan-marker').style.left = at + '%';
    // the fill runs from the middle to the marker, green toward you and red toward the rival
    const fill = document.getElementById('fan-fill');
    fill.style.left = Math.min(at, 50) + '%';
    fill.style.width = Math.abs(at - 50) + '%';
    fill.className = value >= 0 ? 'left' : 'right';
    document.getElementById('fan-meter').className = Math.abs(value) >= 0.999 ? 'full' : '';
}


// ---------- Race bar ----------
// Both scores at the top of the screen. The bar is split by each player's
// share of the points (half and half at 0-0), and the label says who leads.
function updateRace(left, right, leftName, rightName) {
    document.getElementById('race-left').textContent = left;
    document.getElementById('race-right').textContent = right;
    const share = (left + 1) / (left + right + 2);          // +1 each so 0-0 is an even split
    document.getElementById('race-fill').style.width = (share * 100) + '%';
    const lead = document.getElementById('race-lead');
    if (left === right) { lead.textContent = 'TIED'; lead.className = ''; }
    else if (left > right) { lead.textContent = `${leftName} +${left - right}`; lead.className = 'left'; }
    else { lead.textContent = `${rightName.toUpperCase()} +${right - left}`; lead.className = 'right'; }
}

// ---------- Match modifier (the third reel) ----------
// At one pick per match a third reel spins above the cards, lands on the
// modifier, and then its name and effect stay at the bottom of the screen.
// It keeps spinning even if a card is picked first. There is nothing to choose.
const modifierReel = document.getElementById('modifier-reel');
const modifierChip = document.getElementById('modifier-chip');
const MODIFIER_LAND = 2.2;              // seconds: after both cards have landed
let modifierTimers = [];
function showModifierReel(modifier) {
    modifierTimers.forEach(clearTimeout);
    modifierTimers = [];
    const name = document.getElementById('modifier-reel-name');
    const text = document.getElementById('modifier-reel-text');
    modifierReel.className = 'spinning';
    modifierReel.style.display = 'block';
    text.textContent = '';
    // flick through '???' and the modifier names, slowing down, like the cards
    const names = Modifiers.LIST.map((m) => m.name).concat(['???']);
    let at = 0, gap = 0.06, i = 0;
    while (at < MODIFIER_LAND - 0.25) {
        const shown = names[i++ % names.length];
        modifierTimers.push(setTimeout(() => { name.textContent = shown; playSound('reel'); }, at * 1000));
        at += gap;
        gap *= 1.18;
    }
    modifierTimers.push(setTimeout(() => {
        modifierReel.className = 'landed';
        name.textContent = modifier.name;
        text.textContent = modifier.text;
        playSound('land');
        playSound('fanfare', { rarity: 'epic' });
        flashScreen('purple');
    }, MODIFIER_LAND * 1000));
    // after a few seconds the big reel goes and the small line stays
    modifierTimers.push(setTimeout(() => {
        modifierReel.style.display = 'none';
        showModifier(modifier);
    }, (MODIFIER_LAND + 3.5) * 1000));
}
// The line at the bottom of the screen (null hides it, e.g. at a new match)
function showModifier(modifier) {
    if (!modifier) {
        modifierTimers.forEach(clearTimeout);
        modifierTimers = [];
        modifierReel.style.display = 'none';
        modifierChip.style.display = 'none';
        return;
    }
    modifierChip.textContent = `MODIFIER: ${modifier.name} - ${modifier.text}`;
    modifierChip.style.display = 'block';
}

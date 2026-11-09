// game.js — game states, shooting, scoring and the timer (Justin)
//
// States: 'menu' -> 'playing' -> 'gameover'.
// Reads input from Amit's input.js (currentSpot, aimX/aimY, power,
// getDifficultySettings) and writes to Bom's HUD (updateScore, updateTime, ...).
// Needs physics.js loaded first.

const Game = (function () {

    const GAME_LENGTH = 60;             // seconds
    const RELEASE_HEIGHT = 2.1;         // ball leaves the hands above the head

    // 5 shooting spots on an arc around the hoop. angle is measured from
    // straight out (+z); negative = the shooter's left. Corners are worth 3.
    const SPOTS = [
        { angle: -70, dist: 5.5, points: 3 },   // 1 left corner
        { angle: -40, dist: 4.8, points: 2 },   // 2 left wing
        { angle:   0, dist: 4.6, points: 2 },   // 3 top (free throw)
        { angle:  40, dist: 4.8, points: 2 },   // 4 right wing
        { angle:  70, dist: 5.5, points: 3 }    // 5 right corner
    ];

    // How power and aim turn into a throw
    const MIN_SPEED = 6.0;              // m/s at 0% power
    const MAX_SPEED = 9.0;              // m/s at 100% power
    const BASE_ARC = 52;                // degrees, mouse at the center
    const ARC_RANGE = 12;               // mouse up/down changes the arc +/- this
    const YAW_RANGE = 8;                // mouse left/right turns the shot +/- this
    const ON_FIRE_STREAK = 3;           // 3 in a row = +1 bonus per basket

    // Hard mode: hoop slides side to side
    const HOOP_SWING = 1.0;             // meters each way
    const HOOP_SPEED = 0.9;             // radians per second

    const state = {
        mode: 'menu',
        score: 0,
        streak: 0,
        bestStreak: 0,
        made: 0,
        attempts: 0,
        timeLeft: GAME_LENGTH,
        spot: 1,
        shotDir: [0, 0, -1],            // horizontal direction of the last throw (for the follow camera)
        lastShotPoints: 0,
        hoopClock: 0
    };

    // ---------- Helpers that talk to teammates' code (safe if it isn't loaded) ----------
    function hud(fn, ...args) {
        if (typeof window !== 'undefined' && typeof window[fn] === 'function') window[fn](...args);
        else if (typeof globalThis[fn] === 'function') globalThis[fn](...args);
    }
    function sound(name) { hud('playSound', name); }
    function difficulty() {
        if (typeof getDifficultySettings === 'function') return getDifficultySettings();
        return { name: 'Medium', aimWobble: 0.02, movingHoop: false };
    }
    function inputSpot() {
        return (typeof currentSpot !== 'undefined') ? currentSpot : state.spot;
    }

    // ---------- Shot math ----------
    function spotPosition(spotNumber) {
        const s = SPOTS[spotNumber - 1];
        const a = s.angle * Math.PI / 180;
        return [Math.sin(a) * s.dist, RELEASE_HEIGHT, Math.cos(a) * s.dist];
    }

    // power 0..100, aimX/aimY -1..1, wobble in radians (random error on hard)
    function shotVelocity(spotNumber, power, aimX, aimY, wobble) {
        const start = spotPosition(spotNumber);
        wobble = wobble || 0;
        // face the hoop's home position (the moving hoop is the challenge)
        let yaw = Math.atan2(-start[0], -start[2]);
        yaw += aimX * YAW_RANGE * Math.PI / 180 + (Math.random() * 2 - 1) * wobble;
        let pitch = (BASE_ARC + aimY * ARC_RANGE) * Math.PI / 180 + (Math.random() * 2 - 1) * wobble;
        const speed = MIN_SPEED + (Math.max(0, Math.min(power, 100)) / 100) * (MAX_SPEED - MIN_SPEED);
        const h = Math.cos(pitch) * speed;
        return [Math.sin(yaw) * h, Math.sin(pitch) * speed, Math.cos(yaw) * h];
    }

    // ---------- Game flow ----------
    function resetBall() {
        state.spot = inputSpot();
        Physics.placeBall(spotPosition(state.spot));
    }

    function start() {
        state.mode = 'playing';
        state.score = 0;
        state.streak = 0;
        state.bestStreak = 0;
        state.made = 0;
        state.attempts = 0;
        state.timeLeft = GAME_LENGTH;
        state.hoopClock = 0;
        Physics.setHoopOffset(0, 0);
        resetBall();
        hud('updateScore', 0);
        hud('updateStreak', 0);
        hud('updateTime', GAME_LENGTH);
        showMenu(false);
    }

    // Called by input.js when Space is released
    function shoot(power, aimX, aimY) {
        if (state.mode !== 'playing' || Physics.ball.inFlight || state.timeLeft <= 0) return;
        resetBall();                    // make sure the ball is at the current spot
        const vel = shotVelocity(state.spot, power, aimX, aimY, difficulty().aimWobble);
        const hs = Math.hypot(vel[0], vel[2]) || 1;
        state.shotDir = [vel[0] / hs, 0, vel[2] / hs];
        state.attempts++;
        Physics.launch(vel);
        sound('shoot');
    }

    Physics.onBasket = function (info) {
        state.streak++;
        state.made++;
        state.bestStreak = Math.max(state.bestStreak, state.streak);
        let points = SPOTS[state.spot - 1].points;
        if (state.streak >= ON_FIRE_STREAK) points += 1;
        state.lastShotPoints = points;
        state.score += points;
        hud('updateScore', state.score);
        hud('updateStreak', state.streak);
        sound(info.swish ? 'swish' : 'score');
    };

    Physics.onBounce = function (surface) {
        sound(surface);                 // 'rim', 'board', 'floor', 'pole'
    };

    function endShot() {
        if (!Physics.scored) {
            state.streak = 0;
            hud('updateStreak', 0);
        }
        if (state.timeLeft <= 0) gameOver();
        else resetBall();
    }

    function gameOver() {
        state.mode = 'gameover';
        Physics.placeBall(spotPosition(state.spot));
        sound('buzzer');
        showMenu(true);
    }

    function showMenu(show) {
        if (typeof document === 'undefined') return;
        const overlay = document.getElementById('menu-overlay');
        if (!overlay) return;
        overlay.style.display = show ? 'flex' : 'none';
        if (show && state.mode === 'gameover') {
            const pct = state.attempts ? Math.round(100 * state.made / state.attempts) : 0;
            document.getElementById('menu-title').textContent = 'Game Over';
            document.getElementById('menu-subtitle').textContent =
                `Final score ${state.score} | ${state.made}/${state.attempts} shots (${pct}%) | best streak ${state.bestStreak}`;
            document.getElementById('play-btn').textContent = 'Play Again';
        }
    }

    // Called every frame by main.js
    function update(dt) {
        if (state.mode === 'playing') {
            // timer (the last shot in the air still counts — buzzer beater)
            if (state.timeLeft > 0) {
                const before = Math.ceil(state.timeLeft);
                state.timeLeft = Math.max(0, state.timeLeft - dt);
                if (Math.ceil(state.timeLeft) !== before) hud('updateTime', Math.ceil(state.timeLeft));
                if (state.timeLeft <= 0 && !Physics.ball.inFlight) gameOver();
            }

            // moving hoop on hard
            if (difficulty().movingHoop) {
                state.hoopClock += dt;
                Physics.setHoopOffset(HOOP_SWING * Math.sin(state.hoopClock * HOOP_SPEED), 0);
            } else {
                Physics.setHoopOffset(0, 0);
            }

            // follow A/D spot changes while holding the ball
            if (!Physics.ball.inFlight && inputSpot() !== state.spot) resetBall();
        }

        Physics.update(dt);
        if (Physics.shotOver()) endShot();
    }

    // ---------- Hooks for teammates' code ----------
    if (typeof window !== 'undefined') {
        window.onShoot = shoot;                 // input.js calls this on Space release
        window.onRestart = start;               // input.js calls this on R
        window.gameInstance = { start };        // ui.js mentions gameInstance.start()
        if (typeof document !== 'undefined') {
            ['play-btn', 'start-btn'].forEach((id) => {
                const b = document.getElementById(id);
                if (b) b.addEventListener('click', () => { start(); b.blur(); });
            });
        }
    }

    return {
        state, SPOTS, GAME_LENGTH,
        start, shoot, update, spotPosition, shotVelocity
    };
})();

if (typeof module !== 'undefined') module.exports = Game;

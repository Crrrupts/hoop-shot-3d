// game.js — the match: shooting, scoring, streak tiers, the clock, the AI
// rival and the power-up picks.
//
// A match is a live race: you and a rival shoot at your own hoops at the
// same time. States: 'menu' -> 'playing' <-> 'picking' -> 'gameover'.
//
// Reads input from input.js (currentSpot, getDifficultySettings) and writes
// to the HUD in ui.js (updateScore, updateTime, ...). Needs physics.js and
// powerups.js loaded first.

const Game = (function () {

    // In the browser PowerUps is already loaded; the node tests load it here
    const PU = (typeof PowerUps !== 'undefined') ? PowerUps : require('./powerups.js');
    const CourtList = (typeof Courts !== 'undefined') ? Courts : require('./courts.js');

    // ---------- Settings (starting values, easy to change) ----------
    const SETTINGS = {
        gameLength: 180,            // seconds (3 minutes)
        overtimeLength: 60,         // one extra minute if the score is tied
        pickGapMin: 30,             // a power-up pick comes every 30-45 seconds...
        pickGapMax: 45,
        earlyPickMakes: 2,          // ...but the first one comes early, at your 2nd make
        pickChooseTime: 8,          // seconds to choose before a card is picked for you
        oddsMode: 'campaign',       // which rarity odds table to use (see powerups.js)
        courtGap: 15,               // the rival's hoop stands this far to the right (meters)
        shotCooldown: 0.15,         // shortest time between two of your shots
        maxBalls: 12,               // most balls one shooter can have in the air
        moneyRackLength: 10         // surprise bonus round: every make pays double for 10 seconds
    };
    // For testing and demos, add these to the page address:
    //   ?length=30          play a short game (seconds)
    //   ?test=moving,wide   start with those power-ups on you (ids from powerups.js)
    let TEST_CARDS = [];
    if (typeof location !== 'undefined') {
        const length = /[?&]length=(\d+)/.exec(location.search);
        if (length) SETTINGS.gameLength = Number(length[1]);
        const test = /[?&]test=([a-z,]+)/.exec(location.search);
        if (test) TEST_CARDS = test[1].split(',');
    }

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

    // Streak tiers: makes in a row -> bonus. One miss drops you back to zero.
    // A basket is worth  base points x multiplier + bonus.
    const TIERS = [
        { makes: 2, name: 'HEATING UP', bonus: 1, multiplier: 1 },
        { makes: 4, name: 'ON FIRE',    bonus: 2, multiplier: 1 },
        { makes: 7, name: 'INFERNO',    bonus: 2, multiplier: 2 }
    ];

    // The AI rival for each difficulty: share of shots that go in, seconds
    // between shots, and the best card rarity it may pick (null = no cards).
    const RIVALS = {
        Easy:   { name: 'Rookie', accuracy: 0.25, pace: 4.0, maxRarity: null },
        Medium: { name: 'Rival',  accuracy: 0.42, pace: 3.0, maxRarity: 'rare' },
        Hard:   { name: 'Pro',    accuracy: 0.55, pace: 2.5, maxRarity: 'legendary' }
    };

    // Moving Hoop power-up: the hoop slides side to side
    const HOOP_SWING = 1.0;             // meters each way
    const HOOP_SPEED = 0.9;             // radians per second
    const SHAKY_WOBBLE = 0.05;          // extra aim error (radians) from Shaky Hands

    // ---------- The two shooters ----------
    function makeShooter(id, hoopX) {
        const hoop = Physics.createHoop(hoopX, 0);
        return {
            id: id,                     // 'player' or 'rival'
            name: id === 'player' ? 'You' : 'Rival',
            hoop: hoop,
            score: 0, streak: 0, bestStreak: 0, made: 0, attempts: 0,
            spot: 3,
            balls: [],                  // balls in the air or bouncing
            pending: [],                // delayed throws (Double Ball's second ball)
            effects: {},                // active power-ups (see powerups.js)
            hoopClock: 0,
            cooldown: 0,
            ai: null                    // rival only: { accuracy, pace, maxRarity, timer }
        };
    }
    const player = makeShooter('player', 0);
    const rival = makeShooter('rival', SETTINGS.courtGap);
    function opponentOf(shooter) { return shooter === player ? rival : player; }

    const state = {
        mode: 'menu',
        timeLeft: SETTINGS.gameLength,
        elapsed: 0,                     // seconds played (pauses do not count)
        overtime: false,
        buzzer: false,                  // the clock hit 0; waiting for balls still in the air
        pickNumber: 0,
        nextPickAt: 0,
        pick: null,                     // during a pick: { buff, sabotage, timeLeft, row }
        result: null,                   // 'win', 'lose' or 'tie' when the game is over
        court: CourtList.byId('ymca'),  // the court being played (see courts.js)
        wind: [0, 0, 0],                // sideways push on balls in the air right now (m/s^2)
        moneyRackAt: 0,                 // when the Money Rack bonus round starts (seconds played)
        moneyRack: 0,                   // seconds of Money Rack left (0 = not running)
        followBall: null,               // your newest ball (for the Ball Follow camera)
        shotDir: [0, 0, -1],            // which way it was thrown
        player: player,
        rival: rival
    };

    // ---------- Helpers that talk to other files (safe if they are not loaded) ----------
    function hud(fn, ...args) {
        if (typeof window !== 'undefined' && typeof window[fn] === 'function') window[fn](...args);
        else if (typeof globalThis[fn] === 'function') globalThis[fn](...args);
    }
    function sound(name) { hud('playSound', name); }

    // Other files (renderer, effects, crowd) can listen for game events:
    //   Game.on(function (name, data) { ... })
    //   'shoot'    { shooter, ball }
    //   'basket'   { shooter, ball, swish, bank, points, vel }
    //   'miss'     { shooter, ball, airball, lostTier }
    //   'bounce'   { ball, surface, speed }
    //   'tier'     { shooter, tier }            reached a new streak tier
    //   'powerup'  { user, card }
    //   'court'    { court }                    a court was chosen
    //   'start', 'buzzer', 'overtime', 'gameover'
    const listeners = [];
    function on(fn) { listeners.push(fn); }
    function emit(name, data) { for (const fn of listeners) fn(name, data || {}); }

    function difficulty() {
        if (typeof getDifficultySettings === 'function') return getDifficultySettings();
        return { name: 'Medium', aimWobble: 0.02 };
    }
    function inputSpot() {
        return (typeof currentSpot !== 'undefined') ? currentSpot : player.spot;
    }
    function randomBetween(a, b) { return a + Math.random() * (b - a); }

    // ---------- Shot math ----------
    // Where a shooter stands for a spot (their hoop's position + the spot's arc)
    function spotPosition(spotNumber, shooter) {
        const s = SPOTS[spotNumber - 1];
        const base = (shooter || player).hoop.base;
        const a = s.angle * Math.PI / 180;
        return [base[0] + Math.sin(a) * s.dist, RELEASE_HEIGHT, base[2] + Math.cos(a) * s.dist];
    }

    // power 0..100, aimX/aimY -1..1, wobble in radians (random aim error)
    function shotVelocity(spotNumber, power, aimX, aimY, wobble) {
        const s = SPOTS[spotNumber - 1];
        const a = s.angle * Math.PI / 180;
        wobble = wobble || 0;
        // face the hoop's home position (a moving hoop is the challenge)
        let yaw = Math.atan2(-Math.sin(a), -Math.cos(a));
        // mouse right (aimX > 0) turns the shot to the shooter's right
        yaw += -aimX * YAW_RANGE * Math.PI / 180 + (Math.random() * 2 - 1) * wobble;
        const pitch = (BASE_ARC + aimY * ARC_RANGE) * Math.PI / 180 + (Math.random() * 2 - 1) * wobble;
        const speed = MIN_SPEED + (Math.max(0, Math.min(power, 100)) / 100) * (MAX_SPEED - MIN_SPEED);
        const h = Math.cos(pitch) * speed;
        return [Math.sin(yaw) * h, Math.sin(pitch) * speed, Math.cos(yaw) * h];
    }

    // The widest range of power that scores from a spot with a given aim.
    // Returns { lo, hi, best } in percent, or null if nothing scores.
    // Used for the Sweet Spot zone on the meter and for the rival's aim.
    // options (optional): { rimScale, wind } passed on to Physics.wouldScore.
    function makeWindow(shooter, spotNumber, aimX, aimY, options) {
        const pos = spotPosition(spotNumber, shooter);
        let best = null, start = null;
        for (let p = 0; p <= 101; p++) {
            const scores = p <= 100 &&
                Physics.wouldScore(shooter.hoop, pos, shotVelocity(spotNumber, p, aimX, aimY, 0), options);
            if (scores && start === null) start = p;
            if (!scores && start !== null) {
                if (!best || p - 1 - start > best.hi - best.lo) best = { lo: start, hi: p - 1 };
                start = null;
            }
        }
        if (best) best.best = (best.lo + best.hi) / 2;
        return best;
    }

    // ---------- Scoring ----------
    // The streak tier for a number of makes in a row (null below 2)
    function tierFor(streak) {
        let tier = null;
        for (const t of TIERS) if (streak >= t.makes) tier = t;
        return tier;
    }

    // Points for a basket. basePoints is 2 or 3 (from the spot); the shooter's
    // streak already includes this make.
    function pointsFor(shooter, basePoints, info) {
        let base = basePoints;
        if (PU.has(shooter, 'money')) base = Math.max(base, 3);         // Moneyball
        const tier = tierFor(shooter.streak);
        let points = tier ? base * tier.multiplier + tier.bonus : base;
        if (info && info.bank) points += PU.level(shooter, 'glass');    // Glass Cleaner
        if (PU.has(shooter, 'golden')) points *= 2;                     // Golden Ball
        if (state.moneyRack > 0) points *= 2;                           // Money Rack bonus round
        return points;
    }

    function showScores() {
        hud('updateScore', player.score);
        hud('updateRivalScore', rival.score, rival.name);
        const tier = tierFor(player.streak);
        const next = TIERS.find((t) => t.makes > player.streak);
        hud('updateStreak', player.streak, tier ? tier.name : '',
            next ? (next.makes - player.streak) + ' more for ' + next.name : '');
    }

    function setStreak(shooter, value) {
        const before = tierFor(shooter.streak);
        shooter.streak = value;
        shooter.bestStreak = Math.max(shooter.bestStreak, value);
        const after = tierFor(value);
        if (after && after !== before) {
            emit('tier', { shooter: shooter, tier: after });
            if (shooter === player) hud('showBanner', after.name, 'tier');
        }
    }

    function basket(ball, info) {
        const shooter = ball.owner;
        ball.resolved = true;
        shooter.made++;
        setStreak(shooter, shooter.streak + 1);
        const points = pointsFor(shooter, ball.points, info);
        PU.useOne(shooter, 'golden');
        shooter.score += points;
        showScores();
        sound(info.swish ? 'swish' : 'score');
        emit('basket', {
            shooter: shooter, ball: ball, swish: info.swish, bank: info.bank,
            points: points, vel: ball.vel.slice()
        });
    }

    function miss(ball) {
        const shooter = ball.owner;
        ball.resolved = true;
        if (ball.bonus) return;                     // Double Ball's extra ball can only help
        if (shooter.streak > 0 && PU.useOne(shooter, 'second')) return;     // Second Chance
        const lostTier = tierFor(shooter.streak);
        shooter.streak = 0;
        showScores();
        emit('miss', {
            shooter: shooter, ball: ball, lostTier: lostTier,
            airball: !ball.touchedRim && !ball.touchedBoard
        });
    }

    Physics.onBasket = basket;
    Physics.onBounce = function (ball, surface, speed) {
        sound(surface);                 // 'rim', 'board', 'floor', 'pole'
        emit('bounce', { ball: ball, surface: surface, speed: speed });
    };

    // ---------- Throwing ----------
    function canShoot(shooter) {
        return state.mode === 'playing' && !state.buzzer && shooter.cooldown <= 0 &&
            !PU.has(opponentOf(shooter), 'freeze') &&       // frozen by the opponent's Time Freeze
            shooter.balls.length < SETTINGS.maxBalls;
    }

    function launchBall(shooter, pos, vel, points, bonus) {
        const ball = Physics.createBall(shooter.hoop, shooter);
        ball.points = points;
        ball.bonus = !!bonus;
        ball.resolved = false;          // becomes true once it counts as a make or a miss
        ball.wind = state.wind.slice(); // the wind at the moment of release stays with the ball
        // streak tier when thrown: 0 none, 1 Heating Up, 2 On Fire, 3 Inferno (for trails and fire)
        ball.heat = TIERS.filter((t) => shooter.streak >= t.makes).length;
        Physics.launch(ball, pos, vel);
        shooter.balls.push(ball);
        return ball;
    }

    // Throw from the shooter's current spot. A new ball is ready right away,
    // so several balls can be in the air at once.
    function throwBall(shooter, power, aimX, aimY, wobble) {
        const pos = spotPosition(shooter.spot, shooter);
        const vel = shotVelocity(shooter.spot, power, aimX, aimY, wobble);
        const points = SPOTS[shooter.spot - 1].points;
        const ball = launchBall(shooter, pos, vel, points, false);
        // Double Ball: a second ball follows the same path a moment later
        if (PU.useOne(shooter, 'double')) {
            shooter.pending.push({ delay: 0.18, pos: pos, vel: vel, points: points });
        }
        shooter.attempts++;
        shooter.cooldown = SETTINGS.shotCooldown;
        // effects that last "for the next N shots" lose one shot
        for (const id of ['sweet', 'guide', 'fast', 'shaky', 'heckler']) PU.useOne(shooter, id);
        if (shooter === player) {
            const hs = Math.hypot(vel[0], vel[2]) || 1;
            state.shotDir = [vel[0] / hs, 0, vel[2] / hs];
            state.followBall = ball;
        }
        sound('shoot');
        emit('shoot', { shooter: shooter, ball: ball });
        return ball;
    }

    // Called by input.js when Space is released
    function shoot(power, aimX, aimY) {
        if (state.mode === 'playing' && PU.has(rival, 'freeze')) hud('showToast', 'Frozen by Time Freeze!', 'sabotage');
        if (!canShoot(player)) return;
        player.spot = inputSpot();
        // aim error: difficulty + Shaky Hands + a wet ball in the rain
        const wobble = difficulty().aimWobble + (PU.has(player, 'shaky') ? SHAKY_WOBBLE : 0) +
            state.court.rules.slip;
        throwBall(player, power, aimX, aimY, wobble);
    }

    // ---------- The AI rival ----------
    const rivalAim = {};                // best power for each spot, worked out once

    function rivalMakeChance() {
        let chance = rival.ai.accuracy;
        // power-ups change how well the rival shoots
        chance += 0.03 * PU.level(rival, 'steady');
        if (PU.has(rival, 'sweet')) chance += 0.10;
        if (PU.has(rival, 'guide')) chance += 0.10;
        if (PU.has(rival, 'fast')) chance -= 0.08;
        if (PU.has(rival, 'shaky')) chance -= 0.10;
        if (PU.has(rival, 'heckler')) chance -= 0.10;
        if (PU.has(rival, 'fog')) chance -= 0.15;
        if (PU.has(rival, 'blackout')) chance -= 0.25;
        if (state.court.rules.slip) chance -= 0.05;         // wet ball
        return Math.max(0.03, Math.min(0.95, chance));
    }

    function updateRival(dt) {
        if (!rival.ai || !canShoot(rival)) return;
        rival.ai.timer -= dt;
        if (rival.ai.timer > 0) return;
        rival.ai.timer = rival.ai.pace * randomBetween(0.8, 1.2);

        // walk to a new spot now and then
        if (Math.random() < 0.3) rival.spot = 1 + Math.floor(Math.random() * SPOTS.length);
        // the power range that scores on this court's normal rim with no wind
        const normalRim = { rimScale: state.court.rules.rimScale };
        if (!rivalAim[rival.spot]) rivalAim[rival.spot] = makeWindow(rival, rival.spot, 0, 0, normalRim);
        const aim = rivalAim[rival.spot];

        // In wind the rival has to aim off to the side, like you do. Estimate
        // how far the wind will carry the ball and turn the shot against it.
        const spot = SPOTS[rival.spot - 1];
        const a = spot.angle * Math.PI / 180;
        const right = [Math.cos(a), 0, -Math.sin(a)];       // the shooter's right-hand side
        const drift = 0.5 * (state.wind[0] * right[0] + state.wind[2] * right[2]) * 1.2 * 1.2;   // about 1.2 s in the air
        const windAim = -drift / (spot.dist * YAW_RANGE * Math.PI / 180);
        const windy = Math.abs(state.wind[0]) > 0.01;

        // Decide if this shot should go in, then find a throw that does that
        // on a normal rim in the current wind. Tiny Rim, Moving Hoop and
        // Slippery Ball still change the real result because the real throw
        // uses the real hoop.
        const wantMake = Math.random() < rivalMakeChance();
        const pos = spotPosition(rival.spot, rival);
        const test = { rimScale: normalRim.rimScale, wind: state.wind };
        let power = aim.best, aimX = windAim;
        for (let tries = 0; tries < 12; tries++) {
            if (wantMake) {
                const spread = windy ? 5 : 0;
                power = randomBetween(aim.lo - spread, aim.hi + spread);
                aimX = windAim + (windy ? randomBetween(-0.2, 0.2) : 0);
            } else {
                const off = (aim.hi - aim.lo) / 2 + randomBetween(3, 12);
                power = aim.best + (Math.random() < 0.5 ? -off : off);
                aimX = windAim + randomBetween(-0.4, 0.4);
            }
            const scores = Physics.wouldScore(rival.hoop, pos, shotVelocity(rival.spot, power, aimX, 0, 0), test);
            if (scores === wantMake) break;
        }
        throwBall(rival, power, aimX, 0, 0);
    }

    // ---------- Power-up picks ----------
    function startPick() {
        state.pickNumber++;
        const row = PU.oddsRow(SETTINGS.oddsMode, state.pickNumber, state.timeLeft, state.overtime);
        state.pick = {
            buff: PU.rollCard('buff', row),
            sabotage: PU.rollCard('sabotage', row),
            timeLeft: SETTINGS.pickChooseTime,
            row: row
        };
        state.mode = 'picking';         // the game pauses until a card is chosen
        // let go of the power meter (input.js variables)
        if (typeof charging !== 'undefined') { charging = false; power = 0; }
        hud('updatePowerMeter', 0);
        hud('showPick', state.pick, choosePick);
    }

    // side is 'buff' (left card) or 'sabotage' (right card)
    function choosePick(side) {
        if (state.mode !== 'picking') return;
        const row = state.pick.row;
        applyCard(state.pick[side], player);
        // the rival picks a card at the same time
        if (rival.ai && rival.ai.maxRarity) {
            const rivalSide = Math.random() < 0.5 ? 'buff' : 'sabotage';
            const card = PU.rollCard(rivalSide, row, rival.ai.maxRarity);
            applyCard(card, rival);
            hud('showToast', rival.name + ' picked ' + card.name + (card.side === 'sabotage' ? ' on you!' : ''), card.side);
        }
        state.pick = null;
        state.mode = 'playing';
        state.nextPickAt = state.elapsed + randomBetween(SETTINGS.pickGapMin, SETTINGS.pickGapMax);
        hud('hidePick');
    }

    // Give a card to whoever picked it. Buffs land on the user, sabotages on
    // the opponent. Picking a card you already have levels it up.
    function applyCard(card, user) {
        const target = card.side === 'buff' ? user : opponentOf(user);
        if (card.id === 'hothand') {
            if (target.streak < 3) setStreak(target, 3);
        } else if (card.id === 'extinguish') {
            target.streak = 0;
        } else {
            PU.addEffect(target, card);
        }
        showScores();
        emit('powerup', { user: user, card: card });
    }

    // Turn a shooter's active effects into changes to their hoop
    function updateHoop(shooter, dt) {
        const hoop = shooter.hoop;
        hoop.rimScale = state.court.rules.rimScale *
            (PU.has(shooter, 'wide') ? 1.2 : 1) * (PU.has(shooter, 'tiny') ? 0.85 : 1);
        hoop.slippery = PU.has(shooter, 'slippery');
        let target = 0;
        if (PU.has(shooter, 'moving')) {
            shooter.hoopClock += dt;
            target = HOOP_SWING * Math.sin(shooter.hoopClock * HOOP_SPEED);
        } else {
            shooter.hoopClock = 0;
        }
        // glide toward the target so the hoop never jumps
        hoop.offset[0] += (target - hoop.offset[0]) * Math.min(1, dt * 8);
    }

    // ---------- Game flow ----------
    // Choose the court for the next match (id from courts.js)
    function setCourt(id) {
        state.court = CourtList.byId(id);
        applyCourtRules();
        hud('showCourt', state.court);
        emit('court', { court: state.court });
    }

    // Tell the HUD how the wind pushes a shot from your current spot
    function showWind() {
        const a = SPOTS[player.spot - 1].angle * Math.PI / 180;
        const right = [Math.cos(a), -Math.sin(a)];          // your right-hand side (x, z)
        const forward = [-Math.sin(a), -Math.cos(a)];       // toward the hoop
        hud('updateWind',
            state.wind[0] * right[0] + state.wind[2] * right[1],
            state.wind[0] * forward[0] + state.wind[2] * forward[1]);
    }

    // Copy the court's rules onto both hoops
    function applyCourtRules() {
        const rules = state.court.rules;
        for (const s of [player, rival]) {
            s.hoop.rimScale = rules.rimScale;
            s.hoop.rimBounce = rules.rimBounce;
            s.hoop.rimThickness = rules.rimThickness;
            s.hoop.floorBounce = rules.floorBounce;
        }
        for (const spot in rivalAim) delete rivalAim[spot];     // the rival re-learns its aim
    }

    // options (all optional): { rival: { name, accuracy, pace, maxRarity }, length, court }
    function start(options) {
        options = options || {};
        if (options.court && options.court !== state.court.id) setCourt(options.court);
        for (const s of [player, rival]) {
            s.score = 0; s.streak = 0; s.bestStreak = 0; s.made = 0; s.attempts = 0;
            s.balls = []; s.pending = []; s.effects = {};
            s.hoopClock = 0; s.cooldown = 0;
            s.hoop.offset[0] = 0; s.hoop.slippery = false;
        }
        applyCourtRules();
        state.wind[0] = CourtList.windAt(state.court.rules, 0);
        const preset = options.rival || RIVALS[difficulty().name] || RIVALS.Medium;
        rival.name = preset.name || 'Rival';
        rival.spot = 3;
        rival.ai = {
            accuracy: preset.accuracy, pace: preset.pace, maxRarity: preset.maxRarity,
            timer: preset.pace
        };
        player.spot = inputSpot();

        state.mode = 'playing';
        state.timeLeft = options.length || SETTINGS.gameLength;
        state.elapsed = 0;
        state.overtime = false;
        state.buzzer = false;
        state.pickNumber = 0;
        state.nextPickAt = randomBetween(SETTINGS.pickGapMin, SETTINGS.pickGapMax);
        state.pick = null;
        state.result = null;
        state.followBall = null;
        // one surprise Money Rack per game, somewhere in the middle
        // (not in very short test games)
        state.moneyRackAt = state.timeLeft >= 60 ? state.timeLeft * randomBetween(0.35, 0.75) : 0;
        state.moneyRack = 0;

        // ?test=... cards (they last 10 minutes so there is time to look at them)
        for (const id of TEST_CARDS) {
            const card = PU.byId(id);
            if (!card || card.kind === 'instant') continue;
            PU.addEffect(player, card);
            player.effects[id].left = 600;
        }

        showScores();
        hud('updateTime', Math.ceil(state.timeLeft), false);
        hud('updateEffects', []);
        hud('hidePick');
        hud('showCourt', state.court);
        showWind();
        showMenu(false);
        emit('start');
    }

    function ballsInPlay() {
        return player.balls.length + rival.balls.length + player.pending.length + rival.pending.length;
    }

    // Move a shooter's balls and decide makes and misses
    function updateBalls(shooter, dt) {
        for (const throwLater of shooter.pending) {
            throwLater.delay -= dt;
            if (throwLater.delay <= 0) {
                launchBall(shooter, throwLater.pos, throwLater.vel, throwLater.points, true);
            }
        }
        shooter.pending = shooter.pending.filter((t) => t.delay > 0);

        for (const ball of shooter.balls) {
            Physics.update(ball, dt);
            // a ball that reaches the floor without scoring is a miss
            if (!ball.resolved && (ball.touchedFloor || Physics.shotOver(ball))) miss(ball);
            if (Physics.shotOver(ball)) ball.dead = true;
        }
        shooter.balls = shooter.balls.filter((b) => !b.dead);
    }

    // The clock reached 0 and every ball has landed
    function endOfClock() {
        if (player.score === rival.score && !state.overtime) {
            // tie: one minute of overtime, starting with a power-up pick
            state.overtime = true;
            state.buzzer = false;
            state.timeLeft = SETTINGS.overtimeLength;
            hud('updateTime', Math.ceil(state.timeLeft), true);
            hud('showBanner', 'OVERTIME', 'overtime');
            emit('overtime');
            startPick();
        } else {
            gameOver();
        }
    }

    function gameOver() {
        state.mode = 'gameover';
        state.result = player.score > rival.score ? 'win' : player.score < rival.score ? 'lose' : 'tie';
        hud('updateEffects', []);
        emit('gameover', { result: state.result });
        showMenu(true);
    }

    function showMenu(show) {
        if (typeof document === 'undefined') return;
        const overlay = document.getElementById('menu-overlay');
        if (!overlay) return;
        overlay.style.display = show ? 'flex' : 'none';
        if (show && state.mode === 'gameover') {
            const pct = player.attempts ? Math.round(100 * player.made / player.attempts) : 0;
            const titles = { win: 'You Win!', lose: 'You Lose', tie: 'Tie Game' };
            document.getElementById('menu-title').textContent = titles[state.result];
            document.getElementById('menu-subtitle').textContent =
                `You ${player.score} - ${rival.score} ${rival.name} | ` +
                `${player.made}/${player.attempts} shots (${pct}%) | best streak ${player.bestStreak}`;
            document.getElementById('play-btn').textContent = 'Play Again';
        }
    }

    // Called every frame by main.js
    function update(dt) {
        if (state.mode === 'picking') {
            // everything is paused; only the choose timer runs
            state.pick.timeLeft -= dt;
            hud('updatePickTimer', Math.max(0, state.pick.timeLeft / SETTINGS.pickChooseTime));
            if (state.pick.timeLeft <= 0) choosePick(Math.random() < 0.5 ? 'buff' : 'sabotage');
            return;
        }
        if (state.mode !== 'playing') return;

        // Time Freeze stops the clock (and the opponent) but not the shooter
        const frozen = PU.has(player, 'freeze') || PU.has(rival, 'freeze');
        PU.tick(player, dt);
        PU.tick(rival, dt);

        if (!state.buzzer && !frozen) {
            const before = Math.ceil(state.timeLeft);
            state.timeLeft = Math.max(0, state.timeLeft - dt);
            state.elapsed += dt;
            if (Math.ceil(state.timeLeft) !== before) hud('updateTime', Math.ceil(state.timeLeft), state.overtime);
            if (state.timeLeft <= 0) {
                // balls already in the air still count (buzzer beaters)
                state.buzzer = true;
                sound('buzzer');
                emit('buzzer');
            }
        }

        // Money Rack: a surprise 10 seconds where every make pays double
        if (state.moneyRack > 0) {
            state.moneyRack = Math.max(0, state.moneyRack - dt);
        } else if (!state.overtime && !state.buzzer && state.moneyRackAt > 0 && state.elapsed >= state.moneyRackAt) {
            state.moneyRackAt = 0;
            state.moneyRack = SETTINGS.moneyRackLength;
            hud('showBanner', 'MONEY RACK', 'money');
            emit('moneyrack');
        }

        // the wind changes slowly through the match
        state.wind[0] = CourtList.windAt(state.court.rules, state.elapsed);

        player.cooldown -= dt;
        rival.cooldown -= dt;
        player.spot = inputSpot();              // follow A/D spot changes
        updateHoop(player, dt);
        updateHoop(rival, dt);
        updateRival(dt);
        updateBalls(player, dt);
        updateBalls(rival, dt);

        // meter speed for input.js: Steady Hands slows it, Fast Meter speeds it up
        if (typeof window !== 'undefined') {
            window.chargeSpeedScale = Math.pow(0.8, PU.level(player, 'steady')) * (PU.has(player, 'fast') ? 1.3 : 1);
        }
        const chips = PU.describe(player);
        if (state.moneyRack > 0) chips.unshift({ name: 'Money Rack: makes pay double', side: 'buff', label: Math.ceil(state.moneyRack) + 's' });
        hud('updateEffects', chips);
        showWind();

        if (state.buzzer) {
            if (ballsInPlay() === 0) endOfClock();
        } else if (!frozen) {
            // the first pick comes early if you already made 2 shots
            const early = state.pickNumber === 0 && player.made >= SETTINGS.earlyPickMakes &&
                state.elapsed < SETTINGS.pickGapMin;
            if (early || state.elapsed >= state.nextPickAt) startPick();
        }
    }

    // ---------- Hooks for other files ----------
    if (typeof window !== 'undefined') {
        window.onShoot = shoot;                 // input.js calls this on Space release
        window.onRestart = function () { start(); };    // input.js calls this on R
        window.gameInstance = { start, setCourt };
        if (typeof document !== 'undefined') {
            ['play-btn', 'start-btn'].forEach((id) => {
                const b = document.getElementById(id);
                if (b) b.addEventListener('click', () => { start(); b.blur(); });
            });
        }
    }

    return {
        state, player, rival, SPOTS, SETTINGS, TIERS, RIVALS,
        start, shoot, update, on,
        spotPosition, shotVelocity, makeWindow, tierFor, pointsFor,
        throwBall, applyCard, choosePick, opponentOf, setCourt
    };
})();

if (typeof module !== 'undefined') module.exports = Game;

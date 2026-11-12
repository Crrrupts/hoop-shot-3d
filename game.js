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
        gameLength: 120,            // seconds (2 minutes)
        overtimeLength: 60,         // one extra minute...
        overtimeMargin: 10,         // ...when the scores are within this many points at the end
        pickGapMin: 20,             // a power-up pick comes every 20-30 seconds...
        pickGapMax: 30,
        earlyPickMakes: 2,          // ...but the first one comes early, at your 2nd make
        pickChooseTime: 5,          // seconds to choose; after that you get no card (but better odds next time)
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
            spotStats: SPOTS.map(() => ({ made: 0, attempts: 0 })),     // makes and attempts at each spot
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
        practice: false,                // true = no clock, no rival, no picks (tutorial and sandbox)
        twoPlayer: false,               // true = the "rival" is a second person on the same keyboard
        home: null,                     // two-player: who won the coin flip for home court (the crowd is theirs)
        twist: null,                    // a campaign boss's special rule (see campaign.js)
        options: {},                    // what the current match was started with (R restarts it)
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
    // What your gear cards do (cards.js). No gear in the node tests.
    function gear() {
        if (typeof Cards !== 'undefined' && !state.twoPlayer) return Cards.gearBonus();    // no gear in two-player
        return { wobbleScale: 1, rimScale: 1, freeMissChance: 0 };
    }

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

    // A first guess at the sideways aim (aimX) that cancels the wind from a
    // shooter's spot: how far the wind carries the ball, turned against it.
    function windEstimate(shooter, wind) {
        const spot = SPOTS[shooter.spot - 1];
        const a = spot.angle * Math.PI / 180;
        const right = [Math.cos(a), 0, -Math.sin(a)];       // the shooter's right-hand side
        const drift = 0.5 * (wind[0] * right[0] + wind[2] * right[2]) * 1.2 * 1.2;     // about 1.2 s in the air
        return -drift / (spot.dist * YAW_RANGE * Math.PI / 180);
    }

    // The best aim and the power meter's zones for a shooter's current spot:
    //   aimX          the sideways aim that works best (0 with no wind). The golden dot marks it.
    //   green lo..hi  the power that scores with that aim
    //   grey          `buffer` wide on each side: a little early or late still has a chance
    // These depend on the spot, the rim and the wind, not on where you are aiming.
    // Working them out takes a few milliseconds, so the answer is kept until something changes.
    const zoneCache = {};
    function shotGuide(shooter) {
        const wind = [Math.round(state.wind[0] * 20) / 20, 0, 0];      // to the nearest 0.05
        const key = [shooter.spot, shooter.hoop.rimScale, wind[0], state.court.id].join('|');
        let cached = zoneCache[shooter.id];
        if (!cached || cached.key !== key) {
            // try a few aims around the first guess and keep the one with the widest green zone
            const guess = windEstimate(shooter, wind);
            let best = null;
            for (const nudge of (wind[0] ? [0, -0.1, 0.1, -0.2, 0.2] : [0])) {
                const zone = makeWindow(shooter, shooter.spot, guess + nudge, 0, { wind: wind });
                if (zone && (!best || zone.hi - zone.lo > best.hi - best.lo)) {
                    best = { aimX: guess + nudge, lo: zone.lo, hi: zone.hi };
                }
            }
            cached = zoneCache[shooter.id] = { key: key, guide: best };
        }
        return cached.guide;
    }
    function perfectAim(shooter) {
        const guide = shotGuide(shooter);
        return guide ? guide.aimX : 0;
    }
    function powerZone(shooter) {
        const guide = shotGuide(shooter);
        if (!guide) return null;
        return { lo: guide.lo, hi: guide.hi, buffer: difficulty().buffer || 5 };
    }
    const BUFFER_BEST_CHANCE = 0.35;    // chance of a save right next to the green zone...
    const BUFFER_WORST_CHANCE = 0.15;   // ...falling to this at the far edge of the grey zone

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
        // two-player: Player 2's streak
        const tier2 = tierFor(rival.streak);
        hud('updateStreak2', rival.streak, tier2 ? tier2.name : '');
    }

    function setStreak(shooter, value) {
        const before = tierFor(shooter.streak);
        shooter.streak = value;
        shooter.bestStreak = Math.max(shooter.bestStreak, value);
        const after = tierFor(value);
        if (after && after !== before) {
            emit('tier', { shooter: shooter, tier: after });
            if (state.twoPlayer) hud('showBanner', shooter.name + ' ' + after.name, 'tier');
            else if (shooter === player) hud('showBanner', after.name, 'tier');
        }
    }

    function basket(ball, info) {
        const shooter = ball.owner;
        ball.resolved = true;
        shooter.made++;
        if (ball.spot) shooter.spotStats[ball.spot - 1].made++;
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
        // Wristband gear: once a game, a miss may keep your streak
        if (shooter === player && tierFor(player.streak) && !player.freeMissUsed &&
            Math.random() < gear().freeMissChance) {
            player.freeMissUsed = true;
            hud('showToast', 'Wristband saved your streak!', 'buff');
            return;
        }
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
        ball.spot = shooter.spot;
        shooter.attempts++;
        shooter.spotStats[shooter.spot - 1].attempts++;
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
        shootAs(player, power, aimX, aimY);
    }
    // Called by input.js when Player 2 releases Enter (two-player)
    function shoot2(power, aimX, aimY) {
        if (state.twoPlayer) shootAs(rival, power, aimX, aimY);
    }
    function shootAs(shooter, power, aimX, aimY) {
        if (!canShoot(shooter)) return;
        shooter.spot = shooter === player ? inputSpot() : shooter.spot;
        // Grey buffer zone: letting go a little early or late is sometimes
        // saved (the throw is nudged into the green zone). Never better than 35%.
        const zone = powerZone(shooter);
        if (zone) {
            const off = power < zone.lo ? zone.lo - power : power > zone.hi ? power - zone.hi : 0;
            if (off > 0 && off <= zone.buffer) {
                const chance = BUFFER_BEST_CHANCE - (BUFFER_BEST_CHANCE - BUFFER_WORST_CHANCE) * off / zone.buffer;
                if (Math.random() < chance) {
                    const quarter = (zone.hi - zone.lo) / 4;
                    power = power < zone.lo ? zone.lo + quarter : zone.hi - quarter;
                }
            }
        }
        // aim error: difficulty + Shaky Hands + a wet ball in the rain
        // (the Rooftop boss makes the rain heavier as it scores; the Headband gear steadies you)
        const rain = state.court.rules.slip * (state.twist === 'heavierRain' ? 1 + rival.score / 40 : 1);
        const wobble = (difficulty().aimWobble + (PU.has(shooter, 'shaky') ? SHAKY_WOBBLE : 0) + rain) *
            (shooter === player ? gear().wobbleScale : 1);
        throwBall(shooter, power, aimX, aimY, wobble);
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
        if (!rival.ai || state.practice || !canShoot(rival)) return;
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
        const windAim = windEstimate(rival, state.wind);
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
        // two-player is the fast-paced mode: it uses the better multiplayer odds.
        // A player who skipped their last pick gets better odds this time.
        const mode = state.twoPlayer ? 'multiplayer' : SETTINGS.oddsMode;
        const row = PU.oddsRow(mode, state.pickNumber, state.overtime, player.pickBoost);
        state.pick = {
            buff: PU.rollCard('buff', row),
            sabotage: PU.rollCard('sabotage', row),
            timeLeft: SETTINGS.pickChooseTime,
            row: row
        };
        if (state.twoPlayer) {
            // Player 2 gets their own two cards; the game waits for both players
            const row2 = PU.oddsRow(mode, state.pickNumber, state.overtime, rival.pickBoost);
            state.pick.p2 = { buff: PU.rollCard('buff', row2), sabotage: PU.rollCard('sabotage', row2) };
            state.pick.chosen = { player: null, rival: null };
        }
        state.mode = 'picking';         // the game pauses until a card is chosen
        // let go of the power meters (input.js variables)
        if (typeof charging !== 'undefined') { charging = false; power = 0; charging2 = false; power2 = 0; }
        hud('updatePowerMeter', 0);
        hud('updatePowerMeter2', 0);
        hud(state.twoPlayer ? 'showPick2' : 'showPick', state.pick, choosePick);
    }

    // side is 'buff' (left card), 'sabotage' (right card) or 'skip' (the
    // timer ran out: no card, but better odds at your next pick).
    // who is the shooter choosing (two-player); it defaults to you.
    function choosePick(side, who) {
        if (state.mode !== 'picking') return;
        const row = state.pick.row;
        if (state.twoPlayer) {
            const key = who === rival ? 'rival' : 'player';
            if (state.pick.chosen[key]) return;             // already chose
            state.pick.chosen[key] = side;
            hud('markPick2', key, side);
            if (!state.pick.chosen.player || !state.pick.chosen.rival) return;     // wait for the other player
            takeCard(player, state.pick, state.pick.chosen.player);
            takeCard(rival, state.pick.p2, state.pick.chosen.rival);
        } else {
            takeCard(player, state.pick, side);
            if (side === 'sabotage') player.sabotagesUsed++;    // campaign: a star for winning without sabotage
            // the rival picks a card at the same time
            if (rival.ai && rival.ai.maxRarity) {
                // the final boss uses a sabotage every pick
                const rivalSide = state.twist === 'sabotageEveryPick' || Math.random() < 0.5 ? 'sabotage' : 'buff';
                const card = PU.rollCard(rivalSide, row, rival.ai.maxRarity);
                applyCard(card, rival);
                hud('showToast', rival.name + ' picked ' + card.name + (card.side === 'sabotage' ? ' on you!' : ''), card.side);
            }
        }
        state.pick = null;
        state.mode = 'playing';
        state.nextPickAt = state.elapsed + randomBetween(SETTINGS.pickGapMin, SETTINGS.pickGapMax);
        hud('hidePick');
    }

    // Give a shooter the card they chose, or the skip bonus if they chose nothing
    function takeCard(shooter, cards, side) {
        if (side === 'skip') {
            shooter.pickBoost++;                // next pick: odds one step toward rarer cards
            if (shooter === player && !state.twoPlayer) hud('showToast', 'No pick: better odds next time', 'buff');
        } else {
            shooter.pickBoost = 0;
            applyCard(cards[side], shooter);
        }
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
        hoop.rimScale = state.court.rules.rimScale * (shooter === player ? gear().rimScale : 1) *
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
    //   practice: true = no clock, rival or picks (tutorial, sandbox); twist = a boss rule;
    //   mode = 'quick', 'campaign', 'tutorial', 'sandbox' or 'versus' (menus.js uses it); stage = campaign stage number
    //   twoPlayer: true = Player 2 controls the rival (see input.js)
    // With no options, the last match starts again (the R key).
    function start(options) {
        options = options || state.options;
        state.options = options;
        state.practice = !!options.practice;
        state.twoPlayer = !!options.twoPlayer;
        state.home = null;
        state.twist = options.twist || null;
        if (options.court && options.court !== state.court.id) setCourt(options.court);
        player.sabotagesUsed = 0;
        player.pickBoost = 0;           // skipped picks in a row (better odds next time)
        rival.pickBoost = 0;
        player.freeMissUsed = false;
        for (const s of [player, rival]) {
            s.spotStats = SPOTS.map(() => ({ made: 0, attempts: 0 }));
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
        player.name = 'You';
        if (state.twoPlayer) {
            // a second person plays the rival: no AI, and a coin flip for home court
            rival.ai = null;
            player.name = 'P1';
            rival.name = 'P2';
            state.home = Math.random() < 0.5 ? player : rival;
        }
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
        state.moneyRackAt = state.timeLeft >= 60 && !state.practice ? state.timeLeft * randomBetween(0.35, 0.75) : 0;
        if (state.twist === 'heatingStart') rival.streak = 2;      // Home Gym boss starts already Heating Up
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
        hud('setTwoPlayer', state.twoPlayer);
        if (state.twoPlayer) hud('showBanner', 'HOME COURT: ' + state.home.name, 'overtime');
        showWind();
        hud('hideMenus');
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
        const close = Math.abs(player.score - rival.score) <= SETTINGS.overtimeMargin;
        if (close && !state.overtime) {
            // a close game (within 10 points): one minute of overtime, starting with a power-up pick
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
        hud('showGameOver');            // menus.js shows the result screen
    }

    // Sandbox and tutorial helpers
    function forcePick() { if (state.mode === 'playing') startPick(); }
    function clearBalls() { player.balls = []; player.pending = []; }
    // Leave the match and go back to the menus
    function quit() { state.mode = 'menu'; player.balls = []; rival.balls = []; hud('updateEffects', []); }

    // Called every frame by main.js
    function update(dt) {
        if (state.mode === 'picking') {
            // everything is paused; only the choose timer runs
            state.pick.timeLeft -= dt;
            hud('updatePickTimer', Math.max(0, state.pick.timeLeft / SETTINGS.pickChooseTime));
            if (state.pick.timeLeft <= 0) {
                // time is up: anyone who has not chosen skips this pick
                choosePick('skip', player);
                if (state.twoPlayer) choosePick('skip', rival);
            }
            return;
        }
        if (state.mode !== 'playing') return;

        // Time Freeze stops the clock (and the opponent) but not the shooter
        const frozen = PU.has(player, 'freeze') || PU.has(rival, 'freeze');
        PU.tick(player, dt);
        PU.tick(rival, dt);

        if (!state.buzzer && !frozen && !state.practice) {
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
        // boss twists (campaign.js)
        if (state.twist === 'risingWind') state.wind[0] *= 1 + state.elapsed / SETTINGS.gameLength;
        if (state.twist === 'heckle') player.effects.heckler = { level: 1, left: 99 };     // heckled on every shot

        player.cooldown -= dt;
        rival.cooldown -= dt;
        player.spot = inputSpot();              // follow A/D spot changes
        if (state.twoPlayer && typeof currentSpot2 !== 'undefined') rival.spot = currentSpot2;    // Player 2: J/L
        updateHoop(player, dt);
        updateHoop(rival, dt);
        updateRival(dt);
        updateBalls(player, dt);
        updateBalls(rival, dt);

        // meter speed for input.js: Steady Hands slows it, Fast Meter speeds it up
        if (typeof window !== 'undefined') {
            window.chargeSpeedScale = Math.pow(0.8, PU.level(player, 'steady')) * (PU.has(player, 'fast') ? 1.3 : 1);
            window.chargeSpeedScale2 = Math.pow(0.8, PU.level(rival, 'steady')) * (PU.has(rival, 'fast') ? 1.3 : 1);
        }
        const chips = PU.describe(player);
        if (state.moneyRack > 0) chips.unshift({ name: 'Money Rack: makes pay double', side: 'buff', label: Math.ceil(state.moneyRack) + 's' });
        hud('updateEffects', chips);
        if (state.twoPlayer) hud('updateEffects2', PU.describe(rival));
        showWind();

        if (state.buzzer) {
            if (ballsInPlay() === 0) endOfClock();
        } else if (!frozen && !state.practice) {
            // the first pick comes early if you already made 2 shots
            const makes = state.twoPlayer ? Math.max(player.made, rival.made) : player.made;
            const early = state.pickNumber === 0 && makes >= SETTINGS.earlyPickMakes &&
                state.elapsed < SETTINGS.pickGapMin;
            if (early || state.elapsed >= state.nextPickAt) startPick();
        }
    }

    // ---------- Hooks for other files ----------
    if (typeof window !== 'undefined') {
        window.onShoot = shoot;                 // input.js calls this on Space release
        window.onShoot2 = shoot2;               // ...and this when Player 2 releases Enter
        window.onRestart = function () { start(); };    // input.js calls this on R
        window.gameInstance = { start, setCourt };
    }

    return {
        state, player, rival, SPOTS, SETTINGS, TIERS, RIVALS,
        start, shoot, shoot2, update, on,
        spotPosition, shotVelocity, makeWindow, tierFor, pointsFor, perfectAim, powerZone,
        throwBall, applyCard, choosePick, opponentOf, setCourt, forcePick, clearBalls, quit
    };
})();

if (typeof module !== 'undefined') module.exports = Game;

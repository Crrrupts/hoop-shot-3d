// effects.js — game feel: the hype meter, confetti, fire, smoke, ball trails,
// floating text, screen shake, slow motion and sound hooks.
//
// It listens to game events (Game.on) and keeps small lists of things for
// renderer.js to draw and ui.js to show. Nothing here changes the score.
//
// Sounds: the team supplies them. This file calls window.playSound(name, detail)
// with: cheer, chime (detail.streak rises with your streak), groan, gasp,
// airball, hiss, fire, stomp, tick. game.js calls it with shoot, swish, score,
// rim, board, floor, pole, buzzer.

const Effects = (function () {

    let hype = 0;                   // 0..1 crowd energy: rises with makes, drops slowly
    let cheer = 0;                  // 1 right after you score, fades in under a second
    let shake = 0;                  // camera shake size in meters
    let tint = 0;                   // 0..1 how red-orange the lights are (Inferno)
    let stompClock = 0;
    let lastTick = 0;

    const particles = [];           // { kind, color, pos, vel, life, age }
    const trails = new Map();       // ball -> [x, y, z, x, y, z, ...] recent positions
    const boardFlash = new Map();   // hoop -> 0..1, the backboard lights up on a bank shot

    const CONFETTI = [[1, 0.3, 0.3], [1, 0.85, 0.2], [0.3, 0.8, 1], [0.5, 1, 0.5], [1, 0.5, 0.9]];
    const KINDS = {
        // size in meters, life in seconds, gravity in m/s^2 (negative = floats up)
        confetti: { size: 0.055, life: 1.5, gravity: 4.5, drag: 1.5, shape: 2, additive: false, alpha: 1 },
        fire:     { size: 0.16, life: 0.4, gravity: -3, drag: 1, shape: 1, additive: true, alpha: 0.7 },
        smoke:    { size: 0.3, life: 1.2, gravity: -0.8, drag: 1, shape: 1, additive: false, alpha: 0.3 }
    };

    function sound(name, detail) {
        if (typeof window.playSound === 'function') window.playSound(name, detail);
    }
    function hud(fn, ...args) {
        if (typeof window[fn] === 'function') window[fn](...args);
    }

    // Throw `count` particles out from a point
    function burst(kind, pos, count, speed, color) {
        for (let i = 0; i < count; i++) {
            // a random direction, mostly upward
            const a = Math.random() * 2 * Math.PI, up = 0.3 + Math.random() * 0.9;
            const s = speed * (0.4 + Math.random() * 0.6);
            particles.push({
                kind: kind,
                color: color === undefined ? Math.floor(Math.random() * CONFETTI.length) : color,
                pos: pos.slice(),
                vel: [Math.cos(a) * s, up * s, Math.sin(a) * s],
                age: 0
            });
        }
    }

    // Floating text at a point in the world (ui.js shows it; renderer.js finds the screen spot)
    // view: 0 = your view, 1 = Player 2's half of the screen
    function popup(text, worldPos, kind, view) {
        if (typeof window.worldToScreen !== 'function') return;
        const p = window.worldToScreen(worldPos, view);
        if (p.visible) hud('showPopup', text, p.x, p.y, kind);
    }

    // Is this shooter a person? (you always; the rival too in two-player)
    function isPerson(shooter) { return shooter === Game.player || Game.state.twoPlayer; }
    function viewOf(shooter) { return shooter === Game.player ? 0 : 1; }
    // The crowd cheers for you. In two-player it cheers for whoever won home court.
    function crowdFavorite() { return Game.state.twoPlayer ? Game.state.home : Game.player; }

    // ---------- React to game events ----------
    Game.on(function (name, data) {
        const player = Game.player;

        if (name === 'start') {
            hype = 0; cheer = 0; shake = 0; tint = 0;
            particles.length = 0;
            trails.clear();
        }

        if (name === 'basket') {
            const rim = Physics.rimCenter(data.ball.hoop);
            const mine = data.shooter === player;
            burst('confetti', rim, data.swish ? 45 : 20, data.swish ? 3.2 : 2.4);
            // On Fire or better: the net burns on a make
            if (data.ball.heat >= 2) burst('fire', [rim[0], rim[1] - 0.25, rim[2]], 30, 0.9, 0);
            if (data.bank) boardFlash.set(data.ball.hoop, 1);
            if (!isPerson(data.shooter)) return;

            const view = viewOf(data.shooter);
            popup('+' + data.points, [rim[0], rim[1] + 0.45, rim[2]], 'points', view);
            if (data.swish) popup('SWISH!', [rim[0], rim[1] + 0.95, rim[2]], 'swish', view);
            else if (data.bank) popup('BANK!', [rim[0], rim[1] + 0.95, rim[2]], 'bank', view);
            sound('chime', { streak: data.shooter.streak });    // pitch can rise with the streak
            if (data.shooter !== crowdFavorite()) return;       // the crowd only cheers its own player

            hype = Math.min(1, hype + 0.12 + (data.swish ? 0.08 : 0) + (data.points >= 3 ? 0.05 : 0));
            cheer = 1;
            shake = 0.04;
            sound('cheer', { big: data.swish || data.points >= 3 });
            if (Game.state.buzzer) {
                // buzzer beater: the whole crowd jumps and the lights flash
                hype = 1;
                hud('flashScreen', 'white');
                burst('confetti', rim, 80, 4);
            }
        }

        if (name === 'miss' && isPerson(data.shooter)) {
            const rim = Physics.rimCenter(data.ball.hoop);
            const view = viewOf(data.shooter);
            if (data.airball) {
                popup('AIR BALL', [rim[0], rim[1] + 0.6, rim[2]], 'bad', view);
                sound('airball');
            } else if (data.ball.touchedRim) {
                popup('SO CLOSE!', [rim[0], rim[1] + 0.6, rim[2]], 'close', view);
                sound('gasp');
            } else {
                sound('groan');
            }
            if (data.lostTier) {
                // the streak ends: the fire puffs out into smoke
                burst('smoke', Game.spotPosition(data.shooter.spot, data.shooter), 14, 0.7, 0);
                sound('hiss');
            }
        }

        if (name === 'tier' && isPerson(data.shooter)) {
            hype = Math.min(1, hype + 0.25);
            hud('flashScreen', 'orange');
            sound('fire');
        }

        if (name === 'bounce' && data.surface === 'floor') {
            // the ball flattens a little on a hard bounce
            data.ball.squash = Math.min(0.3, data.speed * 0.045);
        }

        if (name === 'powerup' && data.user === player && data.card.rarity === 'legendary') {
            hud('flashScreen', 'gold');
        }
    });

    // Intense moments: the last minute of a close game, overtime, or you are On Fire
    function intense() {
        const s = Game.state;
        if (s.mode !== 'playing') return false;
        const close = Math.abs(s.player.score - s.rival.score) <= 6;
        return s.overtime || (s.timeLeft <= 60 && close) || s.player.streak >= 4;
    }

    // ---------- Every frame ----------
    function update(dt) {
        const s = Game.state, player = Game.player, rival = Game.rival;
        const playing = s.mode === 'playing';

        // hype drops slowly; Inferno keeps the crowd on its feet
        hype = Math.max(0, hype - 0.035 * dt);
        if (playing && player.streak >= 7) hype = Math.max(hype, 0.9);
        cheer = Math.max(0, cheer - 1.2 * dt);
        shake *= Math.exp(-8 * dt);
        // the red-orange Inferno light fades in and out over about a second
        const wantTint = playing && player.streak >= 7 ? 1 : 0;
        tint += Math.max(-dt, Math.min(dt, wantTint - tint));
        hud('updateHype', hype);
        boardFlash.forEach(function (value, hoop) { boardFlash.set(hoop, Math.max(0, value - 3 * dt)); });

        // crowd stomps on a beat in intense moments
        if (intense()) {
            stompClock += dt;
            if (stompClock >= 0.6) { stompClock = 0; sound('stomp'); }
        }
        // last 10 seconds: a tick every second
        const second = Math.ceil(s.timeLeft);
        if (playing && !s.buzzer && second <= 10 && second !== lastTick) { lastTick = second; sound('tick'); }

        // balls: trails, fire and squash
        const live = new Set();
        for (const ball of player.balls.concat(rival.balls)) {
            live.add(ball);
            if (ball.squash) ball.squash *= Math.exp(-12 * dt);
            if (ball.touchedFloor) { trails.delete(ball); continue; }
            let trail = trails.get(ball);
            if (!trail) { trail = []; trails.set(ball, trail); }
            trail.push(ball.pos[0], ball.pos[1], ball.pos[2]);
            if (trail.length > 16 * 3) trail.splice(0, 3);
            // On Fire or better: the ball is covered in fire
            if (ball.heat >= 2 && Math.random() < 60 * dt) {
                particles.push({
                    kind: 'fire', color: 0, age: 0,
                    pos: [ball.pos[0] + (Math.random() - 0.5) * 0.15, ball.pos[1] + (Math.random() - 0.5) * 0.15, ball.pos[2] + (Math.random() - 0.5) * 0.15],
                    vel: [0, 0.3, 0]
                });
            }
        }
        for (const ball of trails.keys()) if (!live.has(ball)) trails.delete(ball);

        // particles: move, slow down, fall (or float), and die
        for (const p of particles) {
            const k = KINDS[p.kind];
            p.age += dt;
            const slow = Math.exp(-k.drag * dt);
            p.vel[0] *= slow; p.vel[2] *= slow;
            p.vel[1] = p.vel[1] * slow - k.gravity * dt;
            for (let i = 0; i < 3; i++) p.pos[i] += p.vel[i] * dt;
        }
        for (let i = particles.length - 1; i >= 0; i--) {
            if (particles[i].age > KINDS[particles[i].kind].life || particles[i].pos[1] < 0) particles.splice(i, 1);
        }
    }

    // ---------- What the renderer asks for ----------

    // Groups of dots to draw: [{ points, size, color, alpha, shape, additive }]
    function dots() {
        const groups = {};
        for (const p of particles) {
            const key = p.kind + p.color;
            if (!groups[key]) {
                const k = KINDS[p.kind];
                const color = p.kind === 'confetti' ? CONFETTI[p.color] : p.kind === 'fire' ? [1, 0.5, 0.12] : [0.6, 0.6, 0.62];
                groups[key] = { points: [], size: k.size, color: color, alpha: k.alpha, shape: k.shape, additive: k.additive };
            }
            groups[key].points.push(p.pos[0], p.pos[1], p.pos[2]);
        }
        return Object.values(groups);
    }

    // Trails behind flying balls: [{ points, color, alpha }]
    // Faint white normally, orange once the shooter is Heating Up.
    function ballTrails() {
        const out = [];
        trails.forEach(function (points, ball) {
            if (points.length < 6) return;
            if (ball.heat >= 1) out.push({ points: points, color: [1, 0.55, 0.15], alpha: 0.85 });
            else out.push({ points: points, color: [1, 1, 1], alpha: 0.28 });
        });
        return out;
    }

    // Slow motion for a buzzer beater: after the clock hits 0, time slows while
    // one of your shots is dropping toward the rim.
    function timeScale() {
        const s = Game.state;
        if (window.sandboxSlowMotion) return 0.4;       // sandbox practice tool
        if (s.mode !== 'playing' || !s.buzzer) return 1;
        const balls = s.twoPlayer ? Game.player.balls.concat(Game.rival.balls) : Game.player.balls;
        for (const ball of balls) {
            if (ball.resolved || ball.vel[1] > 0) continue;
            const rim = Physics.rimCenter(ball.hoop);
            const d = Math.hypot(ball.pos[0] - rim[0], ball.pos[1] - rim[1], ball.pos[2] - rim[2]);
            if (d < 1.3) return 0.35;
        }
        return 1;
    }

    return {
        update, dots, ballTrails, timeScale, intense,
        getHype: function () { return hype; },
        getCheer: function () { return cheer; },
        getShake: function () { return shake; },
        // multiplies the picture's colors: white normally, red-orange in Inferno
        getTint: function () {
            // Neon Arcade boss: the lights flicker in the last minute
            const s = Game.state;
            const flicker = s.mode === 'playing' && s.twist === 'flicker' && s.timeLeft <= 60 &&
                Math.sin(performance.now() / 90) + Math.sin(performance.now() / 37) > 0.9 ? 0.3 : 1;
            return [(1 + 0.12 * tint) * flicker, (1 - 0.18 * tint) * flicker, (1 - 0.3 * tint) * flicker];
        },
        getBoardFlash: function (hoop) { return boardFlash.get(hoop) || 0; },
        // 1 while a shooter is in Inferno: their rim glows
        rimGlow: function (hoop) {
            const shooter = hoop === Game.player.hoop ? Game.player : Game.rival;
            return Game.state.mode === 'playing' && shooter.streak >= 7 ? 1 : 0;
        }
    };
})();

// replay.js — instant replays of the big shots, in slow motion from a
// cinematic camera.
//
// Every frame main.js calls Replay.record(dt): each ball in the air saves its
// position, so a shot can be played back after it has landed.
//
// Which shots get a replay:
//   buzzer-beater  a make counted after the clock hit 0
//   game-winner    the make that put the winner ahead for good, in the last
//                  5 seconds of the clock (or at the buzzer)
//   deep three     a three-pointer (corner) that is a swish, during the game
//
// When it plays:
//   - A buzzer-beater or game-winner plays full screen after the final
//     buzzer, before the result screen (the clock is already over).
//   - A deep three plays in the small view in the top-left corner while the
//     game goes on, so it never pauses the game or uses up the clock
//     (one-player only; two-player has no small view).
// Skip: any key or a click for the full-screen replay, X for the small one.

const Replay = (function () {

    const SLOW = 0.35;              // playback speed (1 = real time)
    const MAX_SAMPLES = 900;        // about 15 s of flight at 60 frames a second
    const LAST_SECONDS = 5;         // a lead taken this late (or later) is a game-winner
    const SMALL_GAP = 15;           // seconds between two small (deep three) replays

    let clock = 0;                  // game time seen by record(), for the samples
    let playing = null;             // the replay on screen: { shot, t, full, title, done }
    let leadTaker = null;           // the make that last gave someone the lead
    let buzzerShot = null;          // the latest buzzer-beater by a human player
    let lastSmallAt = -99;
    const labelEl = document.getElementById('replay-label');

    // ---------- Recording ----------
    function record(dt) {
        const s = Game.state;
        if (s.mode !== 'playing') return;            // nothing moves during a pick
        clock += dt;
        for (const shooter of [Game.player, Game.rival]) {
            for (const ball of shooter.balls) {
                if (!ball.path) ball.path = [];
                if (ball.path.length >= MAX_SAMPLES) continue;
                ball.path.push({ t: clock, pos: ball.pos.slice(), spinAxis: ball.spinAxis.slice(), spinAngle: ball.spinAngle });
            }
        }
    }

    // Is this shooter a person (not the AI rival)?
    function human(shooter) { return shooter === Game.player || Game.state.twoPlayer; }

    // A recorded shot: the samples from the throw until the ball has fallen
    // through the net (a little after it drops below the rim)
    function shotFrom(ball, shooter, title) {
        const path = ball.path || [];
        if (path.length < 10) return null;
        const rimY = Physics.rimCenter(shooter.hoop)[1];
        let peak = 0;
        for (let i = 0; i < path.length; i++) if (path[i].pos[1] > path[peak].pos[1]) peak = i;
        let end = path.length - 1;
        for (let i = peak; i < path.length; i++) {
            if (path[i].pos[1] < rimY - 1.4) { end = i; break; }
        }
        return { path: path.slice(0, end + 1), shooter: shooter, title: title };
    }

    Game.on(function (name, data) {
        const s = Game.state;
        if (name === 'start') {
            stop();
            leadTaker = null;
            buzzerShot = null;
            lastSmallAt = -99;
        }
        if (name === 'basket') {
            const shooter = data.shooter, other = Game.opponentOf(shooter);
            // a lead change: remember it (a game-winner if it is the last one)
            if (shooter.score > other.score && shooter.score - data.points <= other.score) {
                leadTaker = { ball: data.ball, shooter: shooter, timeLeft: s.buzzer ? 0 : s.timeLeft, overtime: s.overtime };
            }
            if (!human(shooter)) return;
            if (s.buzzer) buzzerShot = { ball: data.ball, shooter: shooter };
            // a deep three during the game: the small replay (one-player only)
            else if (data.ball.points >= 3 && data.swish && !s.twoPlayer && !playing && clock - lastSmallAt > SMALL_GAP) {
                // wait a moment so the ball has dropped through the net
                const ball = data.ball;
                setTimeout(() => {
                    if (Game.state.mode !== 'playing' || playing) return;
                    const shot = shotFrom(ball, shooter, 'DEEP THREE');
                    if (shot) { lastSmallAt = clock; begin(shot, false); }
                }, 600);
            }
        }
    });

    // ---------- Playing ----------
    function begin(shot, full, done) {
        playing = { shot: shot, t: shot.path[0].t, full: full, done: done || null };
        labelEl.textContent = full ? `REPLAY: ${shot.title}   (any key or click to skip)` : `REPLAY: ${shot.title} (X to skip)`;
        labelEl.className = full ? 'full' : 'small';
        labelEl.style.display = 'block';
        document.body.classList.toggle('replaying', full);      // hides the small view's frame (style.css)
        document.body.classList.toggle('replaying-small', !full);   // hides its RIVAL tag
    }
    function stop() {
        if (!playing) return;
        const done = playing.done;
        playing = null;
        labelEl.style.display = 'none';
        document.body.classList.remove('replaying', 'replaying-small');
        if (done) done();
    }
    function skip() { stop(); }

    // Called by menus.js when the game ends. If the ending deserves a replay,
    // play it and call showResults when it ends or is skipped; return true.
    function playFinal(showResults) {
        const s = Game.state;
        let pick = null;
        // the game-winner: the winner's last lead change, late in the game
        const winner = s.result === 'win' ? Game.player : s.result === 'lose' ? Game.rival : null;
        if (winner && leadTaker && leadTaker.shooter === winner && human(winner) && leadTaker.timeLeft <= LAST_SECONDS) {
            pick = shotFrom(leadTaker.ball, winner, s.buzzer && leadTaker.timeLeft === 0 ? 'GAME-WINNING BUZZER-BEATER' : 'GAME-WINNER');
        }
        if (!pick && buzzerShot) pick = shotFrom(buzzerShot.ball, buzzerShot.shooter, 'BUZZER-BEATER');
        if (!pick) return false;
        stop();
        begin(pick, true, showResults);
        return true;
    }

    // Move the replay on (main.js, every frame)
    function update(dt) {
        if (!playing) return;
        playing.t += dt * SLOW;
        const path = playing.shot.path;
        if (playing.t >= path[path.length - 1].t) stop();
        // the small replay stops if the game is paused or over
        else if (!playing.full && Game.state.mode !== 'playing') stop();
    }

    // The replay ball at the current time, between two samples
    function ballNow() {
        const path = playing.shot.path;
        let i = 0;
        while (i < path.length - 2 && path[i + 1].t < playing.t) i++;
        const a = path[i], b = path[i + 1];
        const k = Math.max(0, Math.min(1, (playing.t - a.t) / Math.max(1e-6, b.t - a.t)));
        return {
            pos: a.pos.map((v, j) => v + (b.pos[j] - v) * k),
            spinAxis: a.spinAxis, spinAngle: a.spinAngle + (b.spinAngle - a.spinAngle) * k,
            mine: playing.shot.shooter === Game.player
        };
    }

    // The cinematic camera: in front of the hoop and off to one side, a bit
    // below the rim, so the ball arcs across the picture into the hoop. It
    // keeps the hoop near the middle and drifts in slowly as the replay plays.
    function camera(ball) {
        const shot = playing.shot, rim = Physics.rimCenter(shot.shooter.hoop);
        const start = shot.path[0].pos;
        // from the hoop toward where the shot came from (on the floor), and sideways
        let bx = start[0] - rim[0], bz = start[2] - rim[2];
        const len = Math.hypot(bx, bz) || 1;
        bx /= len; bz /= len;
        const sx = -bz, sz = bx;
        const progress = (playing.t - shot.path[0].t) / Math.max(0.01, shot.path[shot.path.length - 1].t - shot.path[0].t);
        const back = 4.6 - progress * 1.2, side = 3.4 - progress * 0.8;     // meters: the slow push-in
        const eye = [rim[0] + bx * back + sx * side, 2.1, rim[2] + bz * back + sz * side];
        const k = 0.3;                                  // how much the camera follows the ball
        const at = [rim[0] + (ball.pos[0] - rim[0]) * k, rim[1] - 0.2 + (ball.pos[1] - rim[1]) * k, rim[2] + (ball.pos[2] - rim[2]) * k];
        return { eye: eye, at: at, up: [0, 1, 0], fov: 58, near: 0.1, far: 200 };
    }

    // What main.js should draw for the replay this frame, or null:
    // { full: true or false, camera, balls, hoopX }
    function view() {
        if (!playing) return null;
        const ball = ballNow();
        return { full: playing.full, camera: camera(ball), balls: [ball], hoopX: playing.shot.shooter.hoop.base[0] };
    }

    // ---------- Skipping ----------
    // Any key or click skips the full-screen replay (and does nothing else,
    // so R cannot restart the game by accident); X skips the small one.
    window.addEventListener('keydown', (e) => {
        if (!playing) return;
        if (playing.full) { e.preventDefault(); e.stopImmediatePropagation(); skip(); }
        else if (e.code === 'KeyX') skip();
    }, true);
    window.addEventListener('mousedown', (e) => {
        if (playing && playing.full) { e.preventDefault(); e.stopImmediatePropagation(); skip(); }
    }, true);

    function active() { return !!playing; }

    return { record, update, view, playFinal, skip, active, SLOW };
})();

// physics.js — ball flight, collisions and basket detection (Justin)
//
// Units are meters and seconds. Y is up. The rim center sits above the
// origin (x = 0, z = 0); the shooter stands out on +z looking toward -z.
// No rendering here: Isaiah's code reads Physics.ball and Physics.hoopOffset
// and draws the objects in the same coordinates.

const Physics = (function () {

    // ---------- Court and hoop sizes (real basketball measurements) ----------
    const G = 9.81;
    const BALL_RADIUS = 0.12;           // size 7 ball
    const RIM_HEIGHT = 3.05;            // 10 ft
    const RIM_RADIUS = 0.2286;          // 18 in inner diameter
    const RIM_TUBE = 0.01;              // rim metal thickness (torus minor radius)
    const NET_DEPTH = 0.40;

    // Backboard: 1.83 m wide, 1.07 m tall, front face 0.381 m behind rim center
    const BOARD = {
        min: [-0.915, 2.90, -0.431],
        max: [ 0.915, 3.97, -0.381]
    };
    // Pole behind the board
    const POLE = {
        min: [-0.10, 0.00, -1.30],
        max: [ 0.10, 3.40, -1.10]
    };

    const RESTITUTION = { floor: 0.72, board: 0.60, rim: 0.50, pole: 0.40 };
    const FLOOR_FRICTION = 0.85;        // keeps this fraction of sideways speed per bounce
    const STEP = 1 / 240;               // fixed physics time step

    // ---------- State ----------
    const ball = {
        pos: [0, 2.1, 4.2],
        vel: [0, 0, 0],
        spinAxis: [1, 0, 0],            // rotate the ball model around this...
        spinAngle: 0,                   // ...by this many radians
        inFlight: false,
        flightTime: 0,
        touchedFloor: false,
        floorTime: 0
    };

    // Hard mode slides the whole hoop (pole -> board -> rim -> net) along x.
    const hoopOffset = [0, 0, 0];

    let accumulator = 0;
    let scoredThisShot = false;
    let touchedRimThisShot = false;
    let touchedBoardThisShot = false;
    let onBasket = null;                // callback(info) when a basket goes in
    let onBounce = null;                // callback(surface, speed) for sound effects

    // ---------- Small vector helpers (plain arrays, no MV.js needed) ----------
    function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    function len(a) { return Math.sqrt(dot(a, a)); }

    function rimCenter() {
        return [hoopOffset[0], RIM_HEIGHT, hoopOffset[2]];
    }

    // Bounce velocity off a surface with unit normal n
    function reflect(n, restitution, surface) {
        const vn = dot(ball.vel, n);
        if (vn >= 0) return;            // already moving away
        for (let i = 0; i < 3; i++) ball.vel[i] -= (1 + restitution) * vn * n[i];
        if (onBounce && -vn > 0.5) onBounce(surface, -vn);
    }

    // ---------- Collisions ----------
    function collideFloor() {
        if (ball.pos[1] >= BALL_RADIUS) return;
        ball.pos[1] = BALL_RADIUS;
        const wasFalling = ball.vel[1] < 0;
        reflect([0, 1, 0], RESTITUTION.floor, 'floor');
        if (wasFalling) {
            ball.vel[0] *= FLOOR_FRICTION;
            ball.vel[2] *= FLOOR_FRICTION;
            // Stop tiny bounces so the ball can roll
            if (ball.vel[1] < 0.4) ball.vel[1] = 0;
        }
        ball.touchedFloor = true;
    }

    // Sphere vs axis-aligned box (backboard, pole). Handles faces, edges and corners.
    function collideBox(box, restitution, surface) {
        const min = [box.min[0] + hoopOffset[0], box.min[1], box.min[2] + hoopOffset[2]];
        const max = [box.max[0] + hoopOffset[0], box.max[1], box.max[2] + hoopOffset[2]];
        const closest = [0, 0, 0];
        for (let i = 0; i < 3; i++) closest[i] = Math.max(min[i], Math.min(ball.pos[i], max[i]));
        const d = sub(ball.pos, closest);
        const dist = len(d);
        if (dist >= BALL_RADIUS) return false;

        let n;
        if (dist > 1e-6) {
            n = [d[0] / dist, d[1] / dist, d[2] / dist];
        } else {
            n = [0, 0, 1];              // center inside the box: push out the front
        }
        const push = BALL_RADIUS - dist;
        for (let i = 0; i < 3; i++) ball.pos[i] += n[i] * push;
        reflect(n, restitution, surface);
        return true;
    }

    // Sphere vs torus (the rim). The rim is a circle of radius RIM_RADIUS lying
    // flat at RIM_HEIGHT; find the closest point on that circle and treat the
    // rim as a tube of radius RIM_TUBE around it.
    function collideRim() {
        const c = rimCenter();
        const q = sub(ball.pos, c);
        const d = Math.sqrt(q[0] * q[0] + q[2] * q[2]);
        let ring;
        if (d > 1e-6) ring = [q[0] / d * RIM_RADIUS, 0, q[2] / d * RIM_RADIUS];
        else ring = [RIM_RADIUS, 0, 0];
        const n = sub(q, ring);
        const dist = len(n);
        const minDist = RIM_TUBE + BALL_RADIUS;
        if (dist >= minDist || dist < 1e-6) return false;
        for (let i = 0; i < 3; i++) n[i] /= dist;
        const push = minDist - dist;
        for (let i = 0; i < 3; i++) ball.pos[i] += n[i] * push;
        reflect(n, RESTITUTION.rim, 'rim');
        return true;
    }

    // A basket counts when the ball's center crosses the rim plane going down
    // while inside the rim circle (plan, advanced feature 1).
    function checkBasket(prevY) {
        if (scoredThisShot) return;
        const c = rimCenter();
        if (!(prevY > c[1] && ball.pos[1] <= c[1] && ball.vel[1] < 0)) return;
        const dx = ball.pos[0] - c[0];
        const dz = ball.pos[2] - c[2];
        if (Math.sqrt(dx * dx + dz * dz) < RIM_RADIUS) {
            scoredThisShot = true;
            const info = {
                swish: !touchedRimThisShot && !touchedBoardThisShot,
                bank: touchedBoardThisShot
            };
            if (onBasket) onBasket(info);
        }
    }

    // The net slows the ball a little as it drops through
    function applyNet(dt) {
        const c = rimCenter();
        const dx = ball.pos[0] - c[0];
        const dz = ball.pos[2] - c[2];
        const inside = Math.sqrt(dx * dx + dz * dz) < RIM_RADIUS &&
            ball.pos[1] < c[1] && ball.pos[1] > c[1] - NET_DEPTH;
        if (!inside) return;
        const keep = Math.pow(0.15, dt);     // strong drag on sideways motion
        ball.vel[0] *= keep;
        ball.vel[2] *= keep;
        ball.vel[1] *= Math.pow(0.6, dt);
    }

    // One fixed-size physics step
    function step(dt) {
        const prevY = ball.pos[1];

        ball.vel[1] -= G * dt;
        for (let i = 0; i < 3; i++) ball.pos[i] += ball.vel[i] * dt;

        if (collideRim()) touchedRimThisShot = true;
        if (collideBox(BOARD, RESTITUTION.board, 'board')) touchedBoardThisShot = true;
        collideBox(POLE, RESTITUTION.pole, 'pole');
        collideFloor();
        checkBasket(prevY);
        applyNet(dt);

        // Spin for the renderer: backspin while flying, rolling spin on the floor
        const hs = Math.sqrt(ball.vel[0] * ball.vel[0] + ball.vel[2] * ball.vel[2]);
        if (hs > 1e-3) ball.spinAxis = [-ball.vel[2] / hs, 0, ball.vel[0] / hs];
        const spinRate = ball.touchedFloor ? hs / BALL_RADIUS : -18;   // rad/s
        ball.spinAngle += spinRate * dt;

        ball.flightTime += dt;
        if (ball.touchedFloor) ball.floorTime += dt;
    }

    // ---------- Public functions ----------

    // Advance the simulation by a frame's worth of time (any size).
    function update(frameDt) {
        if (!ball.inFlight) return;
        accumulator += Math.min(frameDt, 0.1);   // avoid a huge jump after a tab switch
        while (accumulator >= STEP) {
            step(STEP);
            accumulator -= STEP;
        }
    }

    // Put the ball in the shooter's hands at a spot
    function placeBall(pos) {
        ball.pos = pos.slice();
        ball.vel = [0, 0, 0];
        ball.inFlight = false;
        ball.flightTime = 0;
        ball.touchedFloor = false;
        ball.floorTime = 0;
        accumulator = 0;
    }

    // Launch the ball with a velocity vector
    function launch(vel) {
        ball.vel = vel.slice();
        ball.inFlight = true;
        ball.flightTime = 0;
        ball.touchedFloor = false;
        ball.floorTime = 0;
        scoredThisShot = false;
        touchedRimThisShot = false;
        touchedBoardThisShot = false;
        accumulator = 0;
    }

    // Is the shot finished? (lets game.js hand the player a new ball)
    function shotOver() {
        if (!ball.inFlight) return false;
        const out = Math.abs(ball.pos[0]) > 15 || Math.abs(ball.pos[2]) > 15;
        return out || ball.floorTime > 0.8 || ball.flightTime > 4.0;
    }

    function setHoopOffset(x, z) {
        hoopOffset[0] = x;
        hoopOffset[2] = z || 0;
    }

    // Points along the flight path, ignoring collisions. Used for the
    // easy-mode aim arc (draw as a line strip).
    function predictPath(start, vel, seconds, count) {
        const pts = [];
        for (let i = 0; i <= count; i++) {
            const t = (seconds * i) / count;
            const y = start[1] + vel[1] * t - 0.5 * G * t * t;
            if (y < 0) break;
            pts.push([start[0] + vel[0] * t, y, start[2] + vel[2] * t]);
        }
        return pts;
    }

    return {
        // constants Isaiah can use to build matching geometry
        G, BALL_RADIUS, RIM_HEIGHT, RIM_RADIUS, RIM_TUBE, NET_DEPTH, BOARD, POLE,
        ball, hoopOffset,
        update, placeBall, launch, shotOver, setHoopOffset, predictPath, rimCenter,
        get scored() { return scoredThisShot; },
        set onBasket(fn) { onBasket = fn; },
        set onBounce(fn) { onBounce = fn; }
    };
})();

if (typeof module !== 'undefined') module.exports = Physics;

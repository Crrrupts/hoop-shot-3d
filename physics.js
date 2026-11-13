// physics.js — ball flight, collisions and basket detection (Justin)
//
// Units are meters and seconds. Y is up. The rim center sits above the
// origin (x = 0, z = 0); the shooter stands out on +z looking toward -z.
// No rendering here: renderer.js draws the balls and hoops in the same coordinates.

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

    // How much speed a bounce keeps (1 = all of it, 0 = none)
    const RESTITUTION = { floor: 0.72, board: 0.55, rim: 0.45, pole: 0.40 };
    // Rim and backboard also rub the ball: a hit keeps this fraction of the
    // ball's sideways (sliding) speed, so shots do not skid off like on ice.
    const GRIP = { rim: 0.88, board: 0.92 };
    // A bounce slower than this (m/s) is not a bounce at all: the ball stays
    // touching and rolls. This is what lets a soft shot roll around the rim
    // and drop in or fall out, instead of buzzing in tiny bounces.
    const ROLL_SPEED = 0.7;
    const WEDGE_TIME = 0.8;             // seconds on the rim before a stuck ball is eased off it
    const WEDGE_PULL = 3.0;             // how hard it is eased toward the middle of the hoop (m/s^2)
    const FLOOR_FRICTION = 0.85;        // keeps this fraction of sideways speed per bounce
    const STEP = 1 / 240;               // fixed physics time step

    // ---------- Hoops and balls ----------
    // The game can have several hoops (yours and the rival's) and many balls
    // in the air at once, so both are plain objects made by these functions.

    // A hoop standing at (x, z) on the floor. Sizes above are measured from there.
    function createHoop(x, z) {
        return {
            base: [x, 0, z],            // where the hoop normally stands
            offset: [0, 0, 0],          // Moving Hoop power-up slides the whole hoop by this
            rimScale: 1,                // Wide Rim / Tiny Rim power-ups change the rim size
            slippery: false,            // Slippery Ball power-up: wild bounces off the rim
            // Court rules (see courts.js):
            rimBounce: RESTITUTION.rim, // lower = a soft, forgiving rim; higher = a stiff rim
            rimThickness: 1,            // outdoor double rims are thicker
            floorBounce: RESTITUTION.floor  // a wet floor bounces less
        };
    }

    // A ball that will be thrown at one hoop. owner is whoever shot it (game.js uses it).
    function createBall(hoop, owner) {
        return {
            hoop: hoop,
            owner: owner || null,
            pos: [0, 0, 0],
            vel: [0, 0, 0],
            spinAxis: [1, 0, 0],        // rotate the ball model around this...
            spinAngle: 0,               // ...by this many radians
            inFlight: false,
            flightTime: 0,
            touchedFloor: false,
            floorTime: 0,
            scored: false,
            touchedRim: false,
            touchedBoard: false,
            wind: [0, 0, 0],            // sideways push while flying (m/s^2), set when thrown
            rimTime: 0,                 // seconds spent touching the rim (to free a stuck ball)
            accumulator: 0,             // left-over time for the fixed time step
            silent: false               // true for test throws that should not make sounds or score
        };
    }

    let onBasket = null;                // callback(ball, info) when a basket goes in
    let onBounce = null;                // callback(ball, surface, speed) for sound effects

    // ---------- Small vector helpers (plain arrays, no MV.js needed) ----------
    function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    function len(a) { return Math.sqrt(dot(a, a)); }

    // Where the hoop is standing right now (base + Moving Hoop offset)
    function hoopOrigin(hoop) {
        return [hoop.base[0] + hoop.offset[0], 0, hoop.base[2] + hoop.offset[2]];
    }
    function rimCenter(hoop) {
        const o = hoopOrigin(hoop);
        return [o[0], RIM_HEIGHT, o[2]];
    }
    function rimRadius(hoop) {
        return RIM_RADIUS * hoop.rimScale;
    }

    // Bounce velocity off a surface with unit normal n
    function reflect(ball, n, restitution, surface) {
        const vn = dot(ball.vel, n);
        if (vn >= 0) return;            // already moving away
        for (let i = 0; i < 3; i++) ball.vel[i] -= (1 + restitution) * vn * n[i];
        if (onBounce && !ball.silent && -vn > 0.5) onBounce(ball, surface, -vn);
    }

    // Bounce off the rim or backboard: like reflect, plus grip and rolling.
    // The velocity is split into the part going into the surface (along n)
    // and the part sliding along it.
    function bounce(ball, n, restitution, grip, surface) {
        const vn = dot(ball.vel, n);
        if (vn >= 0) return;            // already moving away
        const impact = -vn;
        let out = impact * restitution;             // speed back out of the surface
        if (out < ROLL_SPEED) out = 0;              // too slow to bounce: keep touching and roll
        // a real hit rubs off some sliding speed; a rolling ball keeps almost all of it
        const keep = impact > 0.5 ? grip : 0.9995;
        for (let i = 0; i < 3; i++) {
            const sliding = ball.vel[i] - vn * n[i];
            ball.vel[i] = sliding * keep + out * n[i];
        }
        if (onBounce && !ball.silent && impact > 0.5) onBounce(ball, surface, impact);
    }

    // ---------- Collisions ----------
    function collideFloor(ball) {
        if (ball.pos[1] >= BALL_RADIUS) return;
        ball.pos[1] = BALL_RADIUS;
        const wasFalling = ball.vel[1] < 0;
        reflect(ball, [0, 1, 0], ball.hoop.floorBounce, 'floor');
        if (wasFalling) {
            ball.vel[0] *= FLOOR_FRICTION;
            ball.vel[2] *= FLOOR_FRICTION;
            // Stop tiny bounces so the ball can roll
            if (ball.vel[1] < 0.4) ball.vel[1] = 0;
        }
        ball.touchedFloor = true;
    }

    // Sphere vs axis-aligned box (backboard, pole). Handles faces, edges and corners.
    // grip is optional: the backboard has it, the pole does not.
    function collideBox(ball, box, restitution, surface, grip) {
        const o = hoopOrigin(ball.hoop);
        const min = [box.min[0] + o[0], box.min[1], box.min[2] + o[2]];
        const max = [box.max[0] + o[0], box.max[1], box.max[2] + o[2]];
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
        if (grip) bounce(ball, n, restitution, grip, surface);
        else reflect(ball, n, restitution, surface);
        return true;
    }

    // Sphere vs torus (the rim). The rim is a circle of radius RIM_RADIUS lying
    // flat at RIM_HEIGHT; find the closest point on that circle and treat the
    // rim as a tube of radius RIM_TUBE around it.
    function collideRim(ball) {
        const c = rimCenter(ball.hoop);
        const R = rimRadius(ball.hoop);
        const q = sub(ball.pos, c);
        const d = Math.sqrt(q[0] * q[0] + q[2] * q[2]);
        let ring;
        if (d > 1e-6) ring = [q[0] / d * R, 0, q[2] / d * R];
        else ring = [R, 0, 0];
        const n = sub(q, ring);
        const dist = len(n);
        const minDist = RIM_TUBE * ball.hoop.rimThickness + BALL_RADIUS;
        if (dist >= minDist || dist < 1e-6) return false;
        for (let i = 0; i < 3; i++) n[i] /= dist;
        const push = minDist - dist;
        for (let i = 0; i < 3; i++) ball.pos[i] += n[i] * push;
        if (ball.hoop.slippery) {
            // Slippery Ball: a livelier bounce plus a random sideways kick
            reflect(ball, n, 0.85, 'rim');
            ball.vel[0] += (Math.random() - 0.5) * 2.5;
            ball.vel[2] += (Math.random() - 0.5) * 2.5;
        } else {
            bounce(ball, n, ball.hoop.rimBounce, GRIP.rim, 'rim');
        }
        // A ball can come to rest on the rim, often wedged against the
        // backboard. After a moment, ease it toward the middle of the hoop
        // so it drops through or rolls off instead of sitting there.
        ball.rimTime += STEP;
        if (ball.rimTime > WEDGE_TIME && d > 1e-6) {
            ball.vel[0] -= q[0] / d * WEDGE_PULL * STEP;
            ball.vel[2] -= q[2] / d * WEDGE_PULL * STEP;
        }
        return true;
    }

    // A basket counts when the ball's center crosses the rim plane going down
    // while inside the rim circle (plan, advanced feature 1).
    function checkBasket(ball, prevY) {
        if (ball.scored) return;
        const c = rimCenter(ball.hoop);
        if (!(prevY > c[1] && ball.pos[1] <= c[1] && ball.vel[1] < 0)) return;
        const dx = ball.pos[0] - c[0];
        const dz = ball.pos[2] - c[2];
        if (Math.sqrt(dx * dx + dz * dz) < rimRadius(ball.hoop)) {
            ball.scored = true;
            const info = {
                swish: !ball.touchedRim && !ball.touchedBoard,
                bank: ball.touchedBoard
            };
            if (onBasket && !ball.silent) onBasket(ball, info);
        }
    }

    // The net slows the ball a little as it drops through
    function applyNet(ball, dt) {
        const c = rimCenter(ball.hoop);
        const dx = ball.pos[0] - c[0];
        const dz = ball.pos[2] - c[2];
        const inside = Math.sqrt(dx * dx + dz * dz) < rimRadius(ball.hoop) &&
            ball.pos[1] < c[1] && ball.pos[1] > c[1] - NET_DEPTH;
        if (!inside) return;
        const keep = Math.pow(0.15, dt);     // strong drag on sideways motion
        ball.vel[0] *= keep;
        ball.vel[2] *= keep;
        ball.vel[1] *= Math.pow(0.6, dt);
    }

    // One fixed-size physics step
    function step(ball, dt) {
        const prevY = ball.pos[1];

        ball.vel[1] -= G * dt;
        if (!ball.touchedFloor) {       // wind only pushes a ball that is in the air
            ball.vel[0] += ball.wind[0] * dt;
            ball.vel[2] += ball.wind[2] * dt;
        }
        for (let i = 0; i < 3; i++) ball.pos[i] += ball.vel[i] * dt;

        if (collideRim(ball)) ball.touchedRim = true;
        if (collideBox(ball, BOARD, RESTITUTION.board, 'board', GRIP.board)) ball.touchedBoard = true;
        collideBox(ball, POLE, RESTITUTION.pole, 'pole');
        collideFloor(ball);
        checkBasket(ball, prevY);
        applyNet(ball, dt);

        // Spin for the renderer: backspin while flying, rolling spin on the floor.
        // The axis is level and points to the left of the ball's travel.
        const hs = Math.sqrt(ball.vel[0] * ball.vel[0] + ball.vel[2] * ball.vel[2]);
        if (hs > 1e-3) ball.spinAxis = [-ball.vel[2] / hs, 0, ball.vel[0] / hs];
        const spinRate = ball.touchedFloor ? -hs / BALL_RADIUS : 18;   // rad/s
        ball.spinAngle += spinRate * dt;

        ball.flightTime += dt;
        if (ball.touchedFloor) ball.floorTime += dt;
    }

    // ---------- Public functions ----------

    // Advance one ball by a frame's worth of time (any size).
    function update(ball, frameDt) {
        if (!ball.inFlight) return;
        ball.accumulator += Math.min(frameDt, 0.1);   // avoid a huge jump after a tab switch
        while (ball.accumulator >= STEP) {
            step(ball, STEP);
            ball.accumulator -= STEP;
        }
    }

    // Throw a ball from a position with a velocity vector
    function launch(ball, pos, vel) {
        ball.pos = pos.slice();
        ball.vel = vel.slice();
        ball.inFlight = true;
        ball.flightTime = 0;
        ball.touchedFloor = false;
        ball.floorTime = 0;
        ball.scored = false;
        ball.touchedRim = false;
        ball.touchedBoard = false;
        ball.rimTime = 0;
        ball.accumulator = 0;
    }

    // Is this ball finished? (game.js removes it from the court)
    function shotOver(ball) {
        if (!ball.inFlight) return false;
        const o = ball.hoop.base;
        const out = Math.abs(ball.pos[0] - o[0]) > 15 || Math.abs(ball.pos[2] - o[2]) > 15;
        return out || ball.floorTime > 0.8 || ball.flightTime > 6.0;
    }

    // Would a throw go in? Runs the whole shot instantly on a copy, without
    // sounds or scoring. Used for the rival's aim and the Sweet Spot zone.
    // options (optional): { rimScale, wind } to try a different rim size or wind.
    function wouldScore(hoop, pos, vel, options) {
        options = options || {};
        const testHoop = createHoop(hoop.base[0], hoop.base[2]);
        testHoop.rimScale = options.rimScale || hoop.rimScale;
        testHoop.rimBounce = hoop.rimBounce;
        testHoop.rimThickness = hoop.rimThickness;
        testHoop.floorBounce = hoop.floorBounce;
        const ball = createBall(testHoop, null);
        ball.silent = true;
        if (options.wind) ball.wind = options.wind.slice();
        launch(ball, pos, vel);
        // Stop as soon as the answer is known: it scored, it reached the floor,
        // or it is falling well below the rim (nothing down there can send it
        // back up into the hoop, so it can no longer score).
        const giveUpBelow = RIM_HEIGHT - 0.35;
        for (let i = 0; i < 6 * 240 && !ball.touchedFloor && !ball.scored; i++) {
            step(ball, STEP);
            if (ball.vel[1] < 0 && ball.pos[1] < giveUpBelow) break;
        }
        return ball.scored;
    }

    // Points along the flight path, ignoring collisions. Used for the aim arc
    // (draw as a line strip). wind is optional.
    function predictPath(start, vel, seconds, count, wind) {
        wind = wind || [0, 0, 0];
        const pts = [];
        for (let i = 0; i <= count; i++) {
            const t = (seconds * i) / count;
            const y = start[1] + vel[1] * t - 0.5 * G * t * t;
            if (y < 0) break;
            pts.push([
                start[0] + vel[0] * t + 0.5 * wind[0] * t * t,
                y,
                start[2] + vel[2] * t + 0.5 * wind[2] * t * t
            ]);
        }
        return pts;
    }

    return {
        // constants Isaiah can use to build matching geometry
        G, BALL_RADIUS, RIM_HEIGHT, RIM_RADIUS, RIM_TUBE, NET_DEPTH, BOARD, POLE,
        createHoop, createBall, update, launch, shotOver, wouldScore, predictPath,
        hoopOrigin, rimCenter, rimRadius,
        set onBasket(fn) { onBasket = fn; },
        set onBounce(fn) { onBounce = fn; }
    };
})();

if (typeof module !== 'undefined') module.exports = Physics;

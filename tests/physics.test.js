// Run with:  node tests/physics.test.js
// Checks the physics and shot tuning without a browser.
globalThis.Physics = require('../physics.js');
const Game = require('../game.js');
const { check, finish } = require('./check.js');

const hoop = Physics.createHoop(0, 0);
const shooter = { hoop: hoop };         // enough of a shooter for Game.spotPosition

// Simulate one shot to the end; returns {scored, events}
function simulate(spot, power, aimX, aimY, hoopX) {
    let scored = false;
    const events = [];
    Physics.onBasket = () => { scored = true; };
    Physics.onBounce = (ball, surface) => events.push(surface);
    hoop.offset[0] = hoopX || 0;
    const ball = Physics.createBall(hoop);
    Physics.launch(ball, Game.spotPosition(spot, shooter), Game.shotVelocity(spot, power, aimX, aimY, 0));
    let t = 0;
    while (!Physics.shotOver(ball) && t < 10) { Physics.update(ball, 1 / 60); t += 1 / 60; }
    hoop.offset[0] = 0;
    return { scored, events, time: t };
}

// Drop or throw a ball and run it for some frames
function run(pos, vel, frames, eachFrame) {
    const ball = Physics.createBall(hoop);
    Physics.launch(ball, pos, vel);
    for (let i = 0; i < frames; i++) { Physics.update(ball, 1 / 60); if (eachFrame) eachFrame(ball); }
    return ball;
}

// 1. Every spot can be made with the mouse centered, inside 0-100 power
for (let spot = 1; spot <= 5; spot++) {
    const makes = [];
    for (let p = 0; p <= 100; p += 0.25) if (simulate(spot, p, 0, 0).scored) makes.push(p);
    const lo = makes.length ? makes[0] : null, hi = makes.length ? makes[makes.length - 1] : null;
    check(`spot ${spot} is makeable`, makes.length > 0,
        makes.length ? `scores at power ${lo}-${hi}, ${makes.length} of 401 power values` : 'never scores');
}

// 2. A weak shot misses, a huge shot misses
check('0% power misses', !simulate(3, 0, 0, 0).scored);
check('100% power misses', !simulate(3, 100, 0, 0).scored);

// 3. Ball comes to rest on the floor, never sinks through
let minY = 99;
run([0, 2, 3], [0, 0, 0], 600, (ball) => { minY = Math.min(minY, ball.pos[1]); });
check('ball never goes through the floor', minY >= Physics.BALL_RADIUS - 1e-6, 'lowest y ' + minY.toFixed(3));

// 4. Ball thrown straight at the backboard bounces back
const boardBall = run([0.5, 3.3, 1], [0, 0.5, -8], 30);
check('backboard bounces the ball back', boardBall.vel[2] > 0 && boardBall.pos[2] > Physics.BOARD.max[2]);

// 5. Ball dropped straight onto the rim metal bounces off and does not score
let rimScore = false;
Physics.onBasket = () => { rimScore = true; };
const rimBall = run([Physics.RIM_RADIUS + 0.05, 4, 0], [0, 0, 0], 120);
check('ball dropped on rim bounces outward, no basket', !rimScore && rimBall.pos[0] > Physics.RIM_RADIUS);

// 6. Ball dropped through the middle scores exactly once
let count = 0;
Physics.onBasket = () => { count++; };
run([0, 4, 0], [0, 0, 0], 180);
check('drop through center scores once', count === 1, 'count ' + count);

// 7. Moving hoop: a shot tuned for a centered hoop misses when the hoop is 1 m away
let goodPower = null;
for (let p = 0; p <= 100 && goodPower === null; p += 0.25) if (simulate(3, p, 0, 0).scored) goodPower = p;
check('moved hoop makes the same shot miss', !simulate(3, goodPower, 0, 0, 1.0).scored);

// 8. Frame rate does not change the result (fixed time step)
function simulateFps(fps) {
    const ball = Physics.createBall(hoop);
    Physics.launch(ball, Game.spotPosition(3, shooter), Game.shotVelocity(3, 50, 0.1, 0.2, 0));
    for (let t = 0; t < 1.2; t += 1 / fps) Physics.update(ball, 1 / fps);
    return ball.pos.slice();
}
const a = simulateFps(30), b = simulateFps(144);
const diff = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
check('same result at 30 and 144 fps', diff < 0.05, 'difference ' + diff.toFixed(3) + ' m');

// 9. Several balls fly at once without affecting each other
Physics.onBasket = null;
const one = Physics.createBall(hoop), two = Physics.createBall(hoop);
Physics.launch(one, [0, 2, 4], [0, 6, -3]);
Physics.launch(two, [1, 2, 4], [0, 6, -3]);
for (let i = 0; i < 30; i++) { Physics.update(one, 1 / 60); Physics.update(two, 1 / 60); }
check('two balls in the air at once', one.inFlight && two.inFlight &&
    Math.abs(one.pos[1] - two.pos[1]) < 1e-9 && Math.abs(two.pos[0] - one.pos[0] - 1) < 1e-9);

// 10. A second hoop somewhere else works the same way
const farHoop = Physics.createHoop(15, 0);
let farScore = 0;
Physics.onBasket = (ball) => { if (ball.hoop === farHoop) farScore++; };
const farBall = Physics.createBall(farHoop);
Physics.launch(farBall, [15, 4, 0], [0, 0, 0]);
for (let i = 0; i < 180; i++) Physics.update(farBall, 1 / 60);
check('a ball scores on a second hoop', farScore === 1);

// 11. Rim size power-ups: a wider rim accepts more power values, a smaller rim fewer
function windowWidth(rimScale) {
    const w = Game.makeWindow(shooter, 3, 0, 0, { rimScale: rimScale });
    return w ? w.hi - w.lo : 0;
}
const normal = windowWidth(1), wide = windowWidth(1.2), tiny = windowWidth(0.85);
check('Wide Rim is easier, Tiny Rim is harder', wide > normal && tiny < normal,
    `power window: tiny ${tiny}, normal ${normal}, wide ${wide}`);

finish();

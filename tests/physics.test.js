// Run with:  node tests/physics.test.js
// Checks the physics and shot tuning without a browser.
globalThis.Physics = require('../physics.js');
const Game = require('../game.js');

let failures = 0;
function check(name, ok, extra) {
    console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  (' + extra + ')' : ''));
    if (!ok) failures++;
}

// Simulate one shot to the end; returns {scored, events}
function simulate(spot, power, aimX, aimY, hoopX) {
    let scored = false;
    const events = [];
    Physics.onBasket = () => { scored = true; };
    Physics.onBounce = (s) => events.push(s);
    Physics.setHoopOffset(hoopX || 0, 0);
    Physics.placeBall(Game.spotPosition(spot));
    Physics.launch(Game.shotVelocity(spot, power, aimX, aimY, 0));
    let t = 0;
    while (!Physics.shotOver() && t < 10) { Physics.update(1 / 60); t += 1 / 60; }
    return { scored, events, time: t };
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
Physics.placeBall([0, 2, 3]);
Physics.launch([0, 0, 0]);
let minY = 99;
for (let i = 0; i < 600; i++) { Physics.update(1 / 60); minY = Math.min(minY, Physics.ball.pos[1]); }
check('ball never goes through the floor', minY >= Physics.BALL_RADIUS - 1e-6, 'lowest y ' + minY.toFixed(3));

// 4. Ball thrown straight at the backboard bounces back
Physics.setHoopOffset(0, 0);
Physics.placeBall([0.5, 3.3, 1]);
Physics.launch([0, 0.5, -8]);
for (let i = 0; i < 30; i++) Physics.update(1 / 60);
check('backboard bounces the ball back', Physics.ball.vel[2] > 0 && Physics.ball.pos[2] > Physics.BOARD.max[2]);

// 5. Ball dropped straight onto the rim metal bounces off and does not score
Physics.setHoopOffset(0, 0);
let rimScore = false;
Physics.onBasket = () => { rimScore = true; };
Physics.placeBall([Physics.RIM_RADIUS + 0.05, 4, 0]);
Physics.launch([0, 0, 0]);
for (let i = 0; i < 120; i++) Physics.update(1 / 60);
check('ball dropped on rim bounces outward, no basket', !rimScore && Physics.ball.pos[0] > Physics.RIM_RADIUS);

// 6. Ball dropped through the middle scores exactly once
let count = 0;
Physics.onBasket = () => { count++; };
Physics.placeBall([0, 4, 0]);
Physics.launch([0, 0, 0]);
for (let i = 0; i < 180; i++) Physics.update(1 / 60);
check('drop through center scores once', count === 1, 'count ' + count);

// 7. Moving hoop: a shot tuned for a centered hoop misses when the hoop is 1 m away
let goodPower = null;
for (let p = 0; p <= 100 && goodPower === null; p += 0.25) if (simulate(3, p, 0, 0).scored) goodPower = p;
check('moved hoop makes the same shot miss', !simulate(3, goodPower, 0, 0, 1.0).scored);

// 8. Frame rate does not change the result (fixed time step)
function simulateFps(fps) {
    Physics.setHoopOffset(0, 0);
    Physics.placeBall(Game.spotPosition(3));
    Physics.launch(Game.shotVelocity(3, 50, 0.1, 0.2, 0));
    for (let t = 0; t < 1.2; t += 1 / fps) Physics.update(1 / fps);
    return Physics.ball.pos.slice();
}
const a = simulateFps(30), b = simulateFps(144);
const diff = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
check('same result at 30 and 144 fps', diff < 0.05, 'difference ' + diff.toFixed(3) + ' m');

console.log(failures ? `\n${failures} test(s) failed` : '\nAll tests passed');
process.exit(failures ? 1 : 0);

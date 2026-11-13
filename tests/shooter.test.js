// Run with:  node tests/shooter.test.js
// Checks the shooter's pose: the motion follows the power bar and the hands hold the ball.
const Shooter = require('../shooter.js');
const { check, finish } = require('./check.js');

const B = Shooter.BODY;
const rest = Shooter.pose(0, 99, 0);
check('standing straight at rest, ball at the chest', Math.abs(rest.hipY - Shooter.STAND_HIP) < 1e-9 && rest.knee === 0 &&
    rest.ball[1] > 1.2 && rest.ball[1] < 1.45, 'ball height ' + rest.ball[1].toFixed(2));

// the motion follows the bar at every point: more power = deeper knees, ball never lower
let kneesDeepen = true, ballNeverDrops = true, last = rest;
for (let power = 1; power <= 100; power++) {
    const p = Shooter.pose(power / 100, 99, 0);
    if (p.knee <= last.knee || p.hipY >= last.hipY) kneesDeepen = false;
    if (p.ball[1] < last.ball[1] - 1e-9) ballNeverDrops = false;
    last = p;
}
check('knees bend more as the bar fills', kneesDeepen, 'full bar: ' + Math.round(last.knee * 180 / Math.PI) + ' degrees');
check('the ball rises as the bar fills and never drops', ballNeverDrops);
check('the same bar value always gives the same pose', JSON.stringify(Shooter.pose(0.43, 99, 5)) === JSON.stringify(Shooter.pose(0.43, 99, 5)));
for (const power of [60, 75, 100]) {
    const p = Shooter.pose(power / 100, 99, 0);
    check(`at ${power}% power the ball is at release height (2.1 m)`, Math.abs(p.ball[1] - 2.1) < 0.02, p.ball[1].toFixed(2) + ' m');
}

// the hands really hold the ball in every pose
let worst = 0;
for (let power = 0; power <= 95; power += 5) {
    for (const since of [99, 0.05, 0.2, 0.5]) {
        const p = Shooter.pose(power / 100, since, 0);
        [1, -1].forEach((side, i) => {
            const hand = Shooter.handPosition([side * B.shoulder, p.hipY + B.torso, 0], p.arms[i]);
            const target = [side * 0.09, p.hands[1], p.hands[2]];
            worst = Math.max(worst, Math.hypot(hand[0] - target[0], hand[1] - target[1], hand[2] - target[2]));
        });
    }
}
check('both hands reach the ball in every pose', worst < 0.03, 'largest gap ' + (worst * 100).toFixed(1) + ' cm');
check('elbows bend the right way (never backwards)', [0, 0.3, 0.6, 1].every((c) => Shooter.pose(c, 99, 0).arms.every((a) => a.elbow >= 0 && a.elbow <= Math.PI)));

// follow-through after a release
const through = Shooter.pose(0, 0.2, 0);
check('follow-through: legs straight, a small hop, arms reaching up', through.follow === 1 && through.knee === 0 &&
    through.hipY > Shooter.STAND_HIP && through.hands[1] > 2.1, 'hands at ' + through.hands[1].toFixed(2) + ' m');
check('the follow-through ends after about two thirds of a second', Shooter.followAmount(0.7) === 0 && Shooter.followAmount(0.3) === 1);
check('starting a new charge takes over from the follow-through', Shooter.pose(0.2, 0.2, 0).follow === 0);

finish();

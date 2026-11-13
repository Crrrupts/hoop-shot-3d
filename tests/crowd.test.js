// Run with:  node tests/crowd.test.js
// Checks the crowd size and placement for every court.
const Courts = require('../courts.js');
const Crowd = require('../crowd.js');
const { check, finish } = require('./check.js');

// the floor and hoops the renderer uses: your hoop at x = 0, the rival's at x = 15
const X0 = -7.5, X1 = 22.5, HOOPS = [0, 15];
const counts = {};
for (const court of Courts.LIST) {
    Crowd.build(court.look, X0, X1, HOOPS);
    const fans = Crowd.getFans();
    counts[court.id] = fans.length;
    const behindHoop = fans.filter((f) => HOOPS.some((h) => Math.abs(f.x - h) < 1.5)).length;
    const outside = fans.filter((f) => f.x < X0 || f.x > X1).length;
    check(`${court.name}: nobody stands behind a hoop or off the floor`, behindHoop === 0 && outside === 0);
}
check('crowd size matches the court: a handful at the YMCA, a packed Pro Arena',
    counts.ymca <= 6 && counts.home === 30 && counts.neon === 40 && counts.arena >= 150,
    JSON.stringify(counts));
check('the outdoor courts have just a few people standing', counts.boardwalk <= 8 && counts.rooftop <= 8 && counts.lake <= 8);
// the packed arena: fans spread over all the bleacher rows, not piled up
Crowd.build(Courts.byId('arena').look, X0, X1, HOOPS);
const rows = new Set(Crowd.getFans().map((f) => f.z));
const xs = Crowd.getFans().map((f) => f.x).sort((a, b) => a - b);
let biggestGap = 0;
for (let i = 1; i < xs.length; i++) if (!HOOPS.some((h) => xs[i - 1] < h && xs[i] > h)) biggestGap = Math.max(biggestGap, xs[i] - xs[i - 1]);
check('the Pro Arena crowd fills 4 bleacher rows with no empty stretches', rows.size === 4 && Crowd.getBleachers().length === 4 && biggestGap < 1.2,
    `${rows.size} rows, largest gap ${biggestGap.toFixed(2)} m`);
Crowd.build(Courts.byId('boardwalk').look, X0, X1, HOOPS);
check('outdoor courts have no bleachers', Crowd.getBleachers().length === 0);

finish();

// Run with:  node tests/rules.test.js
// Checks the match rules without a browser: streak tiers, rapid fire,
// power-up odds and effects, the AI rival, overtime and a whole match.
globalThis.Physics = require('../physics.js');
const PowerUps = require('../powerups.js');
const Game = require('../game.js');
const { check, finish } = require('./check.js');

const player = Game.player, rival = Game.rival, state = Game.state;
const noCards = { name: 'Test', accuracy: 0, pace: 999, maxRarity: null };    // a rival that never shoots

// Run the game for some seconds at 60 frames per second
function run(seconds) {
    for (let t = 0; t < seconds; t += 1 / 60) Game.update(1 / 60);
}
// Start a match where power-up picks never interrupt (unless a test wants them)
function quietStart(options) {
    Game.start(Object.assign({ rival: noCards }, options));
    state.nextPickAt = Infinity;
    state.pickNumber = 99;
}
// A power value that scores for a shooter's current spot
function goodPower(shooter) {
    return Game.makeWindow(shooter, shooter.spot, 0, 0, 1).best;
}
// Throw a make or a miss for the player and wait for it to land
function playerShot(make) {
    Game.throwBall(player, make ? goodPower(player) : 5, 0, 0, 0);
    run(3);
}

// ---------- Streak tiers ----------
quietStart();
const points = [];
for (let i = 0; i < 8; i++) { const before = player.score; playerShot(true); points.push(player.score - before); }
check('streak tiers: 2 pts, then +1 from 2 in a row, +2 from 4, x2 +2 from 7',
    points.join(',') === '2,3,3,4,4,4,6,6', 'points per make: ' + points.join(','));
check('streak counts makes in a row', player.streak === 8 && Game.tierFor(player.streak).name === 'INFERNO');
playerShot(false);
check('one miss drops the streak to zero', player.streak === 0 && Game.tierFor(player.streak) === null);
check('tier steps are 2, 4 and 7 makes', Game.TIERS.map((t) => t.makes).join(',') === '2,4,7');

// corner spot is worth 3
quietStart();
player.spot = 1;
playerShot(true);
check('corner spot is worth 3', player.score === 3, 'score ' + player.score);
player.spot = 3;

// ---------- Rapid fire ----------
quietStart();
Game.throwBall(player, goodPower(player), 0, 0, 0);
run(0.3);
Game.throwBall(player, goodPower(player), 0, 0, 0);
run(0.3);
Game.throwBall(player, goodPower(player), 0, 0, 0);
check('three balls in the air at once', player.balls.filter((b) => b.inFlight).length === 3);
run(4);
check('all three rapid-fire shots count', player.made === 3 && player.balls.length === 0, 'made ' + player.made);

// ---------- Power-up odds ----------
let sums = true;
for (const mode in PowerUps.ODDS) for (const row in PowerUps.ODDS[mode]) {
    if (PowerUps.ODDS[mode][row].reduce((x, y) => x + y) !== 100) sums = false;
}
check('every odds row adds up to 100%', sums);
check('no mythic chance before the last 2 minutes',
    PowerUps.oddsRow('campaign', 1, 170, false)[4] === 0 && PowerUps.oddsRow('campaign', 5, 121, false)[4] === 0);
check('mythic chance in the last 2 minutes is 5% or less',
    PowerUps.oddsRow('campaign', 5, 100, false)[4] <= 5 && PowerUps.oddsRow('multiplayer', 5, 100, false)[4] <= 5);
check('overtime cards are always mythic', PowerUps.oddsRow('campaign', 9, 60, true)[4] === 100);
const tally = { common: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 };
for (let i = 0; i < 20000; i++) tally[PowerUps.rollRarity(PowerUps.ODDS.campaign.pick1, Math.random())]++;
check('rolled rarities match the table (pick 1: 80/16/4/0/0)',
    Math.abs(tally.common / 200 - 80) < 2 && Math.abs(tally.rare / 200 - 16) < 2 && tally.legendary === 0 && tally.mythic === 0,
    `common ${tally.common / 200}%, rare ${tally.rare / 200}%, epic ${tally.epic / 200}%`);
let sidesOk = true;
for (let i = 0; i < 500; i++) {
    const row = PowerUps.ODDS.multiplayer.last2min;
    const buff = PowerUps.rollCard('buff', row), sab = PowerUps.rollCard('sabotage', row);
    if (!buff || !sab || buff.side !== 'buff' || sab.side !== 'sabotage') sidesOk = false;
    if (PowerUps.rollCard('buff', row, 'rare').rarity === 'epic') sidesOk = false;
}
check('left card is always a buff, right card a sabotage, rarity cap works', sidesOk);
check('20 power-ups: 11 buffs and 9 sabotages', PowerUps.LIST.length === 20 &&
    PowerUps.LIST.filter((c) => c.side === 'buff').length === 11);

// ---------- Power-up effects ----------
const card = (id) => PowerUps.byId(id);

quietStart();
Game.applyCard(card('hothand'), player);
check('Hot Hand jumps the streak to 3', player.streak === 3);
Game.applyCard(card('extinguish'), rival);
check("Extinguisher ends the opponent's streak", player.streak === 0);

quietStart();
playerShot(true); playerShot(true);
Game.applyCard(card('second'), player);
playerShot(false);
check('Second Chance keeps the streak through one miss', player.streak === 2);
playerShot(false);
check('...but only one miss', player.streak === 0);

quietStart();
Game.applyCard(card('golden'), player);
playerShot(true);
check('Golden Ball doubles the next make', player.score === 4, 'score ' + player.score);
playerShot(false);
playerShot(true);
check('...and only the next make', player.score === 6, 'score ' + player.score);

quietStart();
Game.applyCard(card('money'), player);
playerShot(true);
check('Moneyball makes a 2-point spot worth 3', player.score === 3, 'score ' + player.score);

quietStart();
Game.applyCard(card('double'), player);
playerShot(true);
check('Double Ball throws 2 balls and both count', player.made === 2 && player.attempts === 1,
    `made ${player.made}, attempts ${player.attempts}`);

quietStart();
Game.applyCard(card('wide'), player);
Game.applyCard(card('tiny'), rival);       // the rival sabotages the player
run(0.1);
check('Wide Rim and Tiny Rim change the rim size', Math.abs(player.hoop.rimScale - 1.2 * 0.85) < 1e-9);
run(16);
check('...and wear off after 15 seconds', player.hoop.rimScale === 1 && !PowerUps.has(player, 'wide'));

quietStart();
Game.applyCard(card('moving'), player);    // the player sabotages the rival
let farthest = 0;
for (let i = 0; i < 600; i++) { Game.update(1 / 60); farthest = Math.max(farthest, Math.abs(rival.hoop.offset[0])); }
check("Moving Hoop slides the opponent's hoop, not yours", farthest > 0.5 && player.hoop.offset[0] === 0,
    'moved up to ' + farthest.toFixed(2) + ' m');
run(8);
check('...and the hoop returns when it ends', Math.abs(rival.hoop.offset[0]) < 0.01);

quietStart();
Game.applyCard(card('guide'), player);
Game.applyCard(card('guide'), player);
check('picking a card again levels it up', PowerUps.level(player, 'guide') === 2 && player.effects.guide.left === 6);
playerShot(false);
check('"next N shots" cards count down per shot', player.effects.guide.left === 5);

quietStart({ length: 60 });
Game.applyCard(card('freeze'), player);
run(5);
check('Time Freeze stops the clock', Math.abs(state.timeLeft - 60) < 1e-6, 'time left ' + state.timeLeft.toFixed(2));
run(6);
check('...for 10 seconds', state.timeLeft < 60 && state.timeLeft > 58);

// ---------- Picks ----------
Game.start({ rival: noCards, length: 180 });
playerShot(true); playerShot(true);
run(0.1);
check('first pick comes early at the 2nd make', state.mode === 'picking' && state.pickNumber === 1,
    'mode ' + state.mode + ' at ' + state.elapsed.toFixed(1) + ' s');
const clock = state.timeLeft;
run(3);
check('the clock is frozen during a pick', state.timeLeft === clock);
check('a pick shows one buff and one sabotage', state.pick.buff.side === 'buff' && state.pick.sabotage.side === 'sabotage');
let waited = 3;
while (state.mode === 'picking' && waited < 20) { Game.update(1 / 60); waited += 1 / 60; }
check('after 8 seconds a card is picked for you', state.mode === 'playing' && state.pick === null && waited < 8.1,
    'picked after at most ' + waited.toFixed(1) + ' s');
const gap = state.nextPickAt - state.elapsed;
check('next pick is 30-45 seconds later', gap >= 29.9 && gap <= 45, gap.toFixed(1) + ' s');

Game.start({ rival: noCards, length: 180 });
run(46);
check('without 2 makes the first pick comes at 30-45 seconds', state.pickNumber === 1);

// ---------- The AI rival ----------
Game.start({ rival: { name: 'Bot', accuracy: 0.5, pace: 0.5, maxRarity: null }, length: 100000 });
state.nextPickAt = Infinity; state.pickNumber = 99;
run(600);
const rate = rival.made / rival.attempts;
check('a 50% rival makes about half its shots', rival.attempts > 600 && rate > 0.44 && rate < 0.56,
    `${rival.made}/${rival.attempts} = ${(rate * 100).toFixed(0)}%`);
check('the rival scores on its own scoreboard', rival.score > 0 && player.score === 0);

// Tiny Rim on the rival: count how many of its "make" throws still go in
let normalMakes = 0, tinyMakes = 0;
for (let spot = 1; spot <= 5; spot++) {
    const w = Game.makeWindow(rival, spot, 0, 0, 1);
    const pos = Game.spotPosition(spot, rival);
    for (let p = w.lo; p <= w.hi; p += 0.25) {
        const vel = Game.shotVelocity(spot, p, 0, 0, 0);
        if (Physics.wouldScore(rival.hoop, pos, vel, 1)) normalMakes++;
        if (Physics.wouldScore(rival.hoop, pos, vel, 0.85)) tinyMakes++;
    }
}
check('Tiny Rim really lowers the rival\'s accuracy', tinyMakes < normalMakes * 0.95,
    `${tinyMakes} of ${normalMakes} make-throws still score with Tiny Rim`);

// ---------- Clock, overtime and game over ----------
Game.start({ rival: noCards, length: 5 });
state.nextPickAt = Infinity; state.pickNumber = 99;
run(4.5);
Game.throwBall(player, goodPower(player), 0, 0, 0);     // released before the buzzer
run(1);
check('no new shots after the buzzer', state.buzzer && state.mode === 'playing');
run(3);
check('a shot in the air at the buzzer still counts', player.score === 2 && state.mode === 'gameover' && state.result === 'win',
    `score ${player.score}, mode ${state.mode}, result ${state.result}`);

Game.start({ rival: noCards, length: 3 });
state.nextPickAt = Infinity; state.pickNumber = 99;
run(4);
check('a tie goes to a 1-minute overtime that starts with a pick',
    state.overtime && state.mode === 'picking' && state.timeLeft === 60);
check('overtime cards are the rarest that exist (legendary until mythics are designed)',
    state.pick.buff.rarity === 'legendary' && state.pick.sabotage.rarity === 'legendary');
Game.choosePick('buff');
run(100);       // 60 s of overtime plus another pick and a possible Time Freeze
// the test rival never shoots, so overtime ends tied
check('still tied after overtime ends as a tie game', state.mode === 'gameover' && state.result === 'tie');

// A whole 3-minute match against the Medium rival, with picks
Game.start({ rival: Game.RIVALS.Medium, length: 180 });
let shotTimer = 0, guard = 0;
while (state.mode !== 'gameover' && guard++ < 60 * 400) {
    shotTimer -= 1 / 60;
    if (state.mode === 'playing' && !state.buzzer && shotTimer <= 0) {
        Game.throwBall(player, Math.random() < 0.5 ? goodPower(player) : 20, 0, 0, 0);
        shotTimer = 2;
    }
    Game.update(1 / 60);
}
check('a whole 3-minute match plays to the end', state.mode === 'gameover' && state.pickNumber >= 4,
    `You ${player.score} - ${rival.score} ${rival.name}, ${state.pickNumber} picks, result ${state.result}` +
    (state.overtime ? ', went to overtime' : ''));

finish();

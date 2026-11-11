// Run with:  node tests/rules.test.js
// Checks the match rules without a browser: streak tiers, rapid fire,
// power-up odds and effects, the AI rival, overtime and a whole match.
globalThis.Physics = require('../physics.js');
const PowerUps = require('../powerups.js');
const Game = require('../game.js');
const { check, finish } = require('./check.js');

const Courts = require('../courts.js');
const player = Game.player, rival = Game.rival, state = Game.state;
Game.setCourt('home');          // the rule tests below use the normal court
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
    state.moneyRackAt = 0;          // no surprise bonus round either
}
// A power value that scores for a shooter's current spot
function goodPower(shooter) {
    return Game.makeWindow(shooter, shooter.spot, 0, 0).best;
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

// aiming: mouse right sends the ball to the shooter's right (+x from the top spot)
check('mouse right aims right, mouse left aims left',
    Game.shotVelocity(3, 50, 1, 0, 0)[0] > 0 && Game.shotVelocity(3, 50, -1, 0, 0)[0] < 0);

// ---------- Power meter zones ----------
quietStart();
const zone = Game.powerZone(player);
check('the meter has a green zone and a grey buffer on each side', zone.hi > zone.lo && zone.buffer > 0, JSON.stringify(zone));
function makeRate(power, tries) {
    let makes = 0;
    for (let i = 0; i < tries; i++) {
        quietStart();
        Game.shoot(power, 0, 0);
        run(3);
        makes += player.made;
    }
    return makes / tries;
}
const greenRate = makeRate((zone.lo + zone.hi) / 2, 20);
const nearRate = makeRate(zone.hi + 1, 150), edgeRate = makeRate(zone.hi + zone.buffer, 150);
const outsideRate = makeRate(zone.hi + zone.buffer + 3, 30);
check('green zone with perfect aim goes in', greenRate > 0.9, (greenRate * 100).toFixed(0) + '%');
check('grey zone has a decent chance, always under 40%', nearRate > 0.15 && nearRate < 0.5 && edgeRate > 0.03 && edgeRate < 0.3,
    `${(nearRate * 100).toFixed(0)}% next to green, ${(edgeRate * 100).toFixed(0)}% at the far edge`);
check('past the grey zone the shot misses', outsideRate < 0.1, (outsideRate * 100).toFixed(0) + '%');
const zoneAtCenter = JSON.stringify(Game.powerZone(player));
check('the zones do not change with where you aim (only spot, rim and wind)', zoneAtCenter === JSON.stringify(zone));
Game.start({ rival: noCards, court: 'boardwalk', length: 100000 });
state.nextPickAt = Infinity; state.pickNumber = 99;
run(5);
const windZone = Game.powerZone(player), windAim = Game.perfectAim(player);
let windMakes = 0;
for (let i = 0; i < 10; i++) { Game.throwBall(player, (windZone.lo + windZone.hi) / 2, windAim, 0, 0); run(3); }
check('in wind, the golden-dot aim plus the green zone still scores', windZone && Math.abs(windAim) > 0.1 && player.made >= 8,
    `aim ${windAim.toFixed(2)}, made ${player.made}/10`);
Game.setCourt('home');

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

quietStart();
state.moneyRack = 10;
playerShot(true);
check('Money Rack makes a basket pay double', player.score === 4, 'score ' + player.score);
run(8);
playerShot(true);
check('...for 10 seconds', player.score === 4 + 3, 'score ' + player.score);
Game.start({ rival: noCards, length: 180 });
state.nextPickAt = Infinity; state.pickNumber = 99;
let sawRack = false;
for (let i = 0; i < 60 * 170; i++) { Game.update(1 / 60); if (state.moneyRack > 0) sawRack = true; }
check('one Money Rack happens during a game', sawRack && state.moneyRackAt === 0);

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
    const w = Game.makeWindow(rival, spot, 0, 0);
    const pos = Game.spotPosition(spot, rival);
    for (let p = w.lo; p <= w.hi; p += 0.25) {
        const vel = Game.shotVelocity(spot, p, 0, 0, 0);
        if (Physics.wouldScore(rival.hoop, pos, vel, { rimScale: 1 })) normalMakes++;
        if (Physics.wouldScore(rival.hoop, pos, vel, { rimScale: 0.85 })) tinyMakes++;
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

// ---------- Courts ----------
// Total width of the scoring power window over all 5 spots (bigger = easier)
function courtEase(id) {
    Game.setCourt(id);
    let total = 0;
    for (let spot = 1; spot <= 5; spot++) {
        const w = Game.makeWindow(player, spot, 0, 0);
        if (w) total += w.hi - w.lo + 1;
    }
    return total;
}
const ease = { ymca: courtEase('ymca'), home: courtEase('home'), rooftop: courtEase('rooftop') };
check('YMCA Gym (soft rim) is easier than Home Gym', ease.ymca > ease.home, `power window total: YMCA ${ease.ymca}, Home ${ease.home}`);
check('an outdoor double rim is harder than Home Gym', ease.rooftop < ease.home, `Rooftop ${ease.rooftop}, Home ${ease.home}`);
check('there are 7 courts and each has rules and a look',
    Courts.LIST.length === 7 && Courts.LIST.every((c) => c.rules && c.look && c.name && c.blurb));

// rain: the ball bounces lower off a wet floor
function reboundHeight(id) {
    Game.setCourt(id);
    const ball = Physics.createBall(player.hoop);
    Physics.launch(ball, [3, 3, 3], [0, 0, 0]);
    let top = 0, bounced = false;
    for (let i = 0; i < 300; i++) {
        Physics.update(ball, 1 / 60);
        if (ball.touchedFloor) bounced = true;
        if (bounced) top = Math.max(top, ball.pos[1]);
    }
    return top;
}
const dry = reboundHeight('home'), wet = reboundHeight('rooftop');
check('rain makes the floor bounce less', wet < dry * 0.8, `rebound ${wet.toFixed(2)} m wet vs ${dry.toFixed(2)} m dry`);

// wind: the same throw lands somewhere else
function landingX(id, seconds) {
    Game.start({ rival: noCards, court: id, length: 100000 });
    state.nextPickAt = Infinity; state.pickNumber = 99;
    run(seconds);
    const ball = Game.throwBall(player, 60, 0, 0, 0);
    while (!ball.touchedFloor) Game.update(1 / 60);
    return ball.pos[0];
}
const calm = landingX('home', 1), breezy = landingX('boardwalk', 1);
check('Boardwalk wind pushes the ball sideways', Math.abs(breezy - calm) > 0.15, `landed ${(breezy - calm).toFixed(2)} m to the side`);
let boardwalkSigns = new Set(), lakeSigns = new Set();
for (let t = 0; t < 120; t += 0.5) {
    boardwalkSigns.add(Math.sign(Courts.windAt(Courts.byId('boardwalk').rules, t)));
    lakeSigns.add(Math.sign(Courts.windAt(Courts.byId('lake').rules, t)));
}
check('Boardwalk wind keeps one direction, Frozen Lake wind gusts both ways',
    boardwalkSigns.size === 1 && lakeSigns.has(1) && lakeSigns.has(-1));

// the rival aims into the wind, so it still scores on a windy court
Game.start({ rival: { name: 'Bot', accuracy: 0.5, pace: 0.5, maxRarity: null }, court: 'lake', length: 100000 });
state.nextPickAt = Infinity; state.pickNumber = 99;
run(400);
const windyRate = rival.made / rival.attempts;
check('a 50% rival still makes 35-56% in gusting wind', windyRate > 0.35 && windyRate < 0.56,
    `${rival.made}/${rival.attempts} = ${(windyRate * 100).toFixed(0)}%`);
Game.setCourt('home');

// ---------- Practice mode and boss twists ----------
Game.start({ rival: { name: 'Bot', accuracy: 0.9, pace: 0.5, maxRarity: 'rare' }, practice: true, length: 30 });
playerShot(true); playerShot(true); playerShot(true);
run(60);
check('practice (tutorial, sandbox): no clock, no rival shots, no picks, score still counts',
    state.timeLeft === 30 && rival.attempts === 0 && state.pickNumber === 0 && state.mode === 'playing' &&
    player.score > 0 && Game.tierFor(player.streak) !== null);
check('makes and attempts are counted per spot', player.spotStats[2].made === 3 && player.spotStats[2].attempts === 3);
Game.forcePick();
check('a pick can be forced (tutorial)', state.mode === 'picking');
Game.choosePick('sabotage');
check('sabotage picks are counted (campaign star)', player.sabotagesUsed === 1);
Game.start();
check('starting with no options restarts the same match', state.practice === true && state.timeLeft === 30 && player.score === 0);

Game.start({ rival: noCards, twist: 'heatingStart', length: 60 });
check('Home Gym boss starts already Heating Up', rival.streak === 2);
Game.start({ rival: noCards, twist: 'risingWind', court: 'boardwalk', length: 100000 });
state.nextPickAt = Infinity; state.pickNumber = 99;
run(1); const earlyWind = Math.abs(state.wind[0]);
run(170); const lateWind = Math.abs(state.wind[0]);
check('Boardwalk boss: the wind gets stronger over time', lateWind > earlyWind * 1.3, `${earlyWind.toFixed(2)} -> ${lateWind.toFixed(2)}`);
Game.start({ rival: { name: 'Boss', accuracy: 0, pace: 999, maxRarity: 'legendary' }, twist: 'sabotageEveryPick', court: 'home', length: 600 });
let bossSabotages = 0;
Game.on((name, data) => { if (name === 'powerup' && data.user === rival && data.card.side === 'sabotage') bossSabotages++; });
for (let i = 0; i < 6; i++) { Game.forcePick(); Game.choosePick('buff'); }
check('final boss uses a sabotage every pick', bossSabotages === 6, bossSabotages + ' of 6');
Game.setCourt('home');

// ---------- Two players on one computer ----------
Game.start({ twoPlayer: true, court: 'home', length: 180 });
state.moneyRackAt = 0;
run(20);
check('two-player: the second hoop has no AI (nobody shoots for Player 2)', rival.attempts === 0 && rival.ai === null);
check('two-player: home court goes to one of the two players', state.home === player || state.home === rival);
Game.shoot2(goodPower(rival), 0, 0);
run(3);
check('two-player: Player 2 shoots and scores on their own hoop', rival.made === 1 && rival.score === 2 && player.score === 0,
    `P2 score ${rival.score}`);
Game.shoot2(goodPower(rival), 0, 0);
run(3);
check('two-player: the early pick comes at either player\'s 2nd make', state.mode === 'picking' && state.pick.p2 && state.pick.p2.buff.side === 'buff');
Game.choosePick('buff', player);
check('two-player: the game waits until both players have picked', state.mode === 'picking');
Game.choosePick('sabotage', player);
check('two-player: a player cannot pick twice', state.pick.chosen.player === 'buff');
Game.choosePick('buff', rival);
check('two-player: play resumes when both have picked', state.mode === 'playing');
let multiOdds = true;
for (let i = 0; i < 4; i++) {
    Game.start({ twoPlayer: true, court: 'home', length: 180 });
    Game.forcePick();
    if (state.pick.row !== PowerUps.ODDS.multiplayer.pick1) multiOdds = false;
    run(9);         // nobody picks: after 8 seconds cards are chosen for both
    if (state.mode !== 'playing') multiOdds = false;
}
check('two-player uses the multiplayer odds, and the timer picks for both players', multiOdds);
Game.start({ rival: noCards, court: 'home', length: 60 });
check('a normal match after two-player has an AI rival again', !state.twoPlayer && rival.ai !== null && player.name === 'You');
Game.shoot2(50, 0, 0);
check('Player 2 keys do nothing outside two-player', rival.attempts === 0);

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

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
// Most tests below shoot from the top of the key (spot 3) and pass freeSpots
// so the shooter stays there. This puts both shooters on spot 3 at each start.
Game.on((name) => { if (name === 'start' && state.freeSpots) { player.spot = 3; rival.spot = 3; } });
const noCards = { name: 'Test', accuracy: 0, pace: 999, maxRarity: null };    // a rival that never shoots

// Run the game for some seconds at 60 frames per second
function run(seconds) {
    for (let t = 0; t < seconds; t += 1 / 60) Game.update(1 / 60);
}
// Start a match where power-up picks never interrupt (unless a test wants them)
function quietStart(options) {
    // (these rule tests shoot from one spot: freeSpots keeps the shooter there)
    Game.start(Object.assign({ rival: noCards, freeSpots: true }, options));
    player.spot = 3;
    rival.spot = 3;
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

// ---------- The green-zone search is fast and finds the same zones (row 24) ----------
{
    let sims = 0;
    const realWouldScore = Physics.wouldScore;
    Physics.wouldScore = function () { sims++; return realWouldScore.apply(this, arguments); };
    let fastSims = 0, fullSims = 0, aims = 0, agreeing = 0, wider = 0, missedTiny = 0, problems = [];
    for (const court of ['home', 'boardwalk', 'lake']) {
        Game.start({ rival: noCards, court: court, freeSpots: true, length: 1000 });
        for (let i = 0; i < 60; i++) {
            const spot = 1 + (i % 5), ax = (i % 7 - 3) * 0.12, ay = (i % 9 - 4) * 0.2;
            const wind = [court === 'home' ? 0 : (i % 5 - 2) * 0.15, 0, 0];
            sims = 0; const fast = Game.makeWindow(player, spot, ax, ay, { wind: wind }); fastSims += sims;
            sims = 0; const full = Game.makeWindowFull(player, spot, ax, ay, { wind: wind }); fullSims += sims;
            aims++;
            if (!fast && !full) agreeing++;
            else if (fast && full && fast.lo === full.lo && fast.hi === full.hi) agreeing++;
            else if (fast && full && fast.lo <= full.lo && fast.hi >= full.hi) wider++;                       // a small gap inside, still guaranteed by surePower
            else if (!fast && full && full.hi - full.lo <= 1) missedTiny++;                                      // a 1-2 point range nobody can hit on purpose
            else problems.push(`${court} spot ${spot}: fast ${JSON.stringify(fast)} full ${JSON.stringify(full)}`);
        }
    }
    Physics.wouldScore = realWouldScore;
    check('the fast search finds the same green zone as trying every power (or a harmless difference)', problems.length <= aims * 0.03,
        `${agreeing} same, ${wider} slightly wider, ${missedTiny} tiny ranges skipped, ${problems.length} other of ${aims}` + (problems.length ? ': ' + problems[0] : ''));
    check('...with far fewer test shots', fastSims < fullSims * 0.45,
        `${(fastSims / aims).toFixed(0)} test shots per aim instead of ${(fullSims / aims).toFixed(0)}`);
    Game.setCourt('home');
}

// ---------- Power meter: the green zone ----------
quietStart();
const zone = Game.powerZone(player);
check('the meter has a green zone for perfect aim', zone.hi > zone.lo, JSON.stringify(zone));
// Shoot through the real path (Game.shoot) and report if it went in
function shotGoesIn(power, ax, ay) {
    quietStart();
    Game.shoot(power, ax, ay);
    run(3);
    return player.made === 1;
}
// the same power and aim always give the same result (nothing is random)
let sameEveryTime = true;
for (const [p, ax] of [[zone.lo - 4, 0], [zone.hi + 2, 0.1], [(zone.lo + zone.hi) / 2, 0], [50, 0.5]]) {
    const first = shotGoesIn(p, ax, 0);
    for (let i = 0; i < 8; i++) if (shotGoesIn(p, ax, 0) !== first) sameEveryTime = false;
}
check('the same power and aim always give the same result', sameEveryTime);
check('just outside the green zone is always a miss (no random save)',
    !shotGoesIn(zone.lo - 1.5, 0, 0) && !shotGoesIn(zone.hi + 1.5, 0, 0));
// the zone follows the aim
quietStart();
const centered = Game.aimZone(player, 0, 0), higher = Game.aimZone(player, 0, 0.6), wide = Game.aimZone(player, 0.9, 0);
check('the green zone moves when you aim higher', higher && (higher.lo !== centered.lo || higher.hi !== centered.hi),
    `centered ${centered.lo}-${centered.hi}, higher arc ${higher.lo}-${higher.hi}`);
check('aiming far off the rim leaves no green zone', wide === null);
// a release anywhere in green goes in: try many aims, at both edges and the middle
let greenShots = 0, greenMakes = 0;
for (let i = 0; i < 40; i++) {
    quietStart();
    player.spot = 1 + (i % 5);
    const ax = (Math.random() - 0.5) * 0.5, ay = (Math.random() - 0.5) * 1.2;
    const z = Game.aimZone(player, ax, ay);
    if (!z) continue;
    for (const p of [z.lo, (z.lo + z.hi) / 2, z.hi, z.lo + Math.random() * (z.hi - z.lo)]) {
        quietStart();
        player.spot = 1 + (i % 5);
        Game.shoot(p, ax, ay);      // (in the node tests the shot uses player.spot)
        run(5);                     // long enough for a ball that rolls around the rim first
        greenShots++; greenMakes += player.made;
    }
}
player.spot = 3;
check('a release in the green zone always goes in, at any aim and spot', greenShots > 40 && greenMakes === greenShots,
    `${greenMakes} of ${greenShots} green releases scored`);
// when the zone is drawn
quietStart();
check('the green zone shows by default', Game.zoneVisible(player));
player.effects.blind = { level: 1, left: 3 };
check('Blind Meter hides it', !Game.zoneVisible(player));
player.effects.sweet = { level: 1, left: 3 };
check('Sweet Spot shows it anyway', Game.zoneVisible(player));
globalThis.getDifficultySettings = () => ({ name: 'Hard', chargeSpeed: 110 });
quietStart();
check('Hard hides the green zone', !Game.zoneVisible(player));
delete globalThis.getDifficultySettings;
// Shaky Hands and rain shake the crosshair instead of adding random error
quietStart();
check('no crosshair shake normally', Game.aimShake(player) === 0);
player.effects.shaky = { level: 1, left: 3 };
check('Shaky Hands shakes the crosshair', Game.aimShake(player) > 5);
Game.start({ freeSpots: true, rival: noCards, court: 'rooftop', length: 60 });
check('rain shakes the crosshair a little', Game.aimShake(player) > 0 && Game.aimShake(player) < 10);
Game.setCourt('home');

Game.start({ freeSpots: true, rival: noCards, court: 'boardwalk', length: 100000 });
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
let noMythic = true;
for (const mode in PowerUps.ODDS) {
    for (const row of PowerUps.ODDS[mode].steps.concat([PowerUps.ODDS[mode].overtime])) {
        if (row.reduce((x, y) => x + y) !== 100) sums = false;
    }
    for (const row of PowerUps.ODDS[mode].steps) if (row[4] !== 0) noMythic = false;
}
check('every odds row adds up to 100%', sums);
check('mythic cards only appear in overtime', noMythic &&
    PowerUps.oddsRow('campaign', 9, false, 5)[4] === 0 && PowerUps.oddsRow('multiplayer', 9, false, 5)[4] === 0);
check('overtime cards are always mythic', PowerUps.oddsRow('campaign', 9, true, 0)[4] === 100);
const steps = PowerUps.ODDS.campaign.steps;
check('odds improve with the pick number: pick 1, picks 2-3, pick 4 or later',
    PowerUps.oddsRow('campaign', 1, false, 0) === steps[0] && PowerUps.oddsRow('campaign', 3, false, 0) === steps[1] &&
    PowerUps.oddsRow('campaign', 4, false, 0) === steps[2] && steps[0][0] > steps[1][0] && steps[1][0] > steps[2][0] && steps[2][0] > steps[3][0]);
check('a skipped pick moves the next pick one step toward rarer cards',
    PowerUps.oddsRow('campaign', 1, false, 1) === steps[1] && PowerUps.oddsRow('campaign', 4, false, 1) === steps[3] &&
    PowerUps.oddsRow('campaign', 4, false, 3) === steps[3]);
const tally = { common: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 };
for (let i = 0; i < 20000; i++) tally[PowerUps.rollRarity(PowerUps.ODDS.campaign.steps[0], Math.random())]++;
check('rolled rarities match the table (pick 1: 80/16/4/0/0)',
    Math.abs(tally.common / 200 - 80) < 2 && Math.abs(tally.rare / 200 - 16) < 2 && tally.legendary === 0 && tally.mythic === 0,
    `common ${tally.common / 200}%, rare ${tally.rare / 200}%, epic ${tally.epic / 200}%`);
let sidesOk = true;
for (let i = 0; i < 500; i++) {
    const row = PowerUps.ODDS.multiplayer.steps[3];
    const buff = PowerUps.rollCard('buff', row), sab = PowerUps.rollCard('sabotage', row);
    if (!buff || !sab || buff.side !== 'buff' || sab.side !== 'sabotage') sidesOk = false;
    if (PowerUps.rollCard('buff', row, 'rare').rarity === 'epic') sidesOk = false;
}
check('left card is always a buff, right card a sabotage, rarity cap works', sidesOk);
check('22 power-ups: 12 buffs and 10 sabotages (the 20 originals, Blind Meter and the placeholder mythic)', PowerUps.LIST.length === 22 &&
    PowerUps.LIST.filter((c) => c.side === 'buff').length === 12);
const blind = PowerUps.byId('blind');
check('Blind Meter is a rare sabotage that lasts 3 shots', blind.side === 'sabotage' && blind.rarity === 'rare' && blind.kind === 'shots' && blind.amount === 3);
let blindOffered = false;
for (let i = 0; i < 400 && !blindOffered; i++) if (PowerUps.rollCard('sabotage', [0, 100, 0, 0, 0]).id === 'blind') blindOffered = true;
check('Blind Meter shows up in picks', blindOffered);

// ---------- The slot-machine reel on the pick screen ----------
let reelOk = true, teaseOk = true;
for (const rarity of PowerUps.RARITIES) {
    for (const landAt of [1.0, 1.5]) {
        const frames = PowerUps.reelFrames(rarity, landAt);
        const last = frames[frames.length - 1], beforeLast = frames[frames.length - 2];
        if (!last.landed || last.rarity !== rarity || Math.abs(last.at - landAt) > 1e-9) reelOk = false;
        for (let i = 1; i < frames.length; i++) {
            if (frames[i].at <= frames[i - 1].at) reelOk = false;                                   // in time order
            if (i >= 2 && frames[i].at - frames[i - 1].at < frames[i - 1].at - frames[i - 2].at - 1e-9) reelOk = false;   // slowing down
        }
        const index = PowerUps.RARITIES.indexOf(rarity);
        if (index < 4 && (!beforeLast.tease || beforeLast.rarity !== PowerUps.RARITIES[index + 1])) teaseOk = false;
        if (index === 4 && beforeLast.tease) teaseOk = false;
    }
}
check('the pick reel slows down and lands on the real rarity exactly on time', reelOk);
check('just before landing it teases one rarity higher (nothing above mythic)', teaseOk);
check('both cards land within the first 1.5 of the 5 seconds', Game.SETTINGS.pickChooseTime - 1.5 >= 3);

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
Game.start({ freeSpots: true, rival: noCards, length: 180 });
state.nextPickAt = Infinity; state.pickNumber = 99;
let sawRack = false;
for (let i = 0; i < 60 * 170; i++) { Game.update(1 / 60); if (state.moneyRack > 0) sawRack = true; }
check('one Money Rack happens during a game', sawRack && state.moneyRackAt === 0);

quietStart();
Game.applyCard(blind, rival);          // the rival uses Blind Meter on you
check('Blind Meter lands on the opponent and hides their green zone', PowerUps.has(player, 'blind') && !Game.zoneVisible(player) && Game.zoneVisible(rival));
check('green still goes in while the zone is hidden', (Game.shoot(goodPower(player), 0, 0), run(3), player.made === 1));
playerShot(false); playerShot(false);
check('...and it wears off after 3 shots', !PowerUps.has(player, 'blind') && Game.zoneVisible(player));

// ---------- Picks ----------
Game.start({ freeSpots: true, rival: noCards, length: 180 });
playerShot(true); playerShot(true);
run(0.1);
check('first pick comes early at the 2nd make', state.mode === 'picking' && state.pickNumber === 1,
    'mode ' + state.mode + ' at ' + state.elapsed.toFixed(1) + ' s');
const clock = state.timeLeft;
run(1);
check('the clock is frozen during a pick', state.timeLeft === clock);
check('a pick shows one buff and one sabotage', state.pick.buff.side === 'buff' && state.pick.sabotage.side === 'sabotage');
let waited = 1;
while (state.mode === 'picking' && waited < 20) { Game.update(1 / 60); waited += 1 / 60; }
check('the pick ends after 5 seconds at most', state.mode === 'playing' && state.pick === null && waited < 5.1,
    'ended after at most ' + waited.toFixed(1) + ' s');
check('skipping a pick gives no card, but a bonus for the next pick',
    Object.keys(player.effects).length === 0 && player.streak === 2 && player.pickBoost === 1);
const gap = state.nextPickAt - state.elapsed;
check('next pick is 20-30 seconds later', gap >= 19.9 && gap <= 30, gap.toFixed(1) + ' s');
Game.forcePick();
check('the pick after a skip uses the next odds step', state.pick.row === PowerUps.ODDS.campaign.steps[2],
    'pick 2 with a skip bonus -> step for pick 4 or later');
Game.choosePick('buff');
check('choosing a card uses up the skip bonus', player.pickBoost === 0);

Game.start({ freeSpots: true, rival: noCards });
check('a game is 2 minutes', state.timeLeft === 120 && Game.SETTINGS.gameLength === 120);
run(19);
check('without 2 makes there is no pick in the first 20 seconds', state.pickNumber === 0);
run(12);
check('...and the first pick comes at 20-30 seconds', state.pickNumber === 1);
Game.start({ freeSpots: true, rival: noCards, length: 180 });
state.elapsed = 21;                 // pretend 21 seconds have gone by with no makes
state.nextPickAt = Infinity;
playerShot(true); playerShot(true);
check('the early pick only happens before 20 seconds', state.pickNumber === 0);

// ---------- The AI rival ----------
// These accuracy tests measure the rival's own numbers, so the crowd is kept
// out of it: its pulls are set to 0 here and put back afterwards.
const savedFanSettings = Object.assign({}, Game.SETTINGS.fans);
for (const key of ['make', 'swish', 'three', 'tier', 'run', 'miss', 'airball']) Game.SETTINGS.fans[key] = 0;
// ...and the rival's reaction to the score is switched off the same way
const savedSwing = Game.SETTINGS.rivalSwingMax;
Game.SETTINGS.rivalSwingMax = 0;
Game.start({ freeSpots: true, rival: { name: 'Bot', accuracy: 0.5, pace: 0.5, maxRarity: null }, length: 100000 });
state.nextPickAt = Infinity; state.pickNumber = 99;
run(600);
const rate = rival.made / rival.attempts;
check('a 50% rival makes about half its shots', rival.attempts > 600 && rate > 0.44 && rate < 0.56,
    `${rival.made}/${rival.attempts} = ${(rate * 100).toFixed(0)}%`);
Object.assign(Game.SETTINGS.fans, savedFanSettings);
Game.SETTINGS.rivalSwingMax = savedSwing;
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
Game.start({ freeSpots: true, rival: noCards, length: 5 });
state.nextPickAt = Infinity; state.pickNumber = 99;
player.score = 15;      // far enough ahead that the game does not go to overtime
run(4.5);
Game.throwBall(player, goodPower(player), 0, 0, 0);     // released before the buzzer
run(1);
check('no new shots after the buzzer', state.buzzer && state.mode === 'playing');
run(3);
check('a shot in the air at the buzzer still counts', player.score === 17 && state.mode === 'gameover' && state.result === 'win',
    `score ${player.score}, mode ${state.mode}, result ${state.result}`);

Game.start({ freeSpots: true, rival: noCards, length: 3 });
state.nextPickAt = Infinity; state.pickNumber = 99;
run(4);
check('a tie goes to a 1-minute overtime that starts with a pick',
    state.overtime && state.mode === 'picking' && state.timeLeft === 60);
// overtime also happens when the scores are within 10 points
function endWithScores(you, them) {
    Game.start({ freeSpots: true, rival: noCards, length: 2 });
    state.nextPickAt = Infinity; state.pickNumber = 99;
    player.score = you; rival.score = them;
    run(3);
    return state;
}
check('10 points apart at the end: overtime', endWithScores(30, 20).overtime && state.mode === 'picking');
check('behind by 10 at the end: overtime too', endWithScores(12, 22).overtime);
check('11 points apart at the end: game over, no overtime', !endWithScores(31, 20).overtime && state.mode === 'gameover' && state.result === 'win');
endWithScores(25, 20);
Game.choosePick('skip');
state.nextPickAt = Infinity;
run(62);
check('after overtime whoever is ahead wins, even by less than 10', state.mode === 'gameover' && state.result === 'win' && state.overtime);
Game.start({ freeSpots: true, rival: noCards, length: 3 });
state.nextPickAt = Infinity; state.pickNumber = 99;
run(4);
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
    Game.start({ freeSpots: true, rival: noCards, court: id, length: 100000 });
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
for (const key of ['make', 'swish', 'three', 'tier', 'run', 'miss', 'airball']) Game.SETTINGS.fans[key] = 0;
Game.SETTINGS.rivalSwingMax = 0;
Game.start({ freeSpots: true, rival: { name: 'Bot', accuracy: 0.5, pace: 0.5, maxRarity: null }, court: 'lake', length: 100000 });
state.nextPickAt = Infinity; state.pickNumber = 99;
run(400);
const windyRate = rival.made / rival.attempts;
Object.assign(Game.SETTINGS.fans, savedFanSettings);   // (kept out of the windy test too)
Game.SETTINGS.rivalSwingMax = savedSwing;
check('a 50% rival still makes 35-56% in gusting wind', windyRate > 0.35 && windyRate < 0.56,
    `${rival.made}/${rival.attempts} = ${(windyRate * 100).toFixed(0)}%`);
Game.setCourt('home');

// ---------- Practice mode and boss twists ----------
Game.start({ freeSpots: true, rival: { name: 'Bot', accuracy: 0.9, pace: 0.5, maxRarity: 'rare' }, practice: true, length: 30 });
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

Game.start({ freeSpots: true, rival: noCards, twist: 'heatingStart', length: 60 });
check('Home Gym boss starts already Heating Up', rival.streak === 2);
Game.start({ freeSpots: true, rival: noCards, twist: 'risingWind', court: 'boardwalk', length: 100000 });
state.nextPickAt = Infinity; state.pickNumber = 99;
run(1); const earlyWind = Math.abs(state.wind[0]);
run(170); const lateWind = Math.abs(state.wind[0]);
check('Boardwalk boss: the wind gets stronger over time', lateWind > earlyWind * 1.3, `${earlyWind.toFixed(2)} -> ${lateWind.toFixed(2)}`);
Game.start({ freeSpots: true, rival: { name: 'Boss', accuracy: 0, pace: 999, maxRarity: 'legendary' }, twist: 'sabotageEveryPick', court: 'home', length: 600 });
let bossSabotages = 0;
Game.on((name, data) => { if (name === 'powerup' && data.user === rival && data.card.side === 'sabotage') bossSabotages++; });
for (let i = 0; i < 6; i++) { Game.forcePick(); Game.choosePick('buff'); }
check('final boss uses a sabotage every pick', bossSabotages === 6, bossSabotages + ' of 6');
Game.setCourt('home');

// ---------- Two players on one computer ----------
Game.start({ freeSpots: true, twoPlayer: true, court: 'home', length: 180 });
state.moneyRackAt = 0;
run(10);
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
    Game.start({ freeSpots: true, twoPlayer: true, court: 'home', length: 180 });
    Game.forcePick();
    if (state.pick.row !== PowerUps.ODDS.multiplayer.steps[0]) multiOdds = false;
    run(6);         // nobody picks: after 5 seconds both players skip
    if (state.mode !== 'playing' || player.pickBoost !== 1 || rival.pickBoost !== 1) multiOdds = false;
    if (Object.keys(player.effects).length || Object.keys(rival.effects).length) multiOdds = false;
}
check('two-player uses the multiplayer odds; when the timer runs out both players skip and get the bonus', multiOdds);
Game.start({ freeSpots: true, twoPlayer: true, court: 'home', length: 180 });
Game.forcePick();
Game.choosePick('buff', player);
run(6);
check('two-player: one player can pick while the other skips', state.mode === 'playing' && player.pickBoost === 0 && rival.pickBoost === 1);
Game.start({ freeSpots: true, rival: noCards, court: 'home', length: 60 });
check('a normal match after two-player has an AI rival again', !state.twoPlayer && rival.ai !== null && player.name === 'You');
Game.shoot2(50, 0, 0);
check('Player 2 keys do nothing outside two-player', rival.attempts === 0);

// ---------- Spots in order, 5 shots each ----------
Game.start({ rival: noCards, length: 600 });
state.nextPickAt = Infinity; state.pickNumber = 99; state.moneyRackAt = 0;
check('a match starts at spot 1', player.spot === 1 && rival.spot === 1);
const visited = [];
for (let i = 0; i < 27; i++) { visited.push(player.spot); Game.shoot(5, 0, 0); run(0.3); }
check('5 shots from each spot, then the next spot, 1 to 5 and around again',
    visited.join('') === '111112222233333444445555511',
    visited.join(''));
check('the shot counter restarts at each spot', player.spotShots === 2 && player.attempts === 27);
Game.start({ rival: { name: 'Bot', accuracy: 0.5, pace: 0.4, maxRarity: null }, length: 600 });
state.nextPickAt = Infinity; state.pickNumber = 99; state.moneyRackAt = 0;
const rivalSpots = [];
let lastAttempts = 0;
for (let i = 0; i < 60 * 30 && rivalSpots.length < 12; i++) {
    const spotBefore = rival.spot;
    Game.update(1 / 60);
    if (rival.attempts > lastAttempts) { rivalSpots.push(spotBefore); lastAttempts = rival.attempts; }
}
check('the rival also shoots 5 from each spot in order', rivalSpots.join('') === '111112222233', rivalSpots.join(''));
Game.start({ rival: noCards, freeSpots: true, practice: true });
player.spot = 4;
for (let i = 0; i < 7; i++) { Game.throwBall(player, 5, 0, 0, 0); run(0.3); }
check('in the sandbox (free spots) you stay where you are', player.spot === 4);

// ---------- Money spot ----------
function scoreFrom(spot, moneySpot) {
    Game.start({ rival: noCards, freeSpots: true, moneySpot: moneySpot });
    state.nextPickAt = Infinity; state.pickNumber = 99; state.moneyRackAt = 0;
    player.spot = spot;
    Game.throwBall(player, goodPower(player), 0, 0, 0);
    run(3);
    return player.score;
}
check('a make at your money spot counts double', scoreFrom(3, 3) === 4 && scoreFrom(1, 1) === 6,
    `spot 3: ${scoreFrom(3, 3)}, corner: ${scoreFrom(1, 1)}`);
check('other spots score normally', scoreFrom(3, 2) === 2 && scoreFrom(1, 5) === 3 && scoreFrom(3, 0) === 2);
const rivalMoney = new Set();
for (let i = 0; i < 60; i++) { Game.start({ rival: noCards }); rivalMoney.add(rival.moneySpot); }
check('the AI rival picks its money spot at random (1 to 5)', rivalMoney.size >= 4 && [...rivalMoney].every((n) => n >= 1 && n <= 5),
    'saw spots ' + [...rivalMoney].sort().join(', '));
Game.start({ twoPlayer: true, moneySpot: 2, moneySpot2: 5 });
check('two-player: each player has their own money spot', player.moneySpot === 2 && rival.moneySpot === 5);
Game.start({ rival: noCards, moneySpot: 1, length: 600 });
state.nextPickAt = Infinity; state.pickNumber = 99; state.moneyRackAt = 0;
Game.throwBall(player, goodPower(player), 0, 0, 0);
run(3);
check('in a match, your first spot is spot 1: money spot 1 pays 6 for the corner three', player.score === 6, 'score ' + player.score);
Game.setCourt('home');

// ---------- Fan meter ----------
const FAN = Game.SETTINGS.fans;
function fanStart(options) {
    Game.start(Object.assign({ rival: noCards, freeSpots: true, length: 600 }, options));
    state.nextPickAt = Infinity; state.pickNumber = 99; state.moneyRackAt = 0;
    return state.fans;
}
check('against the AI you are the home team: the meter starts on your side', fanStart() === FAN.start && Game.fanFavorite() === player);
let homeSides = new Set();
for (let i = 0; i < 30; i++) { fanStart({ twoPlayer: true }); homeSides.add(Math.sign(state.fans) === (state.home === player ? 1 : -1)); }
check('two-player: the meter starts on the side of whoever won home court', homeSides.size === 1 && homeSides.has(true));
fanStart();
const atStart = state.fans;
playerShot(true);
check('your make pulls the crowd your way', state.fans > atStart, `${atStart.toFixed(2)} -> ${state.fans.toFixed(2)}`);
const afterMake = state.fans;
playerShot(false);
check('your miss pulls it toward the rival', state.fans < afterMake);
// the rival playing great takes the crowd away from you
fanStart();
let switched = null;
Game.on((name, data) => { if (name === 'fanswitch' && switched === null) switched = data.favorite; });
for (let i = 0; i < 12 && Game.fanFavorite() === player; i++) {
    Game.throwBall(rival, Game.makeWindow(rival, rival.spot, 0, 0).best, 0, 0, 0);
    run(2.5);
}
check('strong play by the rival swings the crowd to the rival', Game.fanFavorite() === rival && switched === rival,
    `meter ${state.fans.toFixed(2)} after ${rival.made} rival makes`);
// leaning your way widens your green zone; the opponent's is unchanged
fanStart();
state.fans = 0;
const plain = Game.greenZone(player, 0, 0);
state.fans = 0.6;
const backed = Game.greenZone(player, 0, 0), rivalZone = Game.greenZone(rival, 0, 0);
check('the crowd leaning your way makes your green zone bigger', backed.hi - backed.lo > plain.hi - plain.lo + 3,
    `${(plain.hi - plain.lo).toFixed(1)} -> ${(backed.hi - backed.lo).toFixed(1)} power points wide`);
check('...and does not widen the other player\'s zone', Math.abs((rivalZone.hi - rivalZone.lo) - (plain.hi - plain.lo)) < 1e-9);
// a release anywhere in the wider zone still goes in
let wideMakes = 0;
for (const p of [backed.lo, backed.lo + 0.5, backed.hi - 0.5, backed.hi]) {
    fanStart(); state.fans = 0.6;
    Game.shoot(p, 0, 0); run(5); wideMakes += player.made;
}
check('green still always goes in, at the edges of the wider zone', wideMakes === 4, wideMakes + ' of 4');
// a full meter: On Fire until you miss, and the opponent's zone shrinks
fanStart();
state.fans = 0.99;
playerShot(true);
check('a full meter sets you On Fire (with only 1 make in a row)', player.crowdFire && Game.heatTier(player).name === 'ON FIRE' && player.streak === 1);
const fireBefore = player.score;
playerShot(true);
check('...and your makes score as On Fire', player.score - fireBefore === 2 + 2, 'make worth ' + (player.score - fireBefore));
const fullRival = Game.greenZone(rival, 0, 0);
player.crowdFire = false;
const normalRival = Game.greenZone(rival, 0, 0);
player.crowdFire = true;
check("a full meter shrinks the opponent's green zone", fullRival.hi - fullRival.lo < (normalRival.hi - normalRival.lo) * 0.8,
    `${(normalRival.hi - normalRival.lo).toFixed(1)} -> ${(fullRival.hi - fullRival.lo).toFixed(1)}`);
let shrunkMakes = 0;
for (const p of [fullRival.lo, (fullRival.lo + fullRival.hi) / 2, fullRival.hi]) {
    fanStart(); state.fans = 1; player.crowdFire = true;
    Game.shoot2 ? null : null;
    Game.throwBall(rival, p, 0, 0, 0); run(5); shrunkMakes += rival.made;
}
check("...but the opponent's smaller green zone still goes in", shrunkMakes === 3, shrunkMakes + ' of 3');
fanStart(); state.fans = 0.99; playerShot(true);
playerShot(false);
check('a miss ends the crowd On Fire', !player.crowdFire && Game.heatTier(player) === null);
fanStart(); state.fans = 0.99; playerShot(true);
Game.applyCard(PowerUps.byId('hothand'), rival);   // rival to 3...
rival.streak = 3;
Game.throwBall(rival, Game.makeWindow(rival, rival.spot, 0, 0).best, 0, 0, 0); run(3);
check('the opponent catching fire ends it too', rival.streak === 4 && !player.crowdFire);
// the meter drifts back toward the home side
fanStart(); state.fans = -0.5;
run(30);
check('the meter slowly drifts back toward the home team', state.fans > -0.5 && state.fans < -0.2, state.fans.toFixed(2));
fanStart({ practice: true });
playerShot(false); playerShot(false);
check('no crowd swings in practice (tutorial, sandbox)', state.fans === FAN.start);
Game.setCourt('home');

// ---------- Score cap (row 20) ----------
quietStart();
player.spot = 1;                                   // a corner three...
player.moneySpot = 1;                              // ...on your money spot...
player.streak = 7;                                 // ...in Inferno...
player.effects.golden = { level: 1, left: 1 };     // ...with Golden Ball...
state.moneyRack = 10;                              // ...during Money Rack
const uncapped = 3 * 2 + 2;                        // Inferno: 8, then x2 x2 x2 = 64
Game.throwBall(player, Game.makeWindow(player, 1, 0, 0).best, 0, 0, 0);
run(3);
check('no single basket is worth more than 12 points, however the bonuses stack', player.score === 12,
    'would have been ' + uncapped * 8 + ', scored ' + player.score);
quietStart();
check('ordinary baskets are not touched by the cap', (playerShot(true), player.score === 2) && Game.pointsFor(player, 3, {}, 1) <= 12);

// ---------- The rival reacts to the score (row 21) ----------
function rivalRateWhen(scoreGap) {
    const saved = Object.assign({}, Game.SETTINGS.fans);
    for (const key of ['make', 'swish', 'three', 'tier', 'run', 'miss', 'airball']) Game.SETTINGS.fans[key] = 0;   // keep the crowd out of it
    Game.start({ freeSpots: true, rival: { name: 'Bot', accuracy: 0.45, pace: 0.4, maxRarity: null }, length: 100000 });
    state.nextPickAt = Infinity; state.pickNumber = 99; state.moneyRackAt = 0;
    state.fans = 0;
    let made = 0, tried = 0;
    for (let i = 0; i < 60 * 300; i++) {
        // hold the score gap steady: you are scoreGap points ahead of the rival
        player.score = rival.score + scoreGap;
        const before = rival.attempts, madeBefore = rival.made;
        Game.update(1 / 60);
        state.fans = 0;
        tried += rival.attempts - before; made += rival.made - madeBefore;
    }
    Object.assign(Game.SETTINGS.fans, saved);
    return { rate: rival.made / rival.attempts, n: rival.attempts };
}
const level = rivalRateWhen(0), trailing = rivalRateWhen(15), leading = rivalRateWhen(-25);
check('behind by 15, the rival shoots better than when level', trailing.rate > level.rate + 0.03,
    `level ${(level.rate * 100).toFixed(0)}%, behind ${(trailing.rate * 100).toFixed(0)}%`);
check('ahead by 25, the rival eases off', leading.rate < level.rate - 0.03,
    `ahead ${(leading.rate * 100).toFixed(0)}%`);
check('the swing is never more than 10% either way', trailing.rate < level.rate + 0.16 && leading.rate > level.rate - 0.16);

// ---------- Streaks resolve in shot order (row 22) ----------
quietStart();
player.streak = 3;                                 // Heating Up, one away from On Fire
const slowMiss = Game.throwBall(player, 100, 0, 1, 0);         // a very high, long shot that misses...
run(0.15);
const quickMake = Game.throwBall(player, goodPower(player), 0, 0, 0);   // ...then a make that lands first
let throughFirst = null;
for (let i = 0; i < 600 && !slowMiss.resolved; i++) {
    Game.update(1 / 60);
    if (quickMake.resolved && throughFirst === null) throughFirst = { streak: player.streak, score: player.score, missLanded: slowMiss.resolved };
}
run(2);
check('test setup: the later make went through before the earlier miss landed', throughFirst && !throughFirst.missLanded && quickMake.outcome.make && !slowMiss.outcome.make);
check('the later make is not counted while the earlier shot is still in the air', throughFirst.streak === 3 && throughFirst.score === 0);
check('then the miss counts first (streak to 0), then the make (streak 1, plain 2 points)', player.streak === 1 && player.score === 2,
    `streak ${player.streak}, score ${player.score} (in landing order it would be streak 0, score 4)`);
quietStart();
for (let i = 0; i < 4; i++) { Game.throwBall(player, goodPower(player), 0, 0, 0); run(0.2); }
run(4);
check('rapid makes still all count, in order', player.made === 4 && player.streak === 4 && player.queue.length === 0);

// ---------- The tutorial race (row 27) ----------
check('the placeholder mythic is never rolled (overtime steps down to legendary)', (() => {
    for (let i = 0; i < 300; i++) if (PowerUps.rollCard('buff', [0, 0, 0, 0, 100]).placeholder) return false;
    return PowerUps.byId('placeholder').rarity === 'mythic' && PowerUps.byId('placeholder').placeholder === true;
})());
// Play the 2-minute tutorial race. shootEvery = seconds between your shots
// (0 = never shoot); good = chance each shot is a make. In overtime you
// let the pick timer run out, then make every shot.
function tutorialRace(shootEvery, good, cheat) {
    Game.start({ court: 'ymca', rival: { name: 'Coach', accuracy: 0.25, pace: 4.0, maxRarity: null }, twist: 'tutorialRace' });
    const out = { reachedOvertime: false, mythic: false, gapAtBuzzer: null };
    let timer = 0, guard = 0;
    while (state.mode !== 'gameover' && guard++ < 60 * 400) {
        if (state.mode === 'playing' && !state.buzzer) {
            timer -= 1 / 60;
            const shooting = state.overtime ? 1 : shootEvery;
            if (shooting && timer <= 0) {
                const make = state.overtime || Math.random() < good;
                Game.throwBall(player, make ? goodPower(player) : 5, 0, 0, 0);
                timer = shooting;
            }
            if (cheat && !state.overtime) player.score += 0.05;      // a player far better than any real one
        }
        if (state.mode === 'picking' && state.pick.buff.placeholder && !state.pick.counted) { state.pick.counted = true; out.offers = (out.offers || 0) + 1; }
        if (state.mode === 'picking' && state.overtime && !out.reachedOvertime) {
            out.reachedOvertime = true;
            player.score = Math.round(player.score);
            out.gapAtBuzzer = player.score - rival.score;
            out.offered = state.pick.buff.id;
        }
        Game.update(1 / 60);
        if (PowerUps.has(player, 'placeholder')) out.mythic = true;
    }
    out.result = state.result;
    out.text = `you ${player.score} - ${rival.score} Coach, gap at the buzzer ${out.gapAtBuzzer}`;
    return out;
}
const races = [['never shoots', 0, 0], ['weak', 1.5, 0.2], ['strong', 1.0, 0.9], ['impossibly good', 1.0, 1, true]];
for (const [name, every, good, cheat] of races) {
    const r = tutorialRace(every, good, cheat);
    check(`tutorial race, ${name} player: overtime, offered the mythic once, got it on timeout, and won`,
        r.reachedOvertime && Math.abs(r.gapAtBuzzer) <= 10 && r.offered === 'placeholder' && r.offers === 1 && r.mythic && r.result === 'win', r.text);
}
check('the placeholder mythic: every make worth at least 3 and a wider green zone', (() => {
    quietStart();
    const plain = Game.greenZone(player, 0, 0);
    PowerUps.addEffect(player, PowerUps.byId('placeholder'));
    const wide = Game.greenZone(player, 0, 0);
    const points = Game.pointsFor(player, 2, {}, 0);
    return points === 3 && wide.hi - wide.lo > plain.hi - plain.lo + 6;
})());
Game.setCourt('home');

// A whole 3-minute match against the Medium rival, with picks
Game.start({ freeSpots: true, rival: Game.RIVALS.Medium, length: 180 });
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

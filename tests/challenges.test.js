// Run with:  node tests/challenges.test.js
// Checks the seeded power-up rolls, the daily challenge, challenge codes,
// the match modifier and the post-game stats record.
globalThis.Physics = require('../physics.js');
globalThis.PowerUps = require('../powerups.js');
globalThis.Courts = require('../courts.js');
globalThis.Modifiers = require('../modifiers.js');
const Game = require('../game.js');
const Challenges = require('../challenges.js');
const Leaderboards = require('../leaderboards.js');
const { check, finish } = require('./check.js');

const player = Game.player, rival = Game.rival, state = Game.state;
const quietRival = { name: 'T', accuracy: 0, pace: 999, maxRarity: null };
function run(seconds) { for (let t = 0; t < seconds; t += 1 / 60) Game.update(1 / 60); }

// ---------- Seeded rolls ----------
const r1 = Game.seededRandom(42), r2 = Game.seededRandom(42), r3 = Game.seededRandom(43);
const a = [r1(), r1(), r1()], b = [r2(), r2(), r2()], c = [r3(), r3(), r3()];
check('the same seed gives the same numbers, another seed different ones', a.join() === b.join() && a.join() !== c.join() &&
    a.every((x) => x >= 0 && x < 1));

// Play the picks of one seed: returns the cards offered at picks 1-6 (choosing buff each time)
function picksFor(seed, options) {
    Game.start(Object.assign({ mode: 'quick', freeSpots: true, rival: quietRival, court: 'home', seed: seed }, options));
    const cards = [];
    for (let i = 0; i < 6; i++) {
        Game.forcePick();
        cards.push(state.pick.buff.id + '/' + state.pick.sabotage.id);
        Game.choosePick(i === 2 ? 'skip' : 'buff');
        run(0.5);           // some play between picks, with its own randomness
    }
    return cards.join(' ');
}
const first = picksFor(123456), again = picksFor(123456), other = picksFor(654321);
check('the same seed offers the same cards at every pick', first === again, first);
check('a different seed offers different cards', first !== other);
// randomness between picks must not change later picks
Game.start({ mode: 'quick', freeSpots: true, rival: quietRival, court: 'home', seed: 123456 });
for (let i = 0; i < 50; i++) Math.random();
Game.forcePick();
const pick1 = state.pick.buff.id + '/' + state.pick.sabotage.id;
check('pick 1 is the same even after other random events', first.startsWith(pick1));
check('a match without a given seed still gets one (for its challenge code)', (Game.start({ freeSpots: true, rival: quietRival }), state.seed >= 0 && state.seed < Game.SEED_RANGE));

// the rival's own card at a pick (it picks when maxRarity is set) also follows the seed
function rivalCards(seed) {
    Game.start({ mode: 'quick', freeSpots: true, rival: { name: 'R', accuracy: 0, pace: 999, maxRarity: 'legendary' }, court: 'home', seed: seed });
    const got = [];
    Game.on((name, d) => { if (name === 'powerup' && d.user === rival) got.push(d.card.id); });
    for (let i = 0; i < 4; i++) { Game.forcePick(); Game.choosePick('buff'); }
    return got.join();
}
check('the rival\'s cards at each pick follow the seed too', rivalCards(777) === rivalCards(777));

// ---------- Daily challenge ----------
const d1 = Challenges.daily('2026-11-17'), d2 = Challenges.daily('2026-11-17'), d3 = Challenges.daily('2026-11-18');
check('the same date gives the same court, difficulty and seed', JSON.stringify(d1) === JSON.stringify(d2));
check('a new day gives a new seed', d1.seed !== d3.seed);
check('the daily court is a real court and the difficulty is Easy, Medium or Hard',
    Courts.LIST.some((x) => x.id === d1.court) && ['Easy', 'Medium', 'Hard'].includes(d1.difficulty));
let courtsSeen = new Set(), diffsSeen = new Set();
for (let day = 1; day <= 60; day++) {
    const d = Challenges.daily(`2026-12-${String((day % 28) + 1).padStart(2, '0')}`.replace('2026-12', day > 28 ? '2027-01' : '2026-12'));
    courtsSeen.add(d.court); diffsSeen.add(d.difficulty);
}
check('over two months the daily challenge visits many courts and all difficulties', courtsSeen.size >= 5 && diffsSeen.size === 3,
    `${courtsSeen.size} courts, ${diffsSeen.size} difficulties`);
check('the date key is YYYY-MM-DD', /^\d{4}-\d\d-\d\d$/.test(Challenges.dateKey()));
Game.start({ mode: 'daily', date: d1.date, court: d1.court, difficulty: d1.difficulty, seed: d1.seed, rival: quietRival, freeSpots: true });
check('a daily game uses the daily court and seed', state.court.id === d1.court && state.seed === d1.seed);
Leaderboards.reset();
player.score = 21;
const dailyMade = Leaderboards.recordGame(state, player);
check('a daily game goes on that day\'s board', dailyMade.length === 1 && Leaderboards.top(Leaderboards.dailyKey(d1.date))[0].value === 21);

// ---------- Challenge codes ----------
const game = { court: 'arena', difficulty: 'Hard', seed: 1234567890, score: 49 };
const code = Challenges.encode(game);
check('a code looks like 3M-0K9F2A-1D7', /^[0-9A-Z][EMH]-[0-9A-Z]{6}-[0-9A-Z]+[0-9A-Z]$/.test(code), code);
check('a code reads back to the same court, difficulty, seed and score', JSON.stringify(Challenges.decode(code)) === JSON.stringify(game));
check('lower case and spaces are fine', JSON.stringify(Challenges.decode(' ' + code.toLowerCase().replace('-', ' - ') + ' ')) === JSON.stringify(game));
let typosCaught = 0, typos = 0;
for (let i = 0; i < code.length; i++) {
    if (code[i] === '-') continue;
    for (const ch of '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
        if (ch === code[i]) continue;
        typos++;
        const bad = code.slice(0, i) + ch + code.slice(i + 1);
        if (Challenges.decode(bad) === null) typosCaught++;      // refused instead of playing the wrong game
    }
}
check('most one-letter typos are caught by the check letter', typosCaught / typos > 0.9, `${typosCaught} of ${typos}`);
check('nonsense is refused', Challenges.decode('hello') === null && Challenges.decode('') === null && Challenges.decode('ZM-000000-00') === null);
check('every court and difficulty can be put in a code', Courts.LIST.every((ct) => ['Easy', 'Medium', 'Hard'].every((df) =>
    Challenges.decode(Challenges.encode({ court: ct.id, difficulty: df, seed: 0, score: 0 })).court === ct.id)));
// playing a code's seed gives the code maker's cards
const maker = picksFor(game.seed, { court: 'arena' });
const friend = picksFor(Challenges.decode(code).seed, { court: 'arena', mode: 'challenge' });
check('a friend playing the code gets the same cards as the code maker', maker === friend);
Game.start({ mode: 'challenge', court: 'arena', difficulty: 'Hard', seed: game.seed, scoreToBeat: 49, rival: quietRival, freeSpots: true });
player.score = 60;
check('a challenge-code game does not go on the leaderboards', Leaderboards.recordGame(state, player).length === 0);

// ---------- Match modifier ----------
const counts = [0, 0, 0, 0];
for (let i = 0; i < 20000; i++) counts[Modifiers.rollShowAt(Math.random) - 1]++;
check('the modifier shows up at pick 1/2/3/4 about 15/20/50/15% of the time',
    [15, 20, 50, 15].every((p, i) => Math.abs(counts[i] / 200 - p) < 1.5), counts.map((n) => (n / 200).toFixed(1) + '%').join(' '));
check('there is exactly one modifier, a clearly labelled placeholder', Modifiers.LIST.length === 1 && Modifiers.LIST[0].placeholder &&
    /PLACEHOLDER/.test(Modifiers.LIST[0].text));
function modifierRun(options) {
    Game.start(Object.assign({ freeSpots: true, rival: quietRival, court: 'home' }, options));
    const at = state.modifierAt, seen = [];
    let events = 0;
    Game.on((name) => { if (name === 'modifier') events++; });
    for (let i = 1; i <= 6; i++) {
        Game.forcePick();
        seen.push(state.modifier ? 'M' : '-');
        if (state.twoPlayer) { Game.choosePick('buff', player); Game.choosePick('buff', rival); } else Game.choosePick('buff');
    }
    return { at, seen: seen.join(''), events };
}
let quick = modifierRun({ mode: 'quick' });
check('Quick Match: the modifier shows up at its secret pick (1-4) and stays', quick.at >= 1 && quick.at <= 4 &&
    quick.seen === '-'.repeat(quick.at - 1) + 'M'.repeat(7 - quick.at), `pick ${quick.at}: ${quick.seen}`);
check('it rolls only once per match', quick.events <= 1);
check('2 Players gets a modifier too', modifierRun({ mode: 'versus', twoPlayer: true }).at > 0);
check('the campaign never gets one', modifierRun({ mode: 'campaign', stage: 1 }).seen === '------');
check('nor the sandbox or tutorial', modifierRun({ mode: 'sandbox', practice: true }).at === 0 && modifierRun({ mode: 'tutorial', practice: true }).at === 0);
check('the daily challenge puts it at the same pick for everyone',
    modifierRun({ mode: 'daily', seed: d1.seed }).at === modifierRun({ mode: 'daily', seed: d1.seed }).at);
check('a new match starts with no modifier showing', (Game.start({ mode: 'quick', freeSpots: true, rival: quietRival }), state.modifier === null));

// ---------- Post-game stats record ----------
Game.start({ mode: 'quick', freeSpots: true, rival: quietRival, court: 'home', seed: 5 });
Game.forcePick(); const firstCard = state.pick.buff; Game.choosePick('buff');
Game.forcePick(); Game.choosePick('skip');
Game.forcePick(); const thirdCard = state.pick.sabotage; Game.choosePick('sabotage');
check('the cards you picked are listed in order (skips are not)', player.cardsUsed.length === 2 &&
    player.cardsUsed[0] === firstCard && player.cardsUsed[1] === thirdCard);
check('a new match clears the list', (Game.start({ freeSpots: true, rival: quietRival }), player.cardsUsed.length === 0));

finish();

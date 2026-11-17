// Run with:  node tests/leaderboards.test.js
// Checks the local leaderboards: top 10 order, ties, names, which games
// count, the combo count, and that a new court gets boards on its own.
globalThis.Physics = require('../physics.js');
globalThis.PowerUps = require('../powerups.js');
globalThis.Courts = require('../courts.js');
globalThis.Campaign = { STAGES: [{ id: 'ymca', court: 'ymca' }, { id: 'home', court: 'home' }] };
const Game = require('../game.js');
const Boards = require('../leaderboards.js');
const { check, finish } = require('./check.js');

const key = Boards.quickKey('home', 'Medium', 'score');

// ---------- Top 10 ----------
Boards.reset();
for (const v of [30, 50, 10, 40, 20]) Boards.add(key, v, 'A' + v);
check('entries are kept best first', Boards.top(key).map((e) => e.value).join() === '50,40,30,20,10');
check('a tie goes below the entry already there', Boards.add(key, 40, 'Late').rank === 3 && Boards.top(key)[2].name === 'Late' && Boards.top(key)[1].name === 'A40');
for (let i = 0; i < 10; i++) Boards.add(key, 100 + i, 'B');
check('only the top 10 are kept', Boards.top(key).length === 10 && Boards.top(key)[9].value === 100);
check('a score below the 10th does not make it', Boards.add(key, 5) === null && Boards.rankFor(key, 99) === 0);
check('a 0 never goes on a board', Boards.rankFor(Boards.quickKey('home', 'Easy', 'score'), 0) === 0);
const entry = Boards.top(key)[0];
check('each entry has a name, a score and a date', entry.name === 'B' && entry.value === 109 && /^\d{4}-\d\d-\d\d$/.test(entry.date));

// ---------- Boards are separate ----------
check('Easy, Medium and Hard are separate boards', Boards.top(Boards.quickKey('home', 'Hard', 'score')).length === 0);
check('high score and combo are separate boards', Boards.top(Boards.quickKey('home', 'Medium', 'combo')).length === 0);
check('each campaign stage has its own key', Boards.campaignKey('ymca') !== Boards.campaignKey('home') &&
    Boards.campaignKey('ymca') !== Boards.quickKey('ymca', 'Medium', 'score'));

// ---------- New courts get boards automatically ----------
Courts.LIST.push({ id: 'zay-test-court', name: 'Test Court', rules: {}, look: {} });
check('a new court in courts.js shows up in the board list', Boards.courts().some((c) => c.id === 'zay-test-court'));
Boards.add(Boards.quickKey('zay-test-court', 'Hard', 'combo'), 7, 'Z');
check('and its boards work with no other change', Boards.top(Boards.quickKey('zay-test-court', 'Hard', 'combo'))[0].value === 7);
Courts.LIST.pop();

// ---------- Names ----------
Boards.reset();
check('no name until one is given', Boards.getName() === '');
const first = Boards.add(key, 12);
check('an entry added before a name is known says Player', first.entry.name === 'Player');
check('an empty name is refused', Boards.setName('   ', [first.entry]) === false && Boards.getName() === '');
Boards.setName('  Justin the Great Shooter ', [first.entry]);
check('saving a name trims it to 12 letters and fills in the waiting entry',
    Boards.getName() === 'Justin the G' && Boards.top(key)[0].name === 'Justin the G');
check('after that, new entries use the saved name', Boards.add(key, 20).entry.name === 'Justin the G');

// ---------- Which games count (recordGame) ----------
const player = Game.player, state = Game.state;
function finishedGame(options, score, combo) {
    Game.start(Object.assign({ rival: { name: 'T', accuracy: 0, pace: 999, maxRarity: null }, court: 'home' }, options));
    player.score = score;
    player.bestCombo = combo;
    return Boards.recordGame(state, player);
}
Boards.reset();
let made = finishedGame({ mode: 'quick' }, 33, 6);
check('a Quick Match goes on its court and difficulty boards (score and combo)',
    made.length === 2 && made[0].label === 'New high score!' && made[1].label === 'New best combo!' &&
    Boards.top(Boards.quickKey('home', state.difficulty, 'score'))[0].value === 33 &&
    Boards.top(Boards.quickKey('home', state.difficulty, 'combo'))[0].value === 6);
check('the match remembers the difficulty it started on', state.difficulty === 'Medium');
made = finishedGame({ mode: 'campaign', stage: 1 }, 41, 9);
check('a campaign game goes on its stage board only (no combo board)', made.length === 1 &&
    Boards.top(Boards.campaignKey('home'))[0].value === 41 && Boards.top(Boards.quickKey('home', 'Medium', 'score')).length === 1);
check('two-player games do not count', finishedGame({ mode: 'versus', twoPlayer: true }, 90, 9).length === 0);
check('the sandbox does not count', finishedGame({ mode: 'sandbox', practice: true, freeSpots: true }, 90, 9).length === 0);
made = finishedGame({ mode: 'quick' }, 20, 2);
check('a lower score that still makes the top 10 says "Top 10", not "New high score!"',
    made.length === 2 && made[0].rank === 2 && made[0].label === 'Top 10 score!' && made[1].label === 'Top 10 combo!');

// ---------- The combo counts real makes in a row ----------
Game.start({ freeSpots: true, rival: { name: 'T', accuracy: 0, pace: 999, maxRarity: null }, court: 'home' });
state.nextPickAt = Infinity; state.pickNumber = 99;
const good = () => Game.makeWindow(player, player.spot, 0, 0).best;
function shot(make) { Game.throwBall(player, make ? good() : 5, 0, 0, 0); for (let t = 0; t < 3; t += 1 / 60) Game.update(1 / 60); }
shot(true); shot(true); shot(true); shot(false); shot(true);
check('combo: 3 makes, a miss, a make = best combo 3, current 1', player.bestCombo === 3 && player.combo === 1,
    `best ${player.bestCombo}, now ${player.combo}`);
Game.applyCard(PowerUps.byId('hothand'), player);
check('Hot Hand jumps the streak but not the combo', player.streak >= 3 && player.combo === 1);
PowerUps.addEffect(player, PowerUps.byId('second'));
shot(false);
check('Second Chance saves the streak but a miss still ends the combo', player.streak >= 3 && player.combo === 0);

finish();

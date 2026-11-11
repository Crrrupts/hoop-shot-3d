// Run with:  node tests/cards.test.js
// Checks chests, upgrades, gear and campaign rewards without a browser.
const Cards = require('../cards.js');
const Campaign = require('../campaign.js');
const { check, finish } = require('./check.js');

Cards.reset();
check('you start with the Classic ball and no gold', Cards.level('classic') === 1 && Cards.getSave().gold === 0 && Cards.getSave().ball === 'classic');
check('9 balls and 3 gear cards', Cards.LIST.filter((c) => c.type === 'ball').length === 9 && Cards.LIST.filter((c) => c.type === 'gear').length === 3);
let oddsOk = true;
for (const k in Cards.CHESTS) if (Math.abs(Cards.CHESTS[k].odds.reduce((a, b) => a + b) - 100) > 1e-9) oddsOk = false;
check('chest odds add up to 100%', oddsOk);

const opened = Cards.openChest('wood');
check('a Wooden Chest gives 3 cards and 40 gold', opened.cards.length === 3 && Cards.getSave().gold === 40);
check('chest cards are added to the collection', opened.cards.every((c) => Cards.owned(c.id)));

// upgrades need duplicates and gold
Cards.reset();
Cards.addCard('headband');
check('first copy unlocks a card at level 1', Cards.level('headband') === 1 && Cards.owned('headband').copies === 0);
Cards.addCard('headband'); Cards.addCard('headband');
check('cannot upgrade without gold', !Cards.canUpgrade('headband') && !Cards.upgrade('headband'));
Cards.addGold(60);
check('2 duplicates + 50 gold upgrades to level 2', Cards.upgrade('headband') && Cards.level('headband') === 2 &&
    Cards.owned('headband').copies === 0 && Cards.getSave().gold === 10);
check('Headband level 2 cuts wobble by 24%', Math.abs(Cards.gearBonus().wobbleScale - 0.76) < 1e-9);
check('no gear means no bonus', Cards.gearBonus().rimScale === 1 && Cards.gearBonus().freeMissChance === 0);
check('cannot equip a ball you do not own, can equip one you do',
    !Cards.equipBall('gold') && (Cards.addCard('street'), Cards.equipBall('street')) && Cards.getSave().ball === 'street');

// rarer chests give rarer cards
function rareShare(kind) {
    let rare = 0, total = 0;
    for (let i = 0; i < 3000; i++) for (const c of Cards.openChest(kind).cards) { total++; if (c.rarity !== 'common') rare++; }
    return rare / total;
}
const woodShare = rareShare('wood'), goldShare = rareShare('gold');
check('a Gold Chest gives more non-common cards than a Wooden Chest', goldShare > woodShare + 0.15,
    `${(woodShare * 100).toFixed(0)}% vs ${(goldShare * 100).toFixed(0)}%`);

// campaign
Cards.reset();
check('7 stages in the order of the difficulty curve',
    Campaign.STAGES.map((s) => s.court).join(',') === 'ymca,home,neon,arena,boardwalk,rooftop,lake' &&
    Campaign.STAGES[0].rival.accuracy === 0.25 && Campaign.STAGES[6].rival.accuracy === 0.65);
check('only the first stage is open at the start', Campaign.unlocked(0) && !Campaign.unlocked(1));
check('stars: win = 1, win by 10+ = 2, and no sabotage = 3',
    Campaign.starsFor('win', 20, 15, 1) === 1 && Campaign.starsFor('win', 30, 15, 2) === 2 &&
    Campaign.starsFor('win', 30, 15, 0) === 3 && Campaign.starsFor('lose', 10, 15, 0) === 0 && Campaign.starsFor('tie', 10, 10, 0) === 0);
const lost = Campaign.finish(0, 'lose', 10, 20, 0);
check('losing gives 20 gold, no chest, and does not unlock the next stage', lost.gold === 20 && !lost.chest && !Campaign.unlocked(1));
const won = Campaign.finish(0, 'win', 40, 20, 0);
check('a 3-star win gives a Gold Chest and unlocks the next stage',
    won.stars === 3 && won.chest.chest.name === 'Gold Chest' && won.firstClear && Campaign.unlocked(1));
Campaign.finish(0, 'win', 21, 20, 3);
check('a worse replay keeps your best stars', Cards.getSave().stars.ymca === 3);
Cards.reset();

finish();

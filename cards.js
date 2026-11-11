// cards.js — the card collection: ball skins and gear, chests, upgrades and
// the saved progress (gold, cards, campaign stars).
//
// Like Clash Royale: winning a campaign match gives a chest, a chest gives
// random cards, and duplicate cards plus gold level a card up.
// Progress is kept in the browser's localStorage, so it stays on this computer.
// All numbers are first-pass values to tune in playtesting.

const Cards = (function () {

    const MAX_LEVEL = 5;
    // To go from level N to N+1 you need this many duplicates and this much gold
    const UPGRADE_COST = [
        null,
        { copies: 2, gold: 50 },
        { copies: 4, gold: 150 },
        { copies: 8, gold: 400 },
        { copies: 16, gold: 1000 }
    ];

    // ---------- The cards ----------
    // Balls only change the look (same sphere, different texture and shine).
    // look is read by textures.js: base color, seam color and a pattern.
    const LIST = [
        { id: 'classic', type: 'ball', name: 'Classic', rarity: 'common', text: 'Orange leather, black seams',
          look: { base: '#d9722b', seam: '#1a1210', pattern: 'leather', shine: 0.25 } },
        { id: 'street', type: 'ball', name: 'Street', rarity: 'common', text: 'Worn rubber, scuffed and faded',
          look: { base: '#a8623a', seam: '#3a2a22', pattern: 'scuffed', shine: 0.08 } },
        { id: 'tricolor', type: 'ball', name: 'Retro Tricolor', rarity: 'rare', text: 'Red, white and blue panels',
          look: { base: '#f2f2f2', seam: '#22252e', pattern: 'tricolor', shine: 0.3 } },
        { id: 'watermelon', type: 'ball', name: 'Watermelon', rarity: 'rare', text: 'Green stripes, a seed pattern',
          look: { base: '#3f9e4a', seam: '#1c5a2a', pattern: 'stripes', shine: 0.35 } },
        { id: 'glow', type: 'ball', name: 'Glow', rarity: 'epic', text: 'Dark ball with glowing neon seams',
          look: { base: '#15131f', seam: '#3dffd0', pattern: 'plain', shine: 0.5 } },
        { id: 'snowball', type: 'ball', name: 'Snowball', rarity: 'epic', text: 'Packed snow',
          look: { base: '#eef4fa', seam: '#c3d3e2', pattern: 'leather', shine: 0.15 } },
        { id: 'disco', type: 'ball', name: 'Disco', rarity: 'legendary', text: 'Mirror tiles that sparkle under the lights',
          look: { base: '#aeb8c8', seam: '#4b5362', pattern: 'tiles', shine: 1.0 } },
        { id: 'lava', type: 'ball', name: 'Lava', rarity: 'legendary', text: 'Black rock with orange glowing cracks',
          look: { base: '#1b1512', seam: '#ff6a1a', pattern: 'cracks', shine: 0.2 } },
        { id: 'gold', type: 'ball', name: 'Gold', rarity: 'mythic', text: 'Polished gold, very shiny',
          look: { base: '#e2b53a', seam: '#8a6a14', pattern: 'plain', shine: 1.0 } },

        // Gear makes you a little better each level
        { id: 'headband', type: 'gear', name: 'Headband', rarity: 'common', text: 'Steadier aim: 12% less wobble per level' },
        { id: 'sleeve', type: 'gear', name: 'Shooting Sleeve', rarity: 'rare', text: 'Wider perfect-power zone: your rim counts 1.2% bigger per level' },
        { id: 'wristband', type: 'gear', name: 'Wristband', rarity: 'epic', text: 'Once a game a miss may keep your streak: 20% chance per level (always at level 5)' }
    ];

    // ---------- Chests ----------
    // odds are percent: common, rare, epic, legendary, mythic
    const CHESTS = {
        wood:   { name: 'Wooden Chest', cards: 3, gold: 40,  odds: [74, 20, 5, 1, 0] },
        silver: { name: 'Silver Chest', cards: 4, gold: 80,  odds: [58, 28, 10, 3.5, 0.5] },
        gold:   { name: 'Gold Chest',   cards: 5, gold: 150, odds: [42, 32, 17, 7, 2] }
    };
    const RARITIES = ['common', 'rare', 'epic', 'legendary', 'mythic'];

    // ---------- Saved progress ----------
    const SAVE_KEY = 'hoopshot3d-save';
    function freshSave() {
        return {
            gold: 0,
            cards: { classic: { level: 1, copies: 0 } },    // you start with the Classic ball
            ball: 'classic',                                // the ball you have equipped
            stars: {},                                      // campaign: stage id -> best stars (1-3)
            tutorialDone: false
        };
    }
    let save = freshSave();
    function load() {
        try {
            const text = localStorage.getItem(SAVE_KEY);
            if (text) save = Object.assign(freshSave(), JSON.parse(text));
        } catch (e) { /* no storage (private window or tests): keep progress in memory only */ }
    }
    function store() {
        try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
    }
    function reset() { save = freshSave(); store(); }
    load();

    function byId(id) { return LIST.find((c) => c.id === id); }
    function owned(id) { return save.cards[id] || null; }
    function level(id) { return save.cards[id] ? save.cards[id].level : 0; }

    // Add one copy of a card. The first copy unlocks it at level 1.
    function addCard(id) {
        if (!save.cards[id]) save.cards[id] = { level: 1, copies: 0 };
        else save.cards[id].copies++;
    }

    // What the next level costs, or null at max level / not owned
    function upgradeCost(id) {
        const c = save.cards[id];
        if (!c || c.level >= MAX_LEVEL) return null;
        return UPGRADE_COST[c.level];
    }
    function canUpgrade(id) {
        const cost = upgradeCost(id);
        return !!cost && save.cards[id].copies >= cost.copies && save.gold >= cost.gold;
    }
    function upgrade(id) {
        if (!canUpgrade(id)) return false;
        const cost = upgradeCost(id);
        save.cards[id].copies -= cost.copies;
        save.gold -= cost.gold;
        save.cards[id].level++;
        store();
        return true;
    }

    // Open a chest: returns { chest, gold, cards: [card, ...] } and saves it.
    function openChest(kind, random) {
        random = random || Math.random;
        const chest = CHESTS[kind];
        const got = [];
        for (let i = 0; i < chest.cards; i++) {
            // roll a rarity, then a random card of that rarity (step down if none)
            let roll = random() * 100, index = 0;
            while (index < chest.odds.length - 1 && roll >= chest.odds[index]) { roll -= chest.odds[index]; index++; }
            let choices = [];
            while (index >= 0 && !choices.length) {
                choices = LIST.filter((c) => c.rarity === RARITIES[index]);
                index--;
            }
            const card = choices[Math.floor(random() * choices.length)];
            addCard(card.id);
            got.push(card);
        }
        save.gold += chest.gold;
        store();
        return { chest: chest, gold: chest.gold, cards: got };
    }

    function addGold(amount) { save.gold += amount; store(); }

    function equipBall(id) {
        if (!save.cards[id] || byId(id).type !== 'ball') return false;
        save.ball = id;
        store();
        return true;
    }

    // What your gear does right now (read by game.js)
    function gearBonus() {
        return {
            wobbleScale: 1 - 0.12 * level('headband'),      // Headband: steadier aim
            rimScale: 1 + 0.012 * level('sleeve'),          // Shooting Sleeve: bigger sweet spot
            freeMissChance: 0.2 * level('wristband')        // Wristband: a miss may keep the streak
        };
    }

    return {
        LIST, CHESTS, MAX_LEVEL, UPGRADE_COST,
        byId, owned, level, addCard, upgradeCost, canUpgrade, upgrade, openChest, addGold,
        equipBall, gearBonus, reset, store,
        getSave: function () { return save; },
        // The ball skin to draw for you. The sandbox can preview any ball.
        previewBall: null,
        activeBall: function () { return this.previewBall || save.ball; }
    };
})();

if (typeof module !== 'undefined') module.exports = Cards;

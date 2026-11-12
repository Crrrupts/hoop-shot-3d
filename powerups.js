// powerups.js — the power-up cards: the list, the rarity odds, and how each
// one is stored on a shooter. game.js decides when a pick happens and reads
// the effects; this file has no drawing and no timers of its own.
//
// Every pick shows two cards: a BUFF for you (left) and a SABOTAGE for your
// opponent (right). Numbers here are starting values from the Design Bible.

const PowerUps = (function () {

    const RARITIES = ['common', 'rare', 'epic', 'legendary', 'mythic'];

    // kind says how long a card lasts:
    //   'shots'   the next N shots            (amount = N)
    //   'time'    N seconds                   (amount = N)
    //   'game'    the rest of the game
    //   'charges' until it has been used N times (amount = N)
    //   'instant' happens once, right away
    // Picking a card you already have adds its amount again and raises its level.
    const LIST = [
        // ----- Buffs (help the player who picks them) -----
        { id: 'steady',   name: 'Steady Hands',  side: 'buff', rarity: 'common',    kind: 'game',
          text: 'Your power meter charges 20% slower for the rest of the game' },
        { id: 'sweet',    name: 'Sweet Spot',    side: 'buff', rarity: 'common',    kind: 'shots', amount: 3,
          text: 'The green and grey power zones show on your meter for 3 shots' },
        { id: 'guide',    name: 'Guide Line',    side: 'buff', rarity: 'common',    kind: 'shots', amount: 3,
          text: 'A golden dot shows where to aim for your next 3 shots' },
        { id: 'glass',    name: 'Glass Cleaner', side: 'buff', rarity: 'common',    kind: 'game',
          text: 'Bank shots are worth +1 for the rest of the game' },
        { id: 'golden',   name: 'Golden Ball',   side: 'buff', rarity: 'rare',      kind: 'charges', amount: 1,
          text: 'Your next make is worth double' },
        { id: 'hothand',  name: 'Hot Hand',      side: 'buff', rarity: 'rare',      kind: 'instant',
          text: 'Your streak jumps to 3 (instant Heating Up)' },
        { id: 'second',   name: 'Second Chance', side: 'buff', rarity: 'rare',      kind: 'charges', amount: 1,
          text: 'Your next miss does not break your streak' },
        { id: 'wide',     name: 'Wide Rim',      side: 'buff', rarity: 'epic',      kind: 'time', amount: 15,
          text: 'Your rim is 20% wider for 15 seconds' },
        { id: 'double',   name: 'Double Ball',   side: 'buff', rarity: 'epic',      kind: 'shots', amount: 1,
          text: 'Your next shot throws 2 balls at once' },
        { id: 'freeze',   name: 'Time Freeze',   side: 'buff', rarity: 'legendary', kind: 'time', amount: 10,
          text: 'The clock and your opponent stop for 10 seconds while you keep shooting' },
        { id: 'money',    name: 'Moneyball',     side: 'buff', rarity: 'legendary', kind: 'time', amount: 20,
          text: 'Every make is worth 3 for 20 seconds' },

        // ----- Sabotages (hurt the opponent of the player who picks them) -----
        { id: 'fast',     name: 'Fast Meter',    side: 'sabotage', rarity: 'common',    kind: 'shots', amount: 3,
          text: "Opponent's meter charges 30% faster for 3 shots" },
        { id: 'shaky',    name: 'Shaky Hands',   side: 'sabotage', rarity: 'common',    kind: 'shots', amount: 3,
          text: "Opponent's aim wobbles for 3 shots" },
        { id: 'heckler',  name: 'Heckler',       side: 'sabotage', rarity: 'common',    kind: 'shots', amount: 2,
          text: "A loud fan shakes the opponent's camera for their next 2 shots" },
        { id: 'tiny',     name: 'Tiny Rim',      side: 'sabotage', rarity: 'rare',      kind: 'time', amount: 15,
          text: "Opponent's rim is 15% smaller for 15 seconds" },
        { id: 'extinguish', name: 'Extinguisher', side: 'sabotage', rarity: 'rare',     kind: 'instant',
          text: "Ends the opponent's streak right now" },
        { id: 'fog',      name: 'Fog Machine',   side: 'sabotage', rarity: 'rare',      kind: 'time', amount: 10,
          text: "Fog covers the opponent's court for 10 seconds" },
        { id: 'moving',   name: 'Moving Hoop',   side: 'sabotage', rarity: 'epic',      kind: 'time', amount: 15,
          text: "Opponent's hoop slides side to side for 15 seconds" },
        { id: 'slippery', name: 'Slippery Ball', side: 'sabotage', rarity: 'epic',      kind: 'time', amount: 15,
          text: "Opponent's ball bounces wildly off the rim for 15 seconds" },
        { id: 'blackout', name: 'Blackout',      side: 'sabotage', rarity: 'legendary', kind: 'time', amount: 10,
          text: "Opponent's lights go out for 10 seconds, except a spotlight on the hoop" }
    ];

    // ---------- Rarity odds (percent): common, rare, epic, legendary, mythic ----------
    // The odds get better with every pick: each mode has 4 steps, used in order.
    // Campaign odds are lower; multiplayer is the fast-paced mode with better odds.
    // Mythic cards only appear in overtime.
    const ODDS = {
        campaign: {
            steps: [
                [80, 16, 4, 0, 0],      // pick 1
                [70, 21, 8, 1, 0],      // picks 2-3
                [62, 24, 11, 3, 0],     // pick 4 or later
                [58, 25, 12, 5, 0]      // the best step: only reached with a skip bonus
            ],
            overtime: [0, 0, 0, 0, 100]
        },
        multiplayer: {
            steps: [
                [70, 22, 7, 1, 0],
                [58, 27, 12, 3, 0],
                [48, 30, 16, 6, 0],
                [42, 30, 17, 11, 0]
            ],
            overtime: [0, 0, 0, 0, 100]
        }
    };

    // Which odds row applies. pickNumber starts at 1.
    // boost: how many picks in a row this player skipped (let the timer run
    // out). Each skip moves their next pick one step toward rarer cards.
    function oddsRow(mode, pickNumber, overtime, boost) {
        const table = ODDS[mode] || ODDS.campaign;
        if (overtime) return table.overtime;
        const step = (pickNumber <= 1 ? 0 : pickNumber <= 3 ? 1 : 2) + (boost || 0);
        return table.steps[Math.min(step, table.steps.length - 1)];
    }

    // Roll a rarity from an odds row. rand is a number from 0 to 1.
    function rollRarity(row, rand) {
        let roll = rand * 100;
        for (let i = 0; i < row.length; i++) {
            if (roll < row[i]) return RARITIES[i];
            roll -= row[i];
        }
        return RARITIES[0];
    }

    // Pick a random card of one side ('buff' or 'sabotage') and rarity.
    // maxRarity (optional) caps it, e.g. 'rare' for an early campaign rival.
    // If no card of that rarity exists yet (the mythics are not designed),
    // step down to the next rarity that has one.
    function rollCard(side, row, maxRarity, random) {
        random = random || Math.random;
        let index = RARITIES.indexOf(rollRarity(row, random()));
        if (maxRarity) index = Math.min(index, RARITIES.indexOf(maxRarity));
        while (index >= 0) {
            const choices = LIST.filter((c) => c.side === side && c.rarity === RARITIES[index]);
            if (choices.length) return choices[Math.floor(random() * choices.length)];
            index--;
        }
        return null;
    }

    function byId(id) {
        return LIST.find((c) => c.id === id);
    }

    // ---------- Effects on a shooter ----------
    // shooter.effects[id] = { level, left }   left = shots, seconds or charges remaining

    // Give a card's effect to a shooter (the picker for buffs, the opponent
    // for sabotages). Instant cards are handled by game.js.
    function addEffect(shooter, card) {
        if (card.kind === 'instant') return;
        const e = shooter.effects[card.id] || { level: 0, left: 0 };
        e.level++;
        if (card.kind !== 'game') e.left += card.amount;
        shooter.effects[card.id] = e;
    }

    function has(shooter, id) {
        return !!shooter.effects[id];
    }
    function level(shooter, id) {
        return shooter.effects[id] ? shooter.effects[id].level : 0;
    }

    // Use up one shot or charge of an effect. Returns true if the shooter had it.
    function useOne(shooter, id) {
        const e = shooter.effects[id];
        if (!e) return false;
        e.left--;
        if (e.left <= 0) delete shooter.effects[id];
        return true;
    }

    // Count down the timed effects
    function tick(shooter, dt) {
        for (const id in shooter.effects) {
            if (byId(id).kind !== 'time') continue;
            shooter.effects[id].left -= dt;
            if (shooter.effects[id].left <= 0) delete shooter.effects[id];
        }
    }

    // Short list for the HUD, e.g. [{ name: 'Wide Rim', side: 'buff', label: '12s' }]
    function describe(shooter) {
        const out = [];
        for (const id in shooter.effects) {
            const card = byId(id), e = shooter.effects[id];
            let label = '';
            if (card.kind === 'time') label = Math.ceil(e.left) + 's';
            else if (card.kind === 'game') label = 'Lv ' + e.level;
            else label = 'x' + e.left;
            out.push({ id: id, name: card.name, side: card.side, rarity: card.rarity, label: label });
        }
        return out;
    }

    return { RARITIES, LIST, ODDS, oddsRow, rollRarity, rollCard, byId, addEffect, has, level, useOne, tick, describe };
})();

if (typeof module !== 'undefined') module.exports = PowerUps;

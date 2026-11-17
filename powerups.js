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
          text: 'Your green power zone shows for 3 shots, even on Hard or under Blind Meter' },
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
        // PLACEHOLDER: the real mythic cards are still being designed. This
        // one is only handed out in the tutorial's overtime pick; normal
        // rolls never land on it (see rollCard).
        { id: 'placeholder', name: 'Placeholder Mythic', side: 'buff', rarity: 'mythic', kind: 'game', placeholder: true,
          text: 'PLACEHOLDER (real mythics coming). Rest of the game: every make worth 3+, much wider green zone' },

        // ----- Sabotages (hurt the opponent of the player who picks them) -----
        { id: 'fast',     name: 'Fast Meter',    side: 'sabotage', rarity: 'common',    kind: 'shots', amount: 3,
          text: "Opponent's meter charges 30% faster for 3 shots" },
        { id: 'shaky',    name: 'Shaky Hands',   side: 'sabotage', rarity: 'common',    kind: 'shots', amount: 3,
          text: "Opponent's aim wobbles for 3 shots" },
        { id: 'heckler',  name: 'Heckler',       side: 'sabotage', rarity: 'common',    kind: 'shots', amount: 2,
          text: "A loud fan shakes the opponent's camera for their next 2 shots" },
        { id: 'blind',    name: 'Blind Meter',   side: 'sabotage', rarity: 'rare',      kind: 'shots', amount: 3,
          text: "Hides the opponent's green power zone for 3 shots" },
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
    // Each pick has its own row, and the odds climb fast. Every mode uses
    // the same table (for now). Mythic cards only appear in overtime.
    // Pick 4's 15% common / 5% rare is on purpose: a late common is a real risk.
    const ODDS = {
        picks: [
            [50, 40, 7, 3, 0],          // pick 1
            [35, 50, 10, 5, 0],         // pick 2
            [15, 25, 50, 10, 0],        // pick 3
            [15, 5, 30, 50, 0]          // pick 4 and later
        ],
        // Used instead when you skipped your previous pick (let the timer run out).
        // Common and rare are cut to 30% of normal; 80% of what they lose goes to
        // epic (up to 50%) and the rest to legendary. Pick 1 has none: nothing comes before it.
        afterSkip: [
            null,                       // pick 1
            [10.5, 15, 50, 24.5, 0],    // pick 2 after a skip
            [4.5, 7.5, 50, 38, 0],      // pick 3 after a skip
            [4.5, 1.5, 41.2, 52.8, 0]   // pick 4 and later after a skip
        ],
        overtime: [0, 0, 0, 0, 100]
    };

    // Which odds row applies. pickNumber starts at 1.
    // skipped: true if this player skipped their previous pick. Only the very
    // next pick uses the "after a skip" row; the one after goes back to normal.
    function oddsRow(pickNumber, overtime, skipped) {
        if (overtime) return ODDS.overtime;
        const index = Math.min(Math.max(pickNumber, 1), ODDS.picks.length) - 1;
        if (skipped && ODDS.afterSkip[index]) return ODDS.afterSkip[index];
        return ODDS.picks[index];
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
    // step down to the next rarity that has one. Placeholder cards are never rolled.
    function rollCard(side, row, maxRarity, random) {
        random = random || Math.random;
        let index = RARITIES.indexOf(rollRarity(row, random()));
        if (maxRarity) index = Math.min(index, RARITIES.indexOf(maxRarity));
        while (index >= 0) {
            const choices = LIST.filter((c) => c.side === side && c.rarity === RARITIES[index] && !c.placeholder);
            if (choices.length) return choices[Math.floor(random() * choices.length)];
            index--;
        }
        return null;
    }

    function byId(id) {
        return LIST.find((c) => c.id === id);
    }

    // ---------- The slot-machine reel on the pick screen ----------
    // Each card spins like a reel before it lands. reelFrames lists what a
    // card shows over time:
    //   finalRarity   the rarity it will land on
    //   landAt        seconds until it lands (the left card lands first)
    // Returns [{ at, rarity, tease, landed }]. The frames start fast and slow
    // down, like a reel coming to a stop. Just before landing it "teases"
    // the next rarity up, then drops to the real one.
    const REEL_STRIP = ['common', 'rare', 'common', 'epic', 'common', 'rare', 'legendary', 'common', 'rare', 'epic'];
    function reelFrames(finalRarity, landAt) {
        // gaps between frames grow by 18% each time
        const gaps = [];
        let total = 0, gap = 0.04;
        while (total < landAt) { gaps.push(gap); total += gap; gap *= 1.18; }
        const fit = landAt / total;                     // stretch so the last frame is exactly at landAt
        const frames = [];
        let at = 0;
        gaps.forEach((g, i) => {
            at += g * fit;
            frames.push({ at: at, rarity: REEL_STRIP[i % REEL_STRIP.length], tease: false, landed: false });
        });
        const last = frames[frames.length - 1];
        last.rarity = finalRarity;
        last.landed = true;
        last.at = landAt;
        // the tease: one rarity higher on the frame before landing (nothing is above mythic)
        const index = RARITIES.indexOf(finalRarity);
        if (frames.length > 1 && index < RARITIES.length - 1) {
            frames[frames.length - 2].rarity = RARITIES[index + 1];
            frames[frames.length - 2].tease = true;
        }
        return frames;
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

    return { RARITIES, LIST, ODDS, oddsRow, rollRarity, rollCard, reelFrames, byId, addEffect, has, level, useOne, tick, describe };
})();

if (typeof module !== 'undefined') module.exports = PowerUps;

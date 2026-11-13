// campaign.js — the main mode: 7 stages, one per court, from easiest to
// hardest. Each stage is a live race against that court's boss, who has a twist.
// Winning earns stars, gold and a chest, and unlocks the next stage.
// Numbers come from the Design Bible's difficulty curve (first pass).

const Campaign = (function () {

    const CardsRef = (typeof Cards !== 'undefined') ? Cards : require('./cards.js');

    // accuracy = share of the rival's shots that go in; pace = seconds between shots;
    // maxRarity = best power-up card the rival may pick (null = none);
    // twist = the boss's special rule (handled in game.js)
    const STAGES = [
        { id: 'ymca', court: 'ymca', rival: { name: 'Coach', accuracy: 0.25, pace: 4.0, maxRarity: null },
          twist: 'tutorialRace', twistText: 'Tutorial, then a 2-minute race that always goes to overtime' },
        { id: 'home', court: 'home', rival: { name: 'Captain', accuracy: 0.35, pace: 3.5, maxRarity: 'common' },
          twist: 'heatingStart', twistText: 'Boss starts already Heating Up' },
        { id: 'neon', court: 'neon', rival: { name: 'Synth', accuracy: 0.42, pace: 3.0, maxRarity: 'rare' },
          twist: 'flicker', twistText: 'Lights flicker in the last minute' },
        { id: 'arena', court: 'arena', rival: { name: 'All-Star', accuracy: 0.50, pace: 2.5, maxRarity: 'epic' },
          twist: 'heckle', twistText: 'The crowd heckles every one of your shots' },
        { id: 'boardwalk', court: 'boardwalk', rival: { name: 'Breeze', accuracy: 0.55, pace: 2.5, maxRarity: 'legendary' },
          twist: 'risingWind', twistText: 'Wind gusts get stronger over time' },
        { id: 'rooftop', court: 'rooftop', rival: { name: 'Storm', accuracy: 0.60, pace: 2.2, maxRarity: 'legendary' },
          twist: 'heavierRain', twistText: 'Rain gets heavier as the boss scores' },
        { id: 'lake', court: 'lake', rival: { name: 'Frost', accuracy: 0.65, pace: 2.0, maxRarity: 'mythic' },
          twist: 'sabotageEveryPick', twistText: 'Final boss: uses a sabotage every pick' }
    ];

    // A stage is open if it is the first one or the stage before it has been won
    function unlocked(index) {
        return index === 0 || !!CardsRef.getSave().stars[STAGES[index - 1].id];
    }

    // Stars for a match: 1 for a win, +1 for winning by 10 or more, +1 for not using a sabotage card
    function starsFor(result, playerScore, rivalScore, sabotagesUsed) {
        if (result !== 'win') return 0;
        return 1 + (playerScore - rivalScore >= 10 ? 1 : 0) + (sabotagesUsed === 0 ? 1 : 0);
    }

    // Record a finished campaign match. Returns what was earned:
    // { stars, gold, chest (opened chest or null), firstClear }
    function finish(index, result, playerScore, rivalScore, sabotagesUsed) {
        const stage = STAGES[index], save = CardsRef.getSave();
        const stars = starsFor(result, playerScore, rivalScore, sabotagesUsed);
        if (stars === 0) {
            CardsRef.addGold(20);                       // a little gold for trying
            return { stars: 0, gold: 20, chest: null, firstClear: false };
        }
        const firstClear = !save.stars[stage.id];
        save.stars[stage.id] = Math.max(save.stars[stage.id] || 0, stars);
        const gold = 50 * stars;
        CardsRef.addGold(gold);
        // more stars, better chest
        const chest = CardsRef.openChest(['wood', 'silver', 'gold'][stars - 1]);
        return { stars: stars, gold: gold, chest: chest, firstClear: firstClear };
    }

    return { STAGES, unlocked, starsFor, finish };
})();

if (typeof module !== 'undefined') module.exports = Campaign;

// modifiers.js — match modifiers (the "third roll").
//
// Once per Quick Match or 2 Players game, a third reel spins next to the two
// power-up cards at one of the first four picks and lands on a modifier.
// There is no choice: the same modifier applies to both players for the rest
// of the game, and its name and effect stay on screen. It does nothing until
// it shows up. Never in the campaign.
//
// The real modifiers are still being designed by Justin. To add one, add an
// object to LIST:
//   id     a short name used in code
//   name   shown on the reel and the HUD
//   text   one line saying what it does, shown on screen
//   start  (optional) function (game) { ... } run once when it shows up.
//          game is everything game.js exposes (Game.state, Game.player,
//          Game.SETTINGS, ...). game.js can also check Game.state.modifier.id
//          wherever a rule needs to change.

const Modifiers = (function () {

    const LIST = [
        // PLACEHOLDER so the roll, the reel and the on-screen text can be tested.
        // It changes nothing. Replace it with the real modifiers.
        { id: 'placeholder', name: 'Placeholder Modifier', placeholder: true,
          text: 'PLACEHOLDER (real modifiers coming): nothing changes this game' }
    ];

    // Which of the first four picks the modifier shows up at (percent).
    const SHOW_AT = [15, 20, 50, 15];       // pick 1, pick 2, pick 3, pick 4

    // Choose the pick number (1-4) the modifier will show up at. random() is 0..1.
    function rollShowAt(random) {
        let roll = random() * 100;
        for (let i = 0; i < SHOW_AT.length; i++) {
            if (roll < SHOW_AT[i]) return i + 1;
            roll -= SHOW_AT[i];
        }
        return SHOW_AT.length;
    }

    // Choose the modifier itself (every one in the list is equally likely for now)
    function roll(random) {
        return LIST[Math.floor(random() * LIST.length)];
    }

    function byId(id) { return LIST.find((m) => m.id === id); }

    return { LIST, SHOW_AT, rollShowAt, roll, byId };
})();

if (typeof module !== 'undefined') module.exports = Modifiers;

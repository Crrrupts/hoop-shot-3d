// challenges.js — the daily challenge and challenge codes. No server: both
// work by sharing a seed, so the power-up rolls come out the same.
//
// Daily challenge: today's date picks the court, the difficulty and the
// seed, so everyone who plays on the same day gets the same game (the same
// cards at each pick, the same match modifier). It has its own daily board.
//
// Challenge code: after a one-player game you get a short code such as
//   3M-0K9F2A-1D7
//   3       the court (its place in courts.js, in base 36)
//   M       the difficulty (E, M or H)
//   0K9F2A  the seed for the power-up rolls (6 letters or digits)
//   1D      the score to beat (base 36: 1D = 49)
//   7       a check letter, so a typo is caught
// Entering it from the menu plays the same game; the result screen shows the
// score to beat. Only the rolls are shared: the rival's shots, the wind and
// your own shots are still your own.

const Challenges = (function () {

    const DIFFS = ['Easy', 'Medium', 'Hard'];
    const SEED_RANGE = 2176782336;          // 36^6
    const courts = () => (typeof Courts !== 'undefined' ? Courts : require('./courts.js')).LIST;

    // A small text hash (FNV-1a): the same text always gives the same number
    function hash(text) {
        let h = 2166136261;
        for (let i = 0; i < text.length; i++) {
            h ^= text.charCodeAt(i);
            h = Math.imul(h, 16777619) >>> 0;
        }
        return h >>> 0;
    }

    // ---------- Daily challenge ----------
    // A date as YYYY-MM-DD on this computer's clock
    function dateKey(d) {
        d = d || new Date();
        const two = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
    }
    // Today's game: { date, court, difficulty, seed }
    function daily(date) {
        const key = typeof date === 'string' ? date : dateKey(date);
        const h = hash('hoop-shot-daily-' + key);
        const list = courts();
        return {
            date: key,
            court: list[h % list.length].id,
            difficulty: DIFFS[Math.floor(h / list.length) % DIFFS.length],
            seed: hash('seed-' + key) % SEED_RANGE
        };
    }

    // ---------- Challenge codes ----------
    function checkChar(text) {
        let sum = 0;
        for (let i = 0; i < text.length; i++) sum += text.charCodeAt(i) * (i + 1);
        return (sum % 36).toString(36).toUpperCase();
    }

    // Make a code from { court, difficulty, seed, score }. Returns '' if the
    // court is not in the list.
    function encode(game) {
        const courtIndex = courts().findIndex((c) => c.id === game.court);
        const diff = DIFFS.indexOf(game.difficulty);
        if (courtIndex < 0 || courtIndex >= 36 || diff < 0) return '';
        const body = courtIndex.toString(36).toUpperCase() + 'EMH'[diff] + '-' +
            (game.seed % SEED_RANGE).toString(36).toUpperCase().padStart(6, '0') + '-' +
            Math.max(0, Math.floor(game.score)).toString(36).toUpperCase();
        return body + checkChar(body);
    }

    // Read a code back. Returns { court, difficulty, seed, score } or null if
    // it is not a valid code. Spaces and lower case are fine.
    function decode(code) {
        const text = String(code || '').toUpperCase().replace(/\s+/g, '');
        const m = /^([0-9A-Z])([EMH])-([0-9A-Z]{6})-([0-9A-Z]+)([0-9A-Z])$/.exec(text);
        if (!m) return null;
        const body = text.slice(0, -1);
        if (checkChar(body) !== m[5]) return null;          // a typo
        const court = courts()[parseInt(m[1], 36)];
        if (!court) return null;
        return {
            court: court.id,
            difficulty: DIFFS['EMH'.indexOf(m[2])],
            seed: parseInt(m[3], 36),
            score: parseInt(m[4], 36)
        };
    }

    return { DIFFS, hash, dateKey, daily, encode, decode };
})();

if (typeof module !== 'undefined') module.exports = Challenges;

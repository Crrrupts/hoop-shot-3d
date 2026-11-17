// leaderboards.js — the local high-score boards.
//
// Quick Match: two boards for every court and difficulty (Easy, Medium, Hard):
//   'score'  most points in one game (overtime points count)
//   'combo'  most makes in a row in one game
// Campaign: one high-score board per stage.
// Each board keeps the top 10, each entry { name, value, date }.
//
// Boards are saved in the browser's localStorage (this computer only), the
// same way cards.js saves progress. A board is just a key such as
// 'quick:home:Medium:score', made from the court list, so a new court in
// courts.js gets its boards automatically, with no change here.

const Leaderboards = (function () {

    const SAVE_KEY = 'hoopshot3d-leaderboards';
    const TOP = 10;
    const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
    const KINDS = ['score', 'combo'];
    const NAME_LENGTH = 12;

    // data = { name: 'the player name, once given', boards: { key: [entries] } }
    let data = { name: '', boards: {} };

    function load() {
        try {
            const text = localStorage.getItem(SAVE_KEY);
            if (text) data = Object.assign({ name: '', boards: {} }, JSON.parse(text));
        } catch (e) { /* no storage (private window or tests): keep the boards in memory only */ }
    }
    function store() {
        try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
    }
    load();

    // ---------- Board names ----------
    function quickKey(courtId, difficulty, kind) { return `quick:${courtId}:${difficulty}:${kind}`; }
    function campaignKey(stageId) { return `campaign:${stageId}:score`; }

    // The courts and campaign stages that have boards, read from courts.js and
    // campaign.js each time, so new ones show up on their own
    function courts() { return typeof Courts !== 'undefined' ? Courts.LIST : []; }
    function stages() { return typeof Campaign !== 'undefined' ? Campaign.STAGES : []; }

    // ---------- Reading and adding ----------
    // The entries of one board, best first (a new empty list if nobody has played it)
    function top(key) { return data.boards[key] || []; }

    // Where a value would land on a board: 1 for first ... 10, or 0 if it does
    // not make the top 10. Ties go below the entries already there.
    function rankFor(key, value) {
        if (!(value > 0)) return 0;                 // a 0 never goes on a board
        const list = top(key);
        let rank = list.length + 1;
        for (let i = 0; i < list.length; i++) {
            if (value > list[i].value) { rank = i + 1; break; }
        }
        return rank <= TOP ? rank : 0;
    }

    // Today's date as YYYY-MM-DD on this computer's clock
    function today() {
        const d = new Date();
        const two = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
    }

    // Add a result to a board. Returns { rank, entry } if it made the top 10,
    // or null. The entry is kept so the name can be filled in afterwards.
    function add(key, value, name) {
        const rank = rankFor(key, value);
        if (!rank) return null;
        const entry = { name: name || data.name || 'Player', value: value, date: today() };
        const list = top(key).slice();
        list.splice(rank - 1, 0, entry);
        data.boards[key] = list.slice(0, TOP);
        store();
        return { rank: rank, entry: entry };
    }

    // ---------- The player's name ----------
    // Asked for the first time a score makes a board, then remembered.
    function getName() { return data.name; }
    function cleanName(name) { return String(name || '').trim().slice(0, NAME_LENGTH); }
    // Save the name, and put it on entries that were added before it was known
    function setName(name, entries) {
        name = cleanName(name);
        if (!name) return false;
        data.name = name;
        for (const entry of entries || []) entry.name = name;
        store();
        return true;
    }

    // ---------- After a game ----------
    // What a finished match puts on the boards. Returns a list of
    // { label, rank, entry } for every board it made (empty if none).
    // Only Quick Match (one player) and campaign games count.
    function recordGame(state, player) {
        const made = [];
        const opt = state.options || {};
        // #1 is a new best; anything else in the top 10 is a top-10 finish
        const note = (result, best, other) => result && made.push(Object.assign({ label: result.rank === 1 ? best : other }, result));
        if (state.twoPlayer || state.practice) return made;
        if (opt.mode === 'quick') {
            const court = state.court.id, diff = state.difficulty;
            note(add(quickKey(court, diff, 'score'), player.score), 'New high score!', 'Top 10 score!');
            note(add(quickKey(court, diff, 'combo'), player.bestCombo), 'New best combo!', 'Top 10 combo!');
        } else if (opt.mode === 'campaign') {
            const stage = stages()[opt.stage];
            if (stage) note(add(campaignKey(stage.id), player.score), 'New stage high score!', 'Top 10 stage score!');
        }
        return made;
    }

    // Wipe every board (for tests)
    function reset() { data = { name: '', boards: {} }; store(); }

    return {
        TOP, DIFFICULTIES, KINDS, NAME_LENGTH,
        quickKey, campaignKey, courts, stages, top, rankFor, add, getName, setName, recordGame, reset
    };
})();

if (typeof module !== 'undefined') module.exports = Leaderboards;

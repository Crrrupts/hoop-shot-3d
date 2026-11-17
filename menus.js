// menus.js — the screens around the game: main menu, quick match, campaign
// map, card collection, result and chest opening, the tutorial and the
// sandbox panel. The game rules themselves are in game.js, campaign.js and cards.js.

const Menus = (function () {

    const overlay = document.getElementById('menu-overlay');
    const $ = (id) => document.getElementById(id);

    // ---------- Showing one screen at a time ----------
    function show(name) {
        overlay.style.display = 'flex';
        for (const screen of overlay.querySelectorAll('.screen')) {
            screen.style.display = screen.id === 'screen-' + name ? 'flex' : 'none';
        }
        for (const el of document.querySelectorAll('.gold-amount')) el.textContent = Cards.getSave().gold;
        if (name === 'campaign') fillCampaign();
        if (name === 'cards') fillCards();
        if (name === 'boards') fillBoards();
        if (name !== 'result') { $('sandbox-panel').style.display = 'none'; hideTutorial(); }
    }
    // game.js calls this when a match starts
    window.hideMenus = function () { overlay.style.display = 'none'; };

    $('btn-campaign').addEventListener('click', () => show('campaign'));
    $('btn-quick').addEventListener('click', () => show('quick'));
    $('btn-versus').addEventListener('click', () => show('versus'));
    $('btn-cards').addEventListener('click', () => show('cards'));
    $('btn-player').addEventListener('click', () => { show('player'); fillPlayer(); });
    $('btn-boards').addEventListener('click', () => show('boards'));
    $('btn-sandbox').addEventListener('click', startSandbox);
    for (const b of document.querySelectorAll('.back-btn')) b.addEventListener('click', () => show('main'));
    $('btn-menu').addEventListener('click', () => show(Game.state.options.mode === 'campaign' ? 'campaign' : 'main'));
    $('btn-again').addEventListener('click', () => Game.start());
    // "Start" under the game restarts whatever is being played
    $('start-btn').addEventListener('click', () => { Game.start(); $('start-btn').blur(); });

    // ---------- Your player: skin tone and hair style ----------
    // The choice is saved with your progress (cards.js) and used by shooter.js.
    function cssColor(rgb) { return `rgb(${rgb.map((c) => Math.round(c * 255)).join(',')})`; }

    function fillPlayer() {
        const chosen = Cards.getSave().shooter;
        const skins = $('skin-choices'), hairs = $('hair-choices');
        skins.innerHTML = '';
        hairs.innerHTML = '';
        Shooter.SKIN_TONES.forEach((tone, i) => {
            const b = document.createElement('button');
            b.className = 'swatch' + (i === chosen.skin ? ' chosen' : '');
            b.style.background = cssColor(tone);
            b.title = 'Skin tone ' + (i + 1);
            b.addEventListener('click', () => { chosen.skin = i; Cards.store(); fillPlayer(); });
            skins.appendChild(b);
        });
        for (const id in Shooter.HAIR_STYLES) {
            const b = document.createElement('button');
            b.className = id === chosen.hair ? 'chosen' : '';
            b.textContent = Shooter.HAIR_STYLES[id].name;
            b.addEventListener('click', () => { chosen.hair = id; Cards.store(); fillPlayer(); });
            hairs.appendChild(b);
        }
        drawPlayerPreview();
    }

    // A simple front view of your player's head and shoulders, drawn in 2D
    // from the same hair shapes the 3D player uses.
    function drawPlayerPreview() {
        const canvas = $('player-preview'), g = canvas.getContext('2d');
        const look = Shooter.lookOf(Game.player), head = 34;        // head radius in pixels
        const cx = canvas.width / 2, cy = 78;
        g.clearRect(0, 0, canvas.width, canvas.height);
        g.fillStyle = cssColor(look.shirt);                         // shoulders
        g.fillRect(cx - 62, cy + head + 14, 124, 60);
        g.fillStyle = cssColor(look.skin);                          // neck
        g.fillRect(cx - 12, cy + head - 6, 24, 24);
        // hair behind the head first, then the head, then hair that sits on top
        g.fillStyle = cssColor(look.hair);
        const parts = Shooter.HAIR_STYLES[look.hairStyle].parts;
        function drawPart(part) {
            const x = cx + part.at[0] * head, y = cy - part.at[1] * head;
            if (part.shape === 'box') g.fillRect(x - part.size[0] * head / 2, y - part.size[1] * head / 2, part.size[0] * head, part.size[1] * head);
            else { g.beginPath(); g.ellipse(x, y, part.size[0] * head, part.size[1] * head, 0, 0, 2 * Math.PI); g.fill(); }
        }
        parts.forEach(drawPart);
        g.fillStyle = cssColor(look.skin);
        g.beginPath(); g.arc(cx, cy, head, 0, 2 * Math.PI); g.fill();
        // seen from the front, the hair only covers the top of the head
        g.save();
        g.beginPath(); g.rect(0, 0, canvas.width, cy - head * 0.45); g.clip();
        g.fillStyle = cssColor(look.hair);
        parts.forEach(drawPart);
        g.restore();
        g.fillStyle = '#222';                                       // eyes
        g.beginPath(); g.arc(cx - 12, cy + 2, 3, 0, 2 * Math.PI); g.arc(cx + 12, cy + 2, 3, 0, 2 * Math.PI); g.fill();
    }

    // ---------- Sound on / off ----------
    $('sound-toggle').checked = Cards.getSave().sound !== false;
    GameAudio.setMuted(!$('sound-toggle').checked);
    $('sound-toggle').addEventListener('change', (e) => {
        Cards.getSave().sound = e.target.checked;
        Cards.store();
        GameAudio.setMuted(!e.target.checked);
        e.target.blur();                                            // keep Space for shooting
    });

    // ---------- Money spot ----------
    // Before a game each player picks one spot where their makes count double.
    // Your choice is saved with your progress (cards.js).
    const SPOT_NAMES = ['1: left corner (3 pts)', '2: left wing', '3: top of the key', '4: right wing', '5: right corner (3 pts)'];
    const moneySelects = [...document.querySelectorAll('.money-spot'), $('versus-money2')];
    for (const select of moneySelects) {
        SPOT_NAMES.forEach((name, i) => select.add(new Option(name, i + 1)));
        select.value = select.id === 'versus-money2' ? 3 : (Cards.getSave().moneySpot || 3);
    }
    function moneySpot() { return Cards.getSave().moneySpot || 3; }
    for (const select of document.querySelectorAll('.money-spot')) {
        select.addEventListener('change', () => {
            Cards.getSave().moneySpot = Number(select.value);
            Cards.store();
            for (const other of document.querySelectorAll('.money-spot')) other.value = select.value;   // keep them in step
        });
    }

    // ---------- Quick match ----------
    $('play-btn').addEventListener('click', () => {
        Cards.previewBall = null;
        Game.start({ mode: 'quick', court: $('court-select').value, moneySpot: moneySpot() });
    });

    // ---------- Two players on one computer ----------
    for (const court of Courts.LIST) $('versus-court').add(new Option(`${court.name} (${court.difficulty})`, court.id));
    $('versus-play').addEventListener('click', () => {
        Cards.previewBall = null;
        document.activeElement.blur();          // so Enter (Player 2's shoot key) does not press a button
        Game.start({ mode: 'versus', twoPlayer: true, court: $('versus-court').value,
            moneySpot: moneySpot(), moneySpot2: Number($('versus-money2').value) });
    });

    // ---------- Campaign map ----------
    function stars(n) { return '★'.repeat(n) + '☆'.repeat(3 - n); }

    function fillCampaign() {
        const list = $('stage-list'), save = Cards.getSave();
        list.innerHTML = '';
        Campaign.STAGES.forEach((stage, i) => {
            const court = Courts.byId(stage.court), open = Campaign.unlocked(i);
            const row = document.createElement('div');
            row.className = 'stage' + (open ? '' : ' locked');
            row.innerHTML =
                `<div class="stage-name">${i + 1}. ${court.name} <span class="stage-diff">${court.difficulty}</span></div>` +
                `<div class="stage-info">vs ${stage.rival.name}: makes ${Math.round(stage.rival.accuracy * 100)}%, ` +
                `shoots every ${stage.rival.pace} s. ${stage.twistText}.</div>` +
                `<div class="stage-stars">${open ? stars(save.stars[stage.id] || 0) : 'Locked'}</div>`;
            const play = document.createElement('button');
            play.textContent = 'Play';
            play.disabled = !open;
            play.addEventListener('click', () => startStage(i));
            row.appendChild(play);
            list.appendChild(row);
        });
    }

    function startStage(i) {
        const stage = Campaign.STAGES[i];
        Cards.previewBall = null;
        // the first stage begins with the tutorial until you have finished it once
        if (i === 0 && !Cards.getSave().tutorialDone) { startTutorial(); return; }
        // (stage 1's twist 'tutorialRace' keeps it close so it always reaches overtime)
        Game.start({ mode: 'campaign', stage: i, court: stage.court, rival: stage.rival, twist: stage.twist, moneySpot: moneySpot() });
    }
    $('btn-next').addEventListener('click', () => startStage(Game.state.options.stage + 1));
    $('btn-tutorial').addEventListener('click', startTutorial);

    // ---------- Result screen (and chest opening for campaign wins) ----------
    window.showGameOver = function () {
        const s = Game.state, player = Game.player, rival = Game.rival, options = s.options;
        const pct = player.attempts ? Math.round(100 * player.made / player.attempts) : 0;
        $('result-title').textContent = { win: 'You Win!', lose: 'You Lose', tie: 'Tie Game' }[s.result];
        $('result-score').textContent = `You ${player.score} - ${rival.score} ${rival.name} | ` +
            `${player.made}/${player.attempts} shots (${pct}%) | best streak ${player.bestStreak}`;
        if (s.twoPlayer) {
            const pct2 = rival.attempts ? Math.round(100 * rival.made / rival.attempts) : 0;
            $('result-title').textContent = { win: 'Player 1 Wins!', lose: 'Player 2 Wins!', tie: 'Tie Game' }[s.result];
            $('result-score').textContent = `P1 ${player.score} - ${rival.score} P2 | ` +
                `P1 ${player.made}/${player.attempts} (${pct}%), P2 ${rival.made}/${rival.attempts} (${pct2}%)`;
        }
        $('result-stars').textContent = '';
        $('result-reward').textContent = '';
        $('result-cards').innerHTML = '';
        $('btn-next').style.display = 'none';

        if (options.mode === 'campaign') {
            const reward = Campaign.finish(options.stage, s.result, player.score, rival.score, player.sabotagesUsed);
            $('result-stars').textContent = stars(reward.stars);
            if (reward.chest) {
                $('result-reward').textContent =
                    `+${reward.gold + reward.chest.gold} gold and a ${reward.chest.chest.name}` +
                    (reward.firstClear && options.stage < Campaign.STAGES.length - 1 ? '. Next stage unlocked!' : '');
                // the cards flip in one after another
                reward.chest.cards.forEach((card, i) => {
                    const el = cardElement(card, false);
                    el.style.animationDelay = (0.4 + i * 0.35) + 's';
                    el.classList.add('reveal');
                    $('result-cards').appendChild(el);
                    if (card.rarity === 'legendary' || card.rarity === 'mythic') {
                        setTimeout(() => flashScreen('gold'), (0.4 + i * 0.35) * 1000);
                    }
                });
            } else {
                $('result-reward').textContent = `+${reward.gold} gold. Win to earn stars and a chest.`;
            }
            const next = options.stage + 1;
            if (next < Campaign.STAGES.length && Campaign.unlocked(next)) $('btn-next').style.display = '';
        }
        showBoardResults(Leaderboards.recordGame(s, player));
        show('result');
    };

    // ---------- Leaderboards on the result screen ----------
    // "New high score! #3 on Home Gym (Medium)". The first time a score makes
    // a board, ask for a name; the new entries get it when it is saved.
    let unnamed = [];               // entries added before the player gave a name
    function showBoardResults(made) {
        const s = Game.state;
        const where = s.options.mode === 'campaign' ? `the stage ${s.options.stage + 1} board` : `${s.court.name} (${s.difficulty})`;
        $('result-boards').textContent = made.map((m) => `${m.label} #${m.rank} on ${where}`).join('\n');      // one per line (style.css keeps the line breaks)
        unnamed = Leaderboards.getName() ? [] : made.map((m) => m.entry);
        $('result-name').style.display = unnamed.length ? '' : 'none';
        if (unnamed.length) $('result-name-input').value = '';
    }
    $('result-name').addEventListener('submit', (e) => {
        e.preventDefault();             // (a form would reload the page)
        if (!Leaderboards.setName($('result-name-input').value, unnamed)) return;
        unnamed = [];
        $('result-name').style.display = 'none';
        $('result-boards').textContent += `\nSaved as ${Leaderboards.getName()}.`;
    });
    // While typing a name, keys must not shoot, restart (R) or change the camera (C)
    for (const type of ['keydown', 'keyup']) $('result-name-input').addEventListener(type, (e) => e.stopPropagation());

    // ---------- Leaderboards screen ----------
    const boardView = { mode: 'quick', difficulty: 'Medium' };

    // Fill one board table: rank, name, value, date (or a line saying it is empty)
    function fillBoard(table, entries) {
        table.innerHTML = '';
        if (!entries.length) {
            const row = table.insertRow();
            const cell = row.insertCell();
            cell.className = 'empty';
            cell.textContent = 'No scores yet';
            return;
        }
        entries.forEach((entry, i) => {
            const row = table.insertRow();
            const cells = [i + 1, entry.name, entry.value, entry.date];
            ['rank', 'name', 'value', 'date'].forEach((cls, j) => {
                const cell = row.insertCell();
                cell.className = cls;
                cell.textContent = cells[j];        // textContent: a name can never become page code
            });
        });
    }
    function fillBoards() {
        // the court and stage lists come from courts.js and campaign.js, so new ones appear on their own
        const courtSelect = $('board-court'), stageSelect = $('board-stage');
        if (courtSelect.options.length !== Leaderboards.courts().length) {
            const keep = courtSelect.value;
            courtSelect.innerHTML = '';
            for (const court of Leaderboards.courts()) courtSelect.add(new Option(court.name, court.id));
            courtSelect.value = keep || Game.state.court.id;
        }
        if (stageSelect.options.length !== Leaderboards.stages().length) {
            stageSelect.innerHTML = '';
            Leaderboards.stages().forEach((stage, i) => stageSelect.add(new Option(`${i + 1}. ${Courts.byId(stage.court).name}`, stage.id)));
        }
        if (!$('board-diff-tabs').children.length) {
            for (const diff of Leaderboards.DIFFICULTIES) {
                const tab = document.createElement('button');
                tab.className = 'tab';
                tab.dataset.diff = diff;
                tab.textContent = diff;
                tab.addEventListener('click', () => { boardView.difficulty = diff; fillBoards(); });
                $('board-diff-tabs').appendChild(tab);
            }
        }
        for (const tab of $('board-mode-tabs').children) tab.classList.toggle('on', tab.dataset.mode === boardView.mode);
        for (const tab of $('board-diff-tabs').children) tab.classList.toggle('on', tab.dataset.diff === boardView.difficulty);
        $('board-quick').style.display = boardView.mode === 'quick' ? '' : 'none';
        $('board-campaign').style.display = boardView.mode === 'campaign' ? '' : 'none';
        const court = courtSelect.value, diff = boardView.difficulty;
        fillBoard($('board-score'), Leaderboards.top(Leaderboards.quickKey(court, diff, 'score')));
        fillBoard($('board-combo'), Leaderboards.top(Leaderboards.quickKey(court, diff, 'combo')));
        fillBoard($('board-stage-score'), Leaderboards.top(Leaderboards.campaignKey(stageSelect.value)));
        const name = Leaderboards.getName();
        $('board-name-line').textContent = name ? `Your name: ${name}` : 'You will be asked for a name the first time a score makes a board.';
    }
    for (const tab of $('board-mode-tabs').children) {
        tab.addEventListener('click', () => { boardView.mode = tab.dataset.mode; fillBoards(); });
    }
    $('board-court').addEventListener('change', fillBoards);
    $('board-stage').addEventListener('change', fillBoards);

    // ---------- Card collection ----------
    // One card as a page element. withButtons adds Upgrade and Equip.
    function cardElement(card, withButtons) {
        const owned = Cards.owned(card.id);
        const el = document.createElement('div');
        el.className = 'card ' + card.rarity + (owned ? '' : ' missing');
        let html = `<div class="card-rarity">${card.rarity.toUpperCase()} ${card.type.toUpperCase()}</div>` +
            `<div class="card-name">${card.name}</div><div class="card-text">${card.text}</div>`;
        if (owned) {
            const cost = Cards.upgradeCost(card.id);
            html += `<div class="card-level">Level ${owned.level}` +
                (cost ? ` | ${owned.copies}/${cost.copies} copies` : ' (max)') + '</div>';
        } else {
            html += '<div class="card-level">Not found yet</div>';
        }
        el.innerHTML = html;
        if (withButtons && owned) {
            const cost = Cards.upgradeCost(card.id);
            if (cost) {
                const up = document.createElement('button');
                up.textContent = `Upgrade (${cost.gold} gold)`;
                up.disabled = !Cards.canUpgrade(card.id);
                up.addEventListener('click', () => { Cards.upgrade(card.id); show('cards'); });
                el.appendChild(up);
            }
            if (card.type === 'ball') {
                const equip = document.createElement('button');
                const using = Cards.getSave().ball === card.id;
                equip.textContent = using ? 'Equipped' : 'Equip';
                equip.disabled = using;
                equip.addEventListener('click', () => { Cards.equipBall(card.id); show('cards'); });
                el.appendChild(equip);
            }
        }
        return el;
    }

    function fillCards() {
        const grid = $('card-grid');
        grid.innerHTML = '';
        for (const card of Cards.LIST) grid.appendChild(cardElement(card, true));
    }

    // ---------- Tutorial (first campaign stage) ----------
    // A list of steps. Each one shows a message and is done when its test is true.
    const tutorialBox = $('tutorial-box');
    let tutorial = null;            // { step, startCamera, ... } while the practice part runs
    const made = () => Game.player.made;
    const TUTORIAL_STEPS = [
        { text: 'Move the crosshair onto the golden dot at the rim. Hold Space to fill the power meter and let go while it is in the green zone: green always goes in. Make one shot.',
          done: (t) => made() >= 1 },
        { text: 'The green zone moves and changes size as you aim: it shows the power that scores from where your crosshair is. Off the dot it shrinks or disappears. The crosshair jumps after every shot, so aim again each time. Make 2 more.',
          begin: (t) => { t.from = made(); },
          done: (t) => made() >= t.from + 2 },
        { text: 'You take 5 shots from each spot, then move to the next one (the corners are worth 3). The count is under the clock. Finish your shots here. Press C to try the other cameras.',
          begin: (t) => { t.fromSpot = Game.player.spot; },
          done: (t) => Game.player.spot !== t.fromSpot },
        { text: 'This spot is now your MONEY SPOT (it says so at the top right; on the floor it is a wide green ring): makes from it count DOUBLE. Choose yours in the menus before a game. Make one from here.',
          // the spot you are on becomes your money spot, with 5 fresh shots
          begin: (t) => { Game.tutorialMoneySpot(); t.money = Game.player.spot; t.from = Game.player.spotStats[t.money - 1].made; },
          // (if your 5 shots here run out, move on anyway)
          done: (t) => Game.player.spotStats[t.money - 1].made > t.from || Game.player.spot !== t.money },
        { text: 'Shoot fast: a new ball is ready as soon as the last one leaves your hands. Get 2 balls in the air at once. Makes in a row build a streak (Heating Up, On Fire) for bonus points.',
          done: (t) => Game.player.balls.filter((b) => !b.touchedFloor).length >= 2 },
        { text: 'The FAN METER (glowing, top of the screen) shows who the crowd backs. Runs of makes pull the fans your way: a crowd on your side widens your green zone, and a full meter puts you On Fire. It stays still in practice.',
          begin: (t) => { t.until = performance.now() + 9000; $('fan-meter').classList.add('tutorial-glow'); },
          done: (t) => performance.now() > t.until,
          end: () => $('fan-meter').classList.remove('tutorial-glow') },
        { text: 'Power-up pick! You have 5 seconds. Left = a buff for you, right = a sabotage on your rival. Rarer cards glow. Let the timer run out to SKIP: no card now, but better odds next pick. Pick or skip.',
          begin: () => Game.forcePick(),
          done: (t) => Game.state.mode === 'playing' },
        { text: 'Now the race: 2 minutes against Coach. Most points wins. If it is within 10 points at the buzzer, you play 1 minute of overtime. Good luck!',
          begin: (t) => { t.until = performance.now() + 5000; },
          done: (t) => performance.now() > t.until }
    ];

    function startTutorial() {
        Cards.previewBall = null;
        Game.start({ mode: 'tutorial', court: 'ymca', practice: true,
            rival: { name: 'Coach', accuracy: 0, pace: 999, maxRarity: null } });
        tutorial = { step: -1, startCamera: currentCamera };
        tutorialBox.style.display = 'block';
        $('tutorial-skip').style.display = '';
        nextTutorialStep();
    }
    function nextTutorialStep() {
        const old = TUTORIAL_STEPS[tutorial.step];
        if (old && old.end) old.end(tutorial);
        tutorial.step++;
        if (tutorial.step >= TUTORIAL_STEPS.length) { finishTutorial(); return; }
        const step = TUTORIAL_STEPS[tutorial.step];
        showTutorialText(`Tutorial ${tutorial.step + 1} of ${TUTORIAL_STEPS.length}`, step.text);
        if (step.begin) step.begin(tutorial);
    }
    function showTutorialText(title, text) {
        // (only when it changes: the race hints are checked several times a second)
        if ($('tutorial-step').textContent !== title) $('tutorial-step').textContent = title;
        if ($('tutorial-text').textContent !== text) $('tutorial-text').textContent = text;
    }
    function hideTutorial() {
        if (tutorial) {
            const step = TUTORIAL_STEPS[tutorial.step];
            if (step && step.end) step.end(tutorial);
        }
        tutorial = null;
        tutorialBox.style.display = 'none';
    }
    // The tutorial ends with the race (campaign stage 1)
    function finishTutorial() {
        hideTutorial();
        Cards.getSave().tutorialDone = true;
        Cards.store();
        startStage(0);
    }
    $('tutorial-skip').addEventListener('click', finishTutorial);

    // Hints during the tutorial race (stage 1). The race itself is scripted in
    // game.js (twist 'tutorialRace'): Coach stays within 10 so it always goes
    // to overtime, the overtime pick offers a mythic card, and Coach stops scoring.
    function raceHint() {
        const s = Game.state;
        if (s.mode === 'picking' && s.overtime && s.pick.buff && s.pick.buff.placeholder) {
            return 'OVERTIME! It was within 10 points. Overtime picks are the rarest of all: take the MYTHIC card on the left (it is yours even if the timer runs out).';
        }
        if (s.mode === 'picking') return 'A pick: 5 seconds to choose. Skip it (let the timer run out) and your next pick has better odds.';
        if (s.overtime && PowerUps.has(Game.player, 'placeholder')) {
            return 'Mythic card: every make is worth at least 3 and your green zone is much wider. One minute left: win it!';
        }
        if (s.overtime) return 'Overtime: one more minute. Win it!';
        return 'Race Coach for 2 minutes. Watch the race bar and the fan meter at the top. Makes from your money spot count double.';
    }
    function updateRaceHints() {
        const racing = Game.state.twist === 'tutorialRace' && (Game.state.mode === 'playing' || Game.state.mode === 'picking');
        if (!racing) {
            if (tutorialBox.dataset.race) { tutorialBox.style.display = 'none'; delete tutorialBox.dataset.race; }
            return;
        }
        tutorialBox.dataset.race = '1';
        tutorialBox.style.display = 'block';
        $('tutorial-skip').style.display = 'none';
        showTutorialText('Tutorial race', raceHint());
    }

    setInterval(() => {
        if (!tutorial) { updateRaceHints(); return; }
        if (Game.state.options.mode !== 'tutorial') { hideTutorial(); return; }
        // the golden aim dot stays on while you learn (the green zone is always on)
        if (Game.state.mode === 'playing') {
            Game.player.effects.guide = { level: 1, left: 99 };
        }
        if (TUTORIAL_STEPS[tutorial.step].done(tutorial)) nextTutorialStep();
    }, 150);

    // ---------- Sandbox: free shootaround with every power-up ----------
    const sandbox = { on: {}, levels: {} };     // which power-ups are switched on, and their levels

    function startSandbox() {
        Game.start({ mode: 'sandbox', practice: true, freeSpots: true, court: $('sandbox-court').value || Game.state.court.id,
            rival: { name: 'Nobody', accuracy: 0, pace: 999, maxRarity: null } });
        $('sandbox-panel').style.display = 'block';
        $('time-display').textContent = 'SANDBOX';
    }

    // Build the sandbox controls once
    for (const court of Courts.LIST) $('sandbox-court').add(new Option(court.name, court.id));
    for (const card of Cards.LIST.filter((c) => c.type === 'ball')) $('sandbox-ball').add(new Option(card.name, card.id));
    $('sandbox-court').addEventListener('change', (e) => { Game.setCourt(e.target.value); e.target.blur(); });
    $('sandbox-ball').addEventListener('change', (e) => { Cards.previewBall = e.target.value; e.target.blur(); });
    $('sandbox-reset').addEventListener('click', (e) => { Game.clearBalls(); e.target.blur(); });
    $('sandbox-exit').addEventListener('click', () => {
        Cards.previewBall = null;
        Game.quit();
        show('main');
    });
    for (const id of ['sandbox-arc', 'sandbox-zone', 'sandbox-slow']) {
        $(id).addEventListener('change', (e) => { e.target.blur(); applySandbox(); });     // keep Space for shooting
    }
    for (const card of PowerUps.LIST) {
        const label = document.createElement('label');
        label.className = 'sandbox-card ' + card.side;
        label.title = card.text;
        if (card.kind === 'instant') {
            // instant cards are buttons: use them on yourself right now
            const use = document.createElement('button');
            use.textContent = 'Use ' + card.name;
            use.addEventListener('click', () => {
                // a buff lands on its user, a sabotage on the user's opponent: pick the user so it lands on you
                Game.applyCard(card, card.side === 'buff' ? Game.player : Game.rival);
                use.blur();
            });
            label.appendChild(use);
        } else {
            const box = document.createElement('input');
            box.type = 'checkbox';
            box.addEventListener('change', () => { sandbox.on[card.id] = box.checked; box.blur(); applySandbox(); });
            const level = document.createElement('input');
            level.type = 'number'; level.min = 1; level.max = 5; level.value = 1;
            level.addEventListener('change', () => { sandbox.levels[card.id] = Number(level.value) || 1; level.blur(); applySandbox(); });
            label.append(box, ' ' + card.name + ' Lv ', level);
        }
        $('sandbox-powerups').appendChild(label);
    }
    $('sandbox-slow').addEventListener('change', (e) => { window.sandboxSlowMotion = e.target.checked; });

    // Keep the chosen power-ups switched on, and show the stats.
    // This runs right when a box is ticked and again a few times a second
    // (shots and timers use power-ups up, so they are topped back up).
    function applySandbox() {
        const inSandbox = Game.state.options.mode === 'sandbox' && Game.state.mode === 'playing';
        window.sandboxSlowMotion = inSandbox && $('sandbox-slow').checked;
        if (!inSandbox) return;
        const effects = Game.player.effects;
        for (const card of PowerUps.LIST) {
            if (card.kind === 'instant') continue;
            const wanted = sandbox.on[card.id] ||
                (card.id === 'guide' && $('sandbox-arc').checked) || (card.id === 'sweet' && $('sandbox-zone').checked);
            if (wanted) effects[card.id] = { level: sandbox.levels[card.id] || 1, left: 99 };
            else delete effects[card.id];
        }
        $('time-display').textContent = 'SANDBOX';
        $('sandbox-stats').textContent = 'Makes / attempts at each spot:  ' + Game.player.spotStats
            .map((st, i) => `Spot ${i + 1}: ${st.made}/${st.attempts}`).join('   ');
    }
    setInterval(applySandbox, 200);

    show('main');
    return { show };
})();

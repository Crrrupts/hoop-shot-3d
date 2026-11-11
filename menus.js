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
        if (name !== 'result') { $('sandbox-panel').style.display = 'none'; hideTutorial(); }
    }
    // game.js calls this when a match starts
    window.hideMenus = function () { overlay.style.display = 'none'; };

    $('btn-campaign').addEventListener('click', () => show('campaign'));
    $('btn-quick').addEventListener('click', () => show('quick'));
    $('btn-cards').addEventListener('click', () => show('cards'));
    $('btn-sandbox').addEventListener('click', startSandbox);
    for (const b of document.querySelectorAll('.back-btn')) b.addEventListener('click', () => show('main'));
    $('btn-menu').addEventListener('click', () => show(Game.state.options.mode === 'campaign' ? 'campaign' : 'main'));
    $('btn-again').addEventListener('click', () => Game.start());
    // "Start" under the game restarts whatever is being played
    $('start-btn').addEventListener('click', () => { Game.start(); $('start-btn').blur(); });

    // ---------- Quick match ----------
    $('play-btn').addEventListener('click', () => {
        Cards.previewBall = null;
        Game.start({ mode: 'quick', court: $('court-select').value });
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
        Game.start({
            mode: 'campaign', stage: i, court: stage.court, rival: stage.rival, twist: stage.twist,
            length: i === 0 ? 60 : undefined        // stage 1 is a short practice race
        });
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
        show('result');
    };

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
    let tutorial = null;            // { step, startSpot, startCamera, picked } while it runs
    const TUTORIAL_STEPS = [
        { text: 'Move the mouse to aim. Hold Space to fill the power meter, then let go to shoot. The green band on the meter is the power that scores.',
          done: (t) => Game.player.attempts >= 1 },
        { text: 'Press A or D to move to another spot (corners are worth 3). Press C to change the camera.',
          done: (t) => {
              // remember each change, so switching back still counts
              if (currentSpot !== t.startSpot) t.movedSpot = true;
              if (currentCamera !== t.startCamera) t.movedCamera = true;
              return t.movedSpot && t.movedCamera;
          } },
        { text: 'Shoot fast: a new ball is ready as soon as the last one leaves your hands. Get 2 balls in the air at once.',
          done: (t) => Game.player.balls.filter((b) => !b.touchedFloor).length >= 2 },
        { text: 'Make 2 in a row to start Heating Up. Streaks give bonus points; one miss resets them.',
          done: (t) => Game.player.streak >= 2 },
        { text: 'Power-up pick! The left card is a buff for you. The right card is a sabotage for your rival. Blue, purple and gold cards are rarer and stronger. Pick one.',
          begin: () => Game.forcePick(),
          done: (t) => t.picked },
        { text: 'Last step: a 60-second practice race against Coach. Most points wins. Good luck!',
          begin: (t) => { t.raceAt = performance.now() + 3500; },
          done: (t) => performance.now() > t.raceAt }
    ];

    function startTutorial() {
        Cards.previewBall = null;
        Game.start({ mode: 'tutorial', court: 'ymca', practice: true, rival: { name: 'Coach', accuracy: 0, pace: 999, maxRarity: null } });
        tutorial = { step: -1, startSpot: currentSpot, startCamera: currentCamera, picked: false };
        tutorialBox.style.display = 'block';
        nextTutorialStep();
    }
    function nextTutorialStep() {
        tutorial.step++;
        if (tutorial.step >= TUTORIAL_STEPS.length) { finishTutorial(); return; }
        const step = TUTORIAL_STEPS[tutorial.step];
        $('tutorial-step').textContent = `Tutorial ${tutorial.step + 1} of ${TUTORIAL_STEPS.length}`;
        $('tutorial-text').textContent = step.text;
        if (step.begin) step.begin(tutorial);
    }
    function hideTutorial() {
        tutorial = null;
        tutorialBox.style.display = 'none';
    }
    // The tutorial ends with the practice race (campaign stage 1)
    function finishTutorial() {
        hideTutorial();
        Cards.getSave().tutorialDone = true;
        Cards.store();
        startStage(0);
    }
    $('tutorial-skip').addEventListener('click', finishTutorial);
    Game.on((name, data) => {
        if (tutorial && name === 'powerup' && data.user === Game.player) tutorial.picked = true;
    });
    setInterval(() => {
        if (!tutorial) return;
        if (Game.state.options.mode !== 'tutorial') { hideTutorial(); return; }
        // the aim arc and the power zone stay on while you learn
        if (Game.state.mode === 'playing') {
            Game.player.effects.guide = { level: 1, left: 99 };
            Game.player.effects.sweet = { level: 1, left: 99 };
        }
        if (TUTORIAL_STEPS[tutorial.step].done(tutorial)) nextTutorialStep();
    }, 150);

    // ---------- Sandbox: free shootaround with every power-up ----------
    const sandbox = { on: {}, levels: {} };     // which power-ups are switched on, and their levels

    function startSandbox() {
        Game.start({ mode: 'sandbox', practice: true, court: $('sandbox-court').value || Game.state.court.id,
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
        $(id).addEventListener('change', (e) => e.target.blur());       // keep Space for shooting
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
            box.addEventListener('change', () => { sandbox.on[card.id] = box.checked; box.blur(); });
            const level = document.createElement('input');
            level.type = 'number'; level.min = 1; level.max = 5; level.value = 1;
            level.addEventListener('change', () => { sandbox.levels[card.id] = Number(level.value) || 1; level.blur(); });
            label.append(box, ' ' + card.name + ' Lv ', level);
        }
        $('sandbox-powerups').appendChild(label);
    }
    $('sandbox-slow').addEventListener('change', (e) => { window.sandboxSlowMotion = e.target.checked; });

    // Keep the chosen power-ups switched on, and show the stats
    setInterval(() => {
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
    }, 200);

    show('main');
    return { show };
})();

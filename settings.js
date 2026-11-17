// settings.js — the gear button at the bottom right of the game.
// Click it to open a small panel with a Sound volume slider and a Menu button.
// It builds its own button, panel and styling, so no other file needs them.

(function () {
    const stage = document.getElementById('stage');
    const overlay = document.getElementById('menu-overlay');

    // ---------- Styling ----------
    const style = document.createElement('style');
    style.textContent = `
        #settings-btn {
            position: absolute; right: 28px; bottom: 5px; width: 34px; height: 34px;
            padding: 0; font-size: 24px; line-height: 30px; text-align: center;
            background: rgba(0, 0, 0, 0.85); color: #fff; border: 2px solid #fff;
            border-radius: 50%; cursor: pointer; z-index: 20; pointer-events: auto;
        }
        #settings-btn:hover { background: rgba(255, 255, 255, 0.25); }
        #settings-panel {
            position: absolute; right: 28px; bottom: 46px; width: 210px; padding: 14px;
            background: rgba(20, 20, 30, 0.95); color: #fff; border: 2px solid #fff;
            border-radius: 8px; z-index: 20; pointer-events: auto; display: none;
            font-family: inherit; text-align: left;
        }
        #settings-panel label { display: block; margin-bottom: 6px; }
        #settings-panel input[type=range] { width: 100%; }
        #settings-panel button {
            width: 100%; margin-top: 14px; padding: 8px; font-size: 16px; cursor: pointer;
        }
    `;
    document.head.appendChild(style);

    // ---------- Gear button and panel ----------
    const gear = document.createElement('button');
    gear.id = 'settings-btn';
    gear.type = 'button';
    gear.title = 'Settings';
    gear.setAttribute('aria-label', 'Settings');
    gear.textContent = '\u2699';

    const panel = document.createElement('div');
    panel.id = 'settings-panel';
    panel.innerHTML =
        '<label for="volume-slider">Sound: <span id="volume-value"></span></label>' +
        '<input type="range" id="volume-slider" min="0" max="100" value="50">' +
        '<button type="button" id="settings-menu-btn">Menu</button>';

    stage.appendChild(gear);
    stage.appendChild(panel);

    const slider = document.getElementById('volume-slider');
    const volumeText = document.getElementById('volume-value');
    const menuBtn = document.getElementById('settings-menu-btn');

    // ---------- Sound volume (remembered in the browser) ----------
    function applyVolume(percent) {
        volumeText.textContent = percent + '%';
        GameAudio.setVolume(percent / 100);
    }
    let saved = 50;
    try {
        const stored = localStorage.getItem('hoopShotVolume');
        if (stored !== null) saved = Number(stored);
    } catch (e) { /* saving is optional */ }
    slider.value = saved;
    applyVolume(saved);

    slider.addEventListener('input', () => {
        applyVolume(Number(slider.value));
        try { localStorage.setItem('hoopShotVolume', slider.value); } catch (e) { /* ignore */ }
    });
    // let go of the slider so Space keeps working for shooting
    slider.addEventListener('change', () => slider.blur());

    // ---------- Open, close, Menu ----------
    function closePanel() { panel.style.display = 'none'; }

    gear.addEventListener('click', () => {
        panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
        gear.blur();
    });

    menuBtn.addEventListener('click', () => {
        closePanel();
        Cards.previewBall = null;       // in case the sandbox was previewing a ball
        Game.quit();
        Menus.show('main');
    });

    // The gear is only for matches: hide it (and the panel) while a menu is showing
    setInterval(() => {
        const inMenu = getComputedStyle(overlay).display !== 'none';
        gear.style.display = inMenu ? 'none' : 'block';
        if (inMenu) closePanel();
    }, 150);
})();
// layout.js — fit the game to the window.
//
// Everything on the stage (the canvas, the HUD, the menus and the pick
// screens) is laid out at 800 x 600. This file scales the whole stage with a
// CSS transform so it fills as much of the window as it can while keeping
// that 4:3 shape. The controls bar stays under it.
//
// The canvas itself is given more pixels to match its size on screen (and
// the screen's pixel density), so the 3D picture stays sharp instead of being
// stretched. Code that measures the screen in "stage pixels" (the crosshair,
// floating text, the rival view box) keeps using 800 x 600; Layout.scale
// converts to and from real pixels.

const Layout = (function () {
    const WIDTH = 800, HEIGHT = 600;        // the stage's own size
    const MAX_PIXELS = 2560;                // never draw wider than this (keeps slow laptops fast)
    const stage = document.getElementById('stage');
    const holder = document.getElementById('stage-holder');
    const canvas = document.getElementById('game-canvas');
    const controls = document.getElementById('controls-bar');
    let scale = 1;

    function fit() {
        // the room the stage may use: the window, minus the controls bar and a small margin
        const roomW = window.innerWidth - 16;
        const roomH = window.innerHeight - controls.offsetHeight - 28;
        scale = Math.max(0.4, Math.min(roomW / WIDTH, roomH / HEIGHT));
        stage.style.transform = `scale(${scale})`;
        holder.style.width = Math.round(WIDTH * scale) + 'px';
        holder.style.height = Math.round(HEIGHT * scale) + 'px';
        // real pixels for the canvas: its size on screen times the pixel density (capped)
        const density = Math.min(window.devicePixelRatio || 1, 2);
        const pixels = Math.min(MAX_PIXELS, Math.round(WIDTH * scale * density));
        canvas.width = pixels;
        canvas.height = Math.round(pixels * HEIGHT / WIDTH);
    }

    window.addEventListener('resize', fit);
    document.addEventListener('fullscreenchange', fit);
    fit();

    // Fullscreen button (the browser may refuse, for example inside a preview frame)
    document.getElementById('fullscreen-btn').addEventListener('click', (e) => {
        e.target.blur();                        // keep Space for shooting
        if (document.fullscreenElement) document.exitFullscreen();
        else if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => {
                if (typeof showToast === 'function') showToast('Fullscreen is not allowed here', 'sabotage');
            });
        }
    });
    document.addEventListener('fullscreenchange', () => {
        document.getElementById('fullscreen-btn').textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';
    });

    return {
        WIDTH, HEIGHT, fit,
        scale: function () { return scale; },                       // stage pixels -> screen pixels
        canvasScale: function () { return canvas.width / WIDTH; }   // stage pixels -> canvas pixels
    };
})();

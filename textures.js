// textures.js — texture images, painted in code on hidden 2D canvases.
//
// These are placeholders so the game needs no image files. Each function
// returns a <canvas>; renderer.js uploads it to WebGL as a texture.
// Bom: to use real art, replace a function's drawing with an <img> you load
// (same size and layout) — nothing else has to change.

const Textures = (function () {

    function makeCanvas(w, h) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        return c;
    }

    // Small repeatable random number generator, so textures look the same every run
    function randomMaker(seed) {
        let s = seed;
        return function () {
            s = (s * 1664525 + 1013904223) % 4294967296;
            return s / 4294967296;
        };
    }

    // ---------- Ball: orange leather with black seams ----------
    // The image wraps around the sphere: x = longitude, y = latitude.
    function ball() {
        const W = 1024, H = 512;
        const c = makeCanvas(W, H), g = c.getContext('2d');
        const rand = randomMaker(7);

        g.fillStyle = '#d9722b';
        g.fillRect(0, 0, W, H);
        // leather pebbles: lots of tiny darker and lighter dots
        for (let i = 0; i < 14000; i++) {
            g.fillStyle = rand() < 0.5 ? 'rgba(90,40,10,0.22)' : 'rgba(255,190,120,0.16)';
            g.beginPath();
            g.arc(rand() * W, rand() * H, 1 + rand() * 1.5, 0, 2 * Math.PI);
            g.fill();
        }

        g.strokeStyle = '#1a1210';
        g.lineWidth = 9;
        g.lineCap = 'round';
        function line(x0, y0, x1, y1) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
        line(0, H / 2, W, H / 2);                   // seam around the equator
        line(0, 0, 0, H); line(W, 0, W, H);         // seam over the poles (wraps at the image edge)
        line(W / 2, 0, W / 2, H);
        // Two curved seams: circles on the ball around the left and right side.
        // On the unwrapped image a circle becomes this stretched loop.
        const size = 52 * Math.PI / 180;            // angular radius of each circle
        for (const center of [0.25, 0.75]) {
            for (const side of [-1, 1]) {
                g.beginPath();
                for (let i = 0; i <= 60; i++) {
                    const lat = (-1 + 2 * i / 60) * size * 0.999;
                    const dLon = Math.acos(Math.cos(size) / Math.cos(lat));
                    const x = (center + side * dLon / (2 * Math.PI)) * W;
                    const y = (0.5 - lat / Math.PI) * H;
                    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
                }
                g.stroke();
            }
        }
        return c;
    }

    // ---------- Court: wood planks with painted lines ----------
    // The image covers the floor plane from (x0, z0) to (x1, z1) in meters.
    // The rim is above x = 0, z = 0; the shooter is on +z.
    // The lines are sized for this game's 5 spots: the corner spots (worth 3)
    // sit outside the three-point arc and the other spots sit inside it.
    function court(x0, z0, x1, z1) {
        const S = 2048;
        const c = makeCanvas(S, S), g = c.getContext('2d');
        const rand = randomMaker(21);
        const px = S / (x1 - x0);                               // pixels per meter
        const X = (x) => (x - x0) * px;                         // meters -> pixels
        const Z = (z) => (z - z0) * px;

        // wood planks running the length of the court
        const plankW = 0.11 * px;
        for (let x = 0; x < S; x += plankW) {
            let y = -rand() * 300;
            while (y < S) {
                const len = 150 + rand() * 250;
                const shade = 0.88 + rand() * 0.2;
                g.fillStyle = `rgb(${Math.round(203 * shade)},${Math.round(160 * shade)},${Math.round(100 * shade)})`;
                g.fillRect(x, y, plankW + 1, len);
                g.fillStyle = 'rgba(70,40,15,0.35)';            // gap at the end of a plank
                g.fillRect(x, y + len - 1, plankW, 1.5);
                y += len;
            }
            g.fillStyle = 'rgba(70,40,15,0.25)';                // gap between planks
            g.fillRect(x, 0, 1, S);
        }

        // court edges (meters)
        const left = -7.5, right = 7.5, baseline = -1.0, far = 13.0;
        // darker floor outside the lines
        g.fillStyle = 'rgba(40,25,15,0.45)';
        g.fillRect(0, 0, S, Z(baseline));
        g.fillRect(0, Z(far), S, S - Z(far));
        g.fillRect(0, Z(baseline), X(left), Z(far) - Z(baseline));
        g.fillRect(X(right), Z(baseline), S - X(right), Z(far) - Z(baseline));

        // painted key (the lane under the hoop)
        const keyHalf = 1.8, freeThrow = 4.4;
        g.fillStyle = 'rgba(150,30,35,0.82)';
        g.fillRect(X(-keyHalf), Z(baseline), (2 * keyHalf) * px, (freeThrow - baseline) * px);

        g.strokeStyle = '#f5f2ea';
        g.lineWidth = 0.06 * px;
        g.lineCap = 'butt';
        g.strokeRect(X(left), Z(baseline), (right - left) * px, (far - baseline) * px);          // boundary
        g.strokeRect(X(-keyHalf), Z(baseline), (2 * keyHalf) * px, (freeThrow - baseline) * px);  // key
        g.beginPath(); g.arc(X(0), Z(freeThrow), 1.8 * px, 0, 2 * Math.PI); g.stroke();          // free-throw circle
        g.beginPath(); g.arc(X(0), Z(0), 1.25 * px, 0, Math.PI); g.stroke();                     // small arc under the rim
        // three-point line: straight in the corners, then an arc 5.2 m from the rim
        const arc = 5.2;
        g.beginPath();
        g.moveTo(X(-arc), Z(baseline));
        g.lineTo(X(-arc), Z(0));
        g.arc(X(0), Z(0), arc * px, Math.PI, 0, true);
        g.lineTo(X(arc), Z(baseline));
        g.stroke();
        // half of the center circle at the far end
        g.beginPath(); g.arc(X(0), Z(far), 1.8 * px, Math.PI, 2 * Math.PI); g.stroke();

        // placeholder court logo (Bom can replace this)
        g.save();
        g.translate(X(0), Z(9.2));
        g.fillStyle = 'rgba(150,30,35,0.55)';
        g.font = `bold ${Math.round(1.1 * px)}px sans-serif`;
        g.textAlign = 'center';
        g.fillText('HOOP SHOT', 0, 0);
        g.restore();
        return c;
    }

    // ---------- Backboard: white board, border and the red shooter's square ----------
    // The image covers the front of the board (1.83 m wide, 1.07 m tall).
    function backboard() {
        const W = 512, H = 256;
        const c = makeCanvas(W, H), g = c.getContext('2d');
        const mx = W / 1.83, my = H / 1.07;                     // pixels per meter each way
        g.fillStyle = '#f2f2ee';
        g.fillRect(0, 0, W, H);
        g.strokeStyle = '#c0281f';
        g.lineWidth = 10;
        g.strokeRect(5, 5, W - 10, H - 10);                     // outer border
        // shooter's square: 0.61 m wide, 0.46 m tall, bottom edge level with the rim
        const sqW = 0.61 * mx, sqH = 0.46 * my, bottom = H - 0.15 * my;
        g.lineWidth = 9;
        g.strokeRect(W / 2 - sqW / 2, bottom - sqH, sqW, sqH);
        // padding strip along the bottom edge
        g.fillStyle = '#26303f';
        g.fillRect(0, H - 0.06 * my, W, 0.06 * my);
        return c;
    }

    // ---------- Gym wall: painted blocks with a colored band ----------
    function wall() {
        const S = 512;
        const c = makeCanvas(S, S), g = c.getContext('2d');
        const rand = randomMaker(3);
        g.fillStyle = '#8f897c';                                 // mortar between the blocks
        g.fillRect(0, 0, S, S);
        const bw = 64, bh = 32;                                 // block size in pixels
        for (let row = 0; row * bh < S; row++) {
            for (let col = -1; col * bw < S; col++) {
                const x = col * bw + (row % 2 ? bw / 2 : 0), y = row * bh;
                const shade = 0.97 + rand() * 0.05;
                g.fillStyle = `rgb(${Math.round(196 * shade)},${Math.round(190 * shade)},${Math.round(176 * shade)})`;
                g.fillRect(x + 1, y + 1, bw - 2, bh - 2);
            }
        }
        g.fillStyle = 'rgba(150,30,35,0.9)';                    // school-color band low on the wall
        g.fillRect(0, S * 0.72, S, S * 0.1);
        g.fillStyle = 'rgba(40,45,60,0.55)';                    // darker base
        g.fillRect(0, S * 0.82, S, S * 0.18);
        return c;
    }

    return { ball, court, backboard, wall };
})();

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

    // ---------- Ball skins ----------
    // The image wraps around the sphere: x = longitude, y = latitude.
    // look comes from the ball cards in cards.js: { base, seam, pattern }
    //   pattern = 'leather', 'scuffed', 'tricolor', 'stripes', 'tiles', 'cracks' or 'plain'
    function ball(look) {
        const W = 1024, H = 512;
        const c = makeCanvas(W, H), g = c.getContext('2d');
        const rand = randomMaker(7);

        g.fillStyle = look.base;
        g.fillRect(0, 0, W, H);

        if (look.pattern === 'tricolor') {
            // red, white and blue panels around the ball
            const colors = ['#c8322d', '#f2f2f2', '#2d55b8', '#f2f2f2'];
            for (let i = 0; i < 8; i++) { g.fillStyle = colors[i % 4]; g.fillRect(i * W / 8, 0, W / 8, H); }
        } else if (look.pattern === 'stripes') {
            // watermelon: dark wavy stripes and seeds
            g.fillStyle = look.seam;
            for (let i = 0; i < 12; i++) {
                g.beginPath();
                for (let y = 0; y <= H; y += 8) g.lineTo(i * W / 12 + 18 + Math.sin(y / 30 + i) * 9, y);
                for (let y = H; y >= 0; y -= 8) g.lineTo(i * W / 12 - 18 + Math.sin(y / 30 + i) * 9 + 36, y);
                g.fill();
            }
            g.fillStyle = '#16210f';
            for (let i = 0; i < 90; i++) { g.beginPath(); g.ellipse(rand() * W, rand() * H, 3, 6, 0, 0, 2 * Math.PI); g.fill(); }
        } else if (look.pattern === 'tiles') {
            // disco ball: small mirror tiles, each a slightly different brightness
            const size = 32;
            for (let y = 0; y < H; y += size) {
                for (let x = 0; x < W; x += size) {
                    const k = Math.round(150 + rand() * 105);
                    g.fillStyle = `rgb(${k},${k + 4},${Math.min(255, k + 14)})`;
                    g.fillRect(x + 1.5, y + 1.5, size - 3, size - 3);
                }
            }
        } else if (look.pattern === 'cracks') {
            // lava: jagged glowing cracks
            g.strokeStyle = look.seam;
            g.lineCap = 'round';
            for (let i = 0; i < 26; i++) {
                let x = rand() * W, y = rand() * H;
                g.lineWidth = 3 + rand() * 5;
                g.beginPath(); g.moveTo(x, y);
                for (let k = 0; k < 7; k++) { x += (rand() - 0.5) * 120; y += (rand() - 0.5) * 90; g.lineTo(x, y); }
                g.stroke();
            }
        }
        if (look.pattern === 'leather' || look.pattern === 'scuffed') {
            // pebbles: lots of tiny darker and lighter dots
            for (let i = 0; i < 14000; i++) {
                g.fillStyle = rand() < 0.5 ? 'rgba(60,30,10,0.2)' : 'rgba(255,220,180,0.16)';
                g.beginPath();
                g.arc(rand() * W, rand() * H, 1 + rand() * 1.5, 0, 2 * Math.PI);
                g.fill();
            }
        }
        if (look.pattern === 'scuffed') {
            // worn, faded patches
            for (let i = 0; i < 40; i++) {
                g.fillStyle = 'rgba(230,215,200,0.14)';
                g.beginPath(); g.ellipse(rand() * W, rand() * H, 20 + rand() * 60, 10 + rand() * 30, rand() * 3, 0, 2 * Math.PI); g.fill();
            }
        }

        // seams (not on the disco, lava or watermelon balls)
        if (['tiles', 'cracks', 'stripes'].includes(look.pattern)) return c;
        g.strokeStyle = look.seam;
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

    // ---------- Court floor ----------
    // One court tile: `width` meters wide (centered on the hoop, x = 0) and
    // from z0 to z1 meters long. The rim is above x = 0, z = 0; the shooter is
    // on +z. The same image is used for your court and the rival's court.
    // The lines are sized for this game's 5 spots: the corner spots (worth 3)
    // sit outside the three-point arc and the other spots sit inside it.
    //
    // floor comes from courts.js: { kind, base, paint, line, logo }
    //   kind = 'wood', 'asphalt', 'concrete', 'grid' or 'ice'
    function court(width, z0, z1, floor) {
        const S = 2048;
        const c = makeCanvas(S, S), g = c.getContext('2d');
        const rand = randomMaker(21);
        const x0 = -width / 2, depth = z1 - z0;
        const [r, gr, b] = floor.base;
        const shadeColor = (k) => `rgb(${Math.round(r * k)},${Math.round(gr * k)},${Math.round(b * k)})`;
        g.fillStyle = shadeColor(1);
        g.fillRect(0, 0, S, S);
        if (floor.kind === 'asphalt' || floor.kind === 'concrete') {
            // speckles: painted once on a small tile, then repeated across the
            // floor (much faster than painting 26,000 separate dots)
            const tile = makeCanvas(256, 256), t = tile.getContext('2d');
            for (let i = 0; i < 420; i++) {
                t.fillStyle = rand() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.10)';
                t.fillRect(rand() * 256, rand() * 256, 4 + rand() * 7, 4 + rand() * 7);
            }
            g.fillStyle = g.createPattern(tile, 'repeat');
            g.fillRect(0, 0, S, S);
        }

        // From here on we draw in meters: the canvas is stretched to fit the tile
        g.scale(S / width, S / depth);
        g.translate(-x0, -z0);

        if (floor.kind === 'wood') {
            // planks running the length of the court
            const plankW = 0.11;
            for (let x = x0; x < x0 + width; x += plankW) {
                let z = z0 - rand() * 3;
                while (z < z1) {
                    const len = 1.5 + rand() * 2.5;
                    g.fillStyle = shadeColor(0.88 + rand() * 0.2);
                    g.fillRect(x, z, plankW + 0.01, len);
                    g.fillStyle = 'rgba(70,40,15,0.35)';            // gap at the end of a plank
                    g.fillRect(x, z + len - 0.012, plankW, 0.015);
                    z += len;
                }
                g.fillStyle = 'rgba(70,40,15,0.25)';                // gap between planks
                g.fillRect(x, z0, 0.008, depth);
            }
        } else if (floor.kind === 'asphalt' || floor.kind === 'concrete') {
            // (the speckles were painted above) a few cracks
            g.strokeStyle = 'rgba(0,0,0,0.35)';
            g.lineWidth = 0.02;
            for (let i = 0; i < 14; i++) {
                let x = x0 + rand() * width, z = z0 + rand() * depth;
                g.beginPath(); g.moveTo(x, z);
                for (let k = 0; k < 8; k++) { x += (rand() - 0.5) * 1.2; z += (rand() - 0.5) * 1.2; g.lineTo(x, z); }
                g.stroke();
            }
            if (floor.kind === 'concrete') {
                // sand blown in along the edges
                for (let i = 0; i < 5000; i++) {
                    const edge = rand() < 0.5 ? x0 + rand() * rand() * 2.2 : x0 + width - rand() * rand() * 2.2;
                    g.fillStyle = 'rgba(226,200,140,0.5)';
                    g.fillRect(edge, z0 + rand() * depth, 0.08, 0.08);
                }
            }
        } else if (floor.kind === 'grid') {
            // glowing grid lines every meter
            g.strokeStyle = 'rgba(53,232,255,0.55)';
            g.lineWidth = 0.035;
            for (let x = Math.ceil(x0); x < x0 + width; x++) { g.beginPath(); g.moveTo(x, z0); g.lineTo(x, z1); g.stroke(); }
            g.strokeStyle = 'rgba(255,60,190,0.55)';
            for (let z = Math.ceil(z0); z < z1; z++) { g.beginPath(); g.moveTo(x0, z); g.lineTo(x0 + width, z); g.stroke(); }
        } else if (floor.kind === 'ice') {
            // cloudy patches and skate scratches
            for (let i = 0; i < 60; i++) {
                g.fillStyle = 'rgba(255,255,255,0.10)';
                g.beginPath(); g.arc(x0 + rand() * width, z0 + rand() * depth, 0.5 + rand() * 1.5, 0, 2 * Math.PI); g.fill();
            }
            g.strokeStyle = 'rgba(255,255,255,0.45)';
            g.lineWidth = 0.012;
            for (let i = 0; i < 160; i++) {
                const x = x0 + rand() * width, z = z0 + rand() * depth, a = rand() * Math.PI;
                g.beginPath(); g.moveTo(x, z); g.lineTo(x + Math.cos(a) * (0.4 + rand()), z + Math.sin(a) * (0.4 + rand())); g.stroke();
            }
        }

        // court edges (meters)
        const left = -7.2, right = 7.2, baseline = -1.0, far = 13.0;
        // darker floor outside the lines
        g.fillStyle = 'rgba(30,22,18,0.4)';
        g.fillRect(x0, z0, width, baseline - z0);
        g.fillRect(x0, far, width, z1 - far);
        g.fillRect(x0, baseline, left - x0, far - baseline);
        g.fillRect(right, baseline, x0 + width - right, far - baseline);

        // painted key (the lane under the hoop)
        const keyHalf = 1.8, freeThrow = 4.4;
        g.fillStyle = floor.paint;
        g.fillRect(-keyHalf, baseline, 2 * keyHalf, freeThrow - baseline);

        g.strokeStyle = floor.line;
        g.lineWidth = 0.06;
        g.lineCap = 'butt';
        g.strokeRect(left, baseline, right - left, far - baseline);             // boundary
        g.strokeRect(-keyHalf, baseline, 2 * keyHalf, freeThrow - baseline);    // key
        g.beginPath(); g.arc(0, freeThrow, 1.8, 0, 2 * Math.PI); g.stroke();    // free-throw circle
        g.beginPath(); g.arc(0, 0, 1.25, 0, Math.PI); g.stroke();               // small arc under the rim
        // three-point line: straight in the corners, then an arc 5.2 m from the rim
        const arc = 5.2;
        g.beginPath();
        g.moveTo(-arc, baseline);
        g.lineTo(-arc, 0);
        g.arc(0, 0, arc, Math.PI, 0, true);
        g.lineTo(arc, baseline);
        g.stroke();
        // half of the center circle at the far end
        g.beginPath(); g.arc(0, far, 1.8, Math.PI, 2 * Math.PI); g.stroke();

        // placeholder court logo (Bom can replace this)
        g.fillStyle = floor.paint;
        g.font = 'bold 1.1px sans-serif';
        g.textAlign = 'center';
        g.fillText(floor.logo, 0, 9.2);
        return c;
    }

    // ---------- Backboard: board color, border and the shooter's square ----------
    // The image covers the front of the board (1.83 m wide, 1.07 m tall).
    // board comes from courts.js: { face, line, pad }
    function backboard(board) {
        const W = 512, H = 256;
        const c = makeCanvas(W, H), g = c.getContext('2d');
        const mx = W / 1.83, my = H / 1.07;                     // pixels per meter each way
        g.fillStyle = board.face;
        g.fillRect(0, 0, W, H);
        g.strokeStyle = board.line;
        g.lineWidth = 10;
        g.strokeRect(5, 5, W - 10, H - 10);                     // outer border
        // shooter's square: 0.61 m wide, 0.46 m tall, bottom edge level with the rim
        const sqW = 0.61 * mx, sqH = 0.46 * my, bottom = H - 0.15 * my;
        g.lineWidth = 9;
        g.strokeRect(W / 2 - sqW / 2, bottom - sqH, sqW, sqH);
        // padding strip along the bottom edge
        g.fillStyle = board.pad;
        g.fillRect(0, H - 0.06 * my, W, 0.06 * my);
        return c;
    }

    // ---------- Indoor wall: painted blocks with a colored band ----------
    // wall comes from courts.js: { block, mortar, band, base }
    function wall(wall) {
        const S = 512;
        const c = makeCanvas(S, S), g = c.getContext('2d');
        const rand = randomMaker(3);
        g.fillStyle = wall.mortar;                              // mortar between the blocks
        g.fillRect(0, 0, S, S);
        const bw = 64, bh = 32;                                 // block size in pixels
        const [r, gr, b] = wall.block;
        for (let row = 0; row * bh < S; row++) {
            for (let col = -1; col * bw < S; col++) {
                const x = col * bw + (row % 2 ? bw / 2 : 0), y = row * bh;
                const shade = 0.97 + rand() * 0.05;
                g.fillStyle = `rgb(${Math.round(r * shade)},${Math.round(gr * shade)},${Math.round(b * shade)})`;
                g.fillRect(x + 1, y + 1, bw - 2, bh - 2);
            }
        }
        g.fillStyle = wall.band;                                // color band low on the wall
        g.fillRect(0, S * 0.72, S, S * 0.1);
        g.fillStyle = wall.base;                                // darker base
        g.fillRect(0, S * 0.82, S, S * 0.18);
        return c;
    }

    // ---------- Outdoor sky with a far-away scene on the horizon ----------
    // Painted on the inside of a big box around the court. The horizon sits
    // HORIZON of the way up the image; below it is far-away ground or sea.
    // sky comes from courts.js: { top, horizon, ground, scene }
    //   scene = 'city' (rooftop), 'sea' (boardwalk) or 'pines' (frozen lake)
    const HORIZON = 0.25;
    function sky(sky) {
        const W = 1024, H = 512;
        const c = makeCanvas(W, H), g = c.getContext('2d');
        const rand = randomMaker(11);
        const horizonY = H * (1 - HORIZON);

        const fade = g.createLinearGradient(0, 0, 0, horizonY);
        fade.addColorStop(0, sky.top);
        fade.addColorStop(1, sky.horizon);
        g.fillStyle = fade;
        g.fillRect(0, 0, W, horizonY);

        if (sky.scene === 'pines') {
            // stars and a moon
            for (let i = 0; i < 260; i++) {
                g.fillStyle = `rgba(255,255,255,${0.3 + rand() * 0.7})`;
                g.fillRect(rand() * W, rand() * horizonY * 0.9, 1.5, 1.5);
            }
            g.fillStyle = '#f3f1dc';
            g.beginPath(); g.arc(W * 0.2, H * 0.22, 26, 0, 2 * Math.PI); g.fill();
            // dark pine trees along the shore
            g.fillStyle = '#0a1712';
            for (let x = 0; x < W; x += 14 + rand() * 12) {
                const h = 30 + rand() * 55, w = 9 + rand() * 8;
                g.beginPath(); g.moveTo(x - w, horizonY + 2); g.lineTo(x, horizonY - h); g.lineTo(x + w, horizonY + 2); g.fill();
            }
        } else if (sky.scene === 'city') {
            // dark buildings with lit windows
            for (let x = 0; x < W;) {
                const w = 26 + rand() * 50, h = 30 + rand() * 130;
                g.fillStyle = `rgb(${18 + rand() * 14},${18 + rand() * 12},${30 + rand() * 18})`;
                g.fillRect(x, horizonY - h, w, h + 2);
                for (let wy = horizonY - h + 6; wy < horizonY - 6; wy += 9) {
                    for (let wx = x + 5; wx < x + w - 6; wx += 8) {
                        if (rand() < 0.35) { g.fillStyle = 'rgba(255,214,130,0.85)'; g.fillRect(wx, wy, 3.5, 4.5); }
                    }
                }
                x += w + rand() * 6;
            }
        } else if (sky.scene === 'sea') {
            // a few clouds
            for (let i = 0; i < 9; i++) {
                const x = rand() * W, y = 40 + rand() * horizonY * 0.5;
                g.fillStyle = 'rgba(255,255,255,0.75)';
                for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + k * 22, y + (rand() - 0.5) * 12, 18 + rand() * 12, 0, 2 * Math.PI); g.fill(); }
            }
            // pier Ferris wheel
            const fx = W * 0.3, fy = horizonY - 62, fr = 50;
            g.strokeStyle = '#3d4654'; g.lineWidth = 3;
            g.beginPath(); g.arc(fx, fy, fr, 0, 2 * Math.PI); g.stroke();
            for (let k = 0; k < 10; k++) {
                const a = k * Math.PI / 5;
                g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx + Math.cos(a) * fr, fy + Math.sin(a) * fr); g.stroke();
                g.fillStyle = ['#e2504a', '#f2c14e', '#4aa3df'][k % 3];
                g.fillRect(fx + Math.cos(a) * fr - 5, fy + Math.sin(a) * fr - 4, 10, 8);
            }
            g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx - 28, horizonY); g.moveTo(fx, fy); g.lineTo(fx + 28, horizonY); g.stroke();
            g.fillStyle = '#5a4a3a'; g.fillRect(fx - 120, horizonY - 8, 240, 8);       // the pier
            // palm trees
            for (const px of [W * 0.62, W * 0.7, W * 0.88]) {
                g.strokeStyle = '#4b3a2a'; g.lineWidth = 5;
                g.beginPath(); g.moveTo(px, horizonY + 4); g.quadraticCurveTo(px + 10, horizonY - 45, px + 4, horizonY - 85); g.stroke();
                g.strokeStyle = '#2f6b3a'; g.lineWidth = 4;
                for (let k = 0; k < 7; k++) {
                    const a = -Math.PI + k * Math.PI / 6;
                    g.beginPath(); g.moveTo(px + 4, horizonY - 85);
                    g.quadraticCurveTo(px + 4 + Math.cos(a) * 26, horizonY - 100 + Math.sin(a) * 10, px + 4 + Math.cos(a) * 44, horizonY - 78 + Math.sin(a) * 4);
                    g.stroke();
                }
            }
        }

        // far-away ground or sea below the horizon
        g.fillStyle = sky.ground;
        g.fillRect(0, horizonY, W, H - horizonY);
        return c;
    }

    // ---------- Crowd fan: a simple person with arms up, on a see-through background ----------
    // shirt is a CSS color. glow = true draws a glowing outline shape (Neon Arcade).
    function fan(shirt, skin, glow) {
        const W = 64, H = 128;
        const c = makeCanvas(W, H), g = c.getContext('2d');
        g.clearRect(0, 0, W, H);
        g.fillStyle = shirt;
        g.strokeStyle = shirt;
        g.lineCap = 'round';
        // body
        g.fillRect(16, 52, 32, 76);
        // arms up
        g.lineWidth = 9;
        g.beginPath(); g.moveTo(18, 60); g.lineTo(8, 22); g.stroke();
        g.beginPath(); g.moveTo(46, 60); g.lineTo(56, 22); g.stroke();
        // head and hands
        g.fillStyle = glow ? shirt : skin;
        g.beginPath(); g.arc(32, 36, 13, 0, 2 * Math.PI); g.fill();
        g.beginPath(); g.arc(8, 18, 6, 0, 2 * Math.PI); g.fill();
        g.beginPath(); g.arc(56, 18, 6, 0, 2 * Math.PI); g.fill();
        return c;
    }

    // ---------- Soft shapes for the floor (white, see-through at the edges) ----------
    // A round blob that fades out toward its edge: soft shadows.
    function softDisc() {
        const S = 128, c = makeCanvas(S, S), g = c.getContext('2d');
        const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.45, 'rgba(255,255,255,0.75)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, S, S);
        return c;
    }
    // A painted ring with a faint inside: the shooting-spot markers.
    function ring() {
        const S = 128, c = makeCanvas(S, S), g = c.getContext('2d');
        g.clearRect(0, 0, S, S);
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.beginPath(); g.arc(S / 2, S / 2, S * 0.42, 0, 2 * Math.PI); g.fill();
        g.strokeStyle = 'rgba(255,255,255,1)';
        g.lineWidth = S * 0.09;
        g.beginPath(); g.arc(S / 2, S / 2, S * 0.43, 0, 2 * Math.PI); g.stroke();
        return c;
    }

    return { ball, court, backboard, wall, sky, fan, softDisc, ring, HORIZON };
})();

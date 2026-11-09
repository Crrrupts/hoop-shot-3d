// debug-view.js — TEMPORARY wireframe view for testing gameplay before the
// real WebGL renderer exists (Justin). Only runs when the URL ends in ?debug
// (e.g. http://127.0.0.1:5500/index.html?debug). Does nothing otherwise,
// so it never touches the WebGL canvas in the normal game.

(function () {
    if (!location.search.includes('debug') || typeof window.renderScene === 'function') return;
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
    function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
    function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

    let view;
    // Same math as lookAt + perspective, done by hand
    function project(p) {
        const d = sub(p, view.eye);
        const z = dot(d, view.f);
        if (z < 0.05) return null;
        const s = (canvas.height / 2) / Math.tan(view.fov * Math.PI / 360);
        return [canvas.width / 2 + dot(d, view.r) / z * s, canvas.height / 2 - dot(d, view.u) / z * s, s / z];
    }
    function line(pts, color, width) {
        ctx.strokeStyle = color; ctx.lineWidth = width || 1;
        ctx.beginPath();
        let started = false;
        for (const p of pts) {
            const q = project(p);
            if (!q) { started = false; continue; }
            if (!started) { ctx.moveTo(q[0], q[1]); started = true; } else ctx.lineTo(q[0], q[1]);
        }
        ctx.stroke();
    }
    function box(b, off, color) {
        const x0 = b.min[0] + off[0], x1 = b.max[0] + off[0], y0 = b.min[1], y1 = b.max[1];
        const z0 = b.min[2] + off[2], z1 = b.max[2] + off[2];
        line([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [x0, y0, z1]], color, 2);
        line([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z0]], color, 1);
    }

    window.renderScene = function (scene) {
        const c = scene.camera;
        const f = norm(sub(c.at, c.eye)), r = norm(cross(f, c.up)), u = cross(r, f);
        view = { eye: c.eye, f, r, u, fov: c.fov };

        ctx.fillStyle = '#1b1b24';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // court grid
        for (let i = -8; i <= 8; i++) {
            line([[i, 0, -2], [i, 0, 9]], '#333a48');
        }
        for (let k = -2; k <= 9; k++) line([[-8, 0, k], [8, 0, k]], '#333a48');

        // spots
        for (let s = 1; s <= 5; s++) {
            const p = Game.spotPosition(s);
            const pts = [];
            for (let a = 0; a <= 16; a++) pts.push([p[0] + 0.3 * Math.cos(a / 8 * Math.PI), 0, p[2] + 0.3 * Math.sin(a / 8 * Math.PI)]);
            line(pts, s === scene.state.spot ? '#ffd166' : '#556');
        }

        // hoop
        const o = scene.hoopOffset;
        box(Physics.POLE, o, '#888');
        box(Physics.BOARD, o, '#ddd');
        const rim = [], net = [];
        for (let a = 0; a <= 32; a++) {
            const t = a / 16 * Math.PI;
            rim.push([o[0] + Physics.RIM_RADIUS * Math.cos(t), Physics.RIM_HEIGHT, o[2] + Physics.RIM_RADIUS * Math.sin(t)]);
            net.push([o[0] + Physics.RIM_RADIUS * 0.7 * Math.cos(t), Physics.RIM_HEIGHT - Physics.NET_DEPTH, o[2] + Physics.RIM_RADIUS * 0.7 * Math.sin(t)]);
        }
        line(rim, '#ff5a1f', 3);
        line(net, '#bbb');

        // aim arc
        if (scene.aimPath.length) line(scene.aimPath, '#4cc9f0', 2);

        // ball (plus a spin marker)
        const b = scene.ball.pos, q = project(b);
        if (q) {
            const rad = Physics.BALL_RADIUS * q[2];
            ctx.fillStyle = '#e07a2f';
            ctx.beginPath(); ctx.arc(q[0], q[1], Math.max(rad, 2), 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(q[0], q[1]);
            ctx.lineTo(q[0] + Math.cos(scene.ball.spinAngle) * rad, q[1] + Math.sin(scene.ball.spinAngle) * rad);
            ctx.stroke();
        }

        ctx.fillStyle = '#889';
        ctx.font = '12px monospace';
        ctx.fillText('DEBUG WIREFRAME (temporary, ?debug)', 10, canvas.height - 10);
    };
})();

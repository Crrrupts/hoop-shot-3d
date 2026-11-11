// camera.js — eye/at/up for the three camera views
//
// renderer.js feeds Camera.eye, Camera.at, Camera.up into lookAt(), and uses
// perspective(Camera.FOV, aspect, Camera.NEAR, Camera.FAR).
// The view index comes from input.js (currentCamera, C key):
//   0 = Shooter, 1 = Ball Follow, 2 = Orbit
// Camera.rivalView() is a fixed camera on the rival's hoop for the small inset view.

const Camera = (function () {
    const FOV = 45, NEAR = 0.1, FAR = 100;
    const SMOOTH = 6;                   // higher = snappier camera moves

    const eye = [0, 2.6, 7];
    const at = [0, 2.8, 0];
    const up = [0, 1, 0];

    let orbitAngle = 0;                 // radians around the hoop
    let orbitDragging = false;

    function mode() {
        return (typeof currentCamera !== 'undefined') ? currentCamera : 0;
    }

    // Behind the shooter, looking at the rim
    function shooterView() {
        const p = Game.spotPosition(Game.player.spot, Game.player);
        const rim = Physics.rimCenter(Game.player.hoop);
        const dx = p[0] - rim[0], dz = p[2] - rim[2];
        const d = Math.hypot(dx, dz) || 1;
        return {
            eye: [p[0] + dx / d * 2.6, 2.85, p[2] + dz / d * 2.6],
            at: [rim[0], 2.45, rim[2]]
        };
    }

    // Behind and above your newest ball while it flies
    function followView() {
        const ball = Game.state.followBall;
        if (!ball || ball.dead || !ball.inFlight) return shooterView();
        const b = ball.pos, dir = Game.state.shotDir;
        return {
            eye: [b[0] - dir[0] * 2.5, Math.max(b[1] + 0.8, 1.0), b[2] - dir[2] * 2.5],
            at: b.slice()
        };
    }

    // Circles the hoop slowly; drag the mouse to spin it yourself
    function orbitView() {
        const r = 9;
        return {
            eye: [Math.sin(orbitAngle) * r, 4.5, Math.cos(orbitAngle) * r],
            at: [0, 2.0, 0]
        };
    }

    function update(dt) {
        if (!orbitDragging) orbitAngle += 0.2 * dt;
        const m = mode();
        // when the game is over the camera pulls back to the wide orbit view
        const over = Game.state.mode === 'gameover';
        const target = m === 1 && !over ? followView() : m === 2 || over ? orbitView() : shooterView();
        const k = 1 - Math.exp(-SMOOTH * dt);
        for (let i = 0; i < 3; i++) {
            eye[i] += (target.eye[i] - eye[i]) * k;
            at[i] += (target.at[i] - at[i]) * k;
        }
        // Heckler power-up: a loud fan shakes your camera
        // (only while you are charging a shot)
        if (Game.state.mode === 'playing' && PowerUps.has(Game.player, 'heckler') && typeof charging !== 'undefined' && charging) {
            for (let i = 0; i < 3; i++) at[i] += (Math.random() - 0.5) * 0.12;
        }
        // tiny shake when you score (effects.js)
        const shake = Effects.getShake();
        for (let i = 0; i < 3; i++) at[i] += (Math.random() - 0.5) * shake;
        // slow push-in while charging a shot: the lens narrows a little
        const charge = (typeof charging !== 'undefined' && charging) ? power / 100 : 0;
        fov += ((FOV - 3 * charge) - fov) * k;
    }
    let fov = FOV;

    // Fixed camera in front of the rival's hoop (for the small inset view)
    function rivalView() {
        return {
            eye: [Game.rival.hoop.base[0] - 2.2, 3.3, 5.2],
            at: [Game.rival.hoop.base[0], 2.7, 0],
            up: [0, 1, 0], fov: FOV, near: NEAR, far: FAR
        };
    }

    // Mouse drag spins the orbit view (only while it is active)
    if (typeof document !== 'undefined') {
        const canvas = document.getElementById('game-canvas');
        let lastX = 0;
        if (canvas) {
            canvas.addEventListener('mousedown', (e) => {
                if (mode() === 2) { orbitDragging = true; lastX = e.clientX; }
            });
            window.addEventListener('mouseup', () => { orbitDragging = false; });
            window.addEventListener('mousemove', (e) => {
                if (!orbitDragging) return;
                orbitAngle -= (e.clientX - lastX) * 0.01;
                lastX = e.clientX;
            });
        }
    }

    return { FOV, NEAR, FAR, eye, at, up, update, rivalView, getFov: function () { return fov; } };
})();

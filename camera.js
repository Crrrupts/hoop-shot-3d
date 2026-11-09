// camera.js — eye/at/up for the three camera views (Justin)
//
// Isaiah: feed Camera.eye, Camera.at, Camera.up into lookAt(), and use
// perspective(Camera.FOV, aspect, Camera.NEAR, Camera.FAR).
// The view index comes from Amit's input.js (currentCamera, C key):
//   0 = Shooter, 1 = Ball Follow, 2 = Orbit

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
        const p = Game.spotPosition(Game.state.spot);
        const rim = Physics.rimCenter();
        const dx = p[0] - rim[0], dz = p[2] - rim[2];
        const d = Math.hypot(dx, dz) || 1;
        return {
            eye: [p[0] + dx / d * 1.8, 2.5, p[2] + dz / d * 1.8],
            at: [rim[0], 2.6, rim[2]]
        };
    }

    // Behind and above the ball while it flies
    function followView() {
        if (!Physics.ball.inFlight) return shooterView();
        const b = Physics.ball.pos, dir = Game.state.shotDir;
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
        const target = m === 1 ? followView() : m === 2 ? orbitView() : shooterView();
        const k = 1 - Math.exp(-SMOOTH * dt);
        for (let i = 0; i < 3; i++) {
            eye[i] += (target.eye[i] - eye[i]) * k;
            at[i] += (target.at[i] - at[i]) * k;
        }
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

    return { FOV, NEAR, FAR, eye, at, up, update };
})();

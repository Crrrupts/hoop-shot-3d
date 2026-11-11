// camera.js — eye/at/up for the camera views
//
// renderer.js feeds a camera's eye, at and up into lookAt(), and its fov,
// near and far into perspective().
// The view type comes from input.js (currentCamera, C key):
//   0 = Shooter, 1 = Ball Follow, 2 = Orbit
// There is one camera "rig" per person: Camera.rigs[0] follows you. In
// two-player, Camera.rigs[1] follows Player 2 (split screen).
// Camera.rivalView() is a fixed camera on the rival's hoop for the small inset view.

const Camera = (function () {
    const FOV = 45, NEAR = 0.1, FAR = 100;
    const SMOOTH = 6;                   // higher = snappier camera moves

    let orbitAngle = 0;                 // radians around the hoop
    let orbitDragging = false;

    function mode() {
        return (typeof currentCamera !== 'undefined') ? currentCamera : 0;
    }

    // A camera that follows one shooter. getInput() returns that person's
    // { charging, power } from input.js (for the push-in and the Heckler shake).
    function makeRig(getShooter, getInput) {
        const rig = { eye: [0, 2.6, 7], at: [0, 2.8, 0], up: [0, 1, 0], fov: FOV, near: NEAR, far: FAR };

        // Behind the shooter, looking at the rim
        function shooterView() {
            const shooter = getShooter();
            const p = Game.spotPosition(shooter.spot, shooter);
            const rim = Physics.rimCenter(shooter.hoop);
            const dx = p[0] - rim[0], dz = p[2] - rim[2];
            const d = Math.hypot(dx, dz) || 1;
            return {
                eye: [p[0] + dx / d * 2.6, 2.85, p[2] + dz / d * 2.6],
                at: [rim[0], 2.45, rim[2]]
            };
        }

        // Behind and above the shooter's newest ball while it flies
        function followView() {
            const balls = getShooter().balls;
            const ball = balls[balls.length - 1];
            if (!ball || ball.touchedFloor) return shooterView();
            const b = ball.pos;
            const hs = Math.hypot(ball.vel[0], ball.vel[2]) || 1;
            const dir = [ball.vel[0] / hs, 0, ball.vel[2] / hs];
            return {
                eye: [b[0] - dir[0] * 2.5, Math.max(b[1] + 0.8, 1.0), b[2] - dir[2] * 2.5],
                at: b.slice()
            };
        }

        // Circles the shooter's hoop slowly; drag the mouse to spin it yourself
        function orbitView() {
            const r = 9, x = getShooter().hoop.base[0];
            return {
                eye: [x + Math.sin(orbitAngle) * r, 4.5, Math.cos(orbitAngle) * r],
                at: [x, 2.0, 0]
            };
        }

        rig.update = function (dt) {
            const m = mode();
            // when the game is over the camera pulls back to the wide orbit view
            const over = Game.state.mode === 'gameover';
            const target = m === 1 && !over ? followView() : m === 2 || over ? orbitView() : shooterView();
            const k = 1 - Math.exp(-SMOOTH * dt);
            for (let i = 0; i < 3; i++) {
                rig.eye[i] += (target.eye[i] - rig.eye[i]) * k;
                rig.at[i] += (target.at[i] - rig.at[i]) * k;
            }
            const input = getInput();
            // Heckler power-up: a loud fan shakes the camera (only while charging a shot)
            if (Game.state.mode === 'playing' && PowerUps.has(getShooter(), 'heckler') && input.charging) {
                for (let i = 0; i < 3; i++) rig.at[i] += (Math.random() - 0.5) * 0.12;
            }
            // tiny shake when the home crowd's player scores (effects.js)
            const shake = Effects.getShake();
            for (let i = 0; i < 3; i++) rig.at[i] += (Math.random() - 0.5) * shake;
            // slow push-in while charging a shot: the lens narrows a little
            const charge = input.charging ? input.power / 100 : 0;
            rig.fov += ((FOV - 3 * charge) - rig.fov) * k;
        };
        return rig;
    }

    const rigs = [
        makeRig(() => Game.player, () => ({ charging: charging, power: power })),
        makeRig(() => Game.rival, () => ({ charging: charging2, power: power2 }))
    ];

    function update(dt) {
        if (!orbitDragging) orbitAngle += 0.2 * dt;
        rigs[0].update(dt);
        if (Game.state.twoPlayer) rigs[1].update(dt);
    }

    // Fixed camera in front of the rival's hoop (for the small inset view)
    function rivalView() {
        return {
            eye: [Game.rival.hoop.base[0] - 2.2, 3.3, 5.2],
            at: [Game.rival.hoop.base[0], 2.7, 0],
            up: [0, 1, 0], fov: FOV, near: NEAR, far: FAR
        };
    }

    // Mouse drag spins the orbit view (only while it is active)
    const canvas = document.getElementById('game-canvas');
    let lastX = 0;
    canvas.addEventListener('mousedown', (e) => {
        if (mode() === 2) { orbitDragging = true; lastX = e.clientX; }
    });
    window.addEventListener('mouseup', () => { orbitDragging = false; });
    window.addEventListener('mousemove', (e) => {
        if (!orbitDragging) return;
        orbitAngle -= (e.clientX - lastX) * 0.01;
        lastX = e.clientX;
    });

    return { FOV, NEAR, FAR, rigs, update, rivalView };
})();

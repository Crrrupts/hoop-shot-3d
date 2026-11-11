// main.js — the frame loop
//
// Each frame: update the game and physics, move the camera, then hand
// everything to the renderer:  window.renderScene(scene)
//   scene.balls      every ball to draw. Each has pos [x, y, z], spinAxis and
//                    spinAngle (radius Physics.BALL_RADIUS)
//   scene.hoops      the hoops (yours, then the rival's). See Physics.createHoop
//   scene.camera     { eye, at, up, fov, near, far } for lookAt/perspective
//   scene.inset      the same for the small view of the rival's hoop
//   scene.aimPath    array of [x, y, z] points for the aim arc (may be empty)
//   scene.fog        true while the Fog Machine power-up is on you
//   scene.blackout   true while the Blackout power-up is on you
//   scene.tint       [r, g, b] multiplies the picture's colors (Inferno turns it red-orange)
//   scene.ballSkin   id of the ball card to draw for your balls (cards.js)
//   scene.state      Game.state (mode, player, rival, ...)

(function () {
    let last = performance.now();

    // The balls waiting in each shooter's hands (drawn, but not in the physics yet)
    const playerHand = { pos: [0, 0, 0], spinAxis: [1, 0, 0], spinAngle: 0, mine: true };
    const rivalHand = { pos: [0, 0, 0], spinAxis: [1, 0, 0], spinAngle: 0 };

    // The aim arc shows on Easy, or while the Guide Line power-up is active
    function aimPath() {
        const player = Game.player;
        const guide = PowerUps.has(player, 'guide');
        if (getDifficultySettings().name !== 'Easy' && !guide) return [];
        if (!charging || Game.state.mode !== 'playing') return [];
        const vel = Game.shotVelocity(player.spot, power, aimX, aimY, 0);
        return Physics.predictPath(Game.spotPosition(player.spot, player), vel, 1.6, 40, Game.state.wind);
    }

    // Sweet Spot power-up: show the power range that scores from here.
    // Working it out takes a few milliseconds, so only redo it when the aim or spot changes.
    let sweetKey = '';
    function updateSweetZone() {
        const player = Game.player;
        if (Game.state.mode !== 'playing' || !PowerUps.has(player, 'sweet')) {
            if (sweetKey !== '') { sweetKey = ''; setSweetZone(null); }
            return;
        }
        const wind = Game.state.wind;
        const key = [player.spot, aimX.toFixed(1), aimY.toFixed(1), player.hoop.rimScale, wind[0].toFixed(1)].join(',');
        if (key === sweetKey) return;
        sweetKey = key;
        setSweetZone(Game.makeWindow(player, player.spot, Number(aimX.toFixed(1)), Number(aimY.toFixed(1)), { wind: wind }));
    }

    function frame(now) {
        // slow motion for buzzer beaters (effects.js decides when)
        const dt = Math.min((now - last) / 1000, 0.1) * Effects.timeScale();
        last = now;

        Game.update(dt);
        if (Game.state.mode !== 'picking') Effects.update(dt);
        Camera.update(dt);
        updateSweetZone();

        const player = Game.player, rival = Game.rival;
        playerHand.pos = Game.spotPosition(player.spot, player);
        if (charging) playerHand.pos[1] -= 0.12 * power / 100;      // the ball dips in your hands as you charge
        rivalHand.pos = Game.spotPosition(rival.spot, rival);
        const balls = [playerHand, rivalHand].concat(player.balls, rival.balls);

        if (typeof window.renderScene === 'function') {
            window.renderScene({
                balls: balls,
                hoops: [player.hoop, rival.hoop],
                camera: {
                    eye: Camera.eye, at: Camera.at, up: Camera.up,
                    fov: Camera.getFov(), near: Camera.NEAR, far: Camera.FAR
                },
                inset: Camera.rivalView(),
                aimPath: aimPath(),
                fog: PowerUps.has(player, 'fog'),
                blackout: PowerUps.has(player, 'blackout'),
                tint: Effects.getTint(),
                ballSkin: Cards.activeBall(),
                state: Game.state
            });
        }
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();

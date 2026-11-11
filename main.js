// main.js — the frame loop
//
// Each frame: update the game and physics, move the cameras, then hand
// everything to the renderer:  window.renderScene(scene)
//   scene.balls      every ball to draw. Each has pos [x, y, z], spinAxis and
//                    spinAngle (radius Physics.BALL_RADIUS)
//   scene.hoops      the hoops (yours, then the rival's). See Physics.createHoop
//   scene.views      the pictures to draw this frame. One player: your view
//                    on the whole canvas plus the small rival view. Two
//                    players: split screen, Player 1 left and Player 2 right.
//                    Each view = { camera, rect, fog, blackout, hoopX }
//                      camera   { eye, at, up, fov, near, far } for lookAt/perspective
//                      rect     'full', 'left', 'right' or 'inset'
//                      fog / blackout   power-ups used on that view's player
//                      hoopX    where that player's hoop stands (for the Blackout spotlight)
//   scene.aimPaths   aim arcs to draw; each is an array of [x, y, z] points
//   scene.tint       [r, g, b] multiplies the picture's colors (Inferno turns it red-orange)
//   scene.ballSkin   id of the ball card to draw for your balls (cards.js)
//   scene.state      Game.state (mode, player, rival, ...)

(function () {
    let last = performance.now();

    // The balls waiting in each shooter's hands (drawn, but not in the physics yet)
    const playerHand = { pos: [0, 0, 0], spinAxis: [1, 0, 0], spinAngle: 0, mine: true };
    const rivalHand = { pos: [0, 0, 0], spinAxis: [1, 0, 0], spinAngle: 0 };

    // What each person is doing with their controls right now (from input.js)
    function inputOf(shooter) {
        if (shooter === Game.player) return { charging: charging, power: power, aimX: aimX, aimY: aimY };
        return { charging: charging2, power: power2, aimX: aim2X, aimY: aim2Y };
    }

    // The aim arc shows on Easy, or while the Guide Line power-up is active
    function aimPath(shooter) {
        const input = inputOf(shooter);
        const guide = PowerUps.has(shooter, 'guide');
        if (getDifficultySettings().name !== 'Easy' && !guide) return [];
        if (!input.charging || Game.state.mode !== 'playing') return [];
        const vel = Game.shotVelocity(shooter.spot, input.power, input.aimX, input.aimY, 0);
        return Physics.predictPath(Game.spotPosition(shooter.spot, shooter), vel, 1.6, 40, Game.state.wind);
    }

    // Sweet Spot power-up: show the power range that scores from here.
    // Working it out takes a few milliseconds, so only redo it when the aim or spot changes.
    const sweetKeys = ['', ''];
    function updateSweetZone(shooter, which) {
        if (Game.state.mode !== 'playing' || !PowerUps.has(shooter, 'sweet')) {
            if (sweetKeys[which] !== '') { sweetKeys[which] = ''; setSweetZone(null, which); }
            return;
        }
        const input = inputOf(shooter), wind = Game.state.wind;
        const ax = Number(input.aimX.toFixed(1)), ay = Number(input.aimY.toFixed(1));
        const key = [shooter.spot, ax, ay, shooter.hoop.rimScale, wind[0].toFixed(1)].join(',');
        if (key === sweetKeys[which]) return;
        sweetKeys[which] = key;
        setSweetZone(Game.makeWindow(shooter, shooter.spot, ax, ay, { wind: wind }), which);
    }

    function frame(now) {
        // slow motion for buzzer beaters (effects.js decides when)
        const dt = Math.min((now - last) / 1000, 0.1) * Effects.timeScale();
        last = now;

        Game.update(dt);
        if (Game.state.mode !== 'picking') Effects.update(dt);
        Camera.update(dt);

        const player = Game.player, rival = Game.rival, two = Game.state.twoPlayer;
        updateSweetZone(player, 0);
        if (two) updateSweetZone(rival, 1);

        // the ball dips in your hands as you charge
        playerHand.pos = Game.spotPosition(player.spot, player);
        if (charging) playerHand.pos[1] -= 0.12 * power / 100;
        rivalHand.pos = Game.spotPosition(rival.spot, rival);
        if (two && charging2) rivalHand.pos[1] -= 0.12 * power2 / 100;
        const balls = [playerHand, rivalHand].concat(player.balls, rival.balls);

        // which pictures to draw
        function viewOf(shooter, rig, rect) {
            return {
                camera: rig, rect: rect, hoopX: shooter.hoop.base[0],
                fog: PowerUps.has(shooter, 'fog'), blackout: PowerUps.has(shooter, 'blackout')
            };
        }
        const views = two
            ? [viewOf(player, Camera.rigs[0], 'left'), viewOf(rival, Camera.rigs[1], 'right')]
            : [viewOf(player, Camera.rigs[0], 'full'), { camera: Camera.rivalView(), rect: 'inset', hoopX: rival.hoop.base[0] }];

        window.renderScene({
            balls: balls,
            hoops: [player.hoop, rival.hoop],
            views: views,
            aimPaths: two ? [aimPath(player), aimPath(rival)] : [aimPath(player)],
            tint: Effects.getTint(),
            ballSkin: Cards.activeBall(),
            state: Game.state
        });
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();

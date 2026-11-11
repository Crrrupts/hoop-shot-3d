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
//   scene.tint       [r, g, b] multiplies the picture's colors (Inferno turns it red-orange)
//   scene.ballSkin   id of the ball card to draw for your balls (cards.js)
//   scene.state      Game.state (mode, player, rival, ...)

(function () {
    let last = performance.now();

    // The balls waiting in each shooter's hands (drawn, but not in the physics yet)
    const playerHand = { pos: [0, 0, 0], spinAxis: [1, 0, 0], spinAngle: 0, mine: true };
    const rivalHand = { pos: [0, 0, 0], spinAxis: [1, 0, 0], spinAngle: 0 };

    // ---------- Aiming ----------
    // Perfect aim is the crosshair on the rim (a little to the side in wind).
    // Moving it AIM_PIXELS away is full aim (aimX or aimY of 1 or -1).
    const AIM_PIXELS = 110;

    // Where perfect aim is on the screen for a player (canvas pixels)
    function aimTarget(shooter, index) {
        const rim = window.worldToScreen(Physics.rimCenter(shooter.hoop), index);
        return { x: rim.x + Game.perfectAim(shooter) * AIM_PIXELS, y: rim.y, rimX: rim.x };
    }

    // Turn a crosshair's position into aimX / aimY (-1..1) and show the HUD marks
    function updateAim(shooter, index) {
        const playing = Game.state.mode === 'playing';
        const target = aimTarget(shooter, index), cross = crosshairs[index];
        const clamp = (v) => Math.max(-1, Math.min(1, v));
        const ax = clamp((cross.x - target.rimX) / AIM_PIXELS);
        const ay = clamp(-(cross.y - target.y) / AIM_PIXELS);       // up on the screen = a higher arc
        if (index === 0) { aimX = ax; aimY = ay; } else { aim2X = ax; aim2Y = ay; }
        showCrosshair(index, playing ? cross : null);
        // the golden dot (where to aim) shows on Easy or with the Guide Line power-up
        const help = getDifficultySettings().name === 'Easy' || PowerUps.has(shooter, 'guide');
        showAimDot(index, playing && help ? target : null);
    }

    // After a shot the crosshair jumps somewhere else in the middle of the
    // view (not near the edges, and not right on the target), so you have to aim again
    function resetCrosshair(shooter, index) {
        const r = viewRect(index), target = aimTarget(shooter, index);
        for (let tries = 0; tries < 20; tries++) {
            crosshairs[index].x = r.x + r.width * (0.25 + Math.random() * 0.5);
            crosshairs[index].y = r.y + r.height * (0.22 + Math.random() * 0.45);
            if (Math.hypot(crosshairs[index].x - target.x, crosshairs[index].y - target.y) > 90) break;
        }
    }
    Game.on(function (name, data) {
        if (name === 'shoot' && data.shooter === Game.player) resetCrosshair(Game.player, 0);
        if (name === 'shoot' && data.shooter === Game.rival && Game.state.twoPlayer) resetCrosshair(Game.rival, 1);
        if (name === 'start') {
            // start each match with the crosshairs in the middle of each view
            for (const i of [0, 1]) { const r = viewRect(i); crosshairs[i].x = r.x + r.width / 2; crosshairs[i].y = r.height * 0.6; }
        }
    });

    // ---------- Power meter zones ----------
    // The green zone and grey buffer show on Easy or with the Sweet Spot power-up.
    const zoneKeys = ['', ''];
    function updateZones(shooter, which) {
        const show = Game.state.mode === 'playing' &&
            (getDifficultySettings().name === 'Easy' || PowerUps.has(shooter, 'sweet'));
        const zone = show ? Game.powerZone(shooter) : null;
        const key = JSON.stringify(zone);
        if (key === zoneKeys[which]) return;        // nothing changed
        zoneKeys[which] = key;
        setSweetZone(zone, which);
    }

    function frame(now) {
        // slow motion for buzzer beaters (effects.js decides when)
        const dt = Math.min((now - last) / 1000, 0.1) * Effects.timeScale();
        last = now;

        Game.update(dt);
        if (Game.state.mode !== 'picking') Effects.update(dt);
        Camera.update(dt);

        const player = Game.player, rival = Game.rival, two = Game.state.twoPlayer;
        updateAim(player, 0);
        if (two) updateAim(rival, 1); else { showCrosshair(1, null); showAimDot(1, null); }
        updateZones(player, 0);
        if (two) updateZones(rival, 1);

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
            tint: Effects.getTint(),
            ballSkin: Cards.activeBall(),
            state: Game.state
        });
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();

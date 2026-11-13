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
        const target = aimTarget(shooter, index), spot = crosshairs[index];
        // Shaky Hands and rain make the crosshair shake. The aim is exactly where it is drawn.
        const shake = playing ? Game.aimShake(shooter) : 0, t = performance.now() / 1000;
        const cross = { x: spot.x + shake * Math.sin(t * 9.1 + index), y: spot.y + shake * Math.cos(t * 7.3 + index) };
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
            moveCrosshair(index, r.x + r.width * (0.25 + Math.random() * 0.5), r.y + r.height * (0.22 + Math.random() * 0.45));
            if (Math.hypot(crosshairs[index].x - target.x, crosshairs[index].y - target.y) > 90) break;
        }
    }
    Game.on(function (name, data) {
        if (name === 'shoot' && data.shooter === Game.player) resetCrosshair(Game.player, 0);
        if (name === 'shoot' && data.shooter === Game.rival && Game.state.twoPlayer) resetCrosshair(Game.rival, 1);
        if (name === 'start') {
            // start each match with the crosshairs in the middle of each view
            for (const i of [0, 1]) { const r = viewRect(i); moveCrosshair(i, r.x + r.width / 2, r.height * 0.6); }
            // keep the mouse inside the game while you play (not in the sandbox: its panel needs the mouse)
            if (Game.state.options.mode !== 'sandbox') lockPointer();
        }
    });

    // ---------- Power meter zone ----------
    // The green zone is the power that scores for where you are aiming right
    // now, so it moves and changes size as you move the crosshair. It is
    // hidden on Hard and under the Blind Meter sabotage.
    const zoneKeys = ['', ''];
    const zoneAims = ['', ''], zoneTimes = [0, 0];
    function updateZones(shooter, which) {
        const show = Game.state.mode === 'playing' && Game.zoneVisible(shooter);
        const aim = which === 0 ? [aimX, aimY] : [aim2X, aim2Y];
        // Working out a zone for a new aim takes a few milliseconds, so while
        // the crosshair is moving do it at most 20 times a second. (The shot
        // itself always uses the exact aim at release.)
        const now = performance.now();
        const aimKey = aim[0].toFixed(2) + ',' + aim[1].toFixed(2);
        if (show && aimKey !== zoneAims[which]) {
            if (now - zoneTimes[which] < 50) return;
            zoneTimes[which] = now;
            zoneAims[which] = aimKey;
        }
        // (the crowd makes it bigger or smaller: Game.greenZone)
        const zone = show ? Game.greenZone(shooter, aim[0], aim[1]) : null;
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

        // the ball in each shooter's hands follows their pose (shooter.js).
        // For a moment after a release the hands are empty.
        const balls = player.balls.concat(rival.balls);
        playerHand.pos = Shooter.ballPosition(player);
        rivalHand.pos = Shooter.ballPosition(rival);
        if (Shooter.holdingBall(player)) balls.push(playerHand);
        if (Shooter.holdingBall(rival)) balls.push(rivalHand);

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

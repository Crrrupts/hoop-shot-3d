// main.js — the frame loop (Justin)
//
// Each frame: update the game and physics, move the camera, then hand
// everything to the renderer.
//
// Isaiah: define  window.renderScene = function (scene) { ... }  in your
// rendering file and it will be called every frame with:
//   scene.ball.pos        [x, y, z] ball center (radius Physics.BALL_RADIUS)
//   scene.ball.spinAxis   axis to rotate the ball model around
//   scene.ball.spinAngle  rotation angle in radians
//   scene.hoopOffset      [x, y, z] translate the hoop root (pole->board->rim->net) by this
//   scene.camera          { eye, at, up, fov, near, far } for lookAt/perspective
//   scene.aimPath         array of [x, y, z] points for the easy-mode aim arc (may be empty)
//   scene.state           Game.state (score, mode, spot, ...)
// Court/hoop sizes to match: Physics.RIM_HEIGHT, RIM_RADIUS, RIM_TUBE, BOARD, POLE.

(function () {
    let last = performance.now();

    function aimPath() {
        // Easy mode shows the arc while charging
        if (typeof getDifficultySettings !== 'function' || getDifficultySettings().name !== 'Easy') return [];
        if (typeof charging === 'undefined' || !charging || Physics.ball.inFlight) return [];
        const spot = Game.state.spot;
        const vel = Game.shotVelocity(spot, power, aimX, aimY, 0);
        return Physics.predictPath(Game.spotPosition(spot), vel, 1.6, 40);
    }

    function frame(now) {
        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;

        Game.update(dt);
        Camera.update(dt);

        if (typeof window.renderScene === 'function') {
            window.renderScene({
                ball: Physics.ball,
                hoopOffset: Physics.hoopOffset,
                camera: {
                    eye: Camera.eye, at: Camera.at, up: Camera.up,
                    fov: Camera.FOV, near: Camera.NEAR, far: Camera.FAR
                },
                aimPath: aimPath(),
                state: Game.state
            });
        }
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();

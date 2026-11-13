// shooter.js — the pose of the 3D player: where each joint is bent for a
// given moment of a shot. No drawing here: renderer.js draws the body from
// this pose with a matrix stack (hips -> legs, torso -> head, arms -> hands).
//
// The motion follows the power bar:
//   - as the bar fills, the knees bend and the ball rises from the chest to
//     above the head (it is at release height from 60% power on)
//   - when the key is let go the ball leaves, and the shooter follows
//     through: legs straighten, arms reach up, then relax back
//
// All sizes are meters. In the shooter's own space, +z is toward the hoop,
// +x is the shooter's left and y is up, with the feet at y = 0.

const Shooter = (function () {

    // ---------- Body sizes ----------
    const BODY = {
        foot: 0.08,             // ankle height
        shin: 0.46,
        thigh: 0.46,
        torso: 0.58,            // hips to shoulders
        shoulder: 0.21,         // half the shoulder width
        hip: 0.11,              // half the hip width
        upperArm: 0.32,
        forearm: 0.30,
        head: 0.115             // head radius
    };
    const STAND_HIP = BODY.foot + BODY.shin + BODY.thigh;       // hip height standing straight

    // ---------- The motion ----------
    const MAX_KNEE = 35 * Math.PI / 180;    // knee bend at a full power bar
    const CHEST = { y: 1.25, z: 0.28 };     // where the ball is held before a shot
    const SET = { y: 2.02, z: 0.14 };       // hands under the ball at release height (ball center 2.1)
    const REACH = { y: 2.16, z: 0.24 };     // follow-through: arms stretched up and forward
    const RISE_BY = 0.6;                    // the ball is at release height from 60% power on
    const BALL_ABOVE_HANDS = 0.08;          // the ball's center sits this far above the hands

    function mix(a, b, t) { return a + (b - a) * t; }
    function smooth(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }    // ease in and out

    // How much of the follow-through pose to show, 0..1.
    // since = seconds since the ball left the hands.
    function followAmount(since) {
        if (since < 0 || since > 0.65) return 0;
        if (since < 0.12) return since / 0.12;          // snap up
        if (since < 0.40) return 1;                     // hold
        return 1 - (since - 0.40) / 0.25;               // relax
    }

    // The whole pose.
    //   charge   0..1  how full the power bar is (0 when not charging)
    //   since    seconds since this shooter's last release (large = long ago)
    //   time     seconds, for a small idle sway
    // Returns the numbers renderer.js needs:
    //   hipY, knee (radians), lift (the little hop on release),
    //   hands [x, y, z] and ball [x, y, z] in the shooter's own space,
    //   arms: for the left and right arm, { yaw, upper, elbow } in radians
    function pose(charge, since, time) {
        // 1. the charging pose, from the power bar alone
        const rise = smooth(charge / RISE_BY);
        let knee = MAX_KNEE * charge;
        let handY = mix(CHEST.y, SET.y, rise);
        let handZ = mix(CHEST.z, SET.z, rise);
        let lift = 0;
        if (charge === 0) handY += 0.012 * Math.sin(time * 1.6);        // breathing while waiting

        // 2. blend toward the follow-through pose after a release.
        //    Starting a new charge takes over again right away.
        const follow = followAmount(since) * Math.max(0, 1 - charge * 8);
        knee = mix(knee, 0, follow);
        handY = mix(handY, REACH.y, follow);
        handZ = mix(handZ, REACH.z, follow);
        lift = 0.06 * follow;

        // 3. the hips drop as the knees bend (the feet stay on the floor)
        const hipY = BODY.foot + (BODY.shin + BODY.thigh) * Math.cos(knee) + lift;
        const shoulderY = hipY + BODY.torso;

        // 4. each arm bends so its hand reaches the ball
        const hands = [0, handY, handZ];
        const arms = [];
        for (const side of [1, -1]) {                   // 1 = left arm, -1 = right arm
            const target = [side * 0.09, handY, handZ];             // each hand holds one side of the ball
            arms.push(reachArm([side * BODY.shoulder, shoulderY, 0], target));
        }
        return {
            hipY: hipY, knee: knee, lift: lift, follow: follow,
            hands: hands, ball: [0, handY + BALL_ABOVE_HANDS, handZ], arms: arms
        };
    }

    // Bend a two-part arm (upper arm + forearm) so the hand lands on a target.
    // The arm hangs straight down at rest. Returns:
    //   yaw    turn the whole arm toward the target, around the up axis
    //   upper  swing the upper arm forward from straight down
    //   elbow  bend the forearm further from the upper arm's line
    // This is the law of cosines on the triangle shoulder - elbow - hand.
    function reachArm(shoulder, target) {
        const dx = target[0] - shoulder[0], dy = target[1] - shoulder[1], dz = target[2] - shoulder[2];
        const forward = Math.hypot(dx, dz);             // how far in front, in the arm's own plane
        const a = BODY.upperArm, b = BODY.forearm;
        // the hand cannot be further than a straight arm, or closer than a folded one
        const d = Math.max(Math.abs(a - b) + 0.01, Math.min(a + b - 0.005, Math.hypot(forward, dy)));
        const toTarget = Math.atan2(forward, -dy);      // angle of the target from straight down
        const atShoulder = Math.acos((a * a + d * d - b * b) / (2 * a * d));
        const atElbow = Math.acos((a * a + b * b - d * d) / (2 * a * b));
        return {
            yaw: Math.atan2(dx, dz),
            upper: toTarget - atShoulder,               // the elbow stays below the hand
            elbow: Math.PI - atElbow
        };
    }

    // Where an arm's hand ends up for a pose (used by the tests to check the
    // hands really meet the ball). Same steps the renderer draws.
    function handPosition(shoulder, arm) {
        const a = BODY.upperArm, b = BODY.forearm;
        const forward = a * Math.sin(arm.upper) + b * Math.sin(arm.upper + arm.elbow);
        const down = a * Math.cos(arm.upper) + b * Math.cos(arm.upper + arm.elbow);
        return [shoulder[0] + Math.sin(arm.yaw) * forward, shoulder[1] - down, shoulder[2] + Math.cos(arm.yaw) * forward];
    }

    // ---------- Looks ----------
    // Colors are [red, green, blue] from 0 to 1. Shirt, shorts and shoes are
    // fixed for now (future upgrade cards). Your skin tone and hair style
    // come from the Player screen in the menu.
    const LOOKS = {
        player: { skin: [0.80, 0.60, 0.46], hair: [0.13, 0.09, 0.07], shirt: [0.93, 0.93, 0.95], shorts: [0.16, 0.27, 0.62], shoes: [0.95, 0.95, 0.95] },
        rival:  { skin: [0.55, 0.38, 0.28], hair: [0.05, 0.05, 0.05], shirt: [0.75, 0.16, 0.16], shorts: [0.12, 0.12, 0.15], shoes: [0.15, 0.15, 0.17] }
    };
    // What you can change about your player: skin tone and hair style.
    const SKIN_TONES = [
        [0.96, 0.80, 0.69], [0.80, 0.60, 0.46], [0.69, 0.49, 0.35],
        [0.55, 0.38, 0.28], [0.40, 0.27, 0.20], [0.28, 0.19, 0.14]
    ];
    // Each hair style is a few shapes placed around the head. Offsets and
    // sizes are in head radiuses (1 = the head's radius), measured from the
    // middle of the head: [x, y, z] with y up and z toward the face.
    const HAIR_STYLES = {
        short:    { name: 'Short',    parts: [{ shape: 'sphere', at: [0, 0.26, -0.17], size: [1.05, 0.92, 1.05] }] },
        buzz:     { name: 'Buzz cut', parts: [{ shape: 'sphere', at: [0, 0.14, -0.08], size: [1.02, 0.95, 1.02] }] },
        afro:     { name: 'Afro',     parts: [{ shape: 'sphere', at: [0, 0.40, -0.18], size: [1.5, 1.35, 1.5] }] },
        flat:     { name: 'Flat top', parts: [{ shape: 'sphere', at: [0, 0.20, -0.15], size: [1.04, 0.9, 1.04] },
                                              { shape: 'box', at: [0, 0.95, -0.05], size: [1.7, 0.75, 1.7] }] },
        ponytail: { name: 'Ponytail', parts: [{ shape: 'sphere', at: [0, 0.26, -0.17], size: [1.05, 0.92, 1.05] },
                                              { shape: 'sphere', at: [0, 0.35, -1.15], size: [0.42, 0.42, 0.5] },
                                              { shape: 'sphere', at: [0, -0.25, -1.3], size: [0.3, 0.6, 0.3] }] },
        bald:     { name: 'Bald',     parts: [] }
    };

    // A shooter's look. Yours uses the skin tone and hair style saved with
    // your progress (cards.js); the rival's is fixed.
    function lookOf(shooter) {
        const look = Object.assign({ hairStyle: 'short' }, LOOKS[shooter.id] || LOOKS.rival);
        if (shooter.id === 'player' && typeof Cards !== 'undefined') {
            const chosen = Cards.getSave().shooter;
            look.skin = SKIN_TONES[chosen.skin] || SKIN_TONES[1];
            look.hairStyle = HAIR_STYLES[chosen.hair] ? chosen.hair : 'short';
        }
        return look;
    }

    // ---------- Each shooter's state (browser only) ----------
    // When did each shooter last let go of a ball? game.js announces every shot.
    const lastShot = new Map();
    if (typeof Game !== 'undefined') {
        Game.on(function (name, data) {
            if (name === 'shoot') lastShot.set(data.shooter, performance.now());
            if (name === 'start') lastShot.clear();
        });
    }
    function sinceShot(shooter) {
        return lastShot.has(shooter) ? (performance.now() - lastShot.get(shooter)) / 1000 : 99;
    }

    // How full a shooter's power bar is, 0..1. You and Player 2 use the real
    // bar. The AI rival has no bar, so it winds up over the last 0.7 seconds
    // before each of its shots.
    function chargeOf(shooter) {
        if (shooter === Game.player) return charging ? power / 100 : 0;
        if (Game.state.twoPlayer) return charging2 ? power2 / 100 : 0;
        if (!shooter.ai || Game.state.mode !== 'playing' || Game.state.practice) return 0;
        return 0.62 * Math.max(0, 1 - shooter.ai.timer / 0.7);
    }

    // The pose of a shooter right now
    function poseOf(shooter) {
        return pose(chargeOf(shooter), sinceShot(shooter), performance.now() / 1000);
    }

    // Which way a shooter faces: the angle (radians, around the up axis) that
    // turns the shooter's +z toward their hoop
    function facing(shooter) {
        const spot = Game.spotPosition(shooter.spot, shooter), hoop = shooter.hoop.base;
        return Math.atan2(hoop[0] - spot[0], hoop[2] - spot[2]);
    }

    // Where the ball in a shooter's hands is, in the world
    function ballPosition(shooter) {
        const p = poseOf(shooter), spot = Game.spotPosition(shooter.spot, shooter), turn = facing(shooter);
        return [
            spot[0] + Math.sin(turn) * p.ball[2] + Math.cos(turn) * p.ball[0],
            p.ball[1],
            spot[2] + Math.cos(turn) * p.ball[2] - Math.sin(turn) * p.ball[0]
        ];
    }

    // Is the shooter holding a ball right now? Not for a moment after a
    // release, while the arms are still up in the follow-through.
    function holdingBall(shooter) {
        return poseOf(shooter).follow < 0.5;
    }

    return { BODY, STAND_HIP, LOOKS, SKIN_TONES, HAIR_STYLES, lookOf, pose, reachArm, handPosition, followAmount, poseOf, facing, ballPosition, holdingBall };
})();

if (typeof module !== 'undefined') module.exports = Shooter;

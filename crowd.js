// crowd.js — where the fans stand and how high each one is jumping.
//
// Fans are flat cut-out cards (drawn by renderer.js) that bob up and down.
// They are never fully still, jump when you score, bounce higher as the
// hype meter fills, and stomp together in intense moments.
// Indoor courts get bleachers behind the baseline; outdoor courts get a few
// people standing along the back of the court.

const Crowd = (function () {

    const SHIRTS = ['#d94a4a', '#3f7fd9', '#e8c33c', '#4caf6a', '#ececec', '#8e5bd0'];
    const NEON_SHIRTS = ['#ff3cbe', '#35e8ff', '#b56bff', '#5dff9b', '#ffe14d', '#ff7a3c'];
    const SKIN = ['#f1c9a5', '#c68e5f', '#8d5a3b'];

    const ROWS = 3;                 // bleacher steps (indoor)
    const STEP_HEIGHT = 0.4, STEP_DEPTH = 0.65, FIRST_ROW_Z = -2.7;

    let fans = [];                  // { x, y, z, size, shirt, phase, speed }
    let bleachers = [];             // boxes: { center: [x, y, z], size: [w, h, d] }
    let glow = false;

    // Small repeatable random numbers so the crowd looks the same every time
    function randomMaker(seed) {
        let s = seed;
        return function () {
            s = (s * 1664525 + 1013904223) % 4294967296;
            return s / 4294967296;
        };
    }

    // Place the fans for a court. x0..x1 is how wide the floor is (meters).
    // hoopXs: nobody stands right behind a hoop, so the net stays easy to see.
    function build(look, x0, x1, hoopXs) {
        const rand = randomMaker(5);
        const count = look.crowd.fans;
        glow = look.crowd.kind === 'glow';
        fans = [];
        bleachers = [];
        const left = x0 + 0.8, width = (x1 - 0.8) - left;

        if (!look.outdoor) {
            for (let k = 0; k < ROWS; k++) {
                const height = STEP_HEIGHT * (k + 1);
                bleachers.push({
                    center: [(x0 + x1) / 2, height / 2, FIRST_ROW_Z - STEP_DEPTH * k - 0.15],
                    size: [x1 - x0 - 0.4, height, STEP_DEPTH]
                });
            }
        }
        for (let i = 0; i < count; i++) {
            const row = look.outdoor ? 0 : i % ROWS;
            // spread out evenly with a little randomness
            let x = left + ((i + rand()) / count) * width;
            for (const hoopX of hoopXs) {
                const gap = 1.5;
                if (Math.abs(x - hoopX) < gap) x = hoopX + (x < hoopX ? -1 : 1) * (gap + rand() * 0.9);
            }
            fans.push({
                x: x,
                y: look.outdoor ? 0 : STEP_HEIGHT * (row + 1),
                z: look.outdoor ? -3.0 - rand() * 0.8 : FIRST_ROW_Z - STEP_DEPTH * row,
                size: 0.75 + rand() * 0.2,
                shirt: Math.floor(rand() * SHIRTS.length),
                phase: rand() * 6.28,
                speed: 2 + rand() * 2
            });
        }
    }

    // How far off the ground a fan is right now (meters).
    //   hype   0..1  the hype meter
    //   cheer  0..1  just after you score, fading out
    //   stomp  true in intense moments: everyone moves together
    function jumpHeight(fan, time, hype, cheer, stomp) {
        let h = 0.03 * Math.abs(Math.sin(time * fan.speed * 0.5 + fan.phase));       // never fully still
        h += 0.22 * hype * Math.abs(Math.sin(time * fan.speed + fan.phase));          // more hype, more bounce
        h += 0.4 * cheer * Math.abs(Math.sin(time * 9 + fan.phase));                  // jump on a make
        if (stomp) h += 0.1 * Math.abs(Math.sin(time * 5.2));                         // in sync
        return h;
    }

    return {
        build, jumpHeight,
        getFans: function () { return fans; },
        getBleachers: function () { return bleachers; },
        shirtColors: function () { return glow ? NEON_SHIRTS : SHIRTS; },
        skinColors: function () { return SKIN; },
        isGlow: function () { return glow; }
    };
})();

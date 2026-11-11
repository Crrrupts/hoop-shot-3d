// courts.js — the courts: how each one plays (rules) and how it looks (look).
//
// rules change the physics and are read by game.js:
//   rimScale      rim size (1 = normal, bigger = easier)
//   rimBounce     how hard the ball bounces off the rim (0.5 = normal;
//                 lower = soft and forgiving, higher = stiff, more bounce-outs)
//   rimThickness  1 = normal rim, 1.8 = outdoor double rim
//   floorBounce   how high the ball bounces off the floor (rain lowers it)
//   wind          sideways push on the ball in the air (m/s^2), 0 = none
//   gusty         true = the wind swings back and forth; false = one direction
//   slip          extra aim error (radians) from a wet, slippery ball
//
// look is read by textures.js and renderer.js (colors, lights, sky, weather).
// Colors are [red, green, blue] from 0 to 1, or CSS color text for painted images.
// Light positions are in meters: your hoop is at x = 0, the rival's at x = 15.
//
// All numbers are first-pass values to tune in playtesting.

const Courts = (function () {

    const NORMAL_RULES = {
        rimScale: 1, rimBounce: 0.5, rimThickness: 1, floorBounce: 0.72,
        wind: 0, gusty: false, slip: 0
    };
    const DOUBLE_RIM = { rimBounce: 0.68, rimThickness: 1.8 };

    // Two spotlights straight above the keys plus a soft fill light (indoor gyms)
    function gymLights(strength, cone, fill) {
        const color = [0.95 * strength, 0.92 * strength, 0.85 * strength];
        return [
            { position: [0, 9.5, 2.5], color: color, direction: [0, -1, 0], cone: cone },
            { position: [15, 9.5, 2.5], color: color, direction: [0, -1, 0], cone: cone },
            { position: [7.5, 6, 14], color: [fill, fill, fill * 1.1], direction: [0, -1, 0], cone: null }
        ];
    }
    const OFF = { position: [0, 0, 0], color: [0, 0, 0], direction: [0, -1, 0], cone: null };

    const LIST = [
        {
            id: 'ymca', name: 'YMCA Gym', difficulty: 'Easiest',
            blurb: 'Bright, even lights, no wind and a soft, forgiving rim. The place to learn.',
            rules: Object.assign({}, NORMAL_RULES, { rimScale: 1.06, rimBounce: 0.3 }),
            look: {
                outdoor: false,
                floor: { kind: 'wood', base: [222, 184, 126], paint: 'rgba(35,105,165,0.85)', line: '#ffffff', logo: 'HOOP SHOT', gloss: 0.06 },
                wall: { block: [214, 212, 202], mortar: '#a9a79c', band: 'rgba(35,105,165,0.9)', base: 'rgba(60,70,90,0.45)' },
                ceiling: [0.3, 0.3, 0.32],
                ambient: [0.62, 0.62, 0.64],
                lights: gymLights(0.72, [50, 78], 0.25),
                board: { face: '#f6f6f2', line: '#2369a5', pad: '#2369a5' },
                rim: [0.95, 0.35, 0.08], pole: [0.25, 0.3, 0.38], net: [0.96, 0.96, 0.96],
                weather: null,
                crowd: { fans: 12, kind: 'people' }
            }
        },
        {
            id: 'home', name: 'Home Gym', difficulty: 'Normal',
            blurb: 'Old high school gym. Plays normally.',
            rules: Object.assign({}, NORMAL_RULES),
            look: {
                outdoor: false,
                floor: { kind: 'wood', base: [203, 160, 100], paint: 'rgba(150,30,35,0.82)', line: '#f5f2ea', logo: 'HOOP SHOT', gloss: 0.06 },
                wall: { block: [196, 190, 176], mortar: '#8f897c', band: 'rgba(150,30,35,0.9)', base: 'rgba(40,45,60,0.55)' },
                ceiling: [0.12, 0.12, 0.14],
                ambient: [0.42, 0.42, 0.46],
                lights: gymLights(1, [38, 62], 0.22),
                board: { face: '#f2f2ee', line: '#c0281f', pad: '#26303f' },
                rim: [0.95, 0.35, 0.08], pole: [0.2, 0.22, 0.27], net: [0.96, 0.96, 0.96],
                weather: null,
                crowd: { fans: 30, kind: 'people' }
            }
        },
        {
            id: 'neon', name: 'Neon Arcade', difficulty: 'Normal',
            blurb: 'Synthwave arena with a glowing grid floor. Plays normally.',
            rules: Object.assign({}, NORMAL_RULES),
            look: {
                outdoor: false,
                floor: { kind: 'grid', base: [14, 12, 26], paint: 'rgba(255,60,190,0.28)', line: '#35e8ff', logo: 'HOOP SHOT', gloss: 0.5 },
                wall: { block: [26, 22, 44], mortar: '#0d0b18', band: 'rgba(255,60,190,0.95)', base: 'rgba(53,232,255,0.5)' },
                ceiling: [0.03, 0.02, 0.06],
                ambient: [0.3, 0.22, 0.42],
                lights: [
                    { position: [0, 9.5, 2.5], color: [1.0, 0.35, 0.8], direction: [0, -1, 0], cone: [40, 65] },
                    { position: [15, 9.5, 2.5], color: [0.3, 0.9, 1.0], direction: [0, -1, 0], cone: [40, 65] },
                    { position: [7.5, 6, 14], color: [0.3, 0.25, 0.45], direction: [0, -1, 0], cone: null }
                ],
                board: { face: '#17142b', line: '#ff3cbe', pad: '#35e8ff' },
                rim: [0.25, 0.95, 1.0], pole: [0.12, 0.1, 0.2], net: [1.0, 0.45, 0.85],
                weather: null,
                crowd: { fans: 36, kind: 'glow' }
            }
        },
        {
            id: 'arena', name: 'Pro Arena', difficulty: 'Normal',
            blurb: 'Packed stadium: dark stands, bright court, the loudest crowd. Plays normally.',
            rules: Object.assign({}, NORMAL_RULES),
            look: {
                outdoor: false,
                floor: { kind: 'wood', base: [214, 168, 104], paint: 'rgba(20,40,110,0.85)', line: '#ffffff', logo: 'HOOP SHOT', gloss: 0.35 },
                wall: { block: [44, 46, 60], mortar: '#23242e', band: 'rgba(20,40,110,0.9)', base: 'rgba(10,10,20,0.6)' },
                ceiling: [0.03, 0.03, 0.05],
                ambient: [0.26, 0.26, 0.3],
                lights: gymLights(1.2, [30, 52], 0.18),
                board: { face: '#e9eef2', line: '#14286e', pad: '#14286e' },
                rim: [0.98, 0.38, 0.08], pole: [0.1, 0.11, 0.14], net: [1, 1, 1],
                weather: null,
                crowd: { fans: 60, kind: 'people' }
            }
        },
        {
            id: 'boardwalk', name: 'Boardwalk', difficulty: 'Hard',
            blurb: 'Beach court by the pier. Outdoor double rim, and a sea wind that pushes the ball sideways.',
            rules: Object.assign({}, NORMAL_RULES, DOUBLE_RIM, { wind: 0.28 }),
            look: {
                outdoor: true,
                floor: { kind: 'concrete', base: [206, 198, 180], paint: 'rgba(40,150,170,0.6)', line: '#fbfaf2', logo: 'BOARDWALK', gloss: 0.03 },
                sky: { top: '#2f7fd6', horizon: '#bfe6ff', ground: '#2a7fa8', scene: 'sea' },
                ground: [0.85, 0.78, 0.6],
                ambient: [0.56, 0.56, 0.58],
                lights: [
                    { position: [40, 60, 45], color: [1.0, 0.97, 0.88], direction: [0, -1, 0], cone: null },   // the sun
                    OFF, OFF
                ],
                board: { face: '#b98d5e', line: '#fbfaf2', pad: '#7a5a3a' },
                rim: [0.95, 0.4, 0.1], pole: [0.45, 0.33, 0.22], net: [0.93, 0.93, 0.9],
                weather: 'breeze',          // blowing dust that shows the wind
                crowd: { fans: 10, kind: 'people' }
            }
        },
        {
            id: 'rooftop', name: 'Rooftop', difficulty: 'Hard',
            blurb: 'City rooftop at dusk. Outdoor double rim, and rain: a slippery ball and a floor that bounces less.',
            rules: Object.assign({}, NORMAL_RULES, DOUBLE_RIM, { floorBounce: 0.45, slip: 0.02 }),
            look: {
                outdoor: true,
                floor: { kind: 'asphalt', base: [70, 72, 78], paint: 'rgba(200,120,40,0.35)', line: '#d9d4c2', logo: 'ROOFTOP', gloss: 0.3 },
                sky: { top: '#262a5c', horizon: '#e8824a', ground: '#15161f', scene: 'city' },
                ground: [0.13, 0.13, 0.16],
                ambient: [0.4, 0.36, 0.4],
                lights: [
                    { position: [-60, 22, 25], color: [1.0, 0.68, 0.42], direction: [0, -1, 0], cone: null },  // low sun
                    { position: [7.5, 5, 4], color: [0.55, 0.45, 0.3], direction: [0, -1, 0], cone: null },     // string lights
                    OFF
                ],
                board: { face: '#8c939c', line: '#e8e2d0', pad: '#5b6068' },
                rim: [0.8, 0.32, 0.12], pole: [0.3, 0.31, 0.34], net: [0.72, 0.74, 0.78],      // chain net
                weather: 'rain',
                crowd: { fans: 8, kind: 'people' }
            }
        },
        {
            id: 'lake', name: 'Frozen Lake', difficulty: 'Hardest',
            blurb: 'Outdoor court on ice at night. Outdoor double rim, gusting wind and falling snow.',
            rules: Object.assign({}, NORMAL_RULES, DOUBLE_RIM, { wind: 0.3, gusty: true }),
            look: {
                outdoor: true,
                floor: { kind: 'ice', base: [200, 222, 236], paint: 'rgba(60,110,190,0.4)', line: '#27467a', logo: 'FROZEN LAKE', gloss: 0.6 },
                sky: { top: '#050a1f', horizon: '#1c3157', ground: '#c9d6e2', scene: 'pines' },
                ground: [0.78, 0.84, 0.9],
                ambient: [0.3, 0.34, 0.46],
                lights: [
                    { position: [-30, 50, -40], color: [0.4, 0.46, 0.62], direction: [0, -1, 0], cone: null }, // the moon
                    { position: [-3, 5.5, 3], color: [0.95, 0.7, 0.4], direction: [0, -1, 0], cone: [45, 80] }, // lamp posts
                    { position: [18, 5.5, 3], color: [0.95, 0.7, 0.4], direction: [0, -1, 0], cone: [45, 80] }
                ],
                board: { face: '#cfe2ee', line: '#27467a', pad: '#9fb9cc' },
                rim: [0.8, 0.84, 0.9], pole: [0.35, 0.4, 0.48], net: [1, 1, 1],
                weather: 'snow',
                crowd: { fans: 14, kind: 'people' }
            }
        }
    ];

    // The scoreboard (score and time boxes) is styled to match each court.
    // ui.js copies these into CSS: background, text color, accent color (rival
    // score and small text), border, font and glow.
    const SCOREBOARDS = {
        ymca:      { bg: 'rgba(255,255,255,0.9)', text: '#17456e', accent: '#2369a5', border: '2px solid #2369a5', font: 'Arial, sans-serif', glow: 'none' },                       // clean community-center board
        home:      { bg: '#170c0a', text: '#ff4a3d', accent: '#ffb020', border: '4px solid #6b4a2a', font: '"Courier New", monospace', glow: '0 0 6px #ff4a3d' },               // old red-bulb scoreboard in a wood frame
        neon:      { bg: 'rgba(10,6,24,0.85)', text: '#35e8ff', accent: '#ff3cbe', border: '2px solid #ff3cbe', font: '"Courier New", monospace', glow: '0 0 8px #35e8ff' },    // neon sign
        arena:     { bg: 'rgba(6,8,16,0.92)', text: '#ffffff', accent: '#ffc93d', border: '2px solid #c9ccd6', font: 'Impact, "Arial Narrow", sans-serif', glow: '0 0 4px rgba(255,255,255,0.6)' },   // jumbotron
        boardwalk: { bg: '#8a5a33', text: '#fff4d6', accent: '#ffe08a', border: '4px solid #5a3a1e', font: 'Georgia, serif', glow: 'none' },                                    // painted wooden sign
        rooftop:   { bg: 'rgba(28,28,34,0.88)', text: '#f2f2e8', accent: '#ff8a3c', border: '2px dashed #d9d4c2', font: '"Courier New", monospace', glow: 'none' },             // chalk on a dark wall
        lake:      { bg: 'rgba(214,234,247,0.9)', text: '#17325c', accent: '#3d6fb8', border: '2px solid #ffffff', font: 'Arial, sans-serif', glow: '0 0 6px #ffffff' }        // block of ice
    };
    LIST.forEach((court) => { court.look.scoreboard = SCOREBOARDS[court.id]; });

    function byId(id) {
        return LIST.find((c) => c.id === id) || LIST[0];
    }

    // Sideways wind (m/s^2 along x) at a moment in the match.
    // Steady wind keeps one direction and changes strength; gusty wind swings both ways.
    function windAt(rules, seconds) {
        if (!rules.wind) return 0;
        if (rules.gusty) return rules.wind * (Math.sin(seconds * 0.35) + 0.5 * Math.sin(seconds * 1.3 + 1));
        return rules.wind * (1 + 0.35 * Math.sin(seconds * 0.4));
    }

    return { LIST, byId, windAt };
})();

if (typeof module !== 'undefined') module.exports = Courts;

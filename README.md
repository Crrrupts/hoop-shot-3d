# Hoop Shot 3D

A 3D basketball shooting game built in WebGL for CMPSC 457.
Aim with the mouse, hold Space to charge, release to shoot. Race an AI rival who shoots at their own hoop: most points in 3 minutes wins.

## Team
The code in this repo is AI-generated (Claude), directed and reviewed by Justin Leddo, with the team's permission to update everyone's files. Every AI session is recorded in [GA1_AI_Use_Log.md](GA1_AI_Use_Log.md).

- Justin Leddo — directs and reviews the code; gameplay and physics
- Isaiah Millien — brainstorming and design; rendering
- Amit Gurung — brainstorming and design; interaction and testing
- Bom Chhetri — brainstorming and design; UI, art, and audio

## Tech
Plain WebGL with our own GLSL shaders and MV.js (no 3D engine).
`Common/MV.js` and `Common/initShaders.js` are the class libraries by Edward Angel.

## Run
Open index.html with a local web server (e.g. VS Code Live Server).

## Controls
Mouse: aim | hold Space: charge power, release to shoot | A/D: change spot | C: change camera | R: restart | slider: difficulty. In the Orbit camera, drag the mouse to spin the view. On a power-up pick: click a card, or Left arrow / 1 for the left card and Right arrow / 2 for the right card.

## Modes
- **Campaign** (main mode): 7 stages, one per court, easiest to hardest. Each is a race against that court's boss, who has a twist (listed on the campaign screen). A win earns 1–3 stars (win, win by 10+, win without picking a sabotage), gold and a chest, and unlocks the next stage. The first stage starts with a 6-step tutorial and a 60-second practice race.
- **Quick Match**: pick any court; the Difficulty slider sets the rival.
- **Sandbox**: free shootaround with no clock and no rival. A panel under the game lets you change court and ball, switch any power-up or sabotage on yourself and set its level, show the aim arc and power zone, use slow motion, reset the balls, and see makes/attempts per spot.
- **Cards**: chests give ball skins (looks only) and gear. Duplicates plus gold level a card up (max level 5). Gear: Headband (steadier aim), Shooting Sleeve (slightly bigger rim for you), Wristband (once a game a miss may keep your streak). Progress is saved in the browser on this computer.

## How a match works
- **Live race.** You and the rival shoot at the same time at your own hoops. The small box on the left is a live camera on the rival's hoop.
- **Shoot as fast as you want.** A new ball is ready as soon as the last one leaves your hands, so several balls can be in the air.
- **Scoring.** 2 points, 3 from the corner spots.
- **Streak tiers.** 2 makes in a row = Heating Up (+1 per basket), 4 = On Fire (+2), 7 = Inferno (points x2, then +2). One miss drops you to zero.
- **Power-up picks.** Every 30–45 seconds (the first one comes early, at your 2nd make) the game pauses and you pick one of two cards: a buff for you or a sabotage for the rival. You have 8 seconds. Picking a card you already have levels it up. The 20 cards and the rarity odds are in `powerups.js`.
- **Clock.** 3 minutes. Shots in the air at the buzzer still count. A tie goes to a 1-minute overtime that starts with a pick.
- **Difficulty slider.** Easy / Medium / Hard changes the meter speed, your aim wobble and the rival (how often it scores, how fast it shoots, which cards it can pick). Easy also shows the aim arc.
- **Money Rack.** Once a game, for a surprise 10 seconds, every make pays double.

## Courts
Pick a court on the menu. Rules and looks are in `courts.js`.

| Court | Difficulty | What changes |
|---|---|---|
| YMCA Gym | Easiest | Bright even lights, a slightly bigger and softer rim |
| Home Gym | Normal | Nothing |
| Neon Arcade | Normal | Looks only |
| Pro Arena | Normal | Looks only, the biggest crowd |
| Boardwalk | Hard | Outdoor double rim (stiffer, thicker) and a sea wind that pushes the ball sideways |
| Rooftop | Hard | Outdoor double rim and rain: a slippery ball (shakier aim) and a floor that bounces less |
| Frozen Lake | Hardest | Outdoor double rim, gusting wind that changes direction, falling snow |

The scoreboard (score and time boxes) is styled to match each court: red bulbs in a wood frame at the Home Gym, a neon sign at the Neon Arcade, a painted wooden sign on the Boardwalk, and so on (`SCOREBOARDS` in `courts.js`).

The wind when you release is the wind that ball gets. The HUD shows it for the spot you are standing on (arrows = sideways push), and the aim arc bends with it.

## Crowd and game feel
- The crowd is flat cut-out cards that bob. They jump when you score, bounce more as the **hype meter** fills, and stomp together in intense moments (last minute of a close game, overtime, or when you are On Fire).
- Makes throw confetti and float "+2" from the rim; swishes, bank shots, rim-outs ("SO CLOSE!") and air balls get their own text.
- Heating Up gives the ball an orange trail, On Fire covers it in fire and burns the net, Inferno turns the lights red-orange and makes the rim glow. Losing the streak puffs out smoke.
- The last 10 seconds turn the timer red. A shot still in the air after the buzzer drops in slow motion.

## Where each graded requirement lives
| Requirement | Where to look |
|---|---|
| Own 3D geometry | `geometry.js`: sphere (ball), torus (rim), unit cube (board, pole, arm, arena, bleachers, crowd cards), plane (court), disc, line net |
| Transformations | `renderer.js`: `drawBall` (translate, rotate, scale), `drawBox` (one unit cube scaled into every box) |
| lookAt camera | `camera.js` picks eye/at/up for the 3 views; `renderer.js` calls `lookAt` and `perspective` |
| Interaction | `input.js`: mouse aim, Space power, A/D, C, R, difficulty slider |
| Animation | `main.js` frame loop; ball flight, net sway and stretch, rim shake, backboard wobble, moving hoop (the Moving Hoop power-up; open `index.html?test=moving` to see it right away) |
| Lighting | Phong shading in the fragment shader in `index.html`: ambient + up to 3 lights (overhead spotlights, sun or moon, lamp posts, set per court in `courts.js`); shiny rim, matte court |
| Advanced: collisions and physics | `physics.js` (several balls and two hoops), tested by `tests/physics.test.js` |
| Advanced: texture mapping | `textures.js` paints the ball, court floors, backboards, walls, skies and crowd images; UVs come from `geometry.js` |
| Advanced: hierarchical modeling | `renderer.js` `drawHoop`: pole → arm → backboard → rim → net on a matrix stack; only the root moves for the Moving Hoop power-up |

## Code layout
| File | Role area | What it does |
|---|---|---|
| index.html, ui.js, style.css | Bom | Page, HUD, menus, power meter, power-up pick screen. index.html also holds the GLSL shaders |
| input.js | Amit | Mouse aim, Space power, A/D spot, C camera, R restart, difficulty |
| physics.js | Justin | Ball flight (fixed 240 Hz step), floor/backboard/pole/rim collisions, basket detection, for any number of balls and hoops |
| game.js | Justin | The match: shooting, scoring, streak tiers, clock and overtime, the AI rival, power-up picks, game events (`Game.on`) |
| powerups.js | Justin | The 20 power-up cards, rarity odds tables, and how effects are stored and counted down |
| courts.js | Justin, Bom | The 7 courts: rules (rim, wind, rain) and looks (colors, lights, sky, weather) |
| effects.js | Justin, Bom | Game feel: hype meter, confetti, fire, smoke, ball trails, floating text, slow motion, sound hooks |
| crowd.js | Bom | Where the fans stand and how high each one jumps |
| cards.js | Justin, Bom | Ball and gear cards, chests, upgrades, saved progress |
| campaign.js | Justin | The 7 campaign stages (rival numbers, boss twists), stars and rewards |
| menus.js | Bom | Menu screens, result and chest opening, tutorial steps, sandbox panel |
| camera.js | Justin | Shooter, Ball Follow and Orbit views (eye/at/up for lookAt), plus the fixed rival camera |
| main.js | Justin | Frame loop; calls `window.renderScene(scene)` every frame |
| geometry.js | Isaiah | Builds every mesh in code (positions, normals, texture coordinates, triangles) |
| textures.js | Isaiah, Bom | Placeholder textures painted on 2D canvases (swap in real art here) |
| renderer.js | Isaiah | WebGL setup, materials, lights, matrix stack, draws the main view and the small rival view |
| tests/ | Amit | `physics.test.js`, `rules.test.js` and `cards.test.js`, run with node |

Units are meters, y is up, the rim is above x = 0, z = 0 and the shooter is on +z. Sizes shared by physics and drawing are in `Physics` (`RIM_HEIGHT`, `RIM_RADIUS`, `BOARD`, `POLE`, ...).

**Sound hookup (Bom):** define `window.playSound(name, detail)`. There are no sounds in the repo yet. The game calls it with `shoot`, `swish`, `score`, `rim`, `board`, `floor`, `pole`, `buzzer`, and the feel layer with `cheer`, `chime` (`detail.streak` rises with the streak, for a rising pitch), `groan`, `gasp`, `airball`, `hiss`, `fire`, `stomp`, `tick`.

**Art hookup (Bom):** each function in `textures.js` returns one image (ball, court floor, backboard, wall, sky, crowd fan). Replace the drawing with your own image of the same layout. Court colors are in `courts.js`.

## Tests
```
node tests/physics.test.js
node tests/rules.test.js
node tests/cards.test.js
```
The first checks that every spot can be scored, the collisions, and frame-rate independence. The second checks the match rules: streak tiers, rapid fire, power-up odds and effects, the rival's accuracy, the buzzer, overtime, the court rules (soft rim, double rim, rain, wind), practice mode, boss twists and a whole simulated match. The third checks chests, upgrades, gear and campaign stars and unlocks.

For testing in the browser, add to the page address: `?length=30` for a short game, or `?test=moving,fog` to start with those power-ups on you (ids are in `powerups.js`).

## AI use
See [GA1_AI_Use_Log.md](GA1_AI_Use_Log.md).

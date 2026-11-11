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

## How a match works
- **Live race.** You and the rival shoot at the same time at your own hoops. The small box on the left is a live camera on the rival's hoop.
- **Shoot as fast as you want.** A new ball is ready as soon as the last one leaves your hands, so several balls can be in the air.
- **Scoring.** 2 points, 3 from the corner spots.
- **Streak tiers.** 2 makes in a row = Heating Up (+1 per basket), 4 = On Fire (+2), 7 = Inferno (points x2, then +2). One miss drops you to zero.
- **Power-up picks.** Every 30–45 seconds (the first one comes early, at your 2nd make) the game pauses and you pick one of two cards: a buff for you or a sabotage for the rival. You have 8 seconds. Picking a card you already have levels it up. The 20 cards and the rarity odds are in `powerups.js`.
- **Clock.** 3 minutes. Shots in the air at the buzzer still count. A tie goes to a 1-minute overtime that starts with a pick.
- **Difficulty slider.** Easy / Medium / Hard changes the meter speed, your aim wobble and the rival (how often it scores, how fast it shoots, which cards it can pick). Easy also shows the aim arc.

## Where each graded requirement lives
| Requirement | Where to look |
|---|---|
| Own 3D geometry | `geometry.js`: sphere (ball), torus (rim), unit cube (board, pole, arm, arena), plane (court), disc, line net |
| Transformations | `renderer.js`: `drawBall` (translate, rotate, scale), `drawBox` (one unit cube scaled into every box) |
| lookAt camera | `camera.js` picks eye/at/up for the 3 views; `renderer.js` calls `lookAt` and `perspective` |
| Interaction | `input.js`: mouse aim, Space power, A/D, C, R, difficulty slider |
| Animation | `main.js` frame loop; ball flight, net sway and stretch, rim shake, backboard wobble, moving hoop (the Moving Hoop power-up; open `index.html?test=moving` to see it right away) |
| Lighting | Phong shading in the fragment shader in `index.html`: ambient + overhead spotlight + fill light; shiny rim, matte court |
| Advanced: collisions and physics | `physics.js` (several balls and two hoops), tested by `tests/physics.test.js` |
| Advanced: texture mapping | `textures.js` paints the ball, court, backboard and wall images; UVs come from `geometry.js` |
| Advanced: hierarchical modeling | `renderer.js` `drawHoop`: pole → arm → backboard → rim → net on a matrix stack; only the root moves for the Moving Hoop power-up |

## Code layout
| File | Role area | What it does |
|---|---|---|
| index.html, ui.js, style.css | Bom | Page, HUD, menus, power meter, power-up pick screen. index.html also holds the GLSL shaders |
| input.js | Amit | Mouse aim, Space power, A/D spot, C camera, R restart, difficulty |
| physics.js | Justin | Ball flight (fixed 240 Hz step), floor/backboard/pole/rim collisions, basket detection, for any number of balls and hoops |
| game.js | Justin | The match: shooting, scoring, streak tiers, clock and overtime, the AI rival, power-up picks, game events (`Game.on`) |
| powerups.js | Justin | The 20 power-up cards, rarity odds tables, and how effects are stored and counted down |
| camera.js | Justin | Shooter, Ball Follow and Orbit views (eye/at/up for lookAt), plus the fixed rival camera |
| main.js | Justin | Frame loop; calls `window.renderScene(scene)` every frame |
| geometry.js | Isaiah | Builds every mesh in code (positions, normals, texture coordinates, triangles) |
| textures.js | Isaiah, Bom | Placeholder textures painted on 2D canvases (swap in real art here) |
| renderer.js | Isaiah | WebGL setup, materials, lights, matrix stack, draws the main view and the small rival view |
| tests/ | Amit | `physics.test.js` and `rules.test.js`, run with node |

Units are meters, y is up, the rim is above x = 0, z = 0 and the shooter is on +z. Sizes shared by physics and drawing are in `Physics` (`RIM_HEIGHT`, `RIM_RADIUS`, `BOARD`, `POLE`, ...).

**Sound hookup (Bom):** define `window.playSound(name)`; the game calls it with `shoot`, `swish`, `score`, `rim`, `board`, `floor`, `pole`, `buzzer`.

**Art hookup (Bom):** each function in `textures.js` returns one image (ball, court, backboard, wall). Replace the drawing with your own image of the same layout.

## Tests
```
node tests/physics.test.js
node tests/rules.test.js
```
The first checks that every spot can be scored, the collisions, and frame-rate independence. The second checks the match rules: streak tiers, rapid fire, power-up odds and effects, the rival's accuracy, the buzzer, overtime and a whole simulated match.

For testing in the browser, add to the page address: `?length=30` for a short game, or `?test=moving,fog` to start with those power-ups on you (ids are in `powerups.js`).

## AI use
See [GA1_AI_Use_Log.md](GA1_AI_Use_Log.md).

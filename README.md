# Hoop Shot 3D

A 3D basketball shooting game built in WebGL for CMPSC 457.
Aim with the mouse, hold Space to charge, release to shoot. Score as many baskets as you can in 60 seconds.

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
Mouse: aim | hold Space: charge power, release to shoot | A/D: change spot | C: change camera | R: restart | slider: difficulty (Hard moves the hoop). In the Orbit camera, drag the mouse to spin the view.

## Where each graded requirement lives
| Requirement | Where to look |
|---|---|
| Own 3D geometry | `geometry.js`: sphere (ball), torus (rim), unit cube (board, pole, arm, arena), plane (court), disc, line net |
| Transformations | `renderer.js`: `drawBall` (translate, rotate, scale), `drawBox` (one unit cube scaled into every box) |
| lookAt camera | `camera.js` picks eye/at/up for the 3 views; `renderer.js` calls `lookAt` and `perspective` |
| Interaction | `input.js`: mouse aim, Space power, A/D, C, R, difficulty slider |
| Animation | `main.js` frame loop; ball flight, net sway and stretch, rim shake, backboard wobble, moving hoop |
| Lighting | Phong shading in the fragment shader in `index.html`: ambient + overhead spotlight + fill light; shiny rim, matte court |
| Advanced: collisions and physics | `physics.js`, tested by `tests/physics.test.js` |
| Advanced: texture mapping | `textures.js` paints the ball, court, backboard and wall images; UVs come from `geometry.js` |
| Advanced: hierarchical modeling | `renderer.js` `drawHoop`: pole → arm → backboard → rim → net on a matrix stack |

## Code layout
| File | Role area | What it does |
|---|---|---|
| index.html, ui.js, style.css | Bom | Page, HUD, menus, power meter. index.html also holds the GLSL shaders |
| input.js | Amit | Mouse aim, Space power, A/D spot, C camera, R restart, difficulty |
| physics.js | Justin | Ball flight (fixed 240 Hz step), floor/backboard/pole/rim collisions, basket detection |
| game.js | Justin | Menu / playing / game over, 60 s timer, scoring (2 pts, 3 from corners, +1 when on fire at 3+ streak), moving hoop on Hard, game events (`Game.on`) |
| camera.js | Justin | Shooter, Ball Follow and Orbit views (eye/at/up for lookAt) |
| main.js | Justin | Frame loop; calls `window.renderScene(scene)` every frame |
| geometry.js | Isaiah | Builds every mesh in code (positions, normals, texture coordinates, triangles) |
| textures.js | Isaiah, Bom | Placeholder textures painted on 2D canvases (swap in real art here) |
| renderer.js | Isaiah | WebGL setup, materials, lights, matrix stack, draws the whole scene |
| debug-view.js | Justin | 2D wireframe test view, only with `?debug` in the URL |

Units are meters, y is up, the rim is above x = 0, z = 0 and the shooter is on +z. Sizes shared by physics and drawing are in `Physics` (`RIM_HEIGHT`, `RIM_RADIUS`, `BOARD`, `POLE`, ...).

**Sound hookup (Bom):** define `window.playSound(name)`; the game calls it with `shoot`, `swish`, `score`, `rim`, `board`, `floor`, `pole`, `buzzer`.

**Art hookup (Bom):** each function in `textures.js` returns one image (ball, court, backboard, wall). Replace the drawing with your own image of the same layout.

## Tests
`node tests/physics.test.js` checks that every spot can be scored, collisions and frame-rate independence.
`index.html?debug` shows the old 2D wireframe view instead of WebGL (useful for checking physics).

## AI use
See [GA1_AI_Use_Log.md](GA1_AI_Use_Log.md).

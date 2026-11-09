# Hoop Shot 3D

A 3D basketball shooting game built in WebGL for CMPSC 457.
Aim with the mouse, hold Space to charge, release to shoot. Score as many baskets as you can in 60 seconds.

## Team
- Justin Leddo — gameplay and physics
- Isaiah Millien — rendering
- Amit Gurung — interaction and testing
- Bom Chhetri — UI, art, and audio

## Tech
Plain WebGL with our own GLSL shaders and MV.js (no 3D engine).

## Run
Open index.html with a local web server (e.g. VS Code Live Server).

## Code layout
| File | Owner | What it does |
|---|---|---|
| ui.js, style.css | Bom | HUD, menus, power meter |
| input.js | Amit | Mouse aim, Space power, A/D spot, C camera, R restart, difficulty |
| physics.js | Justin | Ball flight (fixed 240 Hz step), floor/backboard/pole/rim collisions, basket detection |
| game.js | Justin | Menu / playing / game over, 60 s timer, scoring (2 pts, 3 from corners, +1 when on fire at 3+ streak), moving hoop on Hard |
| camera.js | Justin | Shooter, Ball Follow and Orbit views (eye/at/up for lookAt) |
| main.js | Justin | Frame loop; calls `window.renderScene(scene)` every frame |
| debug-view.js | Justin | Temporary wireframe view, only with `?debug` in the URL |

**Rendering hookup (Isaiah):** define `window.renderScene = function (scene) {...}`. `scene` has `ball.pos`, `ball.spinAxis`, `ball.spinAngle`, `hoopOffset` (translate the hoop root), `camera` (`eye, at, up, fov, near, far`), `aimPath` (easy-mode arc points) and `state`. Sizes to match are in `Physics` (`RIM_HEIGHT`, `RIM_RADIUS`, `BOARD`, `POLE`, ...). Units are meters, y is up, the rim is above x = 0, z = 0 and the shooter is on +z.

**Sound hookup (Bom):** define `window.playSound(name)`; the game calls it with `shoot`, `swish`, `score`, `rim`, `board`, `floor`, `pole`, `buzzer`.

## Tests
`node tests/physics.test.js` checks that every spot can be scored, collisions and frame-rate independence.
To play before the WebGL renderer is in, open `index.html?debug`.

## AI use
See AI_USE_LOG.md.

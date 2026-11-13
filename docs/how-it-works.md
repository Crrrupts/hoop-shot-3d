# Hoop Shot 3D — How it works

Plain-language notes so each teammate can explain their part. One section per area: rendering, physics and game rules, input, and UI. It describes the code on `main` as of Nov 12, 2026. File and function names are given so you can find the code quickly.

## The big picture

The game is plain JavaScript files loaded by `index.html`, in an order where each file only uses files loaded before it. There is no build step and no 3D engine. The only libraries are the two class files in `Common/` (`MV.js` for vectors and matrices, `initShaders.js` for compiling shaders).

Everything runs from one loop in `main.js`. About 60 times a second the browser calls `frame()`, which does four things in order:

1. `Game.update(dt)` moves the game forward by `dt` seconds: the clock, the rival, every ball, makes and misses, power-up picks.
2. `Effects.update(dt)` moves the confetti, fire, trails and the hype meter.
3. `Camera.update(dt)` moves each camera toward where it should be.
4. `window.renderScene(scene)` draws the picture. `scene` is a small object that lists the balls, the two hoops and the views to draw.

The files do not call each other's drawing or rule code directly. `game.js` announces events ("a ball went in", "a ball hit the rim") with `Game.on(...)`, and the renderer, effects and menus listen. That is why a rule change rarely needs a drawing change.

Units are meters and seconds. Y is up. Your rim is above x = 0, z = 0 and you stand on +z looking toward -z. The rival's hoop stands 15 m to the right (x = 15).

## Rendering (Isaiah)

Files: `geometry.js`, `textures.js`, `renderer.js`, `camera.js`, and the two shaders inside `index.html`.

**Shapes.** `geometry.js` builds every shape from numbers. Each function returns four lists: positions (the points), normals (which way the surface faces at each point, for lighting), texture coordinates (where each point sits on an image) and indices (which three points make each triangle).

- `sphere` is the ball: rings of latitude and longitude, like a globe.
- `torus` is the rim: a small circle swept around a big circle.
- `cube` is one unit cube. It is stretched into the backboard, pole, arm, bleachers and walls, and its front face is used for each crowd fan.
- `plane` is the court floor, `disc` is the ball's shadow and the spot markers, and `netLines` is the net, rebuilt every frame so it can sway.

`renderer.js` copies each shape into WebGL buffers once at startup (`makeMesh`).

**Transformations.** Every object is drawn by building a model matrix from translate, rotate and scale (from `MV.js`) and sending it to the shader. `drawBall` translates to the ball's position, rotates by its spin, then scales the unit sphere to the ball's radius. `drawBox` scales the one unit cube to any box size.

**Hierarchy (matrix stack).** `drawHoop` draws pole → arm → backboard → rim → net. Each part's matrix is built on top of its parent's, using `pushMatrix` and `popMatrix` to save and restore. That is why wobbling the backboard also moves the rim and net, and why the Moving Hoop power-up only has to move the root.

**Camera.** `camera.js` works out three things for each view: `eye` (where the camera is), `at` (what it looks at) and `up`. The renderer turns those into a view matrix with `lookAt`, and uses `perspective` (45° field of view) for the lens. There are three view types, switched with C: Shooter (behind you), Ball Follow (behind your newest ball) and Orbit (swings in front of the hoop from corner to corner). The camera eases toward its target each frame so it never jumps.

**Lighting.** The fragment shader does Phong shading for every pixel: ambient light, plus for each of up to 3 lights a diffuse part (brighter where the surface faces the light) and a specular part (the shiny highlight, sharper when `uShininess` is high). A light can be a spotlight with a cone that fades at its edge. Each court sets its own lights in `courts.js`. Materials are in `renderer.js`: the rim is shiny metal, the court is nearly matte.

**Textures.** `textures.js` paints each image on a hidden 2D canvas (ball skins, court floors, backboards, walls, skies, crowd fans), so the game needs no image files. `makeTexture` uploads the canvas to WebGL. The shader multiplies the texture color by the lighting. Crowd images have see-through pixels, which the shader throws away (`discard`).

**Views.** One frame can draw the scene more than once. `drawView` sets a rectangle of the canvas (`gl.viewport` and `gl.scissor`) and draws everything from one camera. In one-player there are two views: your camera on the whole canvas, then a small box with a fixed camera on the rival's hoop. In two-player there are two halves. Solid objects are drawn first, then see-through things (shadows, spot markers, weather, confetti) with blending on.

**Questions you might get.**
- *Why is the lighting done in the fragment shader?* So the highlight is worked out per pixel (Phong shading), not per corner, which looks smooth on big flat triangles like the floor.
- *What is the normal matrix for?* Normals must be rotated with the object but not moved or stretched the same way as points, so they get their own matrix (the inverse transpose of the model matrix).
- *How do the arena walls work?* It is the same cube drawn from the inside: the normals are flipped and front faces are culled instead of back faces.

## Physics and game rules (Justin)

Files: `physics.js`, `game.js`, `powerups.js`, `courts.js`, `campaign.js`, `cards.js`.

**Ball flight.** `physics.js` moves each ball in fixed steps of 1/240 of a second (`STEP`). Each step: gravity pulls the velocity down, wind pushes it sideways (if the court has wind), the position moves by velocity × time, then the collisions are checked. Because the step size is fixed, the result is the same at 30 or 144 frames per second; `update` just runs as many steps as fit in the frame.

**Collisions.** The ball is a sphere, so each check is "is the ball's center closer than one radius to this shape?"
- Floor: a flat plane at y = 0.
- Backboard and pole: boxes. The code finds the closest point on the box to the ball's center (`collideBox`).
- Rim: a torus. The code finds the closest point on the rim's circle and treats the rim as a thin tube around it (`collideRim`).

On a hit, the ball is pushed back out and its velocity is reflected off the surface, keeping only part of its speed (the restitution: floor 0.72, board 0.60, rim 0.50, pole 0.40). Courts can change these: the YMCA rim is softer, outdoor double rims are stiffer and thicker, a wet floor bounces less.

**Baskets.** A make counts when the ball's center crosses the rim's height going down while inside the rim circle (`checkBasket`). The ball also remembers if it touched the rim or board, which is how the game knows a swish from a bank shot.

**Shots.** `game.js` turns the power (0–100) and the aim into a starting velocity (`shotVelocity`): more power means more speed (6 to 9 m/s), aiming up or down changes the arc, aiming left or right turns the shot. `Physics.wouldScore` runs a whole shot instantly without drawing it; the game uses it to find the power range that scores (`makeWindow`), which gives the meter's green zone and the rival's aim. The green zone is worked out for where you are aiming right now (`aimZone`), and a release inside it is checked so it always goes in (`surePower`). Nothing in a shot is random.

**The match.** `game.js` holds two shooters (you and the rival), each with their own hoop, balls, score, streak and power-ups. `update` runs the clock, lets the rival shoot, moves the balls and decides makes and misses.
- Scoring: 2 points, 3 from the corners. Streak tiers add bonuses at 2, 4 and 7 makes in a row (`TIERS`); one miss resets the streak.
- Clock: 2 minutes. Balls in the air at the buzzer still count. Within 10 points at the end means a 1-minute overtime.
- Power-up picks: every 20–30 seconds the game pauses for up to 5 seconds. `powerups.js` holds the cards, the rarity odds and how long each effect lasts. Skipping a pick gives better odds at the next one.
- The rival (`updateRival`): on a timer it decides whether this shot should go in (its accuracy), then searches for a throw that does that, using `wouldScore`. The real throw still goes through the real physics, so sabotages like Tiny Rim really hurt it.

**Courts, campaign and cards.** `courts.js` lists each court's rules (rim, wind, rain) and its look. `campaign.js` lists the 7 stages, their rivals and boss twists, and works out stars and rewards. `cards.js` holds the ball and gear cards, chests, upgrades and the saved progress (browser `localStorage`).

**Tests.** `node tests/physics.test.js`, `node tests/rules.test.js` and `node tests/cards.test.js` run the physics and rules without a browser.

**Questions you might get.**
- *Why a fixed time step?* So the physics does not depend on the frame rate, and a fast ball cannot skip through a thin rim in one big step.
- *How is a sphere-torus collision done?* Find the nearest point on the rim's center circle, then compare the distance to (tube radius + ball radius).
- *Is the rival cheating?* It chooses make or miss by chance, but it has to find a real throw, and the ball obeys the same physics as yours.

## Input (Amit)

File: `input.js` (and the aiming part of `main.js`).

**Keys.** `keydown` and `keyup` listeners on the page handle everything: Space starts and ends a charge, A / D change spot, C changes camera, R restarts. In two-player, Player 2 uses Enter to charge, the arrow keys to move their crosshair and J / L to change spot. `e.repeat` is checked so holding a key does not fire it many times, and `preventDefault` stops Space or the arrows from scrolling the page.

**Power.** When Space goes down, `input.js` remembers the time (`chargeStart`). Power is worked out from how long the key has been held (`chargedPower`), using the browser's clock and the key event's own timestamp, not counted up frame by frame. So the same hold always gives the same power, even if the game drops frames. On release, `input.js` hands the power and aim to the game with `window.onShoot(power, aimX, aimY)` and resets the meter. Power-ups can change the charge speed through `window.chargeSpeedScale`.

**Aiming.** Each player has a crosshair, stored as a position in canvas pixels (`crosshairs`). `main.js` (`updateAim`) finds where the rim is on the screen and turns the crosshair's distance from it into `aimX` and `aimY` between -1 and 1. Crosshair on the rim is perfect aim (a little to one side in wind). After every shot the crosshair jumps to a random place so you have to aim again.

**Pointer lock.** While you play, the browser hides the mouse pointer and keeps it inside the game (`lockPointer`), and reports only how far the mouse moved. That way the pointer can never hit the edge of the screen. The lock is released for menus, power-up picks and results; Esc releases it; a click on the game locks it again. If the browser refuses the lock, the crosshair follows the pointer instead.

**Difficulty.** The slider picks one row of `DIFFICULTY_SETTINGS`: how fast the meter charges. `game.js` also uses the difficulty to choose the rival, to show the golden aim dot on Easy and to hide the green zone on Hard.

**Talking to the rest of the game.** `input.js` does not know the rules. It keeps a few plain variables (`power`, `charging`, `currentSpot`, `currentCamera`, `aimX`, `aimY`) that other files read, and it calls three hooks: `window.onShoot`, `window.onShoot2` and `window.onRestart`.

**Questions you might get.**
- *Why not just use the mouse position for aim?* The crosshair has to be able to jump after a shot, and a real mouse pointer cannot be moved by a web page. So the crosshair is our own, moved by how far the mouse moves.
- *How does one keyboard serve two players?* Each player has separate keys and separate variables (`power` and `power2`, and so on), and both sets are read every frame.

## UI (Bom)

Files: `index.html`, `style.css`, `ui.js`, `menus.js`, plus `effects.js` and `crowd.js` for game feel.

**Layers.** The page is the WebGL canvas with ordinary HTML on top of it. `#ui-layer` is a box the same size as the canvas, placed exactly over it, with `pointer-events: none` so the mouse passes through to the game. Everything in the HUD (scores, clock, power meter, crosshair, floating text) is a normal HTML element positioned inside that box with CSS.

**The HUD.** `ui.js` is a set of small functions the game calls: `updateScore`, `updateTime`, `updateStreak`, `updatePowerMeter`, `updateEffects`, `showBanner`, `showToast`, and so on. Each one changes the text or style of an element. The game never touches the page itself, so the look can change without touching the rules. Scores count up one point at a time instead of jumping.

**The scoreboard matches the court.** Each court in `courts.js` has scoreboard colors, border and font. `showCourt` copies them into CSS variables (`--sb-bg`, `--sb-text`, ...) and `style.css` uses those variables, so one set of HTML gets a different look per court.

**The power meter.** The fill's height is the power percent. The green zone is an extra box placed by `setSweetZone` using percentages from the game (`Game.aimZone`), updated as the crosshair moves.

**Power-up pick.** `showPick` shows two cards and flashes them through the rarity colors before landing (a small slot-machine effect), with a timer bar. Click a card or use the keys. Two-player has its own screen with two cards per player.

**Menus.** `menus.js` shows one screen at a time inside `#menu-overlay`: main menu, Quick Match, 2 Players, Campaign map, Cards, and the result screen with stars and chest cards. It also runs the tutorial (a list of steps, each with a message and a test for "done") and the Sandbox panel under the game.

**Game feel.** `effects.js` listens for game events and keeps lists of particles (confetti, fire, smoke) and ball trails for the renderer to draw. It also raises the hype meter and asks `ui.js` for floating text ("+2", "SWISH!") at the rim's place on the screen. `crowd.js` decides where fans stand and how high each one is jumping.

**Sound and art hooks.** There is no audio in the game yet. The code already calls `window.playSound(name)` for every event (the list is in the README), so adding sound means defining that one function. Every image comes from a function in `textures.js`, so real art can replace one function at a time.

**Questions you might get.**
- *Why HTML for the HUD instead of drawing it in WebGL?* Text, layout and animation are much easier in HTML and CSS, and it stays sharp at any size. WebGL is used for the 3D scene only.
- *How does floating text know where the rim is?* The renderer exposes `worldToScreen`, which runs a 3D point through the same view and projection matrices the picture used and returns its pixel position.

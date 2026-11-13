# Hoop Shot 3D

A 3D basketball shooting game built in WebGL for CMPSC 457.
Aim with the mouse, hold Space to charge, release to shoot. Race an AI rival who shoots at their own hoop: most points in 2 minutes wins.

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
The game fills the browser window and keeps its 4:3 shape; the Fullscreen button under the game makes it fill the screen.

Mouse: move the crosshair (on the rim = perfect aim; it jumps to a new place after every shot; the game keeps the mouse inside itself while you play, press Esc to free it, click the game to lock it again) | hold Space: charge power, release to shoot | C: change camera | R: restart | slider: difficulty. A / D change spot in the Sandbox only; in a match the game moves you. The Orbit camera swings in front of the hoop from corner to corner (never behind it); drag the mouse to turn it. On a power-up pick: click a card, or Left arrow / 1 for the left card and Right arrow / 2 for the right card.

## Modes
- **Campaign** (main mode): 7 stages, one per court, easiest to hardest. Each is a race against that court's boss, who has a twist (listed on the campaign screen). A win earns 1–3 stars (win, win by 10+, win without picking a sabotage), gold and a chest, and unlocks the next stage. The first stage starts with an 8-step tutorial (aiming and the power bar, the moving green zone, 5 shots per spot, the money spot, rapid fire and streaks, the fan meter, the 5-second pick and the skip bonus), then a normal 2-minute race against Coach. The race is scripted to stay within 10 points so it always goes to overtime, where you are offered a mythic card and Coach stops scoring, so you win.
- **Quick Match**: pick any court; the Difficulty slider sets the rival.
- **2 Players**: two people on one computer, split screen (Player 1 left, Player 2 right). No online play.
  | | Player 1 | Player 2 |
  |---|---|---|
  | Move crosshair | Mouse | Arrow keys |
  | Shoot | Hold Space | Hold Enter |
  | Pick a card | 1 / 2 | Left / Right arrow |

  Each player gets their own two cards at a pick and the game waits for both. It uses the better multiplayer odds, power-ups reset every match, gear cards are off, and a coin flip gives one player home court (the crowd cheers that player's makes).
- **Sandbox**: free shootaround with no clock and no rival. A panel under the game lets you change court and ball, switch any power-up or sabotage on yourself and set its level, show the golden aim dot and the power zones, use slow motion, reset the balls, and see makes/attempts per spot.
- **Player**: pick your player's skin tone (6) and hair style (short, buzz cut, afro, flat top, ponytail, bald), with a preview. Saved with your progress. Shirt, shorts and shoes are fixed for now.
- **Cards**: chests give ball skins (looks only) and gear. Duplicates plus gold level a card up (max level 5). Gear: Headband (steadier aim), Shooting Sleeve (slightly bigger rim for you), Wristband (once a game a miss may keep your streak). Progress is saved in the browser on this computer.

## How a match works
- **Live race.** You and the rival shoot at the same time at your own hoops. The small box on the left is a live camera on the rival's hoop.
- **Shoot as fast as you want.** A new ball is ready as soon as the last one leaves your hands, so several balls can be in the air.
- **The shooter.** Each player is a 3D figure standing on their spot and holding the ball. The motion follows the power bar: the knees bend and the ball rises from the chest as the bar fills (it is above the head from 60% power), the ball leaves when you let go, and the shooter follows through with a small hop and arms up. The AI rival winds up before each of its shots.
- **Spots.** Everyone starts at spot 1 (left corner) and shoots 5 times from each spot, 1 to 5 in order and around again. The game moves you after the 5th shot. The HUD shows "Spot 2, shot 3 of 5".
- **Scoring.** 2 points, 3 from the corner spots.
- **Score cap.** Bonuses multiply (Inferno, Golden Ball, Money Rack, the money spot), so a single basket is capped at 12 points.
- **Shot order.** With several balls in the air, results count in the order the shots were taken: a later make waits until every earlier shot has landed, so it never counts before an earlier miss. The net and the swish sound still react at once.
- **Race bar.** The bar at the top shows both scores, each player's share of the points, and who leads by how much.
- **Money spot.** Before the game each player picks one spot (on the menu) where every make counts double. It has a green ring on the floor and shows in the HUD. The AI rival picks its spot at random.
- **Streak tiers.** 2 makes in a row = Heating Up (+1 per basket), 4 = On Fire (+2), 7 = Inferno (points x2, then +2). One miss drops you to zero.
- **Power-up picks.** The two cards spin like slot-machine reels: they flick through rarities, slow down, tease one rarity higher, then land (left after 1 second, right after 1.5), with ticks, a glow in the rarity's color, and a flash and fanfare for rare or better. A card can be chosen once it has landed. Every 20–30 seconds (the first one comes early, at your 2nd make, if that is in the first 20 seconds) the game pauses and you pick one of two cards: a buff for you or a sabotage for the rival. You have 5 seconds. If you do not pick, you get no card, but your next pick's odds move one step toward rarer cards. Picking a card you already have levels it up. Mythic cards only appear in overtime; none are designed yet, so overtime cards are legendary for now. The one exception is the **Placeholder Mythic**, marked as a placeholder, which only the tutorial race hands out. The 22 cards and the rarity odds are in `powerups.js`.
- **Clock.** 2 minutes. Shots in the air at the buzzer still count. If the scores are within 10 points when the clock ends, there is a 1-minute overtime that starts with a pick. After overtime, whoever is ahead wins (level scores are a tie).
- **Difficulty slider.** Easy / Medium / Hard changes how fast the meter fills and the rival (how often it scores, how fast it shoots, which cards it can pick). The AI rival also reacts to the score: up to 10% better when it is behind, up to 10% worse when it leads by more than 10. Easy also shows the golden aim dot. Hard hides the green zone.
- **Power meter.** Power comes from how long you hold Space, timed with the clock, so the same hold always gives the same power. The green zone is the power that scores for where you are aiming right now: it moves and changes size as you move the crosshair, and disappears if no power would score from that aim. A release in green goes in. Nothing about a shot is random: the same power and aim always give the same throw.
- **Aiming.** Crosshair on the rim is perfect aim. The golden dot (Easy, or the Guide Line card) marks the best spot; in wind it sits to one side of the rim. Shaky Hands and rain make the crosshair shake, and the shot goes exactly where the crosshair is.
- **Rim and backboard.** A hit keeps part of the ball's speed and rubs off some sideways speed. A soft touch on the rim does not bounce: the ball rolls on the rim and drops in or falls off. A ball that comes to rest on the rim is eased toward the middle after 0.8 seconds so it never gets stuck. The numbers are at the top of `physics.js` (`RESTITUTION`, `GRIP`, `ROLL_SPEED`).
- **Fan meter.** The bar at the top shows which player the crowd backs. It starts on the home team's side (you, against the AI; the coin-flip winner in two-player) and slowly drifts back there. Makes pull it your way (more for swishes, threes, streak tiers and a run of 8+ points); misses and air balls pull it toward your opponent. The crowd cheers the player it backs and boos the other. Leaning your way makes your green zone up to 3 power points wider on each side. A full meter keeps you On Fire until you miss or your opponent catches fire, and while it lasts your opponent's green zone is 35% smaller (green still always goes in).
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

The wind when you release is the wind that ball gets. The HUD shows it for the spot you are standing on (arrows = sideways push), and the golden aim dot moves to the side to show how far to aim off.

## Crowd and game feel
- The crowd size matches the court: 5 at the YMCA, 30 at the Home Gym, 40 at the Neon Arcade, 160 packed into 4 rows at the Pro Arena, and 5 or 6 standing at each outdoor court. Fans with the same shirt are drawn in one batch so a big crowd stays fast.
- The crowd is flat cut-out cards that bob. They jump when you score, bounce more as the **hype meter** fills, and stomp together in intense moments (last minute of a close game, overtime, or when you are On Fire).
- Makes throw confetti and float "+2" from the rim; swishes, bank shots, rim-outs ("SO CLOSE!") and air balls get their own text.
- Heating Up gives the ball an orange trail, On Fire covers it in fire and burns the net, Inferno turns the lights red-orange and makes the rim glow. Losing the streak puffs out smoke.
- The last 10 seconds turn the timer red. A shot still in the air after the buzzer drops in slow motion.

## Docs
- [docs/how-it-works.md](docs/how-it-works.md): plain-language notes on rendering, physics, input and UI, so each teammate can explain their part.
- [docs/next-steps.md](docs/next-steps.md): the current task list and decisions.
- [docs/review-checklist.md](docs/review-checklist.md): what the team needs to check by playing, and the known gaps.
- [docs/design-bible.md](docs/design-bible.md): the full design. Its "What is built" table says which parts are in the game.

## Graded requirements checklist
The 9 graded requirements, where each one is in the code, and how to see it in the game. Recheck this list after every change. Last checked on 2026-11-12 (all 9 seen working in the browser).

| # | Requirement | Where it is in the code | How to see it in the game |
|---|---|---|---|
| 1 | Own 3D geometry | `geometry.js` builds every shape from numbers: `sphere` (ball, the shooter's head and hands), `torus` (rim), `cube` (backboard, pole, arm, walls, bleachers, crowd cards, the shooter's body), `plane` (court), `disc` (shadows, spot markers), `netLines` (net). No model files | Start any match. Everything on screen is one of these shapes |
| 2 | Transformations | `renderer.js`: `drawBall` translates, rotates (spin) and scales the unit sphere; `drawBox` scales one unit cube into the backboard, pole, arm and bleachers | Shoot: the ball moves and spins. The backboard and the pole are the same cube at different sizes |
| 3 | lookAt camera, 3 views | `camera.js` works out eye / at / up for the Shooter, Ball Follow and Orbit views; `renderer.js` `drawView` calls `lookAt` and `perspective` | Press C during a match to switch between the 3 views. In Orbit, drag the mouse |
| 4 | Interaction | `input.js`: mouse (crosshair), Space (power), C (camera), R (restart), the difficulty slider, and A / D (spot) in the Sandbox | Use the mouse, Space, C, R and the slider in a Quick Match. Use A / D in the Sandbox (in a match the game moves you between spots) |
| 5 | Animation | `main.js` frame loop (`requestAnimationFrame`); `physics.js` ball flight; `renderer.js` springs for the net, rim and backboard; `shooter.js` shooting motion; `game.js` `updateHoop` slides the hoop | Shoot and watch the ball fly, the net stretch on a make, and the rim and board shake on a hit. For the moving hoop open `index.html?test=moving`, or tick Moving Hoop in the Sandbox |
| 6 | Lighting (Phong) | The fragment shader in `index.html`: ambient + diffuse + specular for up to 3 lights, with spotlight cones. Lights are set per court in `courts.js`; materials in `renderer.js`. Reflections are lit by mirrored lights (`drawReflection`) | Home Gym: the spotlight pool on the floor, the shine on the varnished floor and the bright highlight on the rim. The Blackout card (Sandbox) leaves one spotlight on the hoop |
| 7 | Advanced: collisions and physics | `physics.js`: gravity with a fixed 240 Hz step, sphere against floor, backboard and pole (boxes) and rim (torus), basket detection. Checked by `tests/physics.test.js` | Miss on purpose: the ball bounces off the rim, the board and the floor. A make only counts when the ball drops through the rim |
| 8 | Advanced: texture mapping | `textures.js` paints the images (ball, court floors, backboards, walls, skies, crowd); the texture coordinates come from `geometry.js`; `renderer.js` `makeTexture` uploads them | The ball's seams, the court lines and the backboard square. Change court on the menu to see different floors and skies |
| 9 | Advanced: hierarchical modeling | `renderer.js`, drawn with a matrix stack (`pushMatrix` / `popMatrix`). `drawHoop`: pole → arm → backboard → rim → net. `drawShooter`: hips → thigh → shin → foot, and torso → head, and upper arm → forearm → hand; the joint angles come from `shooter.js` | A hard shot off the backboard wobbles the board, and the rim and net move with it. With Moving Hoop (`index.html?test=moving`) only the root moves and every part follows. Hold Space: the shooter's knees, elbows and shoulders bend, and each lower part follows the part above it (Orbit camera shows it best) |

## Code layout
| File | Role area | What it does |
|---|---|---|
| index.html, ui.js, style.css | Bom | Page, HUD, menus, power meter, power-up pick screen. index.html also holds the GLSL shaders |
| input.js | Amit | Mouse aim, Space power, A/D spot, C camera, R restart, difficulty; Player 2's keys |
| physics.js | Justin | Ball flight (fixed 240 Hz step), floor/backboard/pole/rim collisions, basket detection, for any number of balls and hoops |
| game.js | Justin | The match: shooting, scoring, streak tiers, clock and overtime, the AI rival, power-up picks, game events (`Game.on`) |
| powerups.js | Justin | The 20 power-up cards, rarity odds tables, and how effects are stored and counted down |
| courts.js | Justin, Bom | The 7 courts: rules (rim, wind, rain) and looks (colors, lights, sky, weather) |
| effects.js | Justin, Bom | Game feel: hype meter, confetti, fire, smoke, ball trails, floating text, slow motion, sound hooks |
| crowd.js | Bom | Where the fans stand (size and rows per court, gaps behind the hoops) and how high each one jumps |
| cards.js | Justin, Bom | Ball and gear cards, chests, upgrades, saved progress |
| campaign.js | Justin | The 7 campaign stages (rival numbers, boss twists), stars and rewards |
| menus.js | Bom | Menu screens, result and chest opening, tutorial steps, sandbox panel |
| shooter.js | Isaiah | The 3D player's pose (joint angles for the shooting motion, driven by the power bar), skin tones and hair styles |
| audio.js, sounds/ | Bom | Every sound, made in code; real files in `sounds/` replace them |
| camera.js | Justin | Shooter, Ball Follow and Orbit views (eye/at/up for lookAt), one camera rig per player, plus the fixed rival camera |
| main.js | Justin | Frame loop; calls `window.renderScene(scene)` every frame |
| layout.js | Bom | Scales the whole game (canvas, HUD, menus) to fit the window; the Fullscreen button |
| geometry.js | Isaiah | Builds every mesh in code (positions, normals, texture coordinates, triangles) |
| textures.js | Isaiah, Bom | Placeholder textures painted on 2D canvases (swap in real art here) |
| renderer.js | Isaiah | WebGL setup, materials, lights, matrix stack, draws the main view and the small rival view, or a split screen for two players; floor reflections, soft shadows |
| tests/ | Amit | `physics.test.js`, `rules.test.js`, `cards.test.js`, `shooter.test.js` and `crowd.test.js`, run with node |

Units are meters, y is up, the rim is above x = 0, z = 0 and the shooter is on +z. Sizes shared by physics and drawing are in `Physics` (`RIM_HEIGHT`, `RIM_RADIUS`, `BOARD`, `POLE`, ...).

**Sound (Bom):** every sound is made in code by `audio.js` (Web Audio, no files), so the game has placeholder sound for every event. To replace one with a real recording, put the file in `sounds/` named after the sound (for example `swish.mp3`) and add its file name to `sounds/list.js`. Sound names: `shoot`, `swish`, `score`, `rim`, `board`, `floor`, `pole`, `buzzer`, `cheer`, `chime` (rises in pitch with the streak), `groan`, `gasp`, `airball`, `hiss`, `fire`, `stomp`, `tick`, `boo`, `reel`, `land`, `fanfare`. Use only free-to-use or self-recorded audio and list credits in this README. The Sound box under the game turns it off (the choice is saved).

**Art hookup (Bom):** each function in `textures.js` returns one image (ball, court floor, backboard, wall, sky, crowd fan). Replace the drawing with your own image of the same layout. Court colors are in `courts.js`.

## Tests
```
node tests/physics.test.js
node tests/rules.test.js
node tests/cards.test.js
node tests/shooter.test.js
node tests/crowd.test.js
```
The first checks that every spot can be scored, the collisions, and frame-rate independence. The second checks the match rules: streak tiers, rapid fire, power-up odds and effects, the rival's accuracy, the buzzer, overtime, the court rules (soft rim, double rim, rain, wind), practice mode, boss twists, two-player rules and a whole simulated match. The third checks chests, upgrades, gear and campaign stars and unlocks.

To check speed on a laptop, add `?stats` to the page address: the top-left corner shows frames per second, the slowest frame, how long the game's own code takes per frame, and how many objects are drawn.

For testing in the browser, add to the page address: `?length=30` for a short game, or `?test=moving,fog` to start with those power-ups on you (ids are in `powerups.js`).

## AI use
See [GA1_AI_Use_Log.md](GA1_AI_Use_Log.md).

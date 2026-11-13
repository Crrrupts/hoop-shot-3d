# Hoop Shot 3D — Design Bible

Exported Nov 11, 2026 from the live doc: https://claude.ai/artifact/PtSqWJ1oB9T9DCjnBMMoy2. This repo copy was updated on Nov 12, 2026 to match the code on `main`: rule numbers were corrected, and the table below says what is built and what is still only an idea. Newer decisions are in [next-steps.md](next-steps.md), which wins where the two disagree.

## What is built

Everything in this doc is a design. This table is the truth about the game on `main` today. Anything in the right-hand column is **not in the game**.

| Area | In the game now | Not built (ideas only) |
| --- | --- | --- |
| Graded requirements | All 9, see the checklist in the README | |
| Match rules | Live race against an AI rival, shoot as fast as you want, 2-minute games, 1-minute overtime when within 10 points, power-up picks, moving hoop as a power-up | Home court in campaign (the crowd always backs you); power-ups carrying between matches |
| Courts | All 7 courts with their own floor, walls or sky, lights and gameplay rules (soft rim, double rim, wind, rain, snow) | The signature details: swaying banners, string lights, jumbotron replays, Ferris wheel as a 3D object (it is painted on the sky), pulsing floor grid, fogged breath, light that changes during a match |
| Crowd | Cut-out fans that bob, jump on your makes, bounce with the hype meter and stomp together in intense moments | All crowd sound (cheers, chants, "AIR BALL", counting down), camera flashes, fans standing up, the crowd backing the other player |
| Ball designs | 9 ball skins as cards (texture and shine only) | Glow and Lava do not glow in the dark; Snowball sheds no flakes |
| Cards and upgrades | Chests from campaign wins, duplicates plus gold level a card up (max level 5), Headband, Shooting Sleeve and Wristband gear | Shoes; perks on balls; card art |
| Hoop designs | Each court colors the backboard, rim, pole and net | Glass or fan-shaped backboards, chain net sound, LED strip, shot clock, towel, icicles, breakaway rim as a separate part |
| Animations | Power meter pulse, ball dip while charging, camera push-in, ball trail, "+2" and confetti, SWISH / BANK / SO CLOSE / AIR BALL text, backboard flash, rim shake, net stretch, red timer in the last 10 seconds, slow-motion buzzer beater, squash on floor bounces, backspin | All sounds; swish zoom on the net; orbit camera on a buzzer beater; stats counting up on the game-over card; a ball rolling around the rim; wrist flick detail on the follow-through |
| Heating up | The three tiers at 2, 4 and 7 makes with their scoring, banner, orange trail, fire on the ball and net, screen glow, red-orange lights and glowing rim, smoke when the streak ends | Announcer lines, faster music, crowd chants |
| Casino feel | Hype meter, streak hint ("1 more for ON FIRE"), scores that count up, bigger celebrations for bigger shots, "SO CLOSE!", Money Rack, tier colors on the screen, cards that flash through rarities before landing | Court lights pulsing with hype, slow motion on every on-target shot, a chime that rises with the streak (the hook exists, there is no sound), music layers |
| Campaign | 7 stages, one boss race per court with its twist, stars, gold, chests, the tutorial | Rival personalities and habits, several matches per court, Archero-style runs, permanent upgrades bought with gold, daily challenge |
| Sandbox | Everything listed in the Sandbox section | |
| Multiplayer | Two players on one computer, split screen | Online play |
| Power-ups | The 21 cards in the list below | Mythic cards (overtime cards are legendary until they are designed) |
| Sound | Nothing. The game calls `window.playSound(name)` for every event, but no sounds exist yet | All audio |
| Playable link | A private preview artifact | GitHub Pages (needs the repo setting turned on) |

## Graded requirements come first

The features below are what gets graded, so they are built first and must stay working through every later change. Everything else in this doc is extra and only gets added on top of a working graded game. Game mechanics should feel smooth throughout.

**Who writes the code:** the code is AI-generated (Claude), directed and reviewed by Justin, with the team's permission to update everyone's code. Isaiah, Amit and Bom helped brainstorm and design the game and will be credited for it. AI use is recorded in the AI Use Log. The Owner column shows each person's role area.

**Bom's roles (UI, art and audio):**

- **Art direction:** sets the look of each court, ball and hoop, and approves visuals before they go in.
- **Textures and card art:** finds or makes the court floor, ball skin and backboard images, plus the art for power-up and gear cards.
- **Sound:** picks or records crowd cheers, foot stomps, swishes, rim clanks, the buzzer and the announcer lines. The team handles sound; use only free-to-use or self-recorded audio and art, and list credits in the README.
- **Screens:** sketches the menus, power-up pick screen, chest opening and game-over card.
- **Feel check:** plays each build and flags anything that looks or sounds off.

| Requirement | How we meet it | Owner | Status |
| --- | --- | --- | --- |
| Own 3D geometry (Ch. 2–3) | Sphere ball, torus rim, cube backboard and pole, plane court, line net, all generated in code | Isaiah | Done |
| Transformations (Ch. 4) | Ball moves and spins each frame; one unit cube scaled into board and pole | Isaiah | Done |
| lookAt camera (Ch. 5) | Perspective + lookAt; shooter, ball-follow and orbit views | Justin | Done |
| Interaction (Ch. 3) | Mouse crosshair aim, Space power, A/D spot, C camera, R restart, difficulty slider | Amit | Done |
| Animation (Ch. 3) | Frame loop, ball flight, power meter, net sway, moving hoop | Justin, Isaiah | Done |
| Lighting (Ch. 6) | Phong shading: overhead spotlights + ambient (lights set per court); shiny rim, matte court | Isaiah | Done |
| Advanced: collisions and physics | Gravity, floor/board/rim bounces, basket detection | Justin | Done |
| Advanced: texture mapping | Ball leather, wood court, backboard square, with our own UVs | Isaiah | Done |
| Advanced: hierarchical modeling | Pole → arm → board → rim → net with a matrix stack; only the root moves when the Moving Hoop power-up is on | Isaiah | Done |

**Keeping them done:** after every merge, run the physics tests and play one full game to check each row still works. A new feature that breaks a graded row gets fixed or pulled before anything else.

**Handoff rules for the AI building it:** the team does the real playtesting, so each build only needs to be bug-checked and ready to send.

1. Work in small chunks; each chunk ends with a push to GitHub.
2. Before pushing: run the tests, check the browser console for errors, and play one full game to the end.
3. Never break a graded requirement; if one breaks, fix it before anything else.
4. Every push updates a playable link (GitHub Pages) so the team can open the game in a browser with no setup.
5. Each push comes with a short note: what changed, what to test, and any known bugs.
6. Log each AI session in the AI Use Log.

## Match rules

These are the decided rules for how a match plays.

- **Live race:** you and your opponent shoot at the same time at your own hoops, and both scores show live. Campaign always has an AI opponent.
- **Shoot as fast as you want:** a new ball is ready as soon as the last one leaves your hands, so several balls can be in the air at once.
- **Home court:** in two-player a coin flip at the start decides home court, and the crowd cheers that player's makes. Against the AI the crowd always backs you. (Ideas not built: the player choosing in campaign, and the crowd getting loud during your opponent's shots.)
- **Power-ups last the whole game** and reset after every match, in every mode. (Carrying them between campaign matches is not built.)
- **Moving hoop is a power-up**, not a difficulty setting.
- **Game length:** 2 minutes, with a 1-minute overtime when the scores are within 10 points at the end. After overtime whoever is ahead wins.

**Multiplayer** is local only: two players on the same computer, split screen. There is no online play. Multiplayer is the fast-paced mode, with better power-up odds than campaign.

## Courts and fan atmosphere

Six starter court ideas, each with its own crowd, sound and lighting so they feel different, not just reskinned. Cut, rename or add freely.

| Court | Setting | Floor | Lighting | Crowd and sound | Signature detail |
| --- | --- | --- | --- | --- | --- |
| Home Gym | Old high school gym | Scuffed maple wood, painted school logo | Flat fluorescent overhead, one tube flickering | ~30 people on pull-out bleachers, parents yelling, pep-band drum, sneaker squeaks | Hanging championship banners that sway when the crowd cheers |
| Rooftop | City rooftop at sunset | Cracked asphalt, faded painted lines | Golden hour that fades to night with string lights | A few people leaning on the fence, boombox beat, loud "OHHH" on makes, traffic below | Chain-link fence and a chain net |
| Pro Arena | Packed stadium | Polished hardwood, big center logo | Dark stands, bright spotlight on the court | Huge crowd, camera flashes, organ stings, "DEFENSE" chants | Jumbotron replays your best make |
| Boardwalk | Beach court by the pier | Sun-bleached concrete with sand at the edges | Bright afternoon sun, long shadows | Relaxed crowd in beach chairs, steel drums, seagulls, waves | Palm trees and a pier Ferris wheel in the background |
| Neon Arcade | Synthwave arena | Black glossy floor with a glowing grid | Black light, pink and cyan neon edges | Crowd as glowing silhouettes, synth music, a beat drop on every make | Floor grid pulses with the music |
| Frozen Lake | Outdoor court on ice at night | Ice with a slight reflection | Moonlight plus warm lamp posts | Bundled-up crowd, mittens clapping, wind gusts, crunching snow | Falling snow, and fogged breath on the camera in cold moments |

**Courts that change gameplay.** Some courts are only cosmetic; others make scoring easier or harder. The YMCA Gym is a new court and the easiest place to shoot. Which outdoor court gets wind and which gets rain is a first pass.

| Court | Difficulty | What changes |
| --- | --- | --- |
| YMCA Gym (new) | Easiest | Bright, even lighting, no wind, a soft forgiving rim; the place to learn |
| Home Gym | Normal | Cosmetic only |
| Pro Arena | Normal | Cosmetic, but the loudest crowd |
| Neon Arcade | Normal | Cosmetic only |
| Rooftop | Hard | Outdoor double rim (stiffer, so more bounce-outs), plus rain that makes the ball slippery and the floor bounce less |
| Boardwalk | Hard | Outdoor double rim, plus sea wind that pushes the ball sideways |
| Frozen Lake | Hardest | Outdoor double rim, gusting wind and falling snow |

**How the crowd reacts (same rules on every court, different sounds):**

- **Hype meter** rises with makes and streaks, drops slowly over time. Higher hype means louder crowd, more fans standing, more flashes.
- **Make:** cheer sized to the shot (bigger for 3s and swishes).
- **Miss:** groan; **air ball:** the crowd chants "AIR BALL".
- **Last 10 seconds:** the crowd counts down out loud.
- **Buzzer beater:** the whole crowd jumps and the lights flash.

**Intense moments:** in the last minute of a close game, in overtime, or when someone is On Fire, the crowd stomps its feet in sync like a real arena, getting louder the closer the score is.

Build note for the class version: crowd fans can be flat textured cards that bob up and down. That's cheap in WebGL and still reads as a crowd from the shooter camera.

## Basketball designs

Nine ball ideas, from the default up to a top-tier unlock. Each one is just a different texture and shininess on the same sphere, so they're cheap to add.

| Ball | Look | Card rarity |
| --- | --- | --- |
| Classic | Orange leather, black seams | Common (starter) |
| Street | Worn rubber, scuffed and faded | Common |
| Retro Tricolor | Red, white and blue panels | Rare |
| Watermelon | Green stripes, a seed pattern | Rare |
| Glow | Dark ball with glowing neon seams | Epic |
| Snowball | Packed snow, sheds flakes in flight | Epic |
| Disco | Mirror tiles that sparkle under the lights | Legendary |
| Lava | Cracked black rock with orange glowing cracks | Legendary |
| Gold | Polished gold, very shiny highlight | Mythic |

Balls are earned as cards from chests (see Card collection and upgrades).

## Card collection and upgrades

Balls and player gear are earned like cards in Clash Royale: you win chests, collect cards, and combine duplicates with gold to level them up.

1. Winning a campaign match earns a chest, with better chests for more stars.
2. Opening a chest gives random cards (balls and gear), each with a rarity.
3. Duplicate cards plus gold level a card up.
4. Higher levels give bigger perks.

**Gear.** Three gear cards are in the game. Balls only change the look.

| Gear | What leveling it up does in the game |
| --- | --- |
| Headband | Steadier aim: 12% less wobble per level |
| Shooting sleeve | Your rim counts 1.2% bigger per level, which widens the power that scores. (It does not draw a wider zone on the meter by itself.) |
| Wristband | Once a game, a miss may keep your streak: 20% chance per level, so always at level 5 |
| Shoes | Not built. Switching spots is already instant |

## Hoop designs

Every court gets a hoop that matches it, built from the same parts (pole, backboard, rim, net) with different materials. The physics sizes stay the same, so only the look changes.

| Court | Backboard | Rim | Net | Extra |
| --- | --- | --- | --- | --- |
| Home Gym | White painted wood, red shooter's square | Orange, slightly rusty | White nylon | Padding on the bottom edge of the board |
| Rooftop | Metal fan-shaped board, dented | Bent a little, chipped paint | Metal chain | Chains rattle on makes |
| Pro Arena | Clear glass | Breakaway rim | Clean white nylon | LED strip on the board edge lights up on makes; shot clock on top |
| Boardwalk | Weathered wood planks on a wooden post | Orange | Slightly torn nylon | A towel hanging off the pole |
| Neon Arcade | Black glass with neon outline | Glowing tube that changes color with your streak | Glowing strands | Board flashes on makes |
| Frozen Lake | Frosted glass with ice at the edges | Silver, frosty | White nylon with icicles | Icicles drop off when the rim is hit |

**Hoop animations (shared by all hoops):**

- **Rim hit:** rim shakes and the backboard wobbles for half a second.
- **Make:** net ripples, stretching down then springing back.
- **Swish:** cleaner, faster net snap with no rim shake.
- **Very hard shot:** breakaway rim bends down and pops back up.

## Animations

Every key moment gets a visual, a sound and a camera move, so each one feels like a different event.

| Moment | Visual | Sound | Camera |
| --- | --- | --- | --- |
| Charging | Power meter pulses faster near full; ball dips in the hands | Rising hum | Slow push-in |
| Release | Faint arc trail behind the ball | Whoosh | Follows the ball (Ball Follow view) |
| Make | "+2" or "+3" floats up from the rim; small confetti burst | Net swish plus crowd cheer | Tiny shake |
| Swish | "SWISH!" text, bigger confetti | Clean snap, louder cheer | Quick zoom on the net |
| Bank shot | "BANK!" text, backboard flashes | Thud then swish | — |
| Rim-out miss | Rim wobble | Clank, crowd "awww" | — |
| Air ball | Ball sails past, "AIR BALL" text | Crowd chant | — |
| Last 10 seconds | Timer turns red and pulses | Countdown beeps, crowd counts | — |
| Buzzer beater | Slow motion as the ball drops in, lights flash | Buzzer, then a huge cheer | Slow orbit around the hoop |
| Game over | Scoreboard slides in, stats count up | Final horn | Pulls back to a wide shot |

**More realistic ball and hoop motion:**

- **Spin:** real backspin in flight, and the ball spins differently after it hits the rim.
- **Squash:** the ball flattens slightly on hard floor bounces.
- **Rim rolls:** a ball can roll around the rim before dropping in or falling out.
- **Net:** moves like cloth, catching and slowing the ball.
- **Settling:** bounces get lower and lower, then the ball rolls to a stop.
- **Release:** the ball rises from chest height to above the head before it leaves the hands.

## Heating up and On Fire

Streaks climb through three tiers, starting at just 2 makes, and each one changes the look, the sound and the scoring. One miss drops you all the way back to zero. The current code already gives +1 per basket at 3 in a row; these tiers would replace that.

| Makes in a row | Tier | Look | Sound | Scoring |
| --- | --- | --- | --- | --- |
| 2 | Heating Up | "HEATING UP" banner across the screen; ball leaves an orange trail | Announcer: "He's heating up!" | +1 per basket |
| 4 | On Fire | Ball covered in fire; the net burns on makes; screen border glows orange | Fire whoosh; faster music | +2 per basket |
| 7 | Inferno | Court lighting turns red-orange; the rim glows; crowd on its feet | Crowd chants nonstop | Points x2 |

**When the streak ends:** the fire puffs out into smoke with a hiss, and the crowd groans. The lighting fades back to normal over 1 second.

## Game feel: casino-style action

The goal is the constant energy of a casino floor: something is always moving, every result gets a reaction, and big moments build up before they pay off. We borrow the feel only, with no real money or paid randomness.

| Casino trick | How it shows up in Hoop Shot 3D |
| --- | --- |
| Something is always moving (chasing lights, spinning reels) | Court lights pulse with the hype meter; the crowd is never fully still; score numbers count up instead of jumping |
| Build-up before the reveal (reels slow down one by one) | A shot on target goes slow-motion for its last moment at the rim; power-up cards spin before landing on a rarity |
| Bigger wins get bigger celebrations | +2 gets a small burst, a swish a bigger one, a new streak tier takes over the whole screen; a legendary card flashes the screen gold |
| Near misses keep you playing | A rim-out shows "SO CLOSE!" and the crowd gasps |
| Meters that visibly fill toward the next prize | Hype and streak meters always on screen, with hints like "1 more for ON FIRE" |
| Sound on everything | Each make plays a chime that rises in pitch as your streak grows |
| Surprise bonus rounds | A random "Money Rack": 10 seconds where every make pays double |
| The screen state changes with your luck | Color tint, border glow and extra music layers change with each streak tier |

## Campaign (main mode)

Campaign is the main game mode and multiplayer is a side mode. Every game runs 2 minutes, with a 1-minute overtime when the scores are within 10 points (the first stage is a 60-second practice race). The campaign gets its competition from AI rivals and Archero-style runs. Decided: every campaign match is a live race against an AI opponent. The rest are options to test.

- **Every match is against an AI rival** who shoots at their own hoop, with their score shown live. Every match is a race, and the sabotage card has a real target in solo play.
- **Rivals have personalities:** an accuracy level, a shooting speed, and a signature habit (always banks shots, sabotages often, gets hot late).
- **A boss ends each court.** Bosses use legendary sabotages, or the court changes mid-match (the lights flicker, the hoop starts moving).
- **Runs like Archero:** a tour is a set of matches back to back, and your power-ups carry across the whole run. Lose once and the run ends, but you keep the gold you earned.
- **Gold buys permanent upgrades between runs**, like a slower meter, a starting perk, or a third power-up card to choose from.
- **Stars per match** (win, win by 10+, win without sabotage) give a reason to replay courts.
- **Daily challenge** (later idea): one court with fixed modifiers and a high-score board.

**First map: the tutorial (YMCA Gym).** It walks through everything once before the real campaign starts:

1. Aim with the mouse and charge power with Space.
2. Switch spots with A/D and cameras with C.
3. Shoot fast: the next ball is ready as soon as the last one leaves your hands.
4. Make 2 in a row to see Heating Up.
5. A guaranteed power-up pick: what the left buff and right sabotage cards do, and what rarity means.
6. A short practice race against a slow rival.

**Difficulty curve.** Courts go from easiest to hardest, and each one ends with a boss. Rival accuracy is the share of their shots that go in. All numbers are a first pass to tune in playtesting.

| Stage | Court | Rival accuracy | Rival shot pace | Rival power-ups | Boss twist |
| --- | --- | --- | --- | --- | --- |
| 1 | YMCA Gym (tutorial) | 25% | 1 shot every 4 s | None | None (practice race) |
| 2 | Home Gym | 35% | Every 3.5 s | Commons | Boss starts already Heating Up |
| 3 | Neon Arcade | 42% | Every 3 s | Up to rare | Lights flicker in the last minute |
| 4 | Pro Arena | 50% | Every 2.5 s | Up to epic | Crowd heckles every one of your shots |
| 5 | Boardwalk | 55% | Every 2.5 s | Up to legendary | Wind gusts get stronger over time |
| 6 | Rooftop | 60% | Every 2.2 s | Up to legendary | Rain gets heavier as the boss scores |
| 7 | Frozen Lake | 65% | Every 2 s | Everything, mythics late | Final boss: uses a sabotage every pick |

## Sandbox mode

Sandbox mode is a free shootaround with no timer and no pressure, where you can try any power-up or power-down on yourself.

- **No timer, no rival.** Score and streak still count, so heating up and On Fire still trigger.
- **Pick anything:** any court, any ball, any difficulty.
- **Power-up panel:** switch on any buff or sabotage on yourself, set its level, and stack several at once.
- **Practice tools:** show the aim arc, show the perfect-power zone, slow motion, and instant ball reset.
- **Stats:** makes and attempts at each spot.
- **For the team:** this is also the easiest way for us to test and balance power-ups, and a good place to record the demo video.

## Power-up system

A power-up pick comes every 20–30 seconds: the game pauses and you choose one of two cards, like the level-up picks in Archero. The left card buffs you and the right card hurts your opponent. Your first pick comes early, as soon as you make 2 shots, if that happens before the 20-second mark. A 2-minute game gives about 4–5 picks, plus one or two in overtime.

**How a pick works:**

1. Every 20–30 seconds (or at your 2nd make, for the first pick) the clock freezes and two cards spin up, slot-machine style, before landing on their rarity.
2. The left card is a **buff** for you; the right card is a **sabotage** for your opponent.
3. You have 5 seconds to choose. If you do not, you get no card, but your next pick's odds move one step toward rarer cards.
4. Picking a power-up you already have levels it up (stronger or longer), like Archero.
5. The clock restarts.

**Rarities:**

| Rarity | Card color | Power level |
| --- | --- | --- |
| Common | Gray | Small nudge |
| Rare | Blue | Clearly helps |
| Epic | Purple | Changes how you play for a while |
| Legendary | Gold | Game-swinging, with a big flashy reveal |
| Mythic | Red with a rainbow shimmer | Game-deciding; overtime only. None are designed yet |

**Odds get better every pick.** Each pick shifts the chances toward rarer cards, and a skipped pick moves your next one a step further. Mythics only appear in overtime, where both cards are mythic for both players; none are designed yet, so overtime cards are legendary for now. This first table is for multiplayer, the fast-paced mode. Campaign uses lower odds (second table). All numbers are a starting point to tune in testing:

| When | Common | Rare | Epic | Legendary | Mythic |
| --- | --- | --- | --- | --- | --- |
| Pick 1 | 70% | 22% | 7% | 1% | 0% |
| Pick 2–3 | 58% | 27% | 12% | 3% | 0% |
| Pick 4 or later | 48% | 30% | 16% | 6% | 0% |
| Best step (pick 4 or later after a skip) | 42% | 30% | 17% | 11% | 0% |
| Overtime | — | — | — | — | 100% (both cards) |

**Campaign odds (lower):**

| When | Common | Rare | Epic | Legendary | Mythic |
| --- | --- | --- | --- | --- | --- |
| Pick 1 | 80% | 16% | 4% | 0% | 0% |
| Pick 2–3 | 70% | 21% | 8% | 1% | 0% |
| Pick 4 or later | 62% | 24% | 11% | 3% | 0% |
| Best step (pick 4 or later after a skip) | 58% | 25% | 12% | 5% | 0% |
| Overtime | — | — | — | — | 100% (both cards) |

**Durations:** each power-up is one of three kinds:

- **Next shots:** lasts for your next 1 to 5 shots.
- **Timed:** lasts 10 to 20 seconds.
- **Rest of game:** permanent (usually commons, so they stay small).

## Power-up list

These 21 cards are all in the game. They are starting ideas to build on, not a final list. Mark each one Keep / Maybe / Cut in the live doc, then add your own and we'll balance them together.

| Name | Side | Rarity | Effect |
| --- | --- | --- | --- |
| Steady Hands | Buff | Common | Your power meter charges 20% slower for the rest of the game |
| Sweet Spot | Buff | Common | Your green power zone shows for 3 shots, even on Hard or under Blind Meter |
| Guide Line | Buff | Common | A golden dot shows where to aim for your next 3 shots |
| Glass Cleaner | Buff | Common | Bank shots are worth +1 for the rest of the game |
| Golden Ball | Buff | Rare | Your next make is worth double |
| Hot Hand | Buff | Rare | Your streak jumps to 3 (instant Heating Up) |
| Second Chance | Buff | Rare | Your next miss doesn't break your streak |
| Wide Rim | Buff | Epic | Your rim is 20% wider for 15 seconds |
| Double Ball | Buff | Epic | Your next shot throws 2 balls at once |
| Time Freeze | Buff | Legendary | The clock and your opponent stop for 10 seconds while you keep shooting |
| Moneyball | Buff | Legendary | Every make is worth 3 for 20 seconds |
| Fast Meter | Sabotage | Common | Opponent's meter charges 30% faster for 3 shots |
| Shaky Hands | Sabotage | Common | Opponent's aim wobbles for 3 shots |
| Heckler | Sabotage | Common | A loud fan yells during the opponent's next 2 shots and shakes their camera |
| Blind Meter | Sabotage | Rare | Hides the opponent's green power zone for 3 shots (added Nov 12) |
| Tiny Rim | Sabotage | Rare | Opponent's rim is 15% smaller for 15 seconds |
| Extinguisher | Sabotage | Rare | Ends the opponent's streak right now |
| Fog Machine | Sabotage | Rare | Fog covers the opponent's court for 10 seconds |
| Moving Hoop | Sabotage | Epic | Opponent's hoop slides side to side for 15 seconds |
| Slippery Ball | Sabotage | Epic | Opponent's ball bounces wildly off the rim for 15 seconds |
| Blackout | Sabotage | Legendary | Opponent's lights go out for 10 seconds, except a spotlight on the hoop |

## Open decisions

The class deadline is 12/10, so the biggest call is what goes into the graded version and what waits until after. A realistic graded version is 2 courts, the heating-up tiers and the core animations; power-ups and 1v1 make a strong stretch goal.

- [x] Which 2 courts make the graded version? All 7 are in.
- [x] Exactly 3 or 4 minutes per game? 2 minutes (decided Nov 12), with overtime when within 10 points.
- [ ] What does home court give, beyond the crowd being on your side? Nothing yet. The fan meter in next-steps.md is the plan.
- [ ] Campaign: does the player always pick the court, or does a coin flip still decide? Today each stage has a fixed court.
- [ ] Campaign: do power-ups carry from match to match? Today they do not.
- [x] Do balls give small perks as they level up, or only change the look? Only the look.
- [x] Which gear besides the headband can be upgraded? Shooting Sleeve and Wristband. Shoes are not built.
- [x] Do the heating-up tiers replace the current +1 bonus at 3 in a row? Yes.
- [ ] Design the mythic power-ups together.

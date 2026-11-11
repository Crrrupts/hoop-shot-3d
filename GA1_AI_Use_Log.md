# AI Use Log

Project: 3D Basketball Shooting Challenge  
Course: CMPSC 457  
Confirmed members: Justin Leddo and Isaiah Millien  
Started: October 28, 2026

Keep this file throughout the project and submit the updated log with GA2 and GA3. Record each meaningful use of AI, including code, debugging, textures, and writing. Do not claim that proposed work has already been implemented or tested.

| Date | Tool | What was asked | Output and use | Changes / verification |
|---|---|---|---|---|
| 2026-10-28 | ChatGPT | Provided the GA1 assignment and asked for help selecting a project. | ChatGPT suggested a 3D basketball shooting game and mapped the assignment requirements to geometry, camera, controls, animation, lighting, physics, and textures. | Justin selected the basketball idea. Team implementation has not started. |
| 2026-10-28 | ChatGPT | Confirmed Justin Leddo and Isaiah Millien as current members, accepted the idea, and said “ok begin.” | ChatGPT drafted a four-page project proposal, eight-slide PDF pitch, proposed roles and weekly milestones, and this AI Use Log. | The proposal uses the confirmed names, leaves the third teammate and repository unresolved, and marks team procedures as proposed. Justin and Isaiah still need to review technical choices, roles, meeting times, and pitch wording. No game code was generated in this step. |

## Entries to add as work continues

| Date | Tool / model if known | Prompt or accurate summary | What output was used | What we changed and how we checked it | Member |
|---|---|---|---|---|---|
| 2026-11-09 | Claude (Anthropic) | Asked Claude to read the team repo and start Justin's part (gameplay and physics) so it works with Bom's UI and Amit's input code. | Drafted physics.js (gravity, fixed time step, floor/backboard/pole/rim collisions, basket detection), game.js (states, timer, scoring, streaks, moving hoop), camera.js (3 views), main.js (frame loop and renderScene hook), a temporary ?debug wireframe view, node tests, and a 1-line onShoot hook in input.js. | Tuned shot speed (6–9 m/s) with the tests so every spot has a fair power window; ran tests (all pass) and played it in a headless browser (shots, scoring, spot/camera switch, game over, restart). Justin still needs to review and understand the code before GA2. | Justin |
| 2026-11-11 | Claude Code (Anthropic) | Justin gave Claude a handoff note and the Design Bible and asked it to build the game in small chunks, graded requirements first. Session 1, chunk 1: the WebGL renderer. | All code in this chunk is AI-generated. Merged justin-physics (and amit-input) into main. Added geometry.js (sphere, torus, cube, plane, disc, line net built in code), textures.js (ball, court, backboard and wall painted in code as placeholders), renderer.js (WebGL setup, materials, lights, matrix-stack hoop hierarchy pole → arm → backboard → rim → net, ball spin, shadows, aim arc), Phong vertex and fragment shaders in index.html, game events in game.js (Game.on), a slightly higher shooter camera, and the class libraries Common/MV.js and Common/initShaders.js (Edward Angel, downloaded unchanged). | Checked triangle winding against the normals with a node script; ran node tests/physics.test.js (all pass); loaded the game in headless Chromium and played a full 60 s game: all 3 cameras, all 5 spots, Easy aim arc, Hard moving hoop, makes and misses, game over and Play Again. No console errors except the Howler CDN script, which this test machine could not reach. Not yet playtested by the team. Justin still needs to review the code. | Justin |
| YYYY-MM-DD | | | | | |

## Current disclosure

ChatGPT assisted with brainstorming and drafting the GA1 planning materials. The game code is AI-generated with Claude (Anthropic), directed and reviewed by Justin, as listed in the table above. The team is responsible for reviewing the submission, implementing and understanding the application, verifying that it meets the rubric, and maintaining an accurate log. Planned features and testing activities in the proposal describe future work.

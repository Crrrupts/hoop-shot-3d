# Handoff: build Hoop Shot 3D (CMPSC 457)

You are building a WebGL basketball game for Justin's CMPSC 457 team. Justin directs and reviews; the team (Isaiah Millien, Amit Gurung, Bom Chhetri) gave permission for all their code to be updated and are credited for brainstorming and design. All code is AI-generated and must be logged as such.

## Sources
- Repo: https://github.com/Crrrupts/hoop-shot-3d (add it to your session with push access, then clone it)
- Design doc (read it first, it is the spec): docs/design-bible.md in the repo. The live, latest version is https://claude.ai/artifact/PtSqWJ1oB9T9DCjnBMMoy2 ("Hoop Shot 3D — Design Bible"); if the two differ, the live doc wins.
- Project plan PDF in the repo: docs/Hoop-Shot-3D-Project-Plan.pdf (lists the graded requirements)

## Current state of the repo
- main: Bom's HUD and menus (index.html, style.css, ui.js), plus these docs.
- branch amit-input: input.js (mouse aim, Space power, A/D spots, C camera, R restart, difficulty slider).
- branch justin-physics: built on amit-input. Adds physics.js (fixed 240 Hz step; floor, backboard, pole, rim-torus collisions; basket detection), game.js (states, timer, scoring, streaks), camera.js (shooter / follow / orbit eye-at-up), main.js (frame loop that calls window.renderScene(scene)), debug-view.js (temporary 2D wireframe, only with ?debug), tests/physics.test.js (run with: node tests/physics.test.js). Not merged yet.
- Start from justin-physics. Merge it (and therefore amit-input) into main first.
- No WebGL renderer exists yet. Plain WebGL + our own GLSL shaders + MV.js only, no 3D engine (course rule).

## Build order (do not skip ahead)
1. **Graded requirements first** (the doc's top table): own 3D geometry, transformations, lookAt camera with 3 views, interaction, animation, Phong lighting, and the advanced features (collisions/physics, texture mapping, hierarchical hoop model). These must work and must stay working through every later change.
2. **Core match**: live race vs an AI rival; shoot again as soon as the previous ball leaves the hands (several balls in the air; current code waits for each shot, change it); heating-up tiers (2 / 4 / 7 makes); power-up picks every 30–45 s with the early pick at the 2nd make; moving hoop becomes a power-up (currently tied to Hard, change it); games 3–4 min with 1-min overtime.
3. Courts (gameplay-affecting ones: YMCA easiest; outdoor double rims, wind, rain), crowd, animations, casino-style feel.
4. Campaign (tutorial map first, difficulty curve from the doc), card collection and upgrades, sandbox mode.
5. Local multiplayer only (two players, one computer). Do not build online play.

Use the doc's numbers (odds tables, difficulty curve) as starting values. Where the doc lists something under Open decisions, pick the simplest option, keep it easy to change, and list it in your notes for Justin.

## Rules for every chunk
1. Work in small chunks. Each chunk ends with a commit and a push to GitHub.
2. Before pushing: run node tests/physics.test.js (add tests for new physics/rules), load the game in a headless browser and check the console for errors, and play one full game to the end.
3. Never break a graded requirement. If one breaks, fix it before anything else.
4. The team does the real playtesting. You only check for bugs, crashes and broken flows.
5. Sound and art: the team supplies these. Leave clear hooks (window.playSound(name) already exists in game.js) and placeholder visuals; do not pull in unlicensed assets.
6. Keep the code readable for students: plain JS, short comments explaining what each part does.
7. Add an entry to GA1_AI_Use_Log.md for each session, stating the code was AI-generated (model name), what was built, and how it was checked. Update the README team section: code is AI-generated, directed and reviewed by Justin; Isaiah, Amit and Bom credited for brainstorming and design.

## Pushing and showing the result
- Push to a branch named fable-build, then merge into main when the graded requirements pass. Confirm every push landed (git ls-remote should match your local commit) and that main merges cleanly.
- Turn on GitHub Pages for main (repo root) so the game has a playable link. If you cannot change repo settings, tell Justin the exact clicks to enable it.
- When a chunk is done, open the playable game for Justin in the built-in browser pane (the GitHub Pages link). If Pages is not live yet, bundle the game into one HTML file and publish it as an artifact so it opens in the side panel.
- End each chunk with a short note to Justin: what changed, what to test, known bugs, and any decisions you made from the Open decisions list.

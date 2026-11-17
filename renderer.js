// renderer.js — draws the game with plain WebGL, our own GLSL shaders and MV.js.
//
// main.js calls window.renderScene(scene) once per frame. This file:
//   1. builds the meshes (geometry.js) once at startup
//   2. builds the textures and lights for the chosen court (courts.js, textures.js)
//   3. every frame, sets the camera (lookAt + perspective) and the lights
//   4. draws the arena or sky, both courts, both hoops, the crowd, the balls,
//      nets, weather, effects and shadows
//   5. draws each view main.js asks for: your view plus the small rival view,
//      or a split screen for two players
//
// The shaders are in index.html (ids "vertex-shader" and "fragment-shader").
// Lighting is Phong shading done per pixel: ambient + diffuse + specular.
//
// The hoop is a hierarchy drawn with a matrix stack:
//   hoop root -> pole -> arm -> backboard -> rim -> net
// The shooters are a second hierarchy: hips -> legs, torso -> head and arms -> hands.
// Moving or shaking a parent moves everything below it.

(function () {
    const canvas = document.getElementById('game-canvas');
    const gl = canvas.getContext('webgl', { antialias: true });
    if (!gl) {
        alert('WebGL is not available in this browser.');
        return;
    }

    // ---------- Shaders ----------
    const program = initShaders(gl, 'vertex-shader', 'fragment-shader');
    gl.useProgram(program);

    const attrib = {
        position: gl.getAttribLocation(program, 'vPosition'),
        normal: gl.getAttribLocation(program, 'vNormal'),
        texcoord: gl.getAttribLocation(program, 'vTexCoord')
    };
    const uniformNames = [
        'uModel', 'uView', 'uProjection', 'uNormalMatrix', 'uNormalSign', 'uTexScale', 'uPointSize',
        'uEye', 'uAmbientLight', 'uLightPosition', 'uLightColor', 'uSpotDirection', 'uSpotCone',
        'uColor', 'uSpecular', 'uShininess', 'uAlpha', 'uLit', 'uUseTexture', 'uTexture',
        'uFogDensity', 'uFogColor', 'uPointShape', 'uTint', 'uSoftAlpha', 'uFade'
    ];
    const uniform = {};
    uniformNames.forEach((name) => { uniform[name] = gl.getUniformLocation(program, name); });

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);                    // skip triangles that face away from the camera
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // ---------- Meshes ----------
    // Copy a mesh from geometry.js into WebGL buffers
    function makeMesh(data) {
        function buffer(target, typedArray) {
            const b = gl.createBuffer();
            gl.bindBuffer(target, b);
            gl.bufferData(target, typedArray, gl.STATIC_DRAW);
            return b;
        }
        return {
            position: buffer(gl.ARRAY_BUFFER, new Float32Array(data.positions)),
            normal: buffer(gl.ARRAY_BUFFER, new Float32Array(data.normals)),
            texcoord: buffer(gl.ARRAY_BUFFER, new Float32Array(data.texcoords)),
            index: buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data.indices)),
            count: data.indices.length
        };
    }

    // Each court is a floor tile 15 m wide, centered on its hoop. Your court is
    // at x = 0 and the rival's is one tile to the right. The arena box holds both.
    const COURT = { width: Game.SETTINGS.courtGap, z0: -5, z1: 17 };
    const ARENA = { x0: -COURT.width / 2, x1: COURT.width * 1.5, z0: COURT.z0, z1: COURT.z1, height: 10 };
    const CENTER = [(ARENA.x0 + ARENA.x1) / 2, 0, (ARENA.z0 + ARENA.z1) / 2];     // middle of the floor
    const SKY = { size: 100, height: 60 };      // the outdoor sky box

    const meshes = {
        sphere: makeMesh(Geometry.sphere(40, 28)),        // the ball: smooth, it is the star
        smallSphere: makeMesh(Geometry.sphere(16, 12)),   // the player's head, hair and hands (small on screen)
        torus: makeMesh(Geometry.torus(Physics.RIM_RADIUS, Physics.RIM_TUBE * 1.3, 64, 12)),
        cube: makeMesh(Geometry.cube()),
        floor: makeMesh(Geometry.plane(-COURT.width / 2, COURT.z0, COURT.width / 2, COURT.z1, 24)),
        disc: makeMesh(Geometry.disc(28))
    };

    // Buffers for things that change every frame (net, weather, effects)
    const netBuffer = gl.createBuffer();
    const dynamicBuffer = gl.createBuffer();

    // ---------- Textures ----------
    function makeTexture(image, repeat) {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);       // image top = v of 1
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.generateMipmap(gl.TEXTURE_2D);                    // smaller copies for far-away pixels
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
        return t;
    }
    // The current court's images (see imagesFor below)
    const softTextures = { disc: null, ring: null };      // made once, below (makeTexture keeps the see-through parts)
    const textures = { court: null, backboard: null, wall: null, sky: null };

    // ---------- Materials ----------
    // color: base color (multiplied by the texture if there is one)
    // specular + shininess: the shiny highlight (0 specular = matte)
    // unlit: flat color, no lighting (lines, sky, glowing things)
    const MATERIALS = {
        // court, board, rim, pole, wall, ceiling, sky and ground are set by loadCourt()
    };

    // Ball skins (the ball cards in cards.js). Each skin's texture is painted
    // the first time it is needed, then kept.
    const ballMaterials = {};
    function ballMaterial(id) {
        if (!ballMaterials[id]) {
            const lookOfBall = Cards.byId(id).look;
            const shine = lookOfBall.shine;         // 0 = dull rubber, 1 = mirror or polished gold
            ballMaterials[id] = {
                color: [1, 1, 1], specular: [shine, shine, shine], shininess: 12 + shine * 70,
                texture: makeTexture(Textures.ball(lookOfBall), true)
            };
        }
        return ballMaterials[id];
    }

    function setMaterial(m) {
        gl.uniform3fv(uniform.uColor, m.color);
        gl.uniform3fv(uniform.uSpecular, m.specular || [0, 0, 0]);
        gl.uniform1f(uniform.uShininess, m.shininess || 1);
        gl.uniform1f(uniform.uAlpha, m.alpha === undefined ? 1 : m.alpha);
        gl.uniform1i(uniform.uLit, m.unlit ? 0 : 1);
        gl.uniform2fv(uniform.uTexScale, m.texScale || [1, 1]);
        gl.uniform1i(uniform.uPointShape, 0);
        gl.uniform1i(uniform.uSoftAlpha, m.soft ? 1 : 0);
        if (m.texture) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, m.texture);
            gl.uniform1i(uniform.uTexture, 0);
            gl.uniform1i(uniform.uUseTexture, 1);
        } else {
            gl.uniform1i(uniform.uUseTexture, 0);
        }
    }

    // ---------- Court look ----------
    // Rebuild the textures, materials and lights for a court from courts.js
    let look = null;
    let reflection = 0;             // how strongly the floor reflects (0 = not at all)
    let lighting = null;

    // '#rrggbb' -> [r, g, b] from 0 to 1
    function cssColor(hex) {
        return [1, 3, 5].map((i) => parseInt(hex.substr(i, 2), 16) / 255);
    }

    // ---------- Each court's images, painted once and kept ----------
    // Painting a court's floor takes a few tenths of a second, so each court's
    // images are painted the first time they are needed and then kept, so
    // switching back is instant. While the menu is showing, the courts not yet
    // painted are painted in the background, one at a time (see paintAhead).
    const courtImages = {};                     // court id -> { court, backboard, wall, sky, fans }
    const fanImages = {};                       // 'people' or 'glow' -> one texture per shirt color
    function imagesFor(court) {
        if (!courtImages[court.id]) {
            const look = court.look;
            courtImages[court.id] = {
                court: makeTexture(Textures.court(COURT.width, COURT.z0, COURT.z1, look.floor), false),
                backboard: makeTexture(Textures.backboard(look.board), false),
                sky: look.outdoor ? makeTexture(Textures.sky(look.sky), true) : null,
                wall: look.outdoor ? null : makeTexture(Textures.wall(look.wall), true)
            };
        }
        return courtImages[court.id];
    }
    function fanTexturesFor(kind) {
        if (!fanImages[kind]) {
            // (called right after Crowd.build, so Crowd.shirtColors() matches this kind of crowd)
            const glow = kind === 'glow', skin = Crowd.skinColors();
            fanImages[kind] = Crowd.shirtColors().map((shirt, i) => makeTexture(Textures.fan(shirt, skin[i % skin.length], glow), false));
        }
        return fanImages[kind];
    }
    function paintAhead() {
        // only while a menu is showing: painting mid-match would make the game stutter
        if (Game.state.mode === 'playing' || Game.state.mode === 'picking') return;
        const next = Courts.LIST.find((c) => !courtImages[c.id]);
        if (next) imagesFor(next);
    }
    setInterval(paintAhead, 700);
    window.paintedCourts = () => Object.keys(courtImages);         // for checking (tests, ?stats)

    function loadCourt(court) {
        look = court.look;
        const images = imagesFor(court);
        textures.court = images.court;
        textures.backboard = images.backboard;
        textures.sky = images.sky;
        textures.wall = images.wall;

        const gloss = look.floor.gloss;         // 0 = matte floor, higher = shinier (ice, wet asphalt)
        MATERIALS.court = { color: [1, 1, 1], specular: [gloss, gloss, gloss], shininess: 8 + gloss * 60, texture: textures.court };
        // a shiny floor also shows a faded mirror image of the hoops, balls and
        // players (see drawReflection); this is how strong it is
        reflection = gloss >= 0.15 ? Math.min(0.4, gloss * 0.7) : 0;
        MATERIALS.pad = { color: cssColor(look.board.pad), specular: [0.1, 0.1, 0.1], shininess: 10 };
        MATERIALS.fixture = { color: [1, 0.97, 0.88], unlit: true };
        MATERIALS.board = { color: [1, 1, 1], specular: [0.3, 0.3, 0.3], shininess: 40, texture: textures.backboard };
        MATERIALS.rim = { color: look.rim, specular: [1, 0.9, 0.8], shininess: 90 };        // shiny metal
        MATERIALS.pole = { color: look.pole, specular: [0.5, 0.5, 0.5], shininess: 50 };
        MATERIALS.wall = { color: [0.8, 0.8, 0.8], texture: textures.wall, texScale: [7, 1] };
        MATERIALS.ceiling = { color: look.ceiling || [0.1, 0.1, 0.1] };
        MATERIALS.sky = { color: [1, 1, 1], unlit: true, texture: textures.sky };
        MATERIALS.skyTop = { color: look.outdoor ? cssColor(look.sky.top) : [0, 0, 0], unlit: true };
        MATERIALS.ground = { color: look.ground || [0.2, 0.2, 0.2] };

        lighting = { ambient: look.ambient, lights: look.lights };
        resetWeather(look.weather);

        // Crowd: place the fans and paint one cut-out image per shirt color
        Crowd.build(look, ARENA.x0, ARENA.x1, [Game.player.hoop.base[0], Game.rival.hoop.base[0]]);
        fanMaterials = fanTexturesFor(Crowd.isGlow() ? 'glow' : 'people').map((texture) => ({
            color: [0.8, 0.8, 0.8],         // a little dimmer than the court so the crowd stays in the background
            texture: texture,
            unlit: Crowd.isGlow()           // Neon Arcade fans glow instead of being lit
        }));
        MATERIALS.bleachers = { color: look.pole.map((c) => c * 0.8 + 0.05) };
        buildCrowdBatches();
    }
    let fanMaterials = [];

    // ---------- Lights ----------
    // Up to 3 lights. cone = [inner, outer] angle in degrees for a spotlight,
    // or null for a light that shines in every direction.
    const NO_LIGHT = { position: [0, 0, 0], color: [0, 0, 0], direction: [0, -1, 0], cone: null };
    // Blackout power-up: the lights go out except a narrow spotlight on that player's hoop
    function blackoutLighting(hoopX) {
        return {
            ambient: [0.035, 0.035, 0.05],
            lights: [
                { position: [hoopX, 8, 3.5], color: [1, 0.96, 0.85], direction: [0, -0.82, -0.57], cone: [9, 15] },
                NO_LIGHT, NO_LIGHT
            ]
        };
    }

    function setLights(lights, eye) {
        const positions = [], colors = [], directions = [], cones = [];
        for (const light of lights.lights) {
            positions.push(...light.position);
            colors.push(...light.color);
            directions.push(...light.direction);
            if (light.cone) {
                cones.push(Math.cos(radians(light.cone[0])), Math.cos(radians(light.cone[1])));
            } else {
                cones.push(-2, -3);             // never cuts anything off
            }
        }
        gl.uniform3fv(uniform.uLightPosition, positions);
        gl.uniform3fv(uniform.uLightColor, colors);
        gl.uniform3fv(uniform.uSpotDirection, directions);
        gl.uniform2fv(uniform.uSpotCone, cones);
        gl.uniform3fv(uniform.uAmbientLight, lights.ambient);
        gl.uniform3fv(uniform.uEye, eye);
    }

    // ---------- Matrix stack (for the hierarchy) ----------
    let modelMatrix = mat4();
    const stack = [];
    function pushMatrix() { stack.push(modelMatrix); }
    function popMatrix() { modelMatrix = stack.pop(); }
    function transform(m) { modelMatrix = mult(modelMatrix, m); }

    // Send the current model matrix (and the matching normal matrix) to the shader
    // This runs for every object drawn (hundreds of times a frame), so it
    // avoids MV.js's flatten() and normalMatrix(), which make new arrays and
    // invert a whole 4x4 matrix each time. Instead it fills two arrays that
    // are reused, and builds the normal matrix straight from the cofactors
    // of the model matrix's 3x3 part (inverse-transpose times the
    // determinant; the shader normalizes the normals, so the scale does not
    // matter, but the sign does, so it is fixed for mirrored matrices).
    const modelArray = new Float32Array(16), normalArray = new Float32Array(9);
    let matricesSent = 0;                       // per frame, for ?stats
    function sendModelMatrix() {
        const m = modelMatrix;
        for (let col = 0; col < 4; col++) {     // WebGL wants the numbers column by column
            for (let row = 0; row < 4; row++) modelArray[col * 4 + row] = m[row][col];
        }
        const a = m[0][0], b = m[0][1], c = m[0][2], d = m[1][0], e = m[1][1], f = m[1][2], g = m[2][0], h = m[2][1], k = m[2][2];
        const c00 = e * k - f * h, c01 = f * g - d * k, c02 = d * h - e * g;
        const sign = (a * c00 + b * c01 + c * c02) < 0 ? -1 : 1;        // negative determinant = mirrored
        normalArray[0] = sign * c00; normalArray[1] = sign * (c * h - b * k); normalArray[2] = sign * (b * f - c * e);
        normalArray[3] = sign * c01; normalArray[4] = sign * (a * k - c * g); normalArray[5] = sign * (c * d - a * f);
        normalArray[6] = sign * c02; normalArray[7] = sign * (b * g - a * h); normalArray[8] = sign * (a * e - b * d);
        gl.uniformMatrix4fv(uniform.uModel, false, modelArray);
        gl.uniformMatrix3fv(uniform.uNormalMatrix, false, normalArray);
        matricesSent++;
    }
    window.rendererStats = function () { const n = matricesSent; matricesSent = 0; return n; };

    // Draw a triangle mesh with the current model matrix and material.
    // count/offset let us draw only some of its triangles.
    function drawMesh(mesh, count, offset) {
        sendModelMatrix();
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.position);
        gl.vertexAttribPointer(attrib.position, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(attrib.position);
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normal);
        gl.vertexAttribPointer(attrib.normal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(attrib.normal);
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.texcoord);
        gl.vertexAttribPointer(attrib.texcoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(attrib.texcoord);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.index);
        gl.drawElements(gl.TRIANGLES, count === undefined ? mesh.count : count, gl.UNSIGNED_SHORT, (offset || 0) * 2);
    }

    // Draw a unit cube stretched to a box of the given size (centered on the current origin)
    function drawBox(sx, sy, sz) {
        pushMatrix();
        transform(scalem(sx, sy, sz));
        drawMesh(meshes.cube);
        popMatrix();
    }

    // Send loose points [x, y, z, ...] to the shader (lines and dots have no normals or texture)
    function sendPoints(buffer, points) {
        sendModelMatrix();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, points instanceof Float32Array ? points : new Float32Array(points), gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(attrib.position, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(attrib.position);
        gl.disableVertexAttribArray(attrib.normal);
        gl.disableVertexAttribArray(attrib.texcoord);
    }

    // Draw line points in a flat color. mode is gl.LINES or gl.LINE_STRIP.
    function drawLines(buffer, points, mode, color, alpha) {
        if (points.length < 6) return;
        setMaterial({ color: color, unlit: true, alpha: alpha });
        sendPoints(buffer, points);
        gl.drawArrays(mode, 0, points.length / 3);
    }

    // Draw dots (gl.POINTS). size is in meters; shape 1 = soft round, 2 = square.
    let pointScale = 1;                         // pixels per meter at 1 m away, set for each view
    function drawDots(points, size, color, alpha, shape) {
        if (points.length < 3) return;
        setMaterial({ color: color, unlit: true, alpha: alpha });
        gl.uniform1i(uniform.uPointShape, shape);
        gl.uniform1f(uniform.uPointSize, size * pointScale);
        sendPoints(dynamicBuffer, points);
        gl.drawArrays(gl.POINTS, 0, points.length / 3);
        gl.uniform1i(uniform.uPointShape, 0);
    }

    // ---------- Hoop animation (springs) ----------
    // Each value is pulled back to 0 like a spring, so a kick makes it wobble and settle.
    function makeSpring(stiffness, damping) {
        return { value: 0, speed: 0, stiffness: stiffness, damping: damping };
    }
    function stepSpring(s, dt) {
        s.speed += (-s.stiffness * s.value - s.damping * s.speed) * dt;
        s.value += s.speed * dt;
    }
    // Every hoop gets its own set of springs
    const hoopAnims = new Map();
    function animFor(hoop) {
        if (!hoopAnims.has(hoop)) {
            hoopAnims.set(hoop, {
                boardTilt: makeSpring(900, 14),     // backboard wobble (degrees)
                rimTilt: makeSpring(1400, 16),      // rim shake (degrees)
                netX: makeSpring(120, 5),           // net sway (meters at the bottom)
                netZ: makeSpring(120, 5),
                netStretch: makeSpring(260, 9)      // net pulled down by the ball
            });
        }
        return hoopAnims.get(hoop);
    }

    // game.js tells us when a ball hits something or goes in, and when the court changes
    Game.on(function (name, data) {
        if (name === 'court') loadCourt(data.court);
        if (name !== 'bounce' && name !== 'through') return;
        const anim = animFor(data.ball.hoop);
        if (name === 'bounce' && data.surface === 'rim') {
            // a very hard shot bends the rim down further before it springs back
            anim.rimTilt.speed -= Math.min(data.speed, 8) * 10;
            anim.boardTilt.speed -= Math.min(data.speed, 8) * 3;
            anim.netX.speed += (Math.random() - 0.5) * 0.6;
        }
        if (name === 'bounce' && data.surface === 'board') {
            anim.boardTilt.speed -= Math.min(data.speed, 8) * 9;
        }
        if (name === 'through') {
            // the ball drags the net down and sideways; a swish snaps harder
            anim.netStretch.speed += data.swish ? 6.5 : 4.5;
            anim.netX.speed += data.vel[0] * 0.5;
            anim.netZ.speed += data.vel[2] * 0.5;
        }
    });

    // ---------- The hoop: pole -> arm -> backboard -> rim -> net ----------
    // Sizes come from physics.js so what you see matches what the ball hits.
    function drawHoop(hoop, time) {
        const hoopAnim = animFor(hoop);
        const origin = Physics.hoopOrigin(hoop);
        const P = Physics.POLE, B = Physics.BOARD;
        const poleSize = [P.max[0] - P.min[0], P.max[1] - P.min[1], P.max[2] - P.min[2]];
        const poleCenterZ = (P.min[2] + P.max[2]) / 2;
        const boardSize = [B.max[0] - B.min[0], B.max[1] - B.min[1], B.max[2] - B.min[2]];
        const boardCenter = [0, (B.min[1] + B.max[1]) / 2, (B.min[2] + B.max[2]) / 2];
        const armY = 3.25;                                  // where the arm leaves the pole
        const armLength = B.min[2] - P.max[2];              // from the pole's front to the board's back

        pushMatrix();
        // ROOT: where the hoop stands. The Moving Hoop power-up slides this,
        // and everything below follows.
        transform(translate(origin[0], origin[1], origin[2]));

        // POLE (origin at the pole's base)
        transform(translate(0, 0, poleCenterZ));
        setMaterial(MATERIALS.pole);
        pushMatrix();
        transform(translate(0, poleSize[1] / 2, 0));
        drawBox(poleSize[0], poleSize[1], poleSize[2]);
        popMatrix();
        // padding around the bottom of the pole, and a base plate on the floor
        setMaterial(MATERIALS.pad);
        pushMatrix();
        transform(translate(0, 0.9, 0));
        drawBox(poleSize[0] + 0.1, 1.8, poleSize[2] + 0.1);
        popMatrix();
        setMaterial(MATERIALS.pole);
        pushMatrix();
        transform(translate(0, 0.03, -0.1));
        drawBox(0.7, 0.06, 0.9);
        popMatrix();

        // ARM (origin where it joins the pole's front face)
        transform(translate(0, armY, poleSize[2] / 2));
        pushMatrix();
        transform(translate(0, 0, armLength / 2));
        drawBox(0.1, 0.1, armLength);
        popMatrix();

        // BACKBOARD (origin at the board's center). It wobbles around the
        // end of the arm, which also swings the rim and net below it.
        transform(translate(0, 0, armLength));
        transform(rotateX(hoopAnim.boardTilt.value));
        transform(translate(0, boardCenter[1] - armY, boardSize[2] / 2));
        // the board lights up for a moment on a bank shot
        const flash = 1 + 0.9 * Effects.getBoardFlash(hoop);
        setMaterial(Object.assign({}, MATERIALS.board, { color: [flash, flash, flash] }));
        drawBox(boardSize[0], boardSize[1], boardSize[2]);

        // RIM (origin at the rim's center). It shakes around the point where
        // it is bolted to the board.
        const rimBack = -Physics.RIM_RADIUS;                // back edge of the rim
        const boardFront = boardSize[2] / 2;
        transform(translate(0, Physics.RIM_HEIGHT - boardCenter[1], boardFront));
        transform(rotateX(hoopAnim.rimTilt.value));
        transform(translate(0, 0, -boardCenter[2] - boardFront));
        setMaterial(rimMaterial(hoop));
        // small plate that joins the rim to the board
        const plateLength = rimBack - B.max[2];
        pushMatrix();
        transform(translate(0, -0.01, rimBack - plateLength / 2));
        drawBox(0.12, 0.02, plateLength);
        popMatrix();
        // the rim itself (Wide Rim / Tiny Rim power-ups scale it)
        pushMatrix();
        transform(scalem(hoop.rimScale, 1, hoop.rimScale));
        drawMesh(meshes.torus);
        if (hoop.rimThickness > 1.2) {
            // outdoor double rim: a second ring just under the first
            transform(translate(0, -0.024, 0));
            drawMesh(meshes.torus);
        }
        popMatrix();

        // NET (hangs from the rim, drawn as lines). It always sways a little.
        const idle = 0.012 * Math.sin(time * 1.3 + origin[0]);
        const net = Geometry.netLines(Physics.rimRadius(hoop), Physics.NET_DEPTH,
            hoopAnim.netX.value + idle, hoopAnim.netZ.value, Math.max(-0.3, hoopAnim.netStretch.value));
        drawLines(netBuffer, net, gl.LINES, look.net, 1);

        popMatrix();
    }

    // The rim's material. effects.js can make a rim glow (Inferno streak).
    function rimMaterial(hoop) {
        if (Effects.rimGlow(hoop) > 0) {
            return { color: [1, 0.45, 0.1], unlit: true };
        }
        return MATERIALS.rim;
    }

    // ---------- The shooter: a 3D player built from boxes and spheres ----------
    // A hierarchy on the matrix stack, like the hoop. Each part is drawn in
    // its parent's space, so bending a joint moves everything below it:
    //   root (feet, facing the hoop) -> hips -> each leg: thigh -> shin -> foot
    //                                        -> torso -> head -> hair
    //                                                 -> each arm: upper arm -> forearm -> hand
    // The joint angles come from shooter.js and follow the power bar.
    function drawShooter(shooter) {
        const pose = Shooter.poseOf(shooter), B = Shooter.BODY, look = Shooter.lookOf(shooter);
        const spot = Game.spotPosition(shooter.spot, shooter);
        const deg = (radians) => radians * 180 / Math.PI;
        const cloth = (color) => setMaterial({ color: color, specular: [0.06, 0.06, 0.06], shininess: 8 });
        // a box hanging down from the current joint (its top is at the joint)
        function limb(width, length, depth) {
            pushMatrix();
            transform(translate(0, -length / 2, 0));
            drawBox(width, length, depth);
            popMatrix();
        }
        function ballShape(radius) {
            pushMatrix();
            transform(scalem(radius, radius, radius));
            drawMesh(meshes.smallSphere);
            popMatrix();
        }

        pushMatrix();
        // ROOT: stand on the spot, turned to face the hoop
        transform(translate(spot[0], 0, spot[2]));
        transform(rotateY(deg(Shooter.facing(shooter))));
        // HIPS: they drop as the knees bend
        transform(translate(0, pose.hipY, 0));

        // LEGS: thigh -> shin -> foot. The thigh swings forward and the shin
        // back by twice as much, so the foot stays under the hip.
        for (const side of [1, -1]) {
            pushMatrix();
            transform(translate(side * B.hip, 0, 0));
            transform(rotateX(-deg(pose.knee)));
            cloth(look.shorts);
            limb(0.16, B.thigh, 0.17);
            transform(translate(0, -B.thigh, 0));           // the knee
            transform(rotateX(2 * deg(pose.knee)));
            cloth(look.skin);
            limb(0.11, B.shin, 0.12);
            transform(translate(0, -B.shin, 0));            // the ankle
            transform(rotateX(-deg(pose.knee)));            // keep the foot flat
            cloth(look.shoes);
            pushMatrix();
            transform(translate(0, -B.foot / 2, 0.06));
            drawBox(0.12, B.foot, 0.27);
            popMatrix();
            popMatrix();
        }

        // TORSO
        cloth(look.shirt);
        pushMatrix();
        transform(translate(0, B.torso / 2, 0));
        drawBox(0.42, B.torso, 0.22);
        popMatrix();
        transform(translate(0, B.torso, 0));                // now at shoulder height

        // HEAD and HAIR
        pushMatrix();
        transform(translate(0, 0.05 + B.head, 0.01));
        cloth(look.skin);
        ballShape(B.head);
        // hair: each style is a few spheres or boxes placed around the head (shooter.js)
        cloth(look.hair);
        for (const part of Shooter.HAIR_STYLES[look.hairStyle].parts) {
            pushMatrix();
            transform(translate(part.at[0] * B.head, part.at[1] * B.head, part.at[2] * B.head));
            transform(scalem(part.size[0] * B.head, part.size[1] * B.head, part.size[2] * B.head));
            // the unit sphere has radius 1 but the unit cube has side 1, so a box needs half the size
            if (part.shape === 'box') { transform(scalem(0.5, 0.5, 0.5)); drawMesh(meshes.cube); }
            else drawMesh(meshes.smallSphere);
            popMatrix();
        }
        popMatrix();

        // ARMS: upper arm -> forearm -> hand, bent so the hands hold the ball
        [1, -1].forEach((side, i) => {
            const arm = pose.arms[i];
            pushMatrix();
            transform(translate(side * B.shoulder, 0, 0));  // the shoulder
            transform(rotateY(deg(arm.yaw)));
            transform(rotateX(-deg(arm.upper)));
            cloth(look.shirt);
            limb(0.105, B.upperArm, 0.105);
            transform(translate(0, -B.upperArm, 0));        // the elbow
            transform(rotateX(-deg(arm.elbow)));
            cloth(look.skin);
            limb(0.085, B.forearm, 0.085);
            transform(translate(0, -B.forearm, 0));         // the wrist
            ballShape(0.055);
            popMatrix();
        });
        popMatrix();
    }

    // Soft dark disc on the floor under a shooter
    function drawShooterShadow(shooter) {
        const spot = Game.spotPosition(shooter.spot, shooter);
        pushMatrix();
        transform(translate(spot[0], 0.011, spot[2]));
        transform(scalem(0.42, 1, 0.42));
        setMaterial({ color: [0, 0, 0], unlit: true, alpha: 0.55, texture: softTextures.disc, soft: true });
        drawMesh(meshes.disc);
        popMatrix();
    }

    // ---------- Ball ----------
    let ballSkin = 'classic';                   // set from the scene each frame
    // Each ball keeps its own rotation matrix so its spin adds up smoothly.
    const ballSpin = new WeakMap();
    function drawBall(ball) {
        let spin = ballSpin.get(ball);
        if (!spin) { spin = { matrix: mat4(), lastAngle: ball.spinAngle }; ballSpin.set(ball, spin); }
        const turned = ball.spinAngle - spin.lastAngle;
        spin.lastAngle = ball.spinAngle;
        if (turned !== 0) {
            spin.matrix = mult(rotate(turned * 180 / Math.PI, ball.spinAxis), spin.matrix);
        }
        const r = Physics.BALL_RADIUS;
        const squash = ball.squash || 0;                    // 0 = round; effects.js flattens it on hard bounces
        pushMatrix();
        transform(translate(ball.pos[0], ball.pos[1] - r * squash, ball.pos[2]));   // move to the ball's position
        transform(scalem(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5));          // squash (flatter and wider)
        transform(spin.matrix);                                                      // spin it
        transform(scalem(r, r, r));
        // your balls use your equipped ball card; the rival uses the Classic ball
        const mine = ball.mine || ball.owner === Game.player;
        setMaterial(ballMaterial(mine ? ballSkin : 'classic'));
        drawMesh(meshes.sphere);
        popMatrix();
    }

    // Dark see-through disc on the floor under a ball (fades as the ball goes up)
    function drawShadow(ball) {
        const h = Math.max(0, ball.pos[1] - Physics.BALL_RADIUS);
        // a soft shadow that spreads out and fades as the ball goes up
        const size = Physics.BALL_RADIUS * (1.3 + h * 0.25);
        pushMatrix();
        transform(translate(ball.pos[0], 0.012, ball.pos[2]));
        transform(scalem(size, 1, size));
        setMaterial({ color: [0, 0, 0], unlit: true, alpha: 0.7 / (1 + h * 0.6), texture: softTextures.disc, soft: true });
        drawMesh(meshes.disc);
        popMatrix();
    }

    // Circles on the floor at the 5 shooting spots of one shooter; the one
    // they are standing on is brighter (yellow for you, red for the rival)
    function drawSpots(shooter, color) {
        for (let i = 1; i <= Game.SPOTS.length; i++) {
            const p = Game.spotPosition(i, shooter);
            const current = i === shooter.spot;
            if (i === shooter.moneySpot) {
                // the money spot (makes count double): a wide green ring under the marker
                pushMatrix();
                transform(translate(p[0], 0.006, p[2]));
                transform(scalem(0.55, 1, 0.55));
                setMaterial({ color: [0.3, 1, 0.5], unlit: true, alpha: 0.85, texture: softTextures.ring, soft: true });
                drawMesh(meshes.disc);
                popMatrix();
            }
            pushMatrix();
            transform(translate(p[0], 0.008, p[2]));
            transform(scalem(0.32, 1, 0.32));
            setMaterial({
                color: current ? color : [1, 1, 1],
                unlit: true,
                alpha: current ? 0.9 : 0.35,
                texture: softTextures.ring, soft: true          // a painted ring, not a flat disc
            });
            drawMesh(meshes.disc);
            popMatrix();
        }
    }

    // ---------- Arena or sky (inverted box) and floor ----------
    function drawArena() {
        // We are inside a cube, so draw its inner sides: flip the normals
        // and cull the front faces instead of the back faces.
        gl.cullFace(gl.FRONT);
        gl.uniform1f(uniform.uNormalSign, -1);
        pushMatrix();
        if (look.outdoor) {
            // a big sky box; the horizon in the sky image lines up with the floor (y = 0)
            const bottom = -Textures.HORIZON * SKY.height;
            transform(translate(CENTER[0], bottom + SKY.height / 2, CENTER[2]));
            transform(scalem(SKY.size, SKY.height, SKY.size));
            setMaterial(MATERIALS.sky);
            drawMesh(meshes.cube, 24, 0);           // the 4 sides (first 4 faces of the cube)
            setMaterial(MATERIALS.skyTop);
            drawMesh(meshes.cube, 6, 24);           // straight up (5th face)
        } else {
            // gym walls and ceiling around both courts
            transform(translate(CENTER[0], ARENA.height / 2, CENTER[2]));
            transform(scalem(ARENA.x1 - ARENA.x0, ARENA.height, ARENA.z1 - ARENA.z0));
            setMaterial(MATERIALS.wall);
            drawMesh(meshes.cube, 24, 0);
            setMaterial(MATERIALS.ceiling);
            drawMesh(meshes.cube, 6, 24);
        }
        popMatrix();
        gl.uniform1f(uniform.uNormalSign, 1);
        gl.cullFace(gl.BACK);

        // indoor: a glowing light fixture in the ceiling over each spotlight
        if (!look.outdoor) {
            setMaterial(MATERIALS.fixture);
            for (const light of look.lights) {
                if (!light.cone) continue;
                pushMatrix();
                transform(translate(light.position[0], ARENA.height - 0.12, light.position[2]));
                drawBox(1.6, 0.2, 1.0);
                popMatrix();
            }
        }
        if (look.outdoor) {
            // wide ground around the courts (the top face of a flat cube)
            pushMatrix();
            transform(translate(CENTER[0], -0.03, CENTER[2]));
            transform(scalem(SKY.size, 0.02, SKY.size));
            setMaterial(MATERIALS.ground);
            drawMesh(meshes.cube, 6, 24);
            popMatrix();
        }

        drawFloor();
    }

    // The same floor tile is drawn twice: your court and the rival's
    function drawFloor() {
        setMaterial(MATERIALS.court);
        for (const hoop of [Game.player.hoop, Game.rival.hoop]) {
            pushMatrix();
            transform(translate(hoop.base[0], 0, hoop.base[2]));
            drawMesh(meshes.floor);
            popMatrix();
        }
    }

    // ---------- Crowd: bleachers and fans ----------
    // Each fan is one flat card with a cut-out person image, moved up and
    // down by crowd.js. To stay fast with a big crowd (160 at the Pro Arena),
    // fans are drawn in batches: all fans with the same shirt color are put
    // into one list of triangles and drawn with a single call, instead of one
    // call (and one matrix) per fan.
    let crowdBatches = [];          // one per shirt color: { material, fans, positions, buffers }

    function buildCrowdBatches() {
        for (const batch of crowdBatches) {
            gl.deleteBuffer(batch.position); gl.deleteBuffer(batch.normal); gl.deleteBuffer(batch.texcoord);
        }
        crowdBatches = fanMaterials.map((material, shirt) => {
            const fans = Crowd.getFans().filter((fan) => fan.shirt === shirt);
            // Every fan is 2 triangles = 6 corners. The normals (facing the court)
            // and the texture corners never change, so they are sent once.
            const normals = [], texcoords = [];
            const corners = [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]];
            for (let i = 0; i < fans.length; i++) {
                for (const [u, v] of corners) { normals.push(0, 0, 1); texcoords.push(u, v); }
            }
            function buffer(data) {
                const b = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, b);
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
                return b;
            }
            return {
                material: material, fans: fans,
                positions: new Float32Array(fans.length * 18),     // rebuilt every frame
                position: gl.createBuffer(), normal: buffer(normals), texcoord: buffer(texcoords)
            };
        }).filter((batch) => batch.fans.length > 0);
    }

    function drawCrowd(time) {
        setMaterial(MATERIALS.bleachers);
        for (const step of Crowd.getBleachers()) {
            pushMatrix();
            transform(translate(step.center[0], step.center[1], step.center[2]));
            drawBox(step.size[0], step.size[1], step.size[2]);
            popMatrix();
        }
        const hype = Effects.getHype(), cheer = Effects.getCheer(), stomp = Effects.intense();
        pushMatrix();                       // the corners below are in world space (or mirrored, for the reflection)
        sendModelMatrix();
        for (const batch of crowdBatches) {
            const p = batch.positions;
            batch.fans.forEach((fan, i) => {
                const up = Crowd.jumpHeight(fan, time, hype, cheer, stomp);
                const tall = 1.4 * fan.size, half = 0.35 * fan.size;
                const x0 = fan.x - half, x1 = fan.x + half, y0 = fan.y + up, y1 = y0 + tall, z = fan.z;
                // two triangles, counter-clockwise when seen from the court
                p.set([x0, y0, z, x1, y0, z, x1, y1, z, x0, y0, z, x1, y1, z, x0, y1, z], i * 18);
            });
            setMaterial(batch.material);
            gl.bindBuffer(gl.ARRAY_BUFFER, batch.position);
            gl.bufferData(gl.ARRAY_BUFFER, p, gl.DYNAMIC_DRAW);
            gl.vertexAttribPointer(attrib.position, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(attrib.position);
            gl.bindBuffer(gl.ARRAY_BUFFER, batch.normal);
            gl.vertexAttribPointer(attrib.normal, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(attrib.normal);
            gl.bindBuffer(gl.ARRAY_BUFFER, batch.texcoord);
            gl.vertexAttribPointer(attrib.texcoord, 2, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(attrib.texcoord);
            gl.drawArrays(gl.TRIANGLES, 0, batch.fans.length * 6);
        }
        popMatrix();
    }

    // ---------- Effects: ball trails, confetti, fire and smoke (from effects.js) ----------
    function drawEffects() {
        for (const trail of Effects.ballTrails()) {
            drawLines(dynamicBuffer, trail.points, gl.LINE_STRIP, trail.color, trail.alpha);
        }
        for (const group of Effects.dots()) {
            // fire adds its light to what is behind it; confetti and smoke cover it
            if (group.additive) gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
            drawDots(group.points, group.size, group.color, group.alpha, group.shape);
            if (group.additive) gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        }
    }

    // ---------- Weather: rain, snow and wind-blown dust ----------
    // Simple particles that fall through a box over both courts and wrap around.
    const WEATHER_BOX = { x0: ARENA.x0 - 2, x1: ARENA.x1 + 2, z0: ARENA.z0 - 1, z1: ARENA.z1 + 1, top: 11 };
    const WEATHER = {
        rain:   { count: 450, fall: 9,   drift: 0.6 },
        snow:   { count: 380, fall: 1.1, drift: 0 },
        breeze: { count: 110, fall: 0.25, drift: 0 }    // dust that shows which way the wind blows
    };
    let weatherKind = null;
    let weatherPoints = new Float32Array(0);

    function resetWeather(kind) {
        weatherKind = kind;
        const n = kind ? WEATHER[kind].count : 0;
        weatherPoints = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) placeDrop(i, Math.random() * WEATHER_BOX.top);
    }
    function placeDrop(i, y) {
        weatherPoints[i * 3] = WEATHER_BOX.x0 + Math.random() * (WEATHER_BOX.x1 - WEATHER_BOX.x0);
        weatherPoints[i * 3 + 1] = y;
        weatherPoints[i * 3 + 2] = WEATHER_BOX.z0 + Math.random() * (WEATHER_BOX.z1 - WEATHER_BOX.z0);
    }
    // wind is the sideways push from game.js (m/s^2); the particles show it as speed
    function updateWeather(dt, wind, time) {
        if (!weatherKind) return;
        const w = WEATHER[weatherKind];
        const sideways = w.drift + wind * 9;
        for (let i = 0; i < weatherPoints.length / 3; i++) {
            weatherPoints[i * 3 + 1] -= w.fall * dt;
            weatherPoints[i * 3] += sideways * dt;
            if (weatherKind === 'snow') weatherPoints[i * 3] += Math.sin(time * 1.5 + i) * 0.3 * dt;    // flutter
            const x = weatherPoints[i * 3];
            if (weatherPoints[i * 3 + 1] < 0) placeDrop(i, WEATHER_BOX.top);
            else if (x > WEATHER_BOX.x1) weatherPoints[i * 3] = WEATHER_BOX.x0;
            else if (x < WEATHER_BOX.x0) weatherPoints[i * 3] = WEATHER_BOX.x1;
        }
    }
    function drawWeather(wind) {
        if (!weatherKind) return;
        if (weatherKind === 'rain') {
            // each drop is a short slanted line
            const lines = new Float32Array(weatherPoints.length * 2);
            const slant = (WEATHER.rain.drift + wind * 9) * 0.04;
            for (let i = 0; i < weatherPoints.length / 3; i++) {
                const x = weatherPoints[i * 3], y = weatherPoints[i * 3 + 1], z = weatherPoints[i * 3 + 2];
                lines.set([x, y, z, x - slant, y + 0.36, z], i * 6);
            }
            drawLines(dynamicBuffer, lines, gl.LINES, [0.75, 0.8, 0.9], 0.55);
        } else if (weatherKind === 'snow') {
            drawDots(weatherPoints, 0.05, [1, 1, 1], 0.9, 1);
        } else {
            drawDots(weatherPoints, 0.035, [0.95, 0.9, 0.75], 0.6, 1);
        }
    }

    // ---------- One view of the scene ----------
    // Draws everything from one camera into one rectangle of the canvas.
    // rect = { x, y, width, height } in canvas pixels (y measured from the bottom).
    function drawView(scene, cam, rect, lights, fogDensity, time) {
        gl.viewport(rect.x, rect.y, rect.width, rect.height);
        gl.scissor(rect.x, rect.y, rect.width, rect.height);    // only clear and draw inside the rectangle
        const fogColor = [0.62, 0.64, 0.68];
        if (fogDensity > 0) gl.clearColor(fogColor[0], fogColor[1], fogColor[2], 1);
        else gl.clearColor(0.03, 0.03, 0.05, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Camera: where the eye is, what it looks at, and the lens
        const view = lookAt(cam.eye.slice(), cam.at.slice(), cam.up.slice());
        const projection = perspective(cam.fov, rect.width / rect.height, cam.near, cam.far);
        gl.uniformMatrix4fv(uniform.uView, false, flatten(view));
        gl.uniformMatrix4fv(uniform.uProjection, false, flatten(projection));
        lastView = view; lastProjection = projection;
        gl.uniform1f(uniform.uNormalSign, 1);
        gl.uniform1f(uniform.uFogDensity, fogDensity);
        gl.uniform3fv(uniform.uFogColor, fogColor);
        gl.uniform3fv(uniform.uTint, scene.tint || [1, 1, 1]);
        setLights(lights, cam.eye);
        pointScale = (rect.height / 2) / Math.tan(radians(cam.fov) / 2);

        ballSkin = scene.ballSkin;
        const wind = scene.state.wind[0];

        gl.uniform1f(uniform.uFade, 1);
        modelMatrix = mat4();

        // 1. the arena (walls or sky, ground, floor). Everything else is inside
        //    it, so it never hides anything and its depth is not needed later.
        drawArena();
        // 2. on a shiny floor, a faded mirror image of the hoops, balls and players
        if (reflection > 0) {
            drawReflection(scene, lights, cam.eye, time);
            modelMatrix = mat4();
        }

        // 3. solid objects
        drawCrowd(time);
        for (const hoop of scene.hoops) drawHoop(hoop, time);
        for (const ball of scene.balls) drawBall(ball);
        drawShooter(scene.state.player);
        drawShooter(scene.state.rival);

        // 4. see-through things last, without writing depth
        gl.enable(gl.BLEND);
        gl.depthMask(false);
        drawSpots(scene.state.player, [1, 0.85, 0.2]);
        drawSpots(scene.state.rival, [1, 0.35, 0.3]);
        for (const ball of scene.balls) drawShadow(ball);
        drawShooterShadow(scene.state.player);
        drawShooterShadow(scene.state.rival);
        drawWeather(wind);
        drawEffects();
        gl.depthMask(true);
        gl.disable(gl.BLEND);
    }

    // Where a point in the world lands on the screen, in canvas pixels
    // (used to place floating text like "+2" over the rim).
    // viewIndex: 0 = your view; 1 = Player 2's half in two-player.
    let lastView = mat4(), lastProjection = mat4();
    const screens = [];                         // for each view: its matrices and rectangle
    const fogAmounts = [0, 0];
    function timesPoint(m, p) {                 // 4x4 matrix times a point [x, y, z, w]
        return m.map((row) => row[0] * p[0] + row[1] * p[1] + row[2] * p[2] + row[3] * p[3]);
    }
    window.worldToScreen = function (p, viewIndex) {
        const screen = screens[viewIndex || 0];
        if (!screen) return { x: 0, y: 0, visible: false };
        const clip = timesPoint(screen.projection, timesPoint(screen.view, [p[0], p[1], p[2], 1]));
        // canvas pixels, then back to stage pixels (800 x 600) for the HUD
        const k = Layout.canvasScale();
        return {
            x: (screen.rect.x + (clip[0] / clip[3] * 0.5 + 0.5) * screen.rect.width) / k,
            y: (canvas.height - screen.rect.y - (clip[1] / clip[3] * 0.5 + 0.5) * screen.rect.height) / k,
            visible: clip[3] > 0
        };
    };

    // ---------- Reflections in a shiny floor ----------
    // After the arena and floor are drawn, the hoops, balls and players are drawn again
    // upside down under it (a mirror image: scale y by -1), lit by mirrored
    // lights and faded (uFade), so they show on the floor like on polished
    // wood or ice. Then the depth is cleared so the real scene draws normally.
    // Mirroring turns triangles inside out, so the front-face winding is
    // flipped while drawing it. The walls and crowd are not mirrored: that
    // would double the work for the biggest things on screen.
    function drawReflection(scene, lights, eye, time) {
        const mirroredLights = {
            ambient: lights.ambient,
            lights: lights.lights.map((l) => ({
                position: [l.position[0], -l.position[1], l.position[2]],
                color: l.color,
                direction: [l.direction[0], -l.direction[1], l.direction[2]],
                cone: l.cone
            }))
        };
        setLights(mirroredLights, eye);
        gl.uniform1f(uniform.uFade, reflection);
        gl.enable(gl.BLEND);
        gl.frontFace(gl.CW);
        gl.clear(gl.DEPTH_BUFFER_BIT);          // the floor must not hide what is under it
        modelMatrix = scalem(1, -1, 1);
        for (const hoop of scene.hoops) drawHoop(hoop, time);
        for (const ball of scene.balls) drawBall(ball);
        drawShooter(scene.state.player);
        drawShooter(scene.state.rival);
        gl.frontFace(gl.CCW);
        gl.disable(gl.BLEND);
        gl.uniform1f(uniform.uFade, 1);
        setLights(lights, eye);
        gl.clear(gl.DEPTH_BUFFER_BIT);
    }

    // The small rival view sits inside the #rival-view box from index.html.
    // The box is measured in stage pixels; the canvas may have more pixels.
    const insetBox = document.getElementById('rival-view');
    function insetRect() {
        const k = Layout.canvasScale();
        return {
            x: Math.round((insetBox.offsetLeft + 2) * k),
            y: Math.round(canvas.height - (insetBox.offsetTop + insetBox.offsetHeight - 2) * k),
            width: Math.round((insetBox.offsetWidth - 4) * k),
            height: Math.round((insetBox.offsetHeight - 4) * k)
        };
    }

    // ---------- One frame ----------
    let lastTime = performance.now();

    softTextures.disc = makeTexture(Textures.softDisc(), false);
    softTextures.ring = makeTexture(Textures.ring(), false);
    loadCourt(Game.state.court);

    // The rectangle of the canvas for each kind of view (y measured from the bottom)
    function rectFor(name) {
        const w = canvas.width, h = canvas.height;
        const gap = Math.max(1, Math.round(Layout.canvasScale()));                       // a thin line between halves
        if (name === 'left') return { x: 0, y: 0, width: Math.floor(w / 2) - gap, height: h };   // split screen
        if (name === 'right') return { x: Math.ceil(w / 2) + gap, y: 0, width: Math.floor(w / 2) - gap, height: h };
        if (name === 'inset') return insetRect();
        return { x: 0, y: 0, width: w, height: h };
    }

    window.renderScene = function (scene) {
        const now = performance.now();
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;
        const time = now / 1000;
        // animations pause with the game during a power-up pick
        if (scene.state.mode !== 'picking') {
            hoopAnims.forEach((anim) => { for (const key in anim) stepSpring(anim[key], dt); });
            updateWeather(dt, scene.state.wind[0], time);
        }

        gl.disable(gl.SCISSOR_TEST);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);              // the gap between split-screen halves stays black
        gl.enable(gl.SCISSOR_TEST);
        scene.views.forEach((view, i) => {
            // fog fades in and out so it does not pop
            fogAmounts[i] += ((view.fog ? 1 : 0) - fogAmounts[i]) * Math.min(1, dt * 3);
            const rect = rectFor(view.rect);
            // a view can draw its own balls (an instant replay draws only the replay ball)
            const viewScene = view.balls ? Object.assign({}, scene, { balls: view.balls }) : scene;
            drawView(viewScene, view.camera, rect,
                view.blackout ? blackoutLighting(view.hoopX) : lighting, fogAmounts[i] * 0.16, time);
            screens[i] = { view: lastView, projection: lastProjection, rect: rect };
        });
        gl.disable(gl.SCISSOR_TEST);
    };
})();

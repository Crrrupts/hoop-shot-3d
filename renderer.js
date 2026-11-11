// renderer.js — draws the game with plain WebGL, our own GLSL shaders and MV.js.
//
// main.js calls window.renderScene(scene) once per frame. This file:
//   1. builds the meshes (geometry.js) and textures (textures.js) once at startup
//   2. every frame, sets the camera (lookAt + perspective) and the lights
//   3. draws the arena, court, hoop, balls, net, aim arc and shadows
//
// The shaders are in index.html (ids "vertex-shader" and "fragment-shader").
// Lighting is Phong shading done per pixel: ambient + diffuse + specular,
// with an overhead spotlight.
//
// The hoop is a hierarchy drawn with a matrix stack:
//   hoop root -> pole -> arm -> backboard -> rim -> net
// Moving or shaking a parent moves everything below it.

(function () {
    // The 2D wireframe test view (?debug) uses the canvas instead of WebGL
    if (location.search.includes('debug')) return;

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
        'uModel', 'uView', 'uProjection', 'uNormalMatrix', 'uNormalSign', 'uTexScale',
        'uEye', 'uAmbientLight', 'uLightPosition', 'uLightColor', 'uSpotDirection', 'uSpotCone',
        'uColor', 'uSpecular', 'uShininess', 'uAlpha', 'uLit', 'uUseTexture', 'uTexture'
    ];
    const uniform = {};
    uniformNames.forEach((name) => { uniform[name] = gl.getUniformLocation(program, name); });

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);                    // skip triangles that face away from the camera
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0.03, 0.03, 0.05, 1);

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

    // Arena and floor cover x from -11 to 11 and z from -5 to 17 (meters)
    const ARENA = { x0: -11, x1: 11, z0: -5, z1: 17, height: 10 };

    const meshes = {
        sphere: makeMesh(Geometry.sphere(32, 20)),
        torus: makeMesh(Geometry.torus(Physics.RIM_RADIUS, Physics.RIM_TUBE * 1.3, 48, 10)),
        cube: makeMesh(Geometry.cube()),
        floor: makeMesh(Geometry.plane(ARENA.x0, ARENA.z0, ARENA.x1, ARENA.z1, 24)),
        disc: makeMesh(Geometry.disc(28))
    };

    // Line buffers that change every frame (net and aim arc)
    const netBuffer = gl.createBuffer();
    const arcBuffer = gl.createBuffer();

    // ---------- Textures ----------
    function makeTexture(image, repeat) {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);       // image top = v of 1
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
        gl.generateMipmap(gl.TEXTURE_2D);                    // smaller copies for far-away pixels
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
        return t;
    }
    const textures = {
        ball: makeTexture(Textures.ball(), true),
        court: makeTexture(Textures.court(ARENA.x0, ARENA.z0, ARENA.x1, ARENA.z1), false),
        backboard: makeTexture(Textures.backboard(), false),
        wall: makeTexture(Textures.wall(), true)
    };

    // ---------- Materials ----------
    // color: base color (multiplied by the texture if there is one)
    // specular + shininess: the shiny highlight (0 specular = matte)
    const MATERIALS = {
        ball:     { color: [1, 1, 1], specular: [0.25, 0.22, 0.2], shininess: 18, texture: textures.ball },
        court:    { color: [1, 1, 1], specular: [0.06, 0.06, 0.06], shininess: 8, texture: textures.court },   // matte
        board:    { color: [1, 1, 1], specular: [0.3, 0.3, 0.3], shininess: 40, texture: textures.backboard },
        rim:      { color: [0.95, 0.35, 0.08], specular: [1, 0.9, 0.8], shininess: 90 },                        // shiny metal
        pole:     { color: [0.2, 0.22, 0.27], specular: [0.5, 0.5, 0.5], shininess: 50 },
        wall:     { color: [0.8, 0.8, 0.8], specular: [0, 0, 0], shininess: 1, texture: textures.wall, texScale: [6, 1] },
        ceiling:  { color: [0.12, 0.12, 0.14], specular: [0, 0, 0], shininess: 1 }
    };

    function setMaterial(m) {
        gl.uniform3fv(uniform.uColor, m.color);
        gl.uniform3fv(uniform.uSpecular, m.specular || [0, 0, 0]);
        gl.uniform1f(uniform.uShininess, m.shininess || 1);
        gl.uniform1f(uniform.uAlpha, m.alpha === undefined ? 1 : m.alpha);
        gl.uniform1i(uniform.uLit, m.unlit ? 0 : 1);
        gl.uniform2fv(uniform.uTexScale, m.texScale || [1, 1]);
        if (m.texture) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, m.texture);
            gl.uniform1i(uniform.uTexture, 0);
            gl.uniform1i(uniform.uUseTexture, 1);
        } else {
            gl.uniform1i(uniform.uUseTexture, 0);
        }
    }

    // ---------- Lights ----------
    // Up to 3 lights. cone = [inner, outer] angle in degrees for a spotlight,
    // or null for a light that shines in every direction.
    const LIGHTING = {
        ambient: [0.42, 0.42, 0.46],
        lights: [
            // overhead spotlight above the key, pointing straight down
            { position: [0, 9.5, 2.5], color: [0.95, 0.92, 0.85], direction: [0, -1, 0], cone: [38, 62] },
            // soft fill light behind the shooter so the hoop is not flat
            { position: [0, 6, 14], color: [0.22, 0.22, 0.25], direction: [0, -1, 0], cone: null },
            { position: [0, 0, 0], color: [0, 0, 0], direction: [0, -1, 0], cone: null }    // unused
        ]
    };

    function setLights(eye) {
        const positions = [], colors = [], directions = [], cones = [];
        for (const light of LIGHTING.lights) {
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
        gl.uniform3fv(uniform.uAmbientLight, LIGHTING.ambient);
        gl.uniform3fv(uniform.uEye, eye);
    }

    // ---------- Matrix stack (for the hierarchy) ----------
    let modelMatrix = mat4();
    const stack = [];
    function pushMatrix() { stack.push(modelMatrix); }
    function popMatrix() { modelMatrix = stack.pop(); }
    function transform(m) { modelMatrix = mult(modelMatrix, m); }

    // Send the current model matrix (and the matching normal matrix) to the shader
    function sendModelMatrix() {
        gl.uniformMatrix4fv(uniform.uModel, false, flatten(modelMatrix));
        gl.uniformMatrix3fv(uniform.uNormalMatrix, false, flatten(normalMatrix(modelMatrix, true)));
    }

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

    // Draw line points [x, y, z, ...] in a flat color. mode is gl.LINES or gl.LINE_STRIP.
    function drawLines(buffer, points, mode, color, alpha) {
        if (points.length < 6) return;
        setMaterial({ color: color, unlit: true, alpha: alpha });
        sendModelMatrix();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(attrib.position, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(attrib.position);
        gl.disableVertexAttribArray(attrib.normal);         // lines have no normals or texture
        gl.disableVertexAttribArray(attrib.texcoord);
        gl.drawArrays(mode, 0, points.length / 3);
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
    const hoopAnim = {
        boardTilt: makeSpring(900, 14),     // backboard wobble (degrees)
        rimTilt: makeSpring(1400, 16),      // rim shake (degrees)
        netX: makeSpring(120, 5),           // net sway (meters at the bottom)
        netZ: makeSpring(120, 5),
        netStretch: makeSpring(260, 9)      // net pulled down by the ball
    };

    // game.js tells us when the ball hits something or goes in
    if (typeof Game !== 'undefined' && Game.on) {
        Game.on(function (name, data) {
            if (name === 'bounce' && data.surface === 'rim') {
                hoopAnim.rimTilt.speed -= Math.min(data.speed, 8) * 10;
                hoopAnim.boardTilt.speed -= Math.min(data.speed, 8) * 3;
                hoopAnim.netX.speed += (Math.random() - 0.5) * 0.6;
            }
            if (name === 'bounce' && data.surface === 'board') {
                hoopAnim.boardTilt.speed -= Math.min(data.speed, 8) * 9;
            }
            if (name === 'basket') {
                // the ball drags the net down and sideways; a swish snaps harder
                hoopAnim.netStretch.speed += data.swish ? 6.5 : 4.5;
                hoopAnim.netX.speed += data.vel[0] * 0.5;
                hoopAnim.netZ.speed += data.vel[2] * 0.5;
            }
        });
    }

    // ---------- The hoop: pole -> arm -> backboard -> rim -> net ----------
    // Sizes come from physics.js so what you see matches what the ball hits.
    function drawHoop(offset, time) {
        const P = Physics.POLE, B = Physics.BOARD;
        const poleSize = [P.max[0] - P.min[0], P.max[1] - P.min[1], P.max[2] - P.min[2]];
        const poleCenterZ = (P.min[2] + P.max[2]) / 2;
        const boardSize = [B.max[0] - B.min[0], B.max[1] - B.min[1], B.max[2] - B.min[2]];
        const boardCenter = [0, (B.min[1] + B.max[1]) / 2, (B.min[2] + B.max[2]) / 2];
        const armY = 3.25;                                  // where the arm leaves the pole
        const armLength = B.min[2] - P.max[2];              // from the pole's front to the board's back

        pushMatrix();
        // ROOT: the whole hoop slides with the Moving Hoop offset
        transform(translate(offset[0], offset[1], offset[2]));

        // POLE (origin at the pole's base)
        transform(translate(0, 0, poleCenterZ));
        setMaterial(MATERIALS.pole);
        pushMatrix();
        transform(translate(0, poleSize[1] / 2, 0));
        drawBox(poleSize[0], poleSize[1], poleSize[2]);
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
        setMaterial(MATERIALS.board);
        drawBox(boardSize[0], boardSize[1], boardSize[2]);

        // RIM (origin at the rim's center). It shakes around the point where
        // it is bolted to the board.
        const rimBack = -Physics.RIM_RADIUS;                // back edge of the rim
        const boardFront = boardSize[2] / 2;
        transform(translate(0, Physics.RIM_HEIGHT - boardCenter[1], boardFront));
        transform(rotateX(hoopAnim.rimTilt.value));
        transform(translate(0, 0, -boardCenter[2] - boardFront));
        setMaterial(MATERIALS.rim);
        drawMesh(meshes.torus);
        // small plate that joins the rim to the board
        const plateLength = rimBack - B.max[2];
        pushMatrix();
        transform(translate(0, -0.01, rimBack - plateLength / 2));
        drawBox(0.12, 0.02, plateLength);
        popMatrix();

        // NET (hangs from the rim, drawn as lines). It always sways a little.
        const idle = 0.012 * Math.sin(time * 1.3);
        const net = Geometry.netLines(Physics.RIM_RADIUS, Physics.NET_DEPTH,
            hoopAnim.netX.value + idle, hoopAnim.netZ.value, Math.max(-0.3, hoopAnim.netStretch.value));
        drawLines(netBuffer, net, gl.LINES, [0.96, 0.96, 0.96], 1);

        popMatrix();
    }

    // ---------- Ball ----------
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
        pushMatrix();
        transform(translate(ball.pos[0], ball.pos[1], ball.pos[2]));    // move to the ball's position
        transform(spin.matrix);                                          // spin it
        transform(scalem(Physics.BALL_RADIUS, Physics.BALL_RADIUS, Physics.BALL_RADIUS));
        setMaterial(MATERIALS.ball);
        drawMesh(meshes.sphere);
        popMatrix();
    }

    // Dark see-through disc on the floor under a ball (fades as the ball goes up)
    function drawShadow(ball) {
        const h = Math.max(0, ball.pos[1] - Physics.BALL_RADIUS);
        const size = Physics.BALL_RADIUS * (1 + h * 0.12);
        pushMatrix();
        transform(translate(ball.pos[0], 0.012, ball.pos[2]));
        transform(scalem(size, 1, size));
        setMaterial({ color: [0, 0, 0], unlit: true, alpha: 0.5 / (1 + h * 0.45) });
        drawMesh(meshes.disc);
        popMatrix();
    }

    // Circles on the floor at the 5 shooting spots; the current one is brighter
    function drawSpots(state) {
        for (let i = 1; i <= Game.SPOTS.length; i++) {
            const p = Game.spotPosition(i);
            const current = i === state.spot;
            pushMatrix();
            transform(translate(p[0], 0.008, p[2]));
            transform(scalem(0.32, 1, 0.32));
            setMaterial({
                color: current ? [1, 0.85, 0.2] : [1, 1, 1],
                unlit: true,
                alpha: current ? 0.75 : 0.22
            });
            drawMesh(meshes.disc);
            popMatrix();
        }
    }

    // ---------- Arena (inverted box) and floor ----------
    function drawArena() {
        const w = ARENA.x1 - ARENA.x0, d = ARENA.z1 - ARENA.z0;
        pushMatrix();
        transform(translate((ARENA.x0 + ARENA.x1) / 2, ARENA.height / 2, (ARENA.z0 + ARENA.z1) / 2));
        transform(scalem(w, ARENA.height, d));
        // We are inside the cube, so draw its inner sides: flip the normals
        // and cull the front faces instead of the back faces.
        gl.cullFace(gl.FRONT);
        gl.uniform1f(uniform.uNormalSign, -1);
        setMaterial(MATERIALS.wall);
        drawMesh(meshes.cube, 24, 0);           // the 4 walls (first 4 faces of the cube)
        setMaterial(MATERIALS.ceiling);
        drawMesh(meshes.cube, 6, 24);           // the ceiling (5th face)
        gl.uniform1f(uniform.uNormalSign, 1);
        gl.cullFace(gl.BACK);
        popMatrix();

        setMaterial(MATERIALS.court);
        drawMesh(meshes.floor);
    }

    // ---------- One frame ----------
    let lastTime = performance.now();

    window.renderScene = function (scene) {
        const now = performance.now();
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;
        for (const key in hoopAnim) stepSpring(hoopAnim[key], dt);

        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Camera: where the eye is, what it looks at, and the lens
        const cam = scene.camera;
        const view = lookAt(cam.eye.slice(), cam.at.slice(), cam.up.slice());
        const projection = perspective(cam.fov, canvas.width / canvas.height, cam.near, cam.far);
        gl.uniformMatrix4fv(uniform.uView, false, flatten(view));
        gl.uniformMatrix4fv(uniform.uProjection, false, flatten(projection));
        gl.uniform1f(uniform.uNormalSign, 1);
        setLights(cam.eye);

        modelMatrix = mat4();

        // 1. solid objects
        drawArena();
        drawHoop(scene.hoopOffset, now / 1000);
        drawBall(scene.ball);

        // 2. aim arc (easy mode), drawn as a line strip
        const arcPoints = [];
        for (const p of scene.aimPath) arcPoints.push(p[0], p[1], p[2]);
        drawLines(arcBuffer, arcPoints, gl.LINE_STRIP, [1, 0.9, 0.3], 1);

        // 3. see-through things last, without writing depth
        gl.enable(gl.BLEND);
        gl.depthMask(false);
        drawSpots(scene.state);
        drawShadow(scene.ball);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
    };
})();

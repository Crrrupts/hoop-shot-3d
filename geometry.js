// geometry.js — every 3D shape in the game, generated in code (no model files).
//
// Each function returns a "mesh" made of plain arrays:
//   positions  [x, y, z,  x, y, z, ...]   one point per vertex
//   normals    [x, y, z, ...]             which way the surface faces (for lighting)
//   texcoords  [u, v, ...]                where the vertex sits on the texture image
//   indices    [a, b, c, ...]             which 3 vertices make each triangle
// renderer.js copies these arrays into WebGL buffers.

const Geometry = (function () {

    // ---------- Sphere (the ball) ----------
    // A "UV sphere": rings of latitude (stacks) and longitude (slices), radius 1.
    // u goes around the ball, v goes from the bottom pole (0) to the top pole (1).
    function sphere(slices, stacks) {
        const positions = [], normals = [], texcoords = [], indices = [];
        for (let i = 0; i <= stacks; i++) {
            const v = i / stacks;
            const lat = (v - 0.5) * Math.PI;            // -90 to +90 degrees
            for (let j = 0; j <= slices; j++) {
                const u = j / slices;
                const lon = u * 2 * Math.PI;
                const x = Math.cos(lat) * Math.cos(lon);
                const y = Math.sin(lat);
                const z = Math.cos(lat) * Math.sin(lon);
                positions.push(x, y, z);
                normals.push(x, y, z);                  // on a unit sphere the normal = the point
                texcoords.push(u, v);
            }
        }
        const row = slices + 1;
        for (let i = 0; i < stacks; i++) {
            for (let j = 0; j < slices; j++) {
                const a = i * row + j, b = a + row;
                indices.push(a, b, a + 1, a + 1, b, b + 1);
            }
        }
        return { positions, normals, texcoords, indices };
    }

    // ---------- Torus (the rim) ----------
    // A circle of radius R lying flat in the x-z plane, with a tube of radius r around it.
    function torus(R, r, ringSegments, tubeSegments) {
        const positions = [], normals = [], texcoords = [], indices = [];
        for (let i = 0; i <= ringSegments; i++) {
            const a = (i / ringSegments) * 2 * Math.PI;         // angle around the ring
            const cx = Math.cos(a), cz = Math.sin(a);
            for (let j = 0; j <= tubeSegments; j++) {
                const b = (j / tubeSegments) * 2 * Math.PI;     // angle around the tube
                const nx = Math.cos(b) * cx, ny = Math.sin(b), nz = Math.cos(b) * cz;
                positions.push(R * cx + r * nx, r * ny, R * cz + r * nz);
                normals.push(nx, ny, nz);
                texcoords.push(i / ringSegments, j / tubeSegments);
            }
        }
        const row = tubeSegments + 1;
        for (let i = 0; i < ringSegments; i++) {
            for (let j = 0; j < tubeSegments; j++) {
                const a = i * row + j, b = a + row;
                indices.push(a, a + 1, b, a + 1, b + 1, b);
            }
        }
        return { positions, normals, texcoords, indices };
    }

    // ---------- Unit cube (backboard, pole, arm, arena walls) ----------
    // Centered on the origin, 1 unit on each side. The same cube is scaled into
    // every box-shaped object. Each face has its own 4 vertices so the normals
    // stay flat, and its own 0..1 texture square.
    function cube() {
        const positions = [], normals = [], texcoords = [], indices = [];
        // For each face: the normal, and the "right" and "up" directions on that face
        const faces = [
            { n: [0, 0, 1],  right: [1, 0, 0],  up: [0, 1, 0] },    // front (+z)
            { n: [0, 0, -1], right: [-1, 0, 0], up: [0, 1, 0] },    // back
            { n: [1, 0, 0],  right: [0, 0, -1], up: [0, 1, 0] },    // right
            { n: [-1, 0, 0], right: [0, 0, 1],  up: [0, 1, 0] },    // left
            { n: [0, 1, 0],  right: [1, 0, 0],  up: [0, 0, -1] },   // top
            { n: [0, -1, 0], right: [1, 0, 0],  up: [0, 0, 1] }     // bottom
        ];
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];       // around the face, counter-clockwise
        faces.forEach((f, k) => {
            for (const [s, t] of corners) {
                for (let i = 0; i < 3; i++) positions.push(0.5 * (f.n[i] + s * f.right[i] + t * f.up[i]));
                normals.push(f.n[0], f.n[1], f.n[2]);
                texcoords.push((s + 1) / 2, (t + 1) / 2);
            }
            const a = k * 4;
            indices.push(a, a + 1, a + 2, a, a + 2, a + 3);
        });
        return { positions, normals, texcoords, indices };
    }

    // ---------- Plane (the court floor) ----------
    // Flat in x-z at y = 0, from (x0, z0) to (x1, z1), split into a grid so the
    // spotlight shades it smoothly. The texture covers the whole plane once.
    function plane(x0, z0, x1, z1, divisions) {
        const positions = [], normals = [], texcoords = [], indices = [];
        for (let i = 0; i <= divisions; i++) {
            for (let j = 0; j <= divisions; j++) {
                const u = j / divisions, t = i / divisions;
                positions.push(x0 + (x1 - x0) * u, 0, z0 + (z1 - z0) * t);
                normals.push(0, 1, 0);
                texcoords.push(u, 1 - t);       // image top = far end of the court
            }
        }
        const row = divisions + 1;
        for (let i = 0; i < divisions; i++) {
            for (let j = 0; j < divisions; j++) {
                const a = i * row + j, b = a + row;
                indices.push(a, b, a + 1, a + 1, b, b + 1);
            }
        }
        return { positions, normals, texcoords, indices };
    }

    // ---------- Disc (ball shadow, shooting-spot markers) ----------
    // Flat circle of radius 1 in the x-z plane, facing up.
    function disc(segments) {
        const positions = [0, 0, 0], normals = [0, 1, 0], texcoords = [0.5, 0.5], indices = [];
        for (let i = 0; i <= segments; i++) {
            const a = (i / segments) * 2 * Math.PI;
            positions.push(Math.cos(a), 0, Math.sin(a));
            normals.push(0, 1, 0);
            texcoords.push(0.5 + 0.5 * Math.cos(a), 0.5 + 0.5 * Math.sin(a));
        }
        for (let i = 1; i <= segments; i++) indices.push(0, i + 1, i);
        return { positions, normals, texcoords, indices };
    }

    // ---------- Net (lines) ----------
    // The net is a diamond pattern of line segments hanging from the rim.
    // It is rebuilt every frame so it can sway and stretch:
    //   swayX, swayZ  how far the bottom of the net is pushed sideways (meters)
    //   stretch       extra length, as a fraction (0.2 = 20% longer)
    // Returns [x, y, z, ...] with 2 points per line, measured from the rim center.
    const NET_STRANDS = 16, NET_ROWS = 6;
    function netLines(rimRadius, depth, swayX, swayZ, stretch) {
        // Point number i on row j
        function point(i, j) {
            const t = j / NET_ROWS;                                 // 0 at the rim, 1 at the bottom
            const radius = rimRadius * (1 - 0.42 * Math.pow(t, 0.8));   // net narrows on the way down
            const a = ((i + 0.5 * (j % 2)) / NET_STRANDS) * 2 * Math.PI;    // every other row is shifted
            const bend = t * t;                                     // the bottom swings the most
            return [
                Math.cos(a) * radius + swayX * bend,
                -depth * t * (1 + stretch),
                Math.sin(a) * radius + swayZ * bend
            ];
        }
        const out = [];
        for (let j = 0; j < NET_ROWS; j++) {
            for (let i = 0; i < NET_STRANDS; i++) {
                const p = point(i, j);
                // each knot connects to the two knots below it
                const left = point(i + (j % 2 ? 0 : -1), j + 1);
                const right = point(i + (j % 2 ? 1 : 0), j + 1);
                out.push(...p, ...left, ...p, ...right);
            }
        }
        return out;
    }
    const NET_VERTEX_COUNT = NET_ROWS * NET_STRANDS * 4;

    return { sphere, torus, cube, plane, disc, netLines, NET_VERTEX_COUNT };
})();

if (typeof module !== 'undefined') module.exports = Geometry;

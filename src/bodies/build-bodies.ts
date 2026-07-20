import * as THREE from 'three';
import { CONFIG } from '../config';
import { scene, makeGlowTexture } from '../scene';
import { makeShapeFn, seededRand } from './shape';
import { seedMix } from '../world/seed';
import { orbitParams, bodyPosAt, deg, kmToUnits, orbiters } from './orbits';
import { applyTexture, liftVertexColors, TEX_FILES } from './textures';
import { bodies } from './gravity';
import type { Body, BodyCore, BodyDef, ShapeFn } from '../types';

// build/aim raycast targets: rocky surfaces, cores, rings (NOT clouds, NOT sun)
export const solidMeshes: THREE.Mesh[] = [];

// visual-only spin layers (v0.10 item 3): the loop sets rotation.y = rate * sim.time.
// Only ever cloud shells — nothing here is a physics body or a raycast target.
export const spinners: { node: THREE.Object3D; rate: number }[] = [];

const GAS_PALETTES: Record<string, string[]> = {
  jupiter: ['#c9a06f','#e8d5b0','#a9744a','#e0c298','#8f5a3a','#d9b98a'],
  saturn:  ['#e6d3a3','#d8c090','#c9b083','#efe2bf'],
  uranus:  ['#9fd6de','#96cfd9','#a8dde3'],
  neptune: ['#3b5bd6','#2f4ab8','#4a6ce0','#3551c4']
};

const SPOTS: Record<string, { dir: THREE.Vector3; rad: number; color: string }> = {
  jupiter: { dir:new THREE.Vector3(0.8,-0.34,0.5).normalize(), rad:0.15, color:'#c1503a' },
  neptune: { dir:new THREE.Vector3(-0.6,0.25,0.76).normalize(), rad:0.10, color:'#16265e' }
};

const BODY_DEFS: BodyDef[] = [
  { name:'SUN', star:true, R:520, pos:new THREE.Vector3(0,0,0) },
  { name:'MERCURY', type:'rocky', km:2440,  au:0.39, ang:140, y:  60, paint:'mercury', craters:true },
  { name:'VENUS',   type:'rocky', km:6052,  au:0.72, ang:160, y: 120, paint:'venus',
    atmo:{h:0.30, color:0xe8d9a0, glow:0.5, drag:0.9, darken:0.3} },
  { name:'EARTH',   type:'rocky', km:6371,  au:1.00, ang:180, y:   0, paint:'earth',
    atmo:{h:0.16, color:0x6ab7ff, glow:0.38, drag:0.6, sky:'#3d6fb4'} },
  { name:'MARS',    type:'rocky', km:3390,  au:1.52, ang:195, y:-200, paint:'mars',
    atmo:{h:0.10, color:0xd9a066, glow:0.22, drag:0.3, sky:'#b4713d'} },
  { name:'JUPITER', type:'gas',   km:69911, au:5.20, ang:205, y: 350, paint:'jupiter', bands:12 },
  { name:'SATURN',  type:'gas',   km:58232, au:9.50, ang:215, y:-450, paint:'saturn',  bands:9,
    rings:[[1.24,1.72],[1.78,2.1]], ringTilt:27, ringTex:'8k_saturn_ring_alpha.png' },   // v0.7 rider: 2k -> 8k, graceful fallback intact
  { name:'URANUS',  type:'gas',   km:25362, au:19.2, ang:222, y: 600, paint:'uranus',  bands:5,
    rings:[[1.4,1.55]], ringTilt:98 },
  { name:'NEPTUNE', type:'gas',   km:24622, au:30.1, ang:228, y:-500, paint:'neptune', bands:7 },
  { name:'PLUTO',   type:'rocky', km:1188,  au:39.5, ang:233, y: 300, paint:'pluto', craters:true,
    atmo:{h:0.08, color:0xb0c4de, glow:0.15, drag:0.15} }
];

const SUN_R = BODY_DEFS.find(d=>d.star)!.R!;   // orbital speeds are derived from the sun's field

// BODY_DEFS is a loose table; each branch of addBody below guarantees the fields it reads
// (au/ang/y/km/paint for planets, R for the star, bands for gas), so the `!` assertions
// below assert exactly those per-branch invariants.

const PLUTO_HEART = new THREE.Vector3(0.5,0.15,0.85).normalize();

function paintVertex(paint: string, dir: THREE.Vector3, h: number, seed: number): THREE.Color {
  const c = new THREE.Color();
  if(paint==='earth') {
    if(Math.abs(dir.y) > 0.84) c.set('#eef3f6');
    else if(h > 1.06) c.set('#8a7a5f');
    else if(h > 1.02) {
      c.set('#3f7c3a');
      if(Math.abs(dir.y) < 0.28) c.lerp(new THREE.Color('#c2a35c'), 0.55);
      c.lerp(new THREE.Color('#6e8c4a'), (h-1.02)*8);
    }
    else if(h > 1.0) c.set('#2e6b96');
    else c.set('#173f6b').lerp(new THREE.Color('#0f2c50'), seededRand(seed)*0.5);
  } else if(paint==='mars') {
    c.set('#a14f2c').lerp(new THREE.Color('#5f2a14'), Math.min(1,Math.max(0,(h-0.92)*3)));
    if(Math.abs(dir.y) > 0.88) c.set('#ddd4c6');
  } else if(paint==='venus') {
    c.set('#c9a35c').lerp(new THREE.Color('#8a6a34'), Math.min(1,Math.max(0,(h-0.95)*4)));
  } else if(paint==='mercury') {
    c.set('#8a8a85').lerp(new THREE.Color('#5c5c56'), seededRand(seed*3)*0.7);
    if(h > 1.05) c.lerp(new THREE.Color('#a5a59e'), 0.4);
  } else if(paint==='pluto') {
    if(dir.angleTo(PLUTO_HEART) < 0.5) c.set('#e8dcc8');
    else if(h < 0.95) c.set('#4d3a28');
    else c.set('#c7a37a').lerp(new THREE.Color('#9a7a52'), seededRand(seed*5)*0.4);
  } else if(paint==='core') {
    c.set('#181b26').lerp(new THREE.Color('#232838'), seededRand(seed*7)*0.6);
  } else {
    c.set('#888880');
  }
  return c;
}

function gasBandColor(paint: string, dir: THREE.Vector3, bands: number, seed: number): THREE.Color {
  const spot = SPOTS[paint];
  if(spot && dir.angleTo(spot.dir) < spot.rad) return new THREE.Color(spot.color);
  const pal = GAS_PALETTES[paint];
  const lat = Math.asin(Math.max(-1,Math.min(1,dir.y)));
  const lon = Math.atan2(dir.z, dir.x);
  const t = CONFIG.gasTurb;
  const wobble = 0.3*t*Math.sin(lon*3 + lat*7 + seed)
               + 0.15*t*Math.sin(lon*7 - lat*11)
               + CONFIG.gasWobble3*Math.sin(lon*17 + lat*23 + seed*1.7);
  const idx = Math.abs(Math.floor((lat/Math.PI + 0.5)*bands + wobble)) % pal.length;
  return new THREE.Color(pal[idx]);
}

// segs = [widthSegs, heightSegs] switches to SphereGeometry, which carries the UVs a texture
// map needs (v0.6 item 2). Passed only by textured bodies: gas-giant cores and belt rocks are
// never textured, so they stay on the cheaper Icosahedron and keep their vertex budget for
// item 3's populated belt.
function buildRockyMesh(R: number, shapeFn: ShapeFn, paint: string, minDetail?: number, segs?: [number, number]): THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> {
  let geo: THREE.BufferGeometry;
  if(segs) {
    geo = new THREE.SphereGeometry(R, segs[0], segs[1]);
  } else {
    let detail = R > 120 ? 5 : (R > 40 ? 4 : 3);
    if(minDetail) detail = Math.max(detail, minDetail); // cratered bodies need verts to show bowls
    geo = new THREE.IcosahedronGeometry(R, detail);
  }
  const posAttr = geo.getAttribute('position');
  const colors = new Float32Array(posAttr.count*3);
  const v = new THREE.Vector3();
  let maxH = 1;
  for(let i=0;i<posAttr.count;i++){
    v.fromBufferAttribute(posAttr, i).normalize();
    const h = shapeFn(v);
    if(h > maxH) maxH = h;   // v0.6 item 6: the real peak, measured off the real vertices
    posAttr.setXYZ(i, v.x*R*h, v.y*R*h, v.z*R*h);
    const col = paintVertex(paint, v, h, i);
    colors[i*3]=col.r; colors[i*3+1]=col.g; colors[i*3+2]=col.b;
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors,3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({vertexColors:true, flatShading:true, roughness:0.95, metalness:0}));
  mesh.userData.maxH = maxH;   // peak terrain radius multiplier; the atmosphere shell reads it
  return mesh;
}

// Fresnel atmosphere shell. BackSide + depthTest means only the far hemisphere survives,
// so the glow reads as a halo hugging the limb. The logdepthbuf chunks are NOT optional:
// the renderer runs a logarithmic depth buffer, and a custom shader that skips them writes
// depth on a different curve to every other material in the scene (z-fighting at the limb).
const ATMO_VERT = `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vNormalW;
varying vec3 vViewDirW;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vViewDirW = cameraPosition - wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}`;

const ATMO_FRAG = `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uColor;
uniform float uFalloff;
uniform float uStrength;
varying vec3 vNormalW;
varying vec3 vViewDirW;
void main() {
  #include <logdepthbuf_fragment>
  float rim = 1.0 - abs(dot(normalize(vViewDirW), normalize(vNormalW)));
  float intensity = clamp(pow(rim, uFalloff) * uStrength, 0.0, 1.0);
  gl_FragColor = vec4(uColor, intensity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function addAtmoShell(parent: THREE.Object3D, baseR: number, h: number, color: THREE.ColorRepresentation, strength: number): THREE.Mesh {
  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(baseR*(1+h), 4),
    new THREE.ShaderMaterial({
      uniforms: {
        uColor:    { value: new THREE.Color(color) },
        uFalloff:  { value: CONFIG.atmoFalloff },
        uStrength: { value: strength }
      },
      vertexShader: ATMO_VERT,
      fragmentShader: ATMO_FRAG,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  parent.add(shell);   // local origin: the whole body group moves as one (v0.6 item 1)
  return shell;
}

// Every body lives inside its own Group at the world origin of that body; all children sit
// at LOCAL origin. body.center aliases group.position, so it stays the live world centre
// exactly as it did in v0.5 when it aliased mesh.position.
function addBody(def: BodyDef, idx: number): Body {
  // v0.9 item 1: the run seed replaces the table's fixed starting angle. def.ang is kept in
  // BODY_DEFS as the historical reference layout but is no longer read.
  const seededAng = seededRand(seedMix + idx*97)*360;
  const op = def.star ? orbitParams(0, 0, 0, SUN_R) : orbitParams(def.au!*CONFIG.AU, def.y!, seededAng, SUN_R);
  const group = new THREE.Group();
  bodyPosAt(op, 0, group.position);
  group.userData.orbitNode = true;   // placeBlock walks up to find this
  scene.add(group);
  let bodyCore: BodyCore;

  if(def.star) {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(def.R!,3), new THREE.MeshBasicMaterial({color:0xffd98a}));
    group.add(mesh);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map:makeGlowTexture(), blending:THREE.AdditiveBlending, depthWrite:false, transparent:true}));
    sprite.scale.setScalar(def.R!*7);
    group.add(sprite);
    bodyCore = { name:def.name, center:group.position, R:def.R!, shapeFn:null, cloudR:null,
             g:CONFIG.sunGravity, deadly:true, gas:false, atmo:null, star:true };
  }
  else if(def.type === 'rocky') {
    const R = kmToUnits(def.km!);
    const shapeFn = makeShapeFn(def.name.length*37+5, 1.0, def.craters);
    const mesh = buildRockyMesh(R, shapeFn, def.paint!, def.craters ? CONFIG.craterDetail : 0, CONFIG.rockySegs);
    applyTexture(mesh.material, TEX_FILES[def.name],
                 () => liftVertexColors(mesh.geometry, CONFIG.texVertexLift));   // async; no-op on failure
    group.add(mesh);
    solidMeshes.push(mesh);
    // v0.6 item 6: size the shell off the PEAK terrain radius, not the base R, or the tallest
    // mountains poke straight through the sky (plan.md milestone 6 flag). VISUAL ONLY — the
    // drag boundary below still uses the local surfR under you, which is the correct physics.
    if(def.atmo) addAtmoShell(group, R*mesh.userData.maxH, def.atmo.h, def.atmo.color, def.atmo.glow*CONFIG.atmoStrengthMult);
    // v0.10 item 3: Earth's rotating cloud deck. A bonus layer like every texture — the
    // shell only turns visible when the map actually loads, so a blocked CDN changes nothing.
    if(def.name === 'EARTH') {
      const cloudMat = new THREE.MeshStandardMaterial({
        color:0xffffff, transparent:true, opacity:CONFIG.earthCloudOpacity,
        blending:THREE.AdditiveBlending, depthWrite:false, roughness:1
      });
      const cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(R*CONFIG.earthCloudLift, 64, 48), cloudMat);
      cloudMesh.visible = false;
      applyTexture(cloudMat, '8k_earth_clouds.jpg', () => { cloudMesh.visible = true; });
      group.add(cloudMesh);
      spinners.push({ node: cloudMesh, rate: CONFIG.earthCloudSpin });
    }
    bodyCore = { name:def.name, center:group.position, R, shapeFn, cloudR:null,
             g:Math.min(CONFIG.gravityK*R, CONFIG.gravityMax), deadly:false, gas:false, atmo:def.atmo||null, star:false };
  }
  else { // gas giant: banded cloud shell + tiny dark solid core
    const cloudR = kmToUnits(def.km!);
    const coreR = cloudR*0.1;
    const cloudGeo = new THREE.SphereGeometry(cloudR, CONFIG.gasSegs[0], CONFIG.gasSegs[1]);
    const posAttr = cloudGeo.getAttribute('position');
    const colors = new Float32Array(posAttr.count*3);
    const v = new THREE.Vector3();
    const seed = def.name.length*3;
    for(let i=0;i<posAttr.count;i++){
      v.fromBufferAttribute(posAttr, i).normalize();
      const col = gasBandColor(def.paint!, v, def.bands!, seed);
      colors[i*3]=col.r; colors[i*3+1]=col.g; colors[i*3+2]=col.b;
    }
    cloudGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors,3));
    const cloud = new THREE.Mesh(cloudGeo, new THREE.MeshStandardMaterial({vertexColors:true, roughness:1, metalness:0, transparent:true, opacity:0.96, depthWrite:true}));
    applyTexture(cloud.material, TEX_FILES[def.name],
                 () => liftVertexColors(cloud.geometry, CONFIG.texVertexLift));   // async; no-op on failure
    group.add(cloud);
    // v0.10 item 3: slow cloud spin — bands wobble, Jupiter's spot drifts. The cloud shell
    // is visual-only by design (physics is the core), so nothing else notices.
    spinners.push({ node: cloud, rate: CONFIG.gasSpin * (0.7 + (def.name.length*37 % 10)/15) });
    addAtmoShell(group, cloudR, 0.06, new THREE.Color(GAS_PALETTES[def.paint!][0]).getHex(), CONFIG.atmoGasStrength);

    const coreShape = makeShapeFn(def.name.length*53+11, 0.7);
    const core = buildRockyMesh(coreR, coreShape, 'core');
    group.add(core);
    solidMeshes.push(core);

    if(def.rings) {
      for(const [ri, ro] of def.rings) {
        const ringGeo = new THREE.RingGeometry(cloudR*ri, cloudR*ro, 96);
        // RingGeometry's stock UVs are a square projection of the disc, which smears a ring
        // texture into garbage. A ring map is a radial strip, so remap u to normalised radius
        // and pin v mid-strip. Harmless when no texture loads.
        {
          const rp = ringGeo.getAttribute('position');
          const ruv = ringGeo.getAttribute('uv');
          const rIn = cloudR*ri, rOut = cloudR*ro;
          for(let i=0;i<rp.count;i++){
            const rr = Math.hypot(rp.getX(i), rp.getY(i));
            ruv.setXY(i, (rr - rIn)/(rOut - rIn), 0.5);
          }
          ruv.needsUpdate = true;
        }
        const ringMat = new THREE.MeshStandardMaterial({color:0xd8c9a3, roughness:1, metalness:0, side:THREE.DoubleSide, transparent:true, opacity:0.7});
        // the ring map carries its own alpha, so let it drive opacity once it actually lands
        applyTexture(ringMat, def.ringTex, () => { ringMat.color.setHex(0xffffff); ringMat.opacity = 1; });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = deg(90 - def.ringTilt!);
        group.add(ringMesh);
        solidMeshes.push(ringMesh);
      }
    }

    bodyCore = { name:def.name, center:group.position, R:coreR, shapeFn:coreShape, cloudR,
             g:Math.min(CONFIG.gravityK*cloudR, CONFIG.gravityMax), deadly:false, gas:true, atmo:null, star:false };
  }
  const body: Body = { ...bodyCore, ...op, node: group, prev: group.position.clone() };
  bodies.push(body);
  orbiters.push(body);
  return body;
}

BODY_DEFS.forEach((def, idx) => addBody(def, idx));

// ============================================================
// Asteroid belt (v0.6 item 3)
// 120 rocks off 5 shared unit-radius geometries. Because each geometry is built at radius 1
// with its displacement baked in, a rock's uniform scale IS its collision radius R, and
// surfR = R*shapeFn(dir) stays exactly the identity the rest of the engine relies on.
//
// Rotation is the subtle part: the spec wants random static rotation, but shapeFn is queried
// with a WORLD-space direction. Rotating the mesh alone would slide the visible surface off
// the collision surface. So each rock composes the inverse of its own rotation into its
// shapeFn — visual and physics stay locked together.
//
// Budget: rocks under beltDecorMaxR are decor-only (no bodies[] entry, no raycast target),
// which is what keeps bodies[] inside the <=~90 ceiling while still drawing 120 rocks.
// ============================================================
const BELT_SHAPES: { shapeFn: ShapeFn; geo: THREE.IcosahedronGeometry }[] = [];
for(let g=0; g<CONFIG.beltShapeCount; g++){
  const shapeFn = makeShapeFn(g*97+13, 1.4);
  const geo = new THREE.IcosahedronGeometry(1, 3);
  const pa = geo.getAttribute('position');
  const v = new THREE.Vector3();
  for(let j=0;j<pa.count;j++){
    v.fromBufferAttribute(pa, j).normalize();
    const r = shapeFn(v);
    pa.setXYZ(j, v.x*r, v.y*r, v.z*r);
  }
  geo.computeVertexNormals();
  BELT_SHAPES.push({ shapeFn, geo });
}

// v0.10 item 2: the belt is a full, sparse ring around the sun (the 185-220 wedge was a
// v0.2 relic). 3 denser knots sit at seeded angles; the rest scatters over the whole circle.
const BELT_CLUSTERS = [2.45, 2.80, 3.10].map((au, k) => ({
  ang: seededRand(seedMix*7 + k*131)*360,
  au
}));

const _rockDir = new THREE.Vector3();   // scratch for the rotation-composed shapeFn
let beltPhysical = 0, beltDecor = 0;

for(let i=0;i<CONFIG.beltCount;i++){
  const s = i*53+9;

  // --- placement: seeded cluster knot or full-circle sparse scatter (v0.10 item 2) ---
  // Angles mix in the run seed; sizes/shapes keep their fixed seeds so the physical-rock
  // budget stays deterministic across runs (v0.9 rule).
  let ang: number, au: number;
  if(seededRand(s*3) < CONFIG.beltClusterFrac){
    const c = BELT_CLUSTERS[Math.floor(seededRand(s*29)*BELT_CLUSTERS.length) % BELT_CLUSTERS.length];
    ang = c.ang + (seededRand(s*31)-0.5)*6;
    au  = c.au  + (seededRand(s*37)-0.5)*0.22;
  } else {
    ang = seededRand(s + seedMix)*360;
    au  = 2.2 + seededRand(s*3+1)*1.1;
  }
  const y = (seededRand(s*5)-0.5)*CONFIG.beltYSpread;

  // --- size: skewed small so ~a third land under beltDecorMaxR and bodies[] stays in budget ---
  const R = (i < CONFIG.beltMajors)
    ? CONFIG.beltMajorMinR + seededRand(s*23)*CONFIG.beltMajorRangeR
    : CONFIG.beltMinR + (CONFIG.beltMaxR-CONFIG.beltMinR)*Math.pow(seededRand(s*7), CONFIG.beltSizeSkew);

  // --- shared geometry + static rotation ---
  const base = BELT_SHAPES[Math.floor(seededRand(s*17)*BELT_SHAPES.length) % BELT_SHAPES.length];
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(
    seededRand(s*41)*Math.PI*2, seededRand(s*43)*Math.PI*2, seededRand(s*47)*Math.PI*2));

  const col = new THREE.Color().setHSL(0.07+seededRand(s*11)*0.05, 0.15, 0.3+seededRand(s*13)*0.1);
  const mesh = new THREE.Mesh(base.geo, new THREE.MeshStandardMaterial({color:col, flatShading:true, roughness:0.95, metalness:0}));
  mesh.scale.setScalar(R);        // unit geometry -> scale is the radius
  mesh.quaternion.copy(q);

  const op = orbitParams(au*CONFIG.AU, y, ang, SUN_R);
  const group = new THREE.Group();
  bodyPosAt(op, 0, group.position);
  group.userData.orbitNode = true;
  group.add(mesh);
  scene.add(group);

  if(R < CONFIG.beltDecorMaxR) {
    // Decor only: drawn and orbiting, but not a gravity source and not landable. Being under
    // beltDecorMaxR they read as pebbles, so nobody lines up a landing on one.
    orbiters.push({ node:group, prev:group.position.clone(), ...op });
    beltDecor++;
  } else {
    solidMeshes.push(mesh);
    const qi = q.clone().invert();
    // compose the rotation into shapeFn so collision matches the rotated mesh
    const shapeFn: ShapeFn = dir => base.shapeFn(_rockDir.copy(dir).applyQuaternion(qi));
    const rock: Body = { name:'BELT ROCK', center:group.position, R, shapeFn, cloudR:null,
                   g:Math.min(CONFIG.gravityK*R, CONFIG.gravityMax), deadly:false, gas:false, atmo:null,
                   star:false, belt:true, node:group, prev:group.position.clone(), ...op };
    bodies.push(rock);
    orbiters.push(rock);
    beltPhysical++;
  }
}
void beltPhysical; void beltDecor;   // kept as build-time counts; referenced to satisfy noUnusedLocals

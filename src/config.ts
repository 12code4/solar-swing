import type { Config } from './types';

// ============================================================
// CONFIG — all game-feel tuning lives here (invariant 3). Iterate here first.
// One typed object, exported from one module.
// ============================================================
export const CONFIG: Config = {
  gravityK: 0.28,
  gravityMax: 45,        // cloud-top gravity cap for giants (Earth ~44.8: unhoverable by design)
  gasCoreGravityMult: 3, // gravity multiplier at a gas giant core (point of no return)
  sunGravity: 34,
  playerRadius: 0.5,
  walkSpeed: 9,
  walkAccel: 48,
  friction: 9,
  jumpSpeed: 10,
  jetThrust: 38,         // below big-planet surface g: sideways burns mandatory there
  heatRate: 0.13,        // ~7.7s of continuous full burn
  coolRate: 0.5,
  overheatUnlock: 0.3,
  buildRange: 16,
  camDist: 8,
  camSmooth: 7.7,        // camera follow rate. blend = 1-exp(-camSmooth*dt), so the feel is
                         // identical at 60Hz and 160Hz. 7.7 reproduces v0.5's lerp(0.12) at
                         // 60fps exactly: 1-exp(-7.7/60) = 0.120.
  // free look (v0.6 item 5) — an ADDITIVE camera offset only; never touches the aim basis
  freeLookSens:  0.0018,   // mouse rad/px, matches the normal look sensitivity
  freeLookRate:  2.2,      // touch: right-stick rad/s while EYE is held
  freeLookReturn: 12,      // ease-back rate; 1-exp(-12*0.25) = 95% home in ~0.25s
  freeLookMaxPitch: 1.35,
  upBlend: 3.5,
  drag: 1.0,             // vacuum: orbits must not decay (atmospheres brake instead)
  gasInteriorDrag: 0.8,  // soup, but a fast Oberth dive-through survives it
  boundsDist: 200000,
  // trajectory prediction (adaptive since v0.5)
  predictSteps: 360,
  predictDtBase: 0.09,   // step scales with distance to the nearest body's reach
  predictDtMin: 0.04,
  predictDtMax: 1.2,
  // orbit aids (v0.5 item 4)
  orbitAngle: 330*Math.PI/180,      // swept angle needed to call a path a closed orbit
  orbitSweptGate: 300*Math.PI/180,  // only test "back near start radius" past this sweep
  orbitRadTol: 0.08,                // ...and within 8% of the starting radius
  periShowFrac: 0.9,                // hide the periapsis dot unless it's below us
  periScale: 0.012,                 // marker radius as a fraction of distance to camera
  predColorImpact: '#ff5544',
  predColorOrbit:  '#4dd68a',
  predColorCoast:  '#66aaff',
  // touch controls
  lookRate: 2.6,         // rad/s at full stick
  stickDead: 0.12,
  stickRadius: 55,
  // full-range aim + linear throttle (v0.9)
  pitchMax: 1.55,        // aim pitch clamp, ~89 deg — just short of the pole so the cos/sin
                         // look form never flips; the lookAt up-hint is pole-safe regardless
  thrSnap: 0.05,         // throttle slider snaps to 0 below this fraction
  // universal brake (v0.10) — auto retro-burn vs the nearest body's frame; same engine
  brakeMult: 1.0,        // brake thrust as a multiple of jetThrust
  // visual-only planet dressing (v0.10)
  gasSpin: 0.012,        // base gas-giant cloud spin, rad/s (per-planet fixed variation on top)
  earthCloudSpin: 0.0045,
  earthCloudOpacity: 0.55,
  earthCloudLift: 1.02,  // cloud shell radius as a multiple of Earth's R
  // terrain detail (v0.5 item 1)
  terrainAmps: [0.10, 0.06, 0.035, 0.018, 0.009], // octave amplitudes (fraction of R)
  terrainHiFreqMult: 2.6,   // frequency multiplier for the two new fine octaves
  // craters (MERCURY + PLUTO only) — baked into shapeFn so collision matches the mesh
  craterCountMin: 6,
  craterCountMax: 10,
  craterRadMin: 0.12,       // angular radius, radians
  craterRadMax: 0.20,
  craterDepthMin: 0.02,     // bowl depth as a fraction of R
  craterDepthMax: 0.04,
  craterRimHeight: 0.3,     // raised rim, as a fraction of crater depth
  craterRimWidth: 0.35,     // rim falloff width, as a fraction of crater radius
  craterDetail: 5,          // icosahedron detail for cratered bodies (bowls need the verts)
  // gas giant bands
  gasTurb: 1.35,            // band-edge turbulence multiplier
  gasWobble3: 0.09,         // third (high-frequency) wobble amplitude
  // atmosphere shells (v0.5 item 2)
  atmoFalloff: 2.5,         // fresnel exponent — higher = tighter rim
  atmoStrengthMult: 1.8,    // scales each atmo's glow into shader strength
  atmoGasStrength: 0.22,    // subtle limb for gas giants
  skyTintMax: 0.35,         // max screen tint opacity inside a tinted atmosphere
  // bloom — desktop only (v0.5 item 3)
  bloomStrength: 0.55,
  bloomRadius: 0.4,
  bloomThreshold: 0.82,     // luminance cut, applied to linear (pre-tone-map) values
  // kinematic orbits (v0.6 item 1)
  orbitTimeScale: 1.0,      // global multiplier on every omega — tune orbit speed to taste
  // textured geometry (v0.6 item 2) — SphereGeometry segment counts; UVs the texture maps need
  rockySegs: [96, 64],
  gasSegs:   [64, 48],
  texVertexLift: 0.75,      // on texture load, lerp the dark v0.5 palettes this far toward
                            // white so the map reads through; surviving variation scales by
                            // (1-this). Never applied if the texture fails to load.
  // asteroid belt (v0.6 item 3)
  beltCount:       120,     // total rocks drawn
  beltShapeCount:  5,       // shared unit-radius geometries reused across all rocks
  beltMajors:      4,       // "majors" above the normal size range — always landable
  beltMajorMinR:   46,
  beltMajorRangeR: 16,
  beltMinR:        8,
  beltMaxR:        45,
  beltSizeSkew:    2.2,     // R = min + range*u^skew. >1 skews small, which is what keeps
                            // the physical-rock count (and so bodies[]) under budget.
  beltDecorMaxR:   12,      // rocks under this are decor-only: no bodies[] entry, no raycast
  beltClusterFrac: 0.62,    // share of rocks pulled into clusters vs sparse scatter
  beltYSpread:     2000,
  // minimap (v0.6 item 4)
  minimapCorner:   150,     // px, corner mode
  minimapExpandVMin: 70,    // vmin, expanded mode (mirrored in CSS #mmwrap.exp)
  minimapEvery:    6,       // redraw every N frames
  minimapLogK:     1000,    // rMap = log10(1 + dist/minimapLogK), then normalised to fit.
                            // Lower spreads the inner system further out. NOTE: the spec wrote
                            // this as a leading multiplier k*log10(...), but any leading factor
                            // cancels once you scale-to-fit the disc — the divisor is the knob
                            // that actually changes the mapping, so k lives here instead.
  minimapArrowWorld: 2500,  // world distance probed ahead of the player to aim the vel arrow
  minimapArrowPx:  11,
  // scale rulers — radii keep real ratios, distances compressed
  AU: 3600,
  earthR: 160
};

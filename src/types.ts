import * as THREE from 'three';

// ============================================================
// Shared type definitions (v0.7 refactor).
// These describe the exact shapes the single-file v0.6 build already used at runtime —
// no behavior is implied by a type, it only names what was already there.
// ============================================================

// A body's displacement field: dir (unit vector) -> radius multiplier. The SINGLE source of
// truth for both mesh geometry and analytic collision (invariant 1).
export type ShapeFn = (dir: THREE.Vector3) => number;

export interface Atmo {
  h: number;         // shell height as a fraction of surface radius
  color: number;     // glow colour (hex)
  glow: number;      // glow strength before atmoStrengthMult
  drag: number;      // aerobrake coefficient
  darken?: number;   // screen darken (Venus)
  sky?: string;      // sky tint colour (Earth, Mars)
}

// Kinematic orbit params — circular, XZ plane, prograde (v0.6 item 1).
export interface OrbitParams {
  orbitR: number;
  yOff: number;
  ang0: number;
  omega: number;
}

// Anything that moves: planets, the belt rocks, decor pebbles.
export interface Orbiter extends OrbitParams {
  node: THREE.Object3D;
  prev: THREE.Vector3;
}

// The non-orbit fields of a physics body, assembled per-branch in addBody before the orbit
// params and node/prev are merged in.
export interface BodyCore {
  name: string;
  center: THREE.Vector3;   // aliases the body group's position — the live world centre
  R: number;
  shapeFn: ShapeFn | null;
  cloudR: number | null;
  g: number;
  deadly: boolean;
  gas: boolean;
  atmo: Atmo | null;
  star: boolean;
  belt?: boolean;
}

// A full physics body: a core that also orbits.
export interface Body extends BodyCore, Orbiter {}

// gravInfo side-channel filled by gravityAt (invariant 2).
export interface GravInfo {
  nearestD: number;
  nearestReach: number;
  dominant: Body | null;
  dominantG: number;
}

// nearestBody() result.
export interface NearestInfo {
  b: Body;
  dCenter: number;
  surfR: number;
  dSurf: number;
}

// A placed build block and its half-extents (for AABB collision).
export interface BlockInstance {
  mesh: THREE.Mesh;
  half: THREE.Vector3;
}

// A build palette entry.
export interface BlockType {
  name: string;
  half: THREE.Vector3;
  make: () => THREE.BufferGeometry;
  color: number;
  emissive: number;
}

// A row of the BODY_DEFS table.
export interface BodyDef {
  name: string;
  star?: boolean;
  type?: 'rocky' | 'gas';
  R?: number;
  km?: number;
  au?: number;
  ang?: number;
  y?: number;
  pos?: THREE.Vector3;
  paint?: string;
  craters?: boolean;
  atmo?: Atmo;
  bands?: number;
  rings?: [number, number][];
  ringTilt?: number;
  ringTex?: string;
}

// The CONFIG shape (invariant 3): every game-feel tunable, one typed home.
export interface Config {
  gravityK: number;
  gravityMax: number;
  gasCoreGravityMult: number;
  sunGravity: number;
  playerRadius: number;
  walkSpeed: number;
  walkAccel: number;
  friction: number;
  jumpSpeed: number;
  jetThrust: number;
  heatRate: number;
  coolRate: number;
  overheatUnlock: number;
  buildRange: number;
  camDist: number;
  camSmooth: number;
  freeLookSens: number;
  freeLookRate: number;
  freeLookReturn: number;
  freeLookMaxPitch: number;
  upBlend: number;
  drag: number;
  gasInteriorDrag: number;
  boundsDist: number;
  predictSteps: number;
  predictDtBase: number;
  predictDtMin: number;
  predictDtMax: number;
  orbitAngle: number;
  orbitSweptGate: number;
  orbitRadTol: number;
  periShowFrac: number;
  periScale: number;
  predColorImpact: string;
  predColorOrbit: string;
  predColorCoast: string;
  lookRate: number;
  stickDead: number;
  stickRadius: number;
  terrainAmps: number[];
  terrainHiFreqMult: number;
  craterCountMin: number;
  craterCountMax: number;
  craterRadMin: number;
  craterRadMax: number;
  craterDepthMin: number;
  craterDepthMax: number;
  craterRimHeight: number;
  craterRimWidth: number;
  craterDetail: number;
  gasTurb: number;
  gasWobble3: number;
  atmoFalloff: number;
  atmoStrengthMult: number;
  atmoGasStrength: number;
  skyTintMax: number;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  orbitTimeScale: number;
  rockySegs: [number, number];
  gasSegs: [number, number];
  texVertexLift: number;
  beltCount: number;
  beltShapeCount: number;
  beltMajors: number;
  beltMajorMinR: number;
  beltMajorRangeR: number;
  beltMinR: number;
  beltMaxR: number;
  beltSizeSkew: number;
  beltDecorMaxR: number;
  beltClusterFrac: number;
  beltYSpread: number;
  minimapCorner: number;
  minimapExpandVMin: number;
  minimapEvery: number;
  minimapLogK: number;
  minimapArrowWorld: number;
  minimapArrowPx: number;
  AU: number;
  earthR: number;
}

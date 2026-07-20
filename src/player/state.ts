import * as THREE from 'three';
import { CONFIG } from '../config';
import { scene, isTouch } from '../scene';
import type { Body } from '../types';

// ============================================================
// Player state + camera basis (v0.7 refactor).
// See main.ts for the state-management decision. These are grouped module-level singletons:
// the SAME mutable objects the single-file build used, now with module addresses. Nothing is
// threaded through function signatures. Objects (vel, camUp...) are mutated in place; the
// reassigned primitives (pitch, heat, grounded...) live inside `view`/`pstate` so writers in
// other modules can mutate them without fighting ES-module read-only import bindings.
// ============================================================

export const player = new THREE.Mesh(
  new THREE.SphereGeometry(CONFIG.playerRadius*0.8,16,16),
  new THREE.MeshStandardMaterial({color:0xddeeff,emissive:0x223355,roughness:0.6})
);
scene.add(player);

export const vel = new THREE.Vector3();

// Motion trail
export const trailPts = Array.from({length:40}, ()=>new THREE.Vector3());
export const trailGeo = new THREE.BufferGeometry().setFromPoints(trailPts);
scene.add(new THREE.Line(trailGeo, new THREE.LineBasicMaterial({color:0x4466ff,transparent:true,opacity:0.3})));

// ----- mutable mode/flag state (grouped singleton) -----
export const pstate = {
  grounded: false,
  groundBody: null as Body | null,   // which body we are standing on — its velocity is our frame of reference
  heat: 0,
  overheated: false,
  gMag: 0,
  jumpQueued: false,
  mouseBurn: false,
};

// Application-level flags
export const app = {
  playing: false,
  locked: false,
};

export const keys: Record<string, boolean> = {};

// ============================================================
// Camera basis — the most fragile system in the file (CLAUDE.md). Kept here as ONE cohesive
// unit: the smoothed local-up vectors, the look/free-look scalars, and getLookDir(). The
// per-frame smoothing runs in loop.ts but the basis it mutates lives together here.
// camForward is mutated in place (crossVectors) rather than reassigned, so it can be exported
// as a stable binding.
// ============================================================
export const camUp = new THREE.Vector3(0,1,0);
export const camRight = new THREE.Vector3(1,0,0);
export const camForward = new THREE.Vector3(0,0,-1);

// Free look (v0.6 item 5): OFFSETS layered on top of the aim direction at camera time only.
// camForward/camRight/camUp and getLookDir() are never touched by them — per CLAUDE.md that
// basis is the most fragile system in the file, and the spec wants aim frozen while the camera
// swings, so an offset is both the safest and the correct model.
export const view = {
  pitch: 0.15,
  yawDelta: 0,
  camDist: CONFIG.camDist,
  flYaw: 0,
  flPitch: 0,
  eyeHeld: false,
};

export function getLookDir(): THREE.Vector3 {
  return camForward.clone().multiplyScalar(Math.cos(view.pitch)).addScaledVector(camUp, Math.sin(view.pitch)).normalize();
}

export const freeLookOn = (): boolean => isTouch ? view.eyeHeld : (keys['AltLeft'] || keys['AltRight'] || false);

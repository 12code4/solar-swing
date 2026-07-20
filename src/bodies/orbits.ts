import * as THREE from 'three';
import { CONFIG } from '../config';
import type { OrbitParams, Orbiter } from '../types';

export const kmToUnits = (km: number): number => km/6371*CONFIG.earthR;
export const deg = (d: number): number => d*Math.PI/180;

export function orbitPos(au: number, angleDeg: number, y: number): THREE.Vector3 {
  return new THREE.Vector3(Math.cos(deg(angleDeg))*au*CONFIG.AU, y, Math.sin(deg(angleDeg))*au*CONFIG.AU);
}

// ============================================================
// Kinematic orbits (v0.6 item 1)
// Circular, XZ plane, all prograde. NOT force-simulated: position is an analytic function
// of t, which is what lets the predictor evaluate any future time exactly and cheaply.
// Speed comes from the same sun field the player feels — v = sqrt(g_sun(r)*r), which puts
// Earth at ~50 m/s. Each body keeps its fixed y offset; r is the XZ radius.
// Anything that orbits carries these four fields, so bodyPosAt/bodyVelAt work on bodies
// and on decor rocks alike.
// sunR is passed in (the only external input) so this module stays a pure leaf; build-bodies
// supplies it from the sun's radius in BODY_DEFS.
// ============================================================
export function orbitParams(orbitR: number, yOff: number, angDeg: number, sunR: number): OrbitParams {
  let omega = 0;
  if(orbitR > 0) {
    const gSun = CONFIG.sunGravity * (sunR / Math.max(orbitR, sunR))**2;
    omega = (Math.sqrt(gSun*orbitR)/orbitR) * CONFIG.orbitTimeScale;
  }
  return { orbitR, yOff, ang0: deg(angDeg), omega };
}

export function bodyPosAt(o: OrbitParams, t: number, out: THREE.Vector3): THREE.Vector3 {
  const a = o.ang0 + o.omega*t;
  return out.set(Math.cos(a)*o.orbitR, o.yOff, Math.sin(a)*o.orbitR);
}

// Analytic tangent — magnitude is exactly the orbital speed v.
export function bodyVelAt(o: OrbitParams, t: number, out: THREE.Vector3): THREE.Vector3 {
  const a = o.ang0 + o.omega*t;
  const v = o.orbitR*o.omega;
  return out.set(-Math.sin(a)*v, 0, Math.cos(a)*v);
}

export const orbiters: Orbiter[] = [];   // every node that moves: all bodies + decor-only belt rocks

export function updateOrbiters(t: number): void {
  for(const o of orbiters){
    o.prev.copy(o.node.position);
    bodyPosAt(o, t, o.node.position);
    o.node.updateMatrixWorld(true);   // physics runs before render; blocks ride these matrices
  }
}

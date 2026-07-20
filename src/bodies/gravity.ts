import * as THREE from 'three';
import { CONFIG } from '../config';
import { bodyPosAt } from './orbits';
import type { Body, GravInfo, NearestInfo } from '../types';

// The physics registry: every gravitating / landable body. build-bodies.ts fills it; the
// live sim and the trajectory predictor both read it. It lives here because gravityAt and
// nearestBody are its only readers, and keeping it in this leaf module lets gravity be
// imported before build-bodies is constructed.
export const bodies: Body[] = [];

const tmpDir = new THREE.Vector3();

export function nearestBody(p: THREE.Vector3): NearestInfo {
  let best: NearestInfo | null = null, bestSurf = Infinity;
  for(const b of bodies){
    tmpDir.copy(p).sub(b.center);
    const dCenter = tmpDir.length();
    const surfR = b.shapeFn ? b.R * b.shapeFn(tmpDir.clone().normalize()) : b.R;
    const dSurf = dCenter - surfR;
    if(dSurf < bestSurf){ bestSurf = dSurf; best = {b, dCenter, surfR, dSurf}; }
  }
  return best as NearestInfo;
}

// ============================================================
// Shared gravity field (invariant 2): used by the live sim AND the trajectory predictor.
// Returns true if pos is inside a solid body (predictor uses this as impact).
// It also fills gravInfo as a side-effect: the nearest body (by distance normalised to its
// own reach) and the dominant body (largest gravity contribution here). The orbit aids read
// those instead of re-walking the body list — the falloff maths stays defined exactly once.
// gravInfo describes the LAST position passed in, so read it straight after the call.
// v0.6: takes t. Body centres are evaluated AT t, so the predictor sees where a planet WILL
// be, not where it is now. The live sim passes simTime; the predictor passes future times.
// ============================================================
const _gd = new THREE.Vector3();
const _bc = new THREE.Vector3();
export const gravInfo: GravInfo = { nearestD: Infinity, nearestReach: 1, dominant: null, dominantG: 0 };

export function gravityAt(pos: THREE.Vector3, t: number, out: THREE.Vector3): boolean {
  out.set(0,0,0);
  let inside = false;
  let bestRatio = Infinity;
  gravInfo.nearestD = Infinity; gravInfo.nearestReach = 1;
  gravInfo.dominant = null; gravInfo.dominantG = 0;
  for(const b of bodies){
    // PERF EXCEPTION (spec item 1): belt rocks are read at their CURRENT centre instead of
    // being re-evaluated at t. Their gravity is negligible and this keeps ~80 rocks off the
    // trig path in the predictor's inner loop. For the live sim (t === simTime) b.center IS
    // bodyPosAt(b, t), so nothing is approximated there. Planets and the sun are exact.
    if(b.belt) _bc.copy(b.center); else bodyPosAt(b, t, _bc);
    _gd.copy(_bc).sub(pos);
    const d = _gd.length();
    const reach = b.cloudR || b.R;
    let g = b.g * (reach / Math.max(d, reach))**2;
    if(b.gas && b.cloudR !== null && d < b.cloudR) g = b.g * (1 + (CONFIG.gasCoreGravityMult-1) * (1 - d/b.cloudR));
    if(d < b.R*0.99 || (b.deadly && d < b.R + 140)) inside = true;
    const ratio = d/reach;   // "how many of its own radii away am I" — keeps a pebble from
    if(ratio < bestRatio) {  // out-ranking a planet just by being physically closer
      bestRatio = ratio; gravInfo.nearestD = d; gravInfo.nearestReach = reach;
    }
    if(g > gravInfo.dominantG) { gravInfo.dominantG = g; gravInfo.dominant = b; }
    // The sun is NEVER culled. Its pull at Saturn is 0.008 — under the pebble threshold —
    // but it is the force every planet's orbit is derived from, so dropping it would leave
    // the outer system orbiting something the player cannot feel.
    if(g < 0.02 && !b.star) continue;
    out.addScaledVector(_gd.normalize(), g);
  }
  return inside;
}

import * as THREE from 'three';
import { CONFIG } from '../config';
import type { ShapeFn } from '../types';

// ============================================================
// Displacement field (invariant 1). The returned function (dir => radius multiplier) is the
// SINGLE source of truth for both mesh geometry and analytic collision — signature is fixed.
// ============================================================
export function seededRand(seed: number): number {
  const x = Math.sin(seed*127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function makeShapeFn(seed: number, roughness: number, cratered?: boolean): ShapeFn {
  const ks: THREE.Vector3[] = [];
  for(let i=0;i<CONFIG.terrainAmps.length;i++){
    const fine = i >= 3; // octaves 4-5: finer relief on top of the original silhouette
    const v = new THREE.Vector3(
      seededRand(seed*7+i)-0.5,
      seededRand(seed*13+i)-0.5,
      seededRand(seed*29+i)-0.5
    ).normalize().multiplyScalar((2.5 + seededRand(seed*31+i)*3.5) * (fine ? CONFIG.terrainHiFreqMult : 1));
    ks.push(v);
  }
  const amps = CONFIG.terrainAmps.map((a,i)=>a*roughness*(0.8+seededRand(seed*41+i)*0.5));

  // Seeded crater bowls. Each is a smooth depression with a slight raised rim; both the
  // bowl and the rim land with a flat tangent so nothing cliffs at the edges.
  const craters: { dir: THREE.Vector3; rad: number; depth: number; cosCut: number }[] = [];
  if(cratered) {
    const n = CONFIG.craterCountMin + Math.floor(seededRand(seed*83)*(CONFIG.craterCountMax-CONFIG.craterCountMin+1));
    for(let i=0;i<n;i++){
      const dir = new THREE.Vector3(
        seededRand(seed*61+i*3)-0.5,
        seededRand(seed*67+i*5)-0.5,
        seededRand(seed*71+i*7)-0.5
      ).normalize();
      const rad = CONFIG.craterRadMin + seededRand(seed*73+i)*(CONFIG.craterRadMax-CONFIG.craterRadMin);
      const depth = (CONFIG.craterDepthMin + seededRand(seed*79+i)*(CONFIG.craterDepthMax-CONFIG.craterDepthMin))*roughness;
      // cheap reject: cosine of the outermost rim angle, lets us skip the acos entirely
      const cosCut = Math.cos(Math.min(Math.PI, rad*(1+CONFIG.craterRimWidth)));
      craters.push({dir, rad, depth, cosCut});
    }
  }

  return (dir: THREE.Vector3) => {
    let h = 1 + amps[0]*Math.sin(dir.dot(ks[0]))
              + amps[1]*Math.sin(dir.dot(ks[1]))
              + amps[2]*Math.sin(dir.dot(ks[2]))
              + amps[3]*Math.sin(dir.dot(ks[3]))
              + amps[4]*Math.sin(dir.dot(ks[4]));
    for(let i=0;i<craters.length;i++){
      const c = craters[i];
      const cd = dir.dot(c.dir);
      if(cd < c.cosCut) continue;
      const t = Math.acos(Math.min(1, cd))/c.rad;
      if(t < 1) {
        const s = t*t*(3-2*t);              // smoothstep across the bowl
        h -= c.depth*(1 - s);
      }
      const r = 1 - Math.abs(t - 1)/CONFIG.craterRimWidth;  // hump peaking on the rim line
      if(r > 0) h += c.depth*CONFIG.craterRimHeight * r*r*(3-2*r);
    }
    return h;
  };
}

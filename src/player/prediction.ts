import * as THREE from 'three';
import { CONFIG } from '../config';
import { scene } from '../scene';
import { player, vel } from './state';
import { sim } from '../world/sim';
import { gravityAt, gravInfo } from '../bodies/gravity';
import { bodyPosAt } from '../bodies/orbits';
import type { Body } from '../types';

// ============================================================
// Player trajectory prediction — consumes the single gravity field (invariant 2).
// ============================================================
const predPts = Array.from({length:CONFIG.predictSteps}, ()=>new THREE.Vector3());
const predGeo = new THREE.BufferGeometry().setFromPoints(predPts);
export const predLine = new THREE.Line(predGeo, new THREE.LineBasicMaterial({color:0x66aaff, transparent:true, opacity:0.55}));
predLine.frustumCulled = false;
scene.add(predLine);
export { predPts };

const _pp = new THREE.Vector3(), _pv = new THREE.Vector3(), _pa = new THREE.Vector3();
const _r0 = new THREE.Vector3(), _r1 = new THREE.Vector3(), _dc = new THREE.Vector3();

// Periapsis marker — the "burn here" Oberth signpost. Deliberately NOT in solidMeshes:
// it must never be a build/aim raycast target.
export const periMarker = new THREE.Mesh(
  new THREE.SphereGeometry(1, 10, 10),
  new THREE.MeshBasicMaterial({color:0xffdd33})
);
periMarker.visible = false;
periMarker.frustumCulled = false;
scene.add(periMarker);
export const periPoint = new THREE.Vector3();
export let periValid = false;

export const PRED = { IMPACT:0, ORBIT:1, COAST:2 };
export let predOutcome = PRED.COAST;

export function updatePrediction(): void {
  _pp.copy(player.position);
  _pv.copy(vel);
  let stopped = false;
  let dom: Body | null = null, d0 = 0, swept = 0, peri = Infinity, backNearStart = false;
  periValid = false;
  let tPred = sim.time;   // the predictor walks its own clock forward alongside the path

  for(let i=0;i<CONFIG.predictSteps;i++){
    if(!stopped){
      const hit = gravityAt(_pp, tPred, _pa);
      if(i === 0) {
        // gravInfo is fresh for the player's own position on the first step
        dom = gravInfo.dominant;
        if(dom) { bodyPosAt(dom, tPred, _dc); _r0.copy(_pp).sub(_dc); d0 = _r0.length(); }
      }
      // Adaptive step: fine when close to a body, coarse out in the gaps. Same step count
      // now buys minutes of lookahead in deep space without losing accuracy near planets.
      const dtStep = Math.min(CONFIG.predictDtMax, Math.max(CONFIG.predictDtMin,
        CONFIG.predictDtBase * (gravInfo.nearestD / gravInfo.nearestReach)));
      _pv.addScaledVector(_pa, dtStep);
      _pp.addScaledVector(_pv, dtStep);
      tPred += dtStep;
      if(hit) stopped = true;

      if(dom && !stopped){
        // Dominant-body-relative, at the time the path actually gets there.
        bodyPosAt(dom, tPred, _dc);
        _r1.copy(_pp).sub(_dc);
        const d = _r1.length();
        if(d < peri) { peri = d; periPoint.copy(_pp); }
        swept += _r0.angleTo(_r1);   // total angle walked around the dominant body
        if(swept >= CONFIG.orbitSweptGate && Math.abs(d - d0) <= CONFIG.orbitRadTol*d0) backNearStart = true;
        _r0.copy(_r1);
      }
    }
    predPts[i].copy(_pp);
  }
  predGeo.setFromPoints(predPts);

  // Outcome: it comes back around to where it started => closed orbit.
  if(stopped) predOutcome = PRED.IMPACT;
  else if(swept >= CONFIG.orbitAngle && backNearStart) predOutcome = PRED.ORBIT;
  else predOutcome = PRED.COAST;

  predLine.material.color.set(
    predOutcome === PRED.IMPACT ? CONFIG.predColorImpact :
    predOutcome === PRED.ORBIT  ? CONFIG.predColorOrbit  : CONFIG.predColorCoast
  );

  // Only meaningful on a path that doesn't end in the dirt, and only if the low point is
  // meaningfully below where we already are.
  periValid = !stopped && !!dom && peri < CONFIG.periShowFrac*d0;
}

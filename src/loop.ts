import * as THREE from 'three';
import { CONFIG } from './config';
import { scene, camera, renderer, composer, stars, isTouch } from './scene';
import { sim } from './world/sim';
import { updateOrbiters, bodyVelAt } from './bodies/orbits';
import { gravityAt, nearestBody } from './bodies/gravity';
import {
  player, vel, pstate, camUp, camRight, camForward, view, getLookDir, freeLookOn,
  trailPts, trailGeo,
} from './player/state';
import { applyJetpack, applyWalking, applyAtmosphere, resolveSurface, resolveBlocks, respawn } from './player/physics';
import { updatePrediction, predLine, periMarker, periPoint, periValid } from './player/prediction';
import { aimHit, ghost, BLOCK_TYPES, selectedBlock, blocks } from './build/building';
import { drawMinimap } from './ui/minimap';
import { updateHud, applySky, dot } from './ui/hud';
import { stickL, stickR, jumpHeld } from './input/touch';

// ============================================================
// Main loop — the per-frame orchestration. It owns the frame order and the fragile camera
// basis smoothing; every physics / render / UI step is delegated to the modules above.
// ============================================================
let last = performance.now();
let frameCount = 0;
const scratch = new THREE.Vector3();
const scratch2 = new THREE.Vector3();
const gAccum = new THREE.Vector3();
const _bv2 = new THREE.Vector3();
const _vrel = new THREE.Vector3();

function animate(now: number): void {
  requestAnimationFrame(animate);
  const dt = Math.min((now-last)/1000, 0.05);
  last = now;
  frameCount++;

  // --- the system moves (v0.6 item 1) ---
  // Analytic positions, so this is a write, not an integration: no drift, and the predictor
  // can ask for any t. Must run before anything reads a body centre this frame.
  sim.time += dt;
  updateOrbiters(sim.time);
  // Carry the player along with whatever they were standing on last frame, or Earth simply
  // slides out from under them at 50 m/s.
  if(pstate.grounded && pstate.groundBody) {
    player.position.add(scratch2.copy(pstate.groundBody.center).sub(pstate.groundBody.prev));
  }

  // --- nearest body + local up ---
  const near = nearestBody(player.position);
  const localUp = scratch.copy(player.position).sub(near.b.center).normalize().clone();

  // --- camera basis ---
  const upZone = Math.max(60, (near.b.cloudR || near.b.R)*1.2);
  const desiredUp = (near.dCenter - (near.b.cloudR || near.surfR) < upZone) ? localUp : new THREE.Vector3(0,1,0);
  const blend = 1 - Math.exp(-CONFIG.upBlend*dt);
  camUp.lerp(desiredUp, blend).normalize();
  // touch look: left stick drives yaw/pitch rates
  if(isTouch && (Math.abs(stickL.x) > CONFIG.stickDead || Math.abs(stickL.y) > CONFIG.stickDead)) {
    view.yawDelta -= stickL.x * CONFIG.lookRate * dt;
    view.pitch = Math.max(-1.25, Math.min(1.25, view.pitch - stickL.y * CONFIG.lookRate * dt));
  }

  // --- free look offsets (v0.6 item 5) ---
  // Touch: while EYE is held the RIGHT stick orbits the camera instead of walking/burning.
  const freeLook = freeLookOn();
  if(freeLook && isTouch && (Math.abs(stickR.x) > CONFIG.stickDead || Math.abs(stickR.y) > CONFIG.stickDead)) {
    view.flYaw   -= stickR.x * CONFIG.freeLookRate * dt;
    view.flPitch = Math.max(-CONFIG.freeLookMaxPitch, Math.min(CONFIG.freeLookMaxPitch,
              view.flPitch - stickR.y * CONFIG.freeLookRate * dt));
  }
  if(!freeLook && (view.flYaw !== 0 || view.flPitch !== 0)) {
    const back = 1 - Math.exp(-CONFIG.freeLookReturn*dt);   // ~95% home in 0.25s
    view.flYaw   *= (1 - back);
    view.flPitch *= (1 - back);
    if(Math.abs(view.flYaw) < 1e-4 && Math.abs(view.flPitch) < 1e-4) { view.flYaw = 0; view.flPitch = 0; }
  }
  if(view.yawDelta !== 0){ camRight.applyAxisAngle(camUp, view.yawDelta); view.yawDelta = 0; }
  camRight.addScaledVector(camUp, -camRight.dot(camUp)).normalize();
  camForward.crossVectors(camUp, camRight);
  const look = getLookDir();

  // --- gravity (shared field function) ---
  gravityAt(player.position, sim.time, gAccum);
  pstate.gMag = gAccum.length();
  vel.addScaledVector(gAccum, dt);

  // --- jetpack: desktop = aim+hold, touch = right stick vector with throttle ---
  const thrusting = applyJetpack(dt, look, freeLook, stickR, jumpHeld);

  // --- grounded walking (resets jumpQueued at its end) ---
  applyWalking(dt, near, localUp, thrusting, freeLook, stickR, jumpHeld);

  // --- atmospheric drag (aerobraking) + global drag + integration ---
  const atmo = applyAtmosphere(dt, near);
  applySky(atmo.darkness, atmo.tint);   // DOM display half of the atmosphere step
  const noReturn = atmo.noReturn;

  // --- surface collision (sun is deadly; gas giants land on the core) ---
  resolveSurface();

  // --- block collision ---
  resolveBlocks(near, blocks);

  if(player.position.length() > CONFIG.boundsDist) respawn();

  // --- trail ---
  trailPts.pop();
  trailPts.unshift(player.position.clone());
  trailGeo.setFromPoints(trailPts);

  // --- trajectory prediction (hidden when parked) ---
  // Gate on RELATIVE speed: standing still on Earth is 50 m/s in world terms, which would
  // otherwise leave the prediction line switched on permanently while you are planted.
  bodyVelAt(near.b, sim.time, _bv2);
  const relSpeed = _vrel.copy(vel).sub(_bv2).length();
  const showPred = !pstate.grounded || relSpeed > 3;
  predLine.visible = showPred;
  if(showPred && frameCount % 2 === 0) updatePrediction();

  // --- build aim ghost (desktop) ---
  if(!isTouch) {
    const buildHit = aimHit(CONFIG.buildRange, true);
    if(buildHit) {
      const t = BLOCK_TYPES[selectedBlock];
      const n = buildHit.face!.normal.clone().transformDirection(buildHit.object.matrixWorld).normalize();
      ghost.position.copy(buildHit.point).addScaledVector(n, t.half.y);
      ghost.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), n);
      ghost.visible = true;
      dot.setAttribute('stroke','#ff4433');
    } else {
      ghost.visible = false;
      dot.setAttribute('stroke','#ffdd33');
    }
  }

  // --- camera ---
  // FREE LOOK (v0.6 item 5): camView is `look` swung by the offset angles. This is the only
  // place the offset is consumed — thrust, prediction, HUD and getLookDir() all still run on
  // the untouched `look`, which is exactly why aim stays frozen while the camera orbits.
  let camView = look;
  if(view.flYaw !== 0 || view.flPitch !== 0) {
    const qy = new THREE.Quaternion().setFromAxisAngle(camUp, view.flYaw);
    const axis = camRight.clone().applyQuaternion(qy);
    camView = look.clone().applyQuaternion(qy).applyQuaternion(
      new THREE.Quaternion().setFromAxisAngle(axis, view.flPitch));
  }
  const idealCamPos = player.position.clone()
    .addScaledVector(camView, -view.camDist)
    .addScaledVector(camUp, 1.5);
  // v0.6 item 6: a fixed lerp factor makes the camera stiffer the faster you render, so at
  // 160Hz the old lerp(0.12) chased ~2.7x harder than at 60. This form is dt-correct.
  camera.position.lerp(idealCamPos, 1 - Math.exp(-CONFIG.camSmooth*dt));
  camera.up.copy(camUp);
  camera.lookAt(player.position.clone().addScaledVector(camView, 10));
  stars.position.copy(camera.position);

  // --- periapsis marker (scaled by camera distance so it stays a readable dot) ---
  if(periValid && !pstate.grounded && predLine.visible) {
    periMarker.position.copy(periPoint);
    periMarker.scale.setScalar(Math.max(view.camDist*0.15, camera.position.distanceTo(periPoint)*CONFIG.periScale));
    periMarker.visible = true;
  } else {
    periMarker.visible = false;
  }

  // --- minimap (v0.6 item 4) ---
  if(frameCount % CONFIG.minimapEvery === 0) drawMinimap();

  // --- HUD ---
  if(frameCount%6===0) updateHud(near, relSpeed, noReturn, thrusting);

  if(composer) composer.render(); else renderer.render(scene, camera);
}

export function startLoop(): void {
  last = performance.now();
  requestAnimationFrame(animate);
}

window.addEventListener('resize', ()=>{
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  if(composer) composer.setSize(window.innerWidth, window.innerHeight);
});

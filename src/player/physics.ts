import * as THREE from 'three';
import { CONFIG } from '../config';
import { isTouch } from '../scene';
import { sim } from '../world/sim';
import { bodyPosAt, bodyVelAt } from '../bodies/orbits';
import { bodies, nearestBody } from '../bodies/gravity';
import '../bodies/build-bodies';   // side-effect import: guarantees bodies[] is populated before the earth lookup below
import { player, vel, pstate, keys, camForward, camRight } from './state';
import type { NearestInfo, BlockInstance } from '../types';

// A minimal read-only view of a virtual stick — physics only needs its axes. Passing this
// (rather than importing the touch module) keeps physics free of an input-module cycle.
interface StickAxes { x: number; y: number; }

// physics-module scratch vectors. Every use copies before it reads, so sharing them across
// the blocks below is safe — exactly as it was when they were animate()'s file-scoped scratch.
const thrustDir = new THREE.Vector3();
const _bv = new THREE.Vector3();     // a body's orbital velocity
const _bv2 = new THREE.Vector3();
const _vrel = new THREE.Vector3();   // player velocity in the ground body's frame

// ---- spawn / respawn ----
// Spawn on top of Earth. Earth moves, so the spawn point is a function of time — and we
// inherit Earth's orbital velocity, otherwise respawn drops you into a 50 m/s skid.
const earth = bodies.find(b=>b.name==='EARTH')!;
const spawnDir = new THREE.Vector3(0,1,0);
const spawnLift = earth.R * earth.shapeFn!(spawnDir) + CONFIG.playerRadius + 0.5;
function spawnPointAt(t: number, out: THREE.Vector3): THREE.Vector3 {
  return bodyPosAt(earth, t, out).addScaledVector(spawnDir, spawnLift);
}
export function respawn(): void {
  spawnPointAt(sim.time, player.position);
  bodyVelAt(earth, sim.time, vel);
  pstate.heat = 0; pstate.overheated = false;
  pstate.grounded = false; pstate.groundBody = null;
}

// An atmosphere co-moves with its planet, so aerobraking must brake velocity RELATIVE to
// that body. Braking world velocity would mean simply standing in Earth's atmosphere pulls
// you out of Earth's frame at ~30 m/s^2 (0.6 drag x 50 m/s of orbital motion). With static
// planets in v0.5 the two were identical, which is why this only surfaces now.
function brakeRelative(b: NearestInfo['b'], factor: number): void {
  bodyVelAt(b, sim.time, _bv2);
  _vrel.copy(vel).sub(_bv2).multiplyScalar(factor);
  vel.copy(_vrel).add(_bv2);
}

// --- jetpack: desktop = aim+hold, touch = linear throttle slider along the aim (v0.9) ---
// Direction is ALWAYS the camera aim on both platforms now; touch magnitude comes from the
// persistent slider (grounded burns allowed: aim up + throttle = liftoff). During free look
// the aim is frozen, so the burn continues along the frozen aim — same rule as desktop.
// v0.10 item 4: brakeHeld overrides both — an auto-aimed retro-burn against velocity
// RELATIVE TO THE NEAREST BODY (the same rendezvous frame the HUD v shows). Same engine,
// same heat; the throttle self-scales on the final step so it nulls the relative velocity
// exactly instead of jittering around zero. It can only remove energy in that frame.
// Returns whether we are actively thrusting (walking + HUD both need it).
export function applyJetpack(dt: number, look: THREE.Vector3, touchThrottle: number, brakeHeld: boolean, near: NearestInfo): boolean {
  let throttle = 0;
  let power = CONFIG.jetThrust;
  thrustDir.set(0,0,0);
  if(brakeHeld) {
    bodyVelAt(near.b, sim.time, _bv2);
    _vrel.copy(vel).sub(_bv2);
    const m = _vrel.length();
    power = CONFIG.jetThrust*CONFIG.brakeMult;
    if(m > 1e-4 && power*dt > 0) {
      throttle = Math.min(1, m/(power*dt));   // final-step scale: dv = min(m, power*dt)
      thrustDir.copy(_vrel).multiplyScalar(-1/m);
    }
  } else if(isTouch) {
    if(touchThrottle > 0) {
      throttle = Math.min(1, touchThrottle);
      thrustDir.copy(look);
    }
  } else {
    if((keys['ShiftLeft']||keys['ShiftRight']||pstate.mouseBurn)) {
      throttle = 1;
      thrustDir.copy(look);
    }
  }
  const thrusting = throttle > 0 && !pstate.overheated;
  if(thrusting) {
    vel.addScaledVector(thrustDir, power*throttle*dt);
    pstate.heat = Math.min(1, pstate.heat + CONFIG.heatRate*throttle*dt);
    if(pstate.heat >= 1) pstate.overheated = true;
  } else {
    pstate.heat = Math.max(0, pstate.heat - CONFIG.coolRate*dt);
    if(pstate.overheated && pstate.heat <= CONFIG.overheatUnlock) pstate.overheated = false;
  }
  return thrusting;
}

// --- grounded walking ---
// RELATIVE-VELOCITY PHYSICS (v0.6 item 1): the planet under you is doing ~50 m/s. Every
// walk/friction/jump rule runs on velocity in THAT body's frame, then we add the frame
// back on. Without this, walking east on Earth means walking at 59 m/s and west means 41.
export function applyWalking(dt: number, near: NearestInfo, localUp: THREE.Vector3, thrusting: boolean, freeLook: boolean, stickR: StickAxes): void {
  if(pstate.grounded && !thrusting) {
    const gb = pstate.groundBody || near.b;
    bodyVelAt(gb, sim.time, _bv);
    _vrel.copy(vel).sub(_bv);
    const vUpAmt = _vrel.dot(localUp);
    const vT = _vrel.clone().addScaledVector(localUp, -vUpAmt);
    const fT = camForward.clone().addScaledVector(localUp, -camForward.dot(localUp)).normalize();
    const rT = camRight.clone().addScaledVector(localUp, -camRight.dot(localUp)).normalize();
    const input = new THREE.Vector3();
    if(keys['KeyW']) input.add(fT);
    if(keys['KeyS']) input.sub(fT);
    if(keys['KeyD']) input.add(rT);
    if(keys['KeyA']) input.sub(rT);
    if(isTouch && !freeLook) {   // free look suspends walking (v0.6 item 5); the right stick
                                 // walks whenever grounded now — JUMP no longer claims it (v0.9)
      input.addScaledVector(fT, -stickR.y).addScaledVector(rT, stickR.x);
    }
    if(input.lengthSq() > CONFIG.stickDead*CONFIG.stickDead) {
      if(input.length() > 1) input.normalize();
      vT.addScaledVector(input, CONFIG.walkAccel*dt);
      if(vT.length() > CONFIG.walkSpeed) vT.setLength(CONFIG.walkSpeed);
    } else {
      vT.multiplyScalar(Math.max(0, 1 - CONFIG.friction*dt));
    }
    _vrel.copy(vT).addScaledVector(localUp, vUpAmt);
    if(pstate.jumpQueued) _vrel.addScaledVector(localUp, CONFIG.jumpSpeed);
    vel.copy(_vrel).add(_bv);
  }
  pstate.jumpQueued = false;
}

// --- atmospheric drag (aerobraking; gas interiors are soup) + sky tint + integration ---
// Returns the display values (darkness/tint/noReturn) the caller pushes to the DOM/HUD; the
// physics (brake, global drag, position integration) all happen here. The DOM write is pure
// display with no read-back, so doing it in the caller after this returns is observationally
// identical to the single-file order.
export interface AtmoResult { darkness: number; tint: string; noReturn: boolean; }
export function applyAtmosphere(dt: number, near: NearestInfo): AtmoResult {
  let darkness = 0;
  let tint = '#000000';
  let noReturn = false;
  {
    const b = near.b;
    if(b.gas && b.cloudR !== null && near.dCenter < b.cloudR) {
      const depth = Math.min(1, Math.max(0, (b.cloudR - near.dCenter) / (b.cloudR - b.R*1.2)));
      if(!pstate.grounded) brakeRelative(b, Math.max(0, 1 - depth*CONFIG.gasInteriorDrag*dt));
      darkness = Math.min(0.93, depth*0.98);   // gas interior darkness: unchanged
      noReturn = pstate.gMag > CONFIG.jetThrust;
    } else if(b.atmo) {
      const atmoTop = near.surfR*(1 + b.atmo.h);
      if(near.dCenter < atmoTop) {
        const density = Math.min(1, Math.max(0, (atmoTop - near.dCenter)/(atmoTop - near.surfR)));
        if(!pstate.grounded) brakeRelative(b, Math.max(0, 1 - density*b.atmo.drag*dt));
        if(b.atmo.darken) darkness = density*b.atmo.darken;      // Venus keeps its darken
        if(b.atmo.sky) {
          tint = b.atmo.sky;
          darkness = Math.max(darkness, density*CONFIG.skyTintMax);
        }
      }
    }
  }

  if(CONFIG.drag !== 1) vel.multiplyScalar(Math.pow(CONFIG.drag, dt*60)); // frame-rate independent
  // While grounded we are pinned to the ground body's frame: the frame delta applied at the
  // top of this frame already carries the orbital motion, so integrating world vel here too
  // would move us at 2x the planet's speed and slide us across the terrain. Integrate only
  // what we are doing WITHIN that frame. Airborne, the world velocity is the whole story.
  if(pstate.grounded && pstate.groundBody) {
    bodyVelAt(pstate.groundBody, sim.time, _bv2);
    player.position.addScaledVector(_vrel.copy(vel).sub(_bv2), dt);
  } else {
    player.position.addScaledVector(vel, dt);
  }
  return { darkness, tint, noReturn };
}

// --- surface collision (sun is deadly; gas giants land on the core) ---
export function resolveSurface(): void {
  pstate.grounded = false;
  pstate.groundBody = null;
  {
    const n2 = nearestBody(player.position);
    const dir = player.position.clone().sub(n2.b.center).normalize();
    const surfR = n2.b.shapeFn ? n2.b.R * n2.b.shapeFn(dir) : n2.b.R;
    const dSurf = n2.dCenter - surfR - CONFIG.playerRadius;
    if(n2.b.deadly && dSurf < 140) { respawn(); }
    else if(dSurf <= 0.03) {
      player.position.copy(n2.b.center).addScaledVector(dir, surfR + CONFIG.playerRadius);
      // Cancel the radial component of RELATIVE velocity, not world velocity: arriving at a
      // planet that is running away from you is not a landing. Matching its motion is.
      bodyVelAt(n2.b, sim.time, _bv2);
      const radial = _vrel.copy(vel).sub(_bv2).dot(dir);
      if(radial < 0) vel.addScaledVector(dir, -radial);
      pstate.grounded = true;
      pstate.groundBody = n2.b;
    }
  }
}

// --- block collision ---
export function resolveBlocks(near: NearestInfo, blocks: BlockInstance[]): void {
  for(const b of blocks){
    const local = b.mesh.worldToLocal(player.position.clone());
    const c = new THREE.Vector3(
      Math.max(-b.half.x, Math.min(b.half.x, local.x)),
      Math.max(-b.half.y, Math.min(b.half.y, local.y)),
      Math.max(-b.half.z, Math.min(b.half.z, local.z))
    );
    const delta = local.clone().sub(c);
    const d = delta.length();
    if(d > 0.0001 && d < CONFIG.playerRadius) {
      const pushWorld = delta.normalize().transformDirection(b.mesh.matrixWorld).normalize();
      player.position.addScaledVector(pushWorld, CONFIG.playerRadius - d);
      // blocks ride their planet, so the same relative-velocity rule applies here
      bodyVelAt(near.b, sim.time, _bv2);
      const vn = _vrel.copy(vel).sub(_bv2).dot(pushWorld);
      if(vn < 0) vel.addScaledVector(pushWorld, -vn);
      const upLocal = player.position.clone().sub(near.b.center).normalize();
      if(pushWorld.dot(upLocal) > 0.5) { pstate.grounded = true; if(!pstate.groundBody) pstate.groundBody = near.b; }
    }
  }
}

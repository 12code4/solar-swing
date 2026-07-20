import { CONFIG } from '../config';
import { canvas, isTouch } from '../scene';
import { app, pstate, keys, view, freeLookOn } from '../player/state';
import { placeBlock, removeBlock, setSelectedBlock } from '../build/building';
import { respawn } from '../player/physics';
import { setMinimap, mmExpanded } from '../ui/minimap';

// ============================================================
// Input — desktop
// ============================================================
export function tryPointerLock(): void {
  try {
    const p = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
    if(p && p.catch) p.catch(()=>{});
  } catch(err) { /* sandboxed/touch contexts refuse pointer lock; fallback covers it */ }
}

canvas.addEventListener('mousedown', e => {
  if(!app.playing || isTouch) return;
  if(!app.locked) tryPointerLock();
  if(e.button === 0) pstate.mouseBurn = true;
  if(e.button === 2) placeBlock();
});
canvas.addEventListener('mouseup', e => {
  if(e.button === 0) pstate.mouseBurn = false;
});
canvas.addEventListener('contextmenu', e => e.preventDefault());

document.addEventListener('pointerlockchange', () => {
  app.locked = !!document.pointerLockElement;
});

document.addEventListener('mousemove', e => {
  if(!app.playing || isTouch) return;
  const mx = e.movementX || 0, my = e.movementY || 0;
  // ALT held: the mouse orbits the CAMERA and the aim stays exactly where it was. Reading
  // e.altKey as well as the key map keeps us honest if a keyup got eaten by the OS.
  if(freeLookOn() || e.altKey) {
    view.flYaw   -= mx*CONFIG.freeLookSens;
    view.flPitch = Math.max(-CONFIG.freeLookMaxPitch, Math.min(CONFIG.freeLookMaxPitch, view.flPitch - my*CONFIG.freeLookSens));
    return;
  }
  view.yawDelta -= mx*CONFIG.freeLookSens;
  // v0.9 item 2: full-range aim — clamp sits just short of the poles
  view.pitch = Math.max(-CONFIG.pitchMax, Math.min(CONFIG.pitchMax, view.pitch - my*CONFIG.freeLookSens));
});

document.addEventListener('wheel', e => {
  view.camDist = Math.max(3, Math.min(30, view.camDist + e.deltaY*0.01));
});

document.addEventListener('keydown', e => {
  keys[e.code]=true;
  if(e.code==='Space' && !e.repeat) pstate.jumpQueued = true;
  if(e.code==='Digit1') setSelectedBlock(0);
  if(e.code==='Digit2') setSelectedBlock(1);
  if(e.code==='Digit3') setSelectedBlock(2);
  if(e.code==='KeyX') removeBlock();
  if(e.code==='KeyR') respawn();
  if(e.code==='KeyM' && !e.repeat) setMinimap(!mmExpanded);        // v0.6 item 4
  if(e.code==='Escape' && mmExpanded) setMinimap(false);
});
document.addEventListener('keyup', e => { keys[e.code]=false; });
window.addEventListener('blur', () => { for(const k in keys) keys[k]=false; pstate.mouseBurn=false; view.eyeHeld=false; });

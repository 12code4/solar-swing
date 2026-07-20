import { CONFIG } from '../config';
import { canvas, isTouch } from '../scene';
import { app, pstate, view } from '../player/state';
import { respawn } from '../player/physics';
import { setMinimap, mmExpanded, mmWrap, mmBack } from '../ui/minimap';

// ============================================================
// Input — touch (v0.9 control rework)
// left stick: camera look (full-range aim) · right stick: walk when grounded, free look
// while EYE is held · right-edge LINEAR SLIDER: jetpack throttle 0..1 (persistent), thrust
// always fires along the camera aim. The old radial burn-stick and the JUMP-held-to-burn
// gate are gone (v0.9 item 3).
// stickL/stickR/throttle are exported so the loop (and, via the loop, physics) can read the
// live values without an input<->physics module cycle.
// ============================================================
interface Stick { el: HTMLElement; knob: HTMLElement; id: number | null; ox: number; oy: number; x: number; y: number; }

export const stickL: Stick = { el:document.getElementById('stickL') as HTMLElement, knob:document.getElementById('knobL') as HTMLElement, id:null, ox:0, oy:0, x:0, y:0 };
export const stickR: Stick = { el:document.getElementById('stickR') as HTMLElement, knob:document.getElementById('knobR') as HTMLElement, id:null, ox:0, oy:0, x:0, y:0 };
export const btnJump = document.getElementById('btnJump') as HTMLElement;
export const btnEye  = document.getElementById('btnEye') as HTMLElement;
export const btnBrake = document.getElementById('btnBrake') as HTMLElement;
export const btnReset = document.getElementById('btnReset') as HTMLElement;

// universal brake (v0.10 item 4) — held state, read by the loop
export const brake = { held: false };

// ----- linear throttle slider (v0.9 item 3) -----
export const throttle = { value: 0 };
export const thrEl = document.getElementById('throttle') as HTMLElement;
const thrTrack = document.getElementById('thrTrack') as HTMLElement;
const thrFill  = document.getElementById('thrFill') as HTMLElement;
const thrLabel = document.getElementById('thrLabel') as HTMLElement;

function setThrottle(v: number): void {
  throttle.value = v < CONFIG.thrSnap ? 0 : Math.min(1, v);
  thrFill.style.height = (throttle.value*100).toFixed(0)+'%';
  thrLabel.textContent = (throttle.value*100).toFixed(0)+'%';
  thrLabel.style.color = throttle.value > 0 ? '#ffdd33' : '#ccc';
}

function throttleFromTouch(t: Touch): void {
  const r = thrTrack.getBoundingClientRect();
  setThrottle(1 - (t.clientY - r.top)/r.height);
}

function stickStart(s: Stick, t: Touch): void {
  s.id = t.identifier;
  s.ox = t.clientX; s.oy = t.clientY;
  s.x = 0; s.y = 0;
  s.el.style.display = 'block';
  s.el.style.left = (s.ox-55)+'px';
  s.el.style.top  = (s.oy-55)+'px';
  s.knob.style.transform = 'translate(-50%,-50%)';
}
function stickMove(s: Stick, t: Touch): void {
  const dx = t.clientX - s.ox, dy = t.clientY - s.oy;
  const len = Math.hypot(dx, dy);
  const cl = Math.min(len, CONFIG.stickRadius);
  const nx = len > 0 ? dx/len : 0, ny = len > 0 ? dy/len : 0;
  s.x = (cl/CONFIG.stickRadius) * nx;
  s.y = (cl/CONFIG.stickRadius) * ny;
  s.knob.style.transform = `translate(calc(-50% + ${nx*cl}px), calc(-50% + ${ny*cl}px))`;
}
function stickEnd(s: Stick): void {
  s.id = null; s.x = 0; s.y = 0;
  s.el.style.display = 'none';
}

if(isTouch) {
  canvas.addEventListener('touchstart', e => {
    if(!app.playing) return;
    e.preventDefault();
    for(const t of Array.from(e.changedTouches)) {
      if(t.clientX < window.innerWidth/2 && stickL.id === null) stickStart(stickL, t);
      else if(t.clientX >= window.innerWidth/2 && stickR.id === null) stickStart(stickR, t);
    }
  }, {passive:false});
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    for(const t of Array.from(e.changedTouches)) {
      if(t.identifier === stickL.id) stickMove(stickL, t);
      if(t.identifier === stickR.id) stickMove(stickR, t);
    }
  }, {passive:false});
  const endHandler = (e: TouchEvent) => {
    for(const t of Array.from(e.changedTouches)) {
      if(t.identifier === stickL.id) stickEnd(stickL);
      if(t.identifier === stickR.id) stickEnd(stickR);
    }
  };
  canvas.addEventListener('touchend', endHandler);
  canvas.addEventListener('touchcancel', endHandler);

  // Throttle: touch events keep firing on the element where the touch STARTED, so a drag
  // that drifts off the track keeps working. stopPropagation keeps it off the canvas sticks.
  const thrHandler = (e: TouchEvent): void => {
    e.preventDefault(); e.stopPropagation();
    throttleFromTouch(e.changedTouches[0]);
  };
  thrTrack.addEventListener('touchstart', thrHandler, {passive:false});
  thrTrack.addEventListener('touchmove', thrHandler, {passive:false});

  // JUMP is now a plain jump (v0.9: burning no longer needs it held)
  btnJump.addEventListener('touchstart', e => { e.preventDefault(); pstate.jumpQueued = true; btnJump.classList.add('on'); }, {passive:false});
  btnJump.addEventListener('touchend',   e => { e.preventDefault(); btnJump.classList.remove('on'); }, {passive:false});
  // BRAKE: hold to retro-burn against the nearest body's frame (v0.10 item 4)
  btnBrake.addEventListener('touchstart', e => { e.preventDefault(); brake.held = true;  btnBrake.classList.add('on'); }, {passive:false});
  btnBrake.addEventListener('touchend',   e => { e.preventDefault(); brake.held = false; btnBrake.classList.remove('on'); }, {passive:false});
  btnBrake.addEventListener('touchcancel', () => { brake.held = false; btnBrake.classList.remove('on'); });
  btnReset.addEventListener('touchstart', e => { e.preventDefault(); setThrottle(0); respawn(); }, {passive:false});
  // v0.6 item 5: hold EYE and the right stick orbits the camera; release eases back to aim.
  btnEye.addEventListener('touchstart', e => { e.preventDefault(); view.eyeHeld = true;  btnEye.classList.add('on'); }, {passive:false});
  btnEye.addEventListener('touchend',   e => { e.preventDefault(); view.eyeHeld = false; btnEye.classList.remove('on'); }, {passive:false});
  btnEye.addEventListener('touchcancel', () => { view.eyeHeld = false; btnEye.classList.remove('on'); });
  // v0.6 item 4: tap the corner map to expand, tap again (or the backdrop) to collapse.
  // These listeners sit on the overlay elements, so they never reach the canvas touchstart
  // that spawns the sticks.
  mmWrap.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); setMinimap(!mmExpanded); }, {passive:false});
  mmBack.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); setMinimap(false); }, {passive:false});
}

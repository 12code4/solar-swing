import { CONFIG } from '../config';
import { canvas, isTouch } from '../scene';
import { app, pstate, view } from '../player/state';
import { respawn } from '../player/physics';
import { setMinimap, mmExpanded, mmWrap, mmBack } from '../ui/minimap';

// ============================================================
// Input — touch (twin virtual sticks)
// left stick: camera look · right stick: walk (grounded) / burn (airborne or JUMP held)
// stickL/stickR/jumpHeld are exported so the loop (and, via the loop, physics) can read the
// live axis values without an input<->physics module cycle.
// ============================================================
interface Stick { el: HTMLElement; knob: HTMLElement; id: number | null; ox: number; oy: number; x: number; y: number; }

export const stickL: Stick = { el:document.getElementById('stickL') as HTMLElement, knob:document.getElementById('knobL') as HTMLElement, id:null, ox:0, oy:0, x:0, y:0 };
export const stickR: Stick = { el:document.getElementById('stickR') as HTMLElement, knob:document.getElementById('knobR') as HTMLElement, id:null, ox:0, oy:0, x:0, y:0 };
export const btnJump = document.getElementById('btnJump') as HTMLElement;
export const btnEye  = document.getElementById('btnEye') as HTMLElement;
export const btnReset = document.getElementById('btnReset') as HTMLElement;
export let jumpHeld = false;

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

  btnJump.addEventListener('touchstart', e => { e.preventDefault(); jumpHeld = true; pstate.jumpQueued = true; btnJump.classList.add('on'); }, {passive:false});
  btnJump.addEventListener('touchend',   e => { e.preventDefault(); jumpHeld = false; btnJump.classList.remove('on'); }, {passive:false});
  btnReset.addEventListener('touchstart', e => { e.preventDefault(); respawn(); }, {passive:false});
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

import { CONFIG } from '../config';
import { player, vel } from '../player/state';
import { bodies } from '../bodies/gravity';
import '../bodies/build-bodies';   // side-effect: bodies[] must be populated before MM_PLANETS is built
import { predLine, predPts, predOutcome, PRED } from '../player/prediction';
import type { Body } from '../types';

// ============================================================
// Minimap (v0.6 item 4)
// Top-down XZ, sun-centred, LOG-RADIAL. A linear map is useless here: Pluto sits 101x
// further out than Mercury, so linear crushes the entire inner system into the middle pixel.
// log10(1 + d/K) normalised to the outermost orbit keeps every planet visibly separate.
// It is a 2D canvas overlay — nothing here touches the WebGL scene or the camera basis.
// ============================================================
export const mmWrap = document.getElementById('mmwrap') as HTMLElement;
export const mmBack = document.getElementById('mmback') as HTMLElement;
const mmCanvas = document.getElementById('minimap') as HTMLCanvasElement;
const mmCtx = mmCanvas.getContext('2d')!;
export let mmExpanded = false;

// approximations of each body's palette — the map should read at a glance, not match exactly
const MM_COLORS: Record<string, string> = {
  SUN:'#ffdd33', MERCURY:'#9a8f86', VENUS:'#d9b26a', EARTH:'#3f7c9a', MARS:'#a14f2c',
  JUPITER:'#c9a06f', SATURN:'#e6d3a3', URANUS:'#9fd6de', NEPTUNE:'#3b5bd6', PLUTO:'#b6a89a'
};
const MM_PLANETS: Body[] = bodies.filter(b => !b.star && !b.belt);
const MM_MAXDIST = MM_PLANETS.reduce((m,b) => Math.max(m, b.orbitR), 1);
const MM_FULLLOG = Math.log10(1 + MM_MAXDIST/CONFIG.minimapLogK);
const mmRadius = (dist: number, Rpix: number): number =>
  Rpix * Math.min(1.06, Math.log10(1 + Math.max(0,dist)/CONFIG.minimapLogK) / MM_FULLLOG);

// world XZ -> canvas px. Sun is at the origin, so it lands dead centre.
const _mmp = { x:0, y:0 };
function mmProject(x: number, z: number, cx: number, cy: number, Rpix: number, out: { x: number; y: number }): { x: number; y: number } {
  const r = mmRadius(Math.hypot(x, z), Rpix);
  const a = Math.atan2(z, x);
  out.x = cx + Math.cos(a)*r;
  out.y = cy + Math.sin(a)*r;
  return out;
}

export function drawMinimap(): void {
  const cssW = mmWrap.clientWidth || CONFIG.minimapCorner;
  const cssH = mmWrap.clientHeight || CONFIG.minimapCorner;
  if(!cssW || !cssH) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if(mmCanvas.width !== Math.round(cssW*dpr) || mmCanvas.height !== Math.round(cssH*dpr)) {
    mmCanvas.width = Math.round(cssW*dpr);
    mmCanvas.height = Math.round(cssH*dpr);
  }
  const ctx = mmCtx;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const cx = cssW/2, cy = cssH/2;
  const pad = mmExpanded ? 22 : 7;
  const Rpix = Math.min(cssW, cssH)/2 - pad;
  const big = mmExpanded;

  // belt annulus, faint
  {
    const rIn  = mmRadius(2.2*CONFIG.AU, Rpix);
    const rOut = mmRadius(3.3*CONFIG.AU, Rpix);
    ctx.beginPath();
    ctx.arc(cx, cy, (rIn+rOut)/2, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(180,160,130,0.16)';
    ctx.lineWidth = Math.max(1, rOut-rIn);
    ctx.stroke();
  }

  // orbit rings
  ctx.lineWidth = 1;
  for(const b of MM_PLANETS) {
    ctx.beginPath();
    ctx.arc(cx, cy, mmRadius(b.orbitR, Rpix), 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.stroke();
  }

  // sun
  ctx.beginPath();
  ctx.arc(cx, cy, big ? 4 : 2.5, 0, Math.PI*2);
  ctx.fillStyle = MM_COLORS.SUN;
  ctx.fill();

  // planets
  if(big) { ctx.font = '9px "Courier New",monospace'; ctx.textAlign = 'center'; }
  for(const b of MM_PLANETS) {
    mmProject(b.center.x, b.center.z, cx, cy, Rpix, _mmp);
    ctx.beginPath();
    ctx.arc(_mmp.x, _mmp.y, big ? 3.5 : 2, 0, Math.PI*2);
    ctx.fillStyle = MM_COLORS[b.name] || '#999';
    ctx.fill();
    if(big) {   // labels on the expanded view only — they would be soup at 150px
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText(b.name, _mmp.x, _mmp.y - 6);
    }
  }

  // prediction endpoint, in the trajectory line's own outcome colour
  if(predLine.visible) {
    const end = predPts[predPts.length-1];
    mmProject(end.x, end.z, cx, cy, Rpix, _mmp);
    ctx.beginPath();
    ctx.arc(_mmp.x, _mmp.y, big ? 2.5 : 1.6, 0, Math.PI*2);
    ctx.fillStyle = predOutcome === PRED.IMPACT ? CONFIG.predColorImpact :
                    predOutcome === PRED.ORBIT  ? CONFIG.predColorOrbit  : CONFIG.predColorCoast;
    ctx.fill();
  }

  // player + velocity arrow
  mmProject(player.position.x, player.position.z, cx, cy, Rpix, _mmp);
  const px = _mmp.x, py = _mmp.y;
  const sp = Math.hypot(vel.x, vel.z);
  if(sp > 0.001) {
    // Probe a point ahead in WORLD space and project it: doing the arrow in map space keeps
    // it honest under the log distortion instead of pointing at a lie near the sun.
    const k = CONFIG.minimapArrowWorld/sp;
    mmProject(player.position.x + vel.x*k, player.position.z + vel.z*k, cx, cy, Rpix, _mmp);
    let dx = _mmp.x - px, dy = _mmp.y - py;
    const dl = Math.hypot(dx, dy);
    if(dl > 0.0001) {
      const L = big ? CONFIG.minimapArrowPx*1.5 : CONFIG.minimapArrowPx;
      dx = dx/dl*L; dy = dy/dl*L;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px+dx, py+dy);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = big ? 1.6 : 1.2;
      ctx.stroke();
    }
  }
  ctx.beginPath();
  ctx.arc(px, py, big ? 3 : 2, 0, Math.PI*2);
  ctx.fillStyle = '#fff';
  ctx.fill();
}

export function setMinimap(on: boolean): void {
  mmExpanded = on;
  mmWrap.classList.toggle('exp', on);
  mmBack.classList.toggle('on', on);
  drawMinimap();
}

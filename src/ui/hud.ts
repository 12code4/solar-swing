import { CONFIG } from '../config';
import { pstate } from '../player/state';
import { predOutcome, predLine, PRED } from '../player/prediction';
import type { NearestInfo } from '../types';

// HUD element refs
const statsEl = document.getElementById('stats') as HTMLElement;
export const dot = document.getElementById('dot') as unknown as SVGElement;   // SVG <circle>, mutated via setAttribute
const heatfill = document.getElementById('heatfill') as HTMLElement;
const heatBox = document.getElementById('heat') as HTMLElement;
const darkEl = document.getElementById('dark') as HTMLElement;
let lastTint = '#000000';   // avoids restyling the overlay every frame

// The gas-interior / atmosphere overlay. darkness + tint come from physics.applyAtmosphere;
// this is the DOM half (pure display, no read-back).
export function applySky(darkness: number, tint: string): void {
  if(tint !== lastTint) { darkEl.style.background = tint; lastTint = tint; }
  darkEl.style.opacity = darkness.toFixed(2);
}

export function updateHud(near: NearestInfo, relSpeed: number, noReturn: boolean, thrusting: boolean, braking: boolean): void {
  const speed = relSpeed;   // relative to the nearest body — this is what rendezvous needs
  // orbital + escape velocity at current distance from nearest body
  const reach = near.b.cloudR || near.b.R;
  const gHere = near.b.g * (reach / Math.max(near.dCenter, reach))**2;
  const vOrb = Math.sqrt(Math.max(0, gHere * near.dCenter));
  const vEsc = vOrb * Math.SQRT2;
  const orbiting = predOutcome === PRED.ORBIT && predLine.visible;
  const mode = noReturn ? 'NO RETURN' : (pstate.grounded ? 'GROUNDED' : (braking && thrusting ? 'BRAKING' : (thrusting ? 'BURNING' : (orbiting ? 'ORBIT' : 'COASTING'))));
  const modeColor = noReturn ? '#ff4433' : (mode === 'ORBIT' ? CONFIG.predColorOrbit : (mode === 'BRAKING' ? CONFIG.predColorCoast : '#ffdd33'));
  const dShow = near.dSurf > 999 ? (near.dSurf/1000).toFixed(1)+'km' : Math.max(0,near.dSurf).toFixed(0)+'m';
  statsEl.innerHTML = `v: ${speed.toFixed(1)} m/s<br>`
    + `<span style="color:#8fa">${near.b.name} · ${dShow} · g ${pstate.gMag.toFixed(1)}</span><br>`
    + `<span style="color:#7fc7ff">orb ${vOrb.toFixed(0)} · esc ${vEsc.toFixed(0)}</span><br>`
    + `<span style="color:${modeColor}">${mode}</span>`;
  heatfill.style.width = (pstate.heat*100).toFixed(0)+'%';
  heatfill.style.background = pstate.overheated ? '#ff4433' : '#ffdd33';
  heatBox.style.color = pstate.overheated ? '#ff4433' : '#889';
  heatBox.firstChild!.textContent = pstate.overheated ? 'OVERHEATED' : 'JETPACK';
}

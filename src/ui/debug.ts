import * as THREE from 'three';
import { canvas, isTouch } from '../scene';
import { sim } from '../world/sim';
import { bodies } from '../bodies/gravity';
import { bodyVelAt } from '../bodies/orbits';
import { player, vel, pstate, app } from '../player/state';
import { baseConfig, setBaseValue, cheats, meta, run, addSalvage, wipeMeta } from '../rogue/state';
import { abortRun, toast } from '../rogue/ui';
import type { NearestInfo } from '../types';

// ============================================================
// Debug menu (v0.8 spec item 6). ` / ~ toggles. DOM is built here (auto-generated tuning
// rows), CSS lives in index.html. Tuning edits go through setBaseValue -> applyTuning, so
// purchased upgrades keep composing on top, and BOTH the live sim and the predictor see the
// change (they read the same CONFIG — invariant 2/3).
// ============================================================

export const dbg = { open: false };

// Keys consumed only while the world is BUILT (geometry, orbits, belt, composer, body g).
// Editable for completeness but flagged: they do nothing until a reload.
const STARTUP_KEYS = new Set([
  'gravityK','gravityMax','sunGravity','terrainHiFreqMult',
  'craterCountMin','craterCountMax','craterRadMin','craterRadMax','craterDepthMin',
  'craterDepthMax','craterRimHeight','craterRimWidth','craterDetail',
  'gasTurb','gasWobble3','atmoFalloff','atmoStrengthMult','atmoGasStrength',
  'bloomStrength','bloomRadius','bloomThreshold','orbitTimeScale','texVertexLift',
  'beltCount','beltShapeCount','beltMajors','beltMajorMinR','beltMajorRangeR','beltMinR',
  'beltMaxR','beltSizeSkew','beltDecorMaxR','beltClusterFrac','beltYSpread',
  'minimapCorner','minimapExpandVMin','AU','earthR',
  'surfShardsRocky','orbitShardsRocky','orbitShardsGas','beltShardsMajor',
]);

const INITIAL: Record<string, number> = { ...baseConfig };   // pristine values for reset
const UP = new THREE.Vector3(0, 1, 0);   // teleport arrival direction (above the pole)

const root = document.getElementById('dbg') as HTMLElement;
// Typing in panel inputs must not reach the document key handlers (WASD would walk the
// player). Keydown from a panel child stops here — except the toggle key itself.
root.addEventListener('keydown', e => {
  if(e.code === 'Backquote') { e.preventDefault(); toggleDebug(); }
  e.stopPropagation();
});
root.addEventListener('keyup', e => e.stopPropagation());

const statsBox = document.createElement('div');
const inputs: Record<string, HTMLInputElement> = {};

function h3(text: string): HTMLElement {
  const el = document.createElement('h3');
  el.textContent = text;
  root.appendChild(el);
  return el;
}

function actionBtn(parent: HTMLElement, label: string, fn: (btn: HTMLButtonElement) => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'rbtn';
  b.textContent = label;
  b.addEventListener('click', () => fn(b));
  parent.appendChild(b);
  return b;
}

// ----- build the panel -----
{
  h3('STATS');
  statsBox.id = 'dbgstats';
  root.appendChild(statsBox);

  h3('TIME');
  const timeRow = document.createElement('div');
  timeRow.className = 'row';
  root.appendChild(timeRow);
  const timeBtns: HTMLButtonElement[] = [];
  for(const s of [0, 0.25, 1, 4]) {
    const b = actionBtn(timeRow, `x${s}`, () => {
      cheats.timeScale = s;
      for(const tb of timeBtns) tb.classList.toggle('on', tb.textContent === `x${s}`);
    });
    if(s === 1) b.classList.add('on');
    timeBtns.push(b);
  }

  h3('ACTIONS');
  const act = document.createElement('div');
  act.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;';
  root.appendChild(act);
  actionBtn(act, 'REFILL HEAT', () => { pstate.heat = 0; pstate.overheated = false; });
  actionBtn(act, 'GOD MODE', b => { cheats.god = !cheats.god; b.classList.toggle('on', cheats.god); });
  actionBtn(act, 'INF HEAT', b => { cheats.infiniteHeat = !cheats.infiniteHeat; b.classList.toggle('on', cheats.infiniteHeat); });
  actionBtn(act, '+100 SALVAGE', () => { addSalvage(100); toast('+100 SALVAGE (DEBUG)'); });
  actionBtn(act, 'END RUN', () => abortRun());
  actionBtn(act, 'WIPE META', b => {
    if(b.dataset.armed === '1') { wipeMeta(); b.dataset.armed = ''; b.textContent = 'WIPE META'; b.classList.remove('on'); }
    else {
      b.dataset.armed = '1'; b.textContent = 'SURE? CLICK AGAIN'; b.classList.add('on');
      setTimeout(() => { b.dataset.armed = ''; b.textContent = 'WIPE META'; b.classList.remove('on'); }, 3000);
    }
  });

  // teleport: arrive above the body with its velocity matched (rendezvous rules respected)
  const tpRow = document.createElement('div');
  tpRow.className = 'row';
  tpRow.style.marginTop = '6px';
  root.appendChild(tpRow);
  const sel = document.createElement('select');
  let beltN = 0;
  bodies.forEach((b, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = b.belt ? `BELT ROCK ${++beltN}` : b.name;
    sel.appendChild(o);
  });
  tpRow.appendChild(sel);
  actionBtn(tpRow, 'TELEPORT', () => {
    const b = bodies[parseInt(sel.value, 10)];
    const reach = b.cloudR || b.R;
    player.position.copy(b.center).addScaledVector(UP, reach*2.2);
    bodyVelAt(b, sim.time, vel);
    pstate.grounded = false; pstate.groundBody = null;
    pstate.heat = 0; pstate.overheated = false;
    toast(`TELEPORT: ${b.name}`, '#7fc7ff');
  });

  h3('TUNING');
  const note = document.createElement('div');
  note.style.cssText = 'color:#667;line-height:1.5;margin-bottom:6px;';
  note.textContent = 'live edits; dim rows only apply after reload. Upgraded fields (thrust/heat/cool/crash) show the BASE value.';
  root.appendChild(note);
  const filter = document.createElement('input');
  filter.type = 'text';
  filter.placeholder = 'filter…';
  root.appendChild(filter);
  const resetRow = document.createElement('div');
  resetRow.className = 'row';
  root.appendChild(resetRow);
  actionBtn(resetRow, 'RESET ALL', () => {
    for(const k of Object.keys(INITIAL)) setBaseValue(k, INITIAL[k]);
    for(const k of Object.keys(inputs)) inputs[k].value = String(baseConfig[k]);
  });

  const rows: { key: string; el: HTMLElement }[] = [];
  for(const key of Object.keys(baseConfig)) {
    const row = document.createElement('div');
    row.className = 'row' + (STARTUP_KEYS.has(key) ? ' startup' : '');
    const label = document.createElement('label');
    label.textContent = key + (STARTUP_KEYS.has(key) ? ' *' : '');
    label.title = STARTUP_KEYS.has(key) ? 'startup-only: applied at world build, reload to see it' : key;
    row.appendChild(label);
    const input = document.createElement('input');
    input.type = 'number';
    input.step = 'any';
    input.value = String(baseConfig[key]);
    input.addEventListener('change', () => {
      const v = parseFloat(input.value);
      if(isFinite(v)) setBaseValue(key, v);
      else input.value = String(baseConfig[key]);
    });
    inputs[key] = input;
    row.appendChild(input);
    actionBtn(row, 'R', () => { setBaseValue(key, INITIAL[key]); input.value = String(INITIAL[key]); });
    root.appendChild(row);
    rows.push({ key, el: row });
  }
  filter.addEventListener('input', () => {
    const q = filter.value.toLowerCase();
    for(const r of rows) r.el.style.display = r.key.toLowerCase().includes(q) ? 'flex' : 'none';
  });
}

export function toggleDebug(): void {
  dbg.open = !dbg.open;
  root.style.display = dbg.open ? 'block' : 'none';
  if(dbg.open) {
    try { document.exitPointerLock(); } catch(err) { /* not locked */ }
    if(!isTouch) canvas.style.cursor = 'crosshair';
  } else if(app.playing && !isTouch) {
    canvas.style.cursor = 'none';   // next canvas click re-locks the pointer
  }
}

// ----- live stats (fed by the loop every frame; DOM written ~5Hz while open) -----
let fpsEma = 60;
let tick = 0;
export function updateDebug(near: NearestInfo, rawDt: number): void {
  if(rawDt > 1e-4) fpsEma += (1/rawDt - fpsEma)*0.05;
  if(!dbg.open || (++tick % 12)) return;
  const p = player.position;
  statsBox.textContent =
    `fps      ${fpsEma.toFixed(0)}\n`
    + `sim time ${sim.time.toFixed(1)}s  (x${cheats.timeScale})\n`
    + `body     ${near.b.name}  dSurf ${near.dSurf.toFixed(1)}\n`
    + `speed    ${vel.length().toFixed(1)} world\n`
    + `g        ${pstate.gMag.toFixed(2)}   heat ${(pstate.heat*100).toFixed(0)}%${pstate.overheated ? ' OVERHEATED' : ''}\n`
    + `pos      ${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)}\n`
    + `grounded ${pstate.grounded}${pstate.groundBody ? ' on ' + pstate.groundBody.name : ''}\n`
    + `run      ${run.active ? 'active' : 'ended'}  salvage ${meta.salvage}  earned ${run.salvageEarned}\n`
    + `charted  ${meta.discovered.length}  runs ${meta.stats.runs}  deaths ${meta.stats.deaths}\n`
    + `cheats   god ${cheats.god ? 'ON' : 'off'} · infheat ${cheats.infiniteHeat ? 'ON' : 'off'}`;
}

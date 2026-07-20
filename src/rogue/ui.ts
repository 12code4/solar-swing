import { CONFIG } from '../config';
import { canvas, isTouch } from '../scene';
import { sim } from '../world/sim';
import { app, pstate } from '../player/state';
import { respawn } from '../player/physics';
import {
  meta, run, cheats, hooks, DISCOVERABLE_COUNT,
  startRun, endRun, addSalvage, discover, saveMeta, applyTuning, upgLevel,
} from './state';
import { resetShards, updatePickups } from './pickups';

// ============================================================
// Roguelite UI + per-frame orchestration (v0.8 spec items 2/4/5).
// Owns: toasts, the RUN ENDED / HOME BASE overlay with the upgrade shop, the death hook,
// and updateRogue() (pickup collection + discovery), called by the loop each frame.
// ============================================================

const toastEl   = document.getElementById('toast') as HTMLElement;
const runendEl  = document.getElementById('runend') as HTMLElement;
const reTitle   = document.getElementById('reTitle') as HTMLElement;
const reCause   = document.getElementById('reCause') as HTMLElement;
const reStats   = document.getElementById('reStats') as HTMLElement;
const reSalv    = document.getElementById('reSalv') as HTMLElement;
const shopEl    = document.getElementById('shop') as HTMLElement;
const launchBtn = document.getElementById('launchbtn') as HTMLElement;

// ----- toasts -----
let toastTimer: ReturnType<typeof setTimeout> | null = null;
export function toast(msg: string, color = '#ffdd33'): void {
  toastEl.textContent = msg;
  toastEl.style.color = color;
  toastEl.style.opacity = '1';
  if(toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.style.opacity = '0'; }, 2600);
}

// ----- upgrade shop -----
// Effect sizes live in CONFIG (game-feel rule); costs are economy/UI, so they live here.
interface UpgradeDef { id: string; name: string; max: number; baseCost: number; desc: () => string; }
const UPGRADES: UpgradeDef[] = [
  { id:'thrusters', name:'THRUSTERS', max:4, baseCost:60,
    desc:()=>`+${(CONFIG.upgThrustPct*100).toFixed(0)}% thrust/lv — capped: big planets stay unhoverable` },
  { id:'heatsink',  name:'HEATSINK',  max:5, baseCost:40,
    desc:()=>`-${(CONFIG.upgHeatsinkPct*100).toFixed(0)}% heat buildup per level` },
  { id:'radiator',  name:'RADIATOR',  max:5, baseCost:40,
    desc:()=>`+${(CONFIG.upgRadiatorPct*100).toFixed(0)}% cooling rate per level` },
  { id:'aeroshell', name:'AEROSHELL', max:5, baseCost:50,
    desc:()=>`+${CONFIG.upgAeroshellFlat} m/s crash tolerance per level` },
];
const upgCost = (u: UpgradeDef): number => u.baseCost * (upgLevel(u.id) + 1);

function renderShop(): void {
  reSalv.textContent = `SALVAGE: ${meta.salvage}`;
  shopEl.innerHTML = '';
  for(const u of UPGRADES) {
    const lv = upgLevel(u.id);
    const maxed = lv >= u.max;
    const cost = upgCost(u);
    const row = document.createElement('div');
    row.className = 'upg';
    row.innerHTML = `<span class="nm">${u.name}</span><span class="lv">${lv}/${u.max}</span>`
      + `<span class="ds">${u.desc()}</span>`;
    const btn = document.createElement('button');
    btn.textContent = maxed ? 'MAX' : `BUY ${cost}`;
    btn.disabled = maxed || meta.salvage < cost;
    const buy = (): void => {
      if(maxed || meta.salvage < cost) return;
      meta.salvage -= cost;   // direct: a purchase is not run earnings
      meta.upgrades[u.id] = lv + 1;
      applyTuning();
      saveMeta();
      renderShop();
    };
    btn.addEventListener('click', buy);
    btn.addEventListener('touchstart', e => { e.preventDefault(); buy(); }, {passive:false});
    row.appendChild(btn);
    shopEl.appendChild(row);
  }
}

// ----- run end / home base overlay -----
let overlayMode: 'death' | 'base' = 'death';

const fmtTime = (s: number): string => {
  const m = Math.floor(s/60);
  return `${m}:${Math.floor(s - m*60).toString().padStart(2,'0')}`;
};

function showOverlay(mode: 'death' | 'base', cause: string): void {
  overlayMode = mode;
  reTitle.textContent = mode === 'death' ? 'RUN ENDED' : 'HOME BASE';
  reTitle.style.color = mode === 'death' ? '#ff5544' : '#ffdd33';
  reCause.textContent = cause;
  reStats.textContent = mode === 'death'
    ? `run time ${fmtTime(sim.time - run.startTime)} · salvage earned ${run.salvageEarned} · new discoveries ${run.discoveredThisRun}`
    : `runs ${meta.stats.runs} · deaths ${meta.stats.deaths} · charted ${meta.discovered.length}/${DISCOVERABLE_COUNT}`;
  renderShop();
  runendEl.style.display = 'flex';
  app.playing = false;
  try { document.exitPointerLock(); } catch(err) { /* not locked */ }
  if(!isTouch) canvas.style.cursor = 'crosshair';
}

function earthHomeDiscovery(): void {
  if(discover('EARTH')) {
    addSalvage(CONFIG.discoveryBonus);
    toast(`DISCOVERED: EARTH +${CONFIG.discoveryBonus}`);
  }
}

// First launch, called by main.ts startGame.
export function beginRun(): void {
  resetShards();
  startRun(sim.time);
  earthHomeDiscovery();
}

function launch(): void {
  runendEl.style.display = 'none';
  app.playing = true;
  if(overlayMode === 'death') {
    respawn();
    beginRun();
  }
  if(!isTouch) {
    canvas.style.cursor = 'none';
    try {
      const p = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      if(p && p.catch) p.catch(()=>{});
    } catch(err) { /* fallback: next canvas click locks */ }
  }
}
launchBtn.addEventListener('click', launch);
launchBtn.addEventListener('touchstart', e => { e.preventDefault(); launch(); }, {passive:false});

// U key (desktop.ts): spend salvage without dying — but only from home ground.
export function openHomeBase(): void {
  if(!run.active || runendEl.style.display === 'flex') return;
  if(!(pstate.grounded && pstate.groundBody && pstate.groundBody.name === 'EARTH')) {
    toast('HOME BASE: land on EARTH first', '#889');
    return;
  }
  showOverlay('base', 'spend salvage, then launch');
}

// Debug-menu action: abort the current run without counting a death.
export function abortRun(): void {
  if(!run.active) return;
  endRun(false);
  showOverlay('death', 'RUN ABORTED (DEBUG)');
}

// ----- the death hook (spec item 2) -----
hooks.death = (cause: string): void => {
  if(cheats.god || !run.active) {
    // god mode / already-ended run: sun and void still need an exit; a hard landing doesn't
    if(cause !== 'CRASH LANDING') respawn();
    return;
  }
  endRun(true);
  showOverlay('death', cause);
};

// ----- per-frame (called by the loop) -----
const collectedBuf: number[] = [];
export function updateRogue(): void {
  if(!run.active) return;
  collectedBuf.length = 0;
  updatePickups(collectedBuf);
  for(const v of collectedBuf) toast(`+${v} SALVAGE`);
  if(pstate.grounded && pstate.groundBody && !pstate.groundBody.star) {
    if(discover(pstate.groundBody.name)) {
      addSalvage(CONFIG.discoveryBonus);
      toast(`DISCOVERED: ${pstate.groundBody.name} +${CONFIG.discoveryBonus}`);
    }
  }
}

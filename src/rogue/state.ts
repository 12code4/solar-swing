import { CONFIG } from '../config';

// ============================================================
// Roguelite state (v0.8 spec item 1). A leaf module — imports CONFIG only — so physics and
// the loop can read run/cheat state without ever touching UI code. The UI assigns
// hooks.death; leaf modules call it instead of importing the overlay (no cycles).
// ============================================================

// ----- meta (persists across sessions) -----
export interface Meta {
  salvage: number;
  upgrades: Record<string, number>;   // upgrade id -> level
  discovered: string[];               // body names ever landed on
  stats: { runs: number; deaths: number };
}

const META_KEY = 'solarSwingMeta.v1';

function defaultMeta(): Meta {
  return { salvage: 0, upgrades: {}, discovered: [], stats: { runs: 0, deaths: 0 } };
}

export function loadMeta(): Meta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if(raw) return { ...defaultMeta(), ...JSON.parse(raw) as Meta };
  } catch(err) { /* sandboxed contexts may block storage; play memory-only */ }
  return defaultMeta();
}

export function saveMeta(): void {
  try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch(err) { /* memory-only */ }
}

export function wipeMeta(): void {
  try { localStorage.removeItem(META_KEY); } catch(err) { /* fine */ }
  Object.assign(meta, defaultMeta());
  applyTuning();
}

export const meta: Meta = loadMeta();

// ----- run (in-memory, reset each launch) -----
export const run = {
  active: false,
  startTime: 0,          // sim.time at launch
  salvageEarned: 0,
  discoveredThisRun: 0,
  collected: new Set<string>(),   // shard ids picked up this run
};

// ----- cheats (debug menu writes, sim reads) -----
export const cheats = {
  god: false,
  infiniteHeat: false,
  timeScale: 1,
};

// ----- death hook -----
// Assigned by rogue/ui.ts. Until then (or in god mode) leaf callers get plain-respawn
// behavior by whatever fallback the assigner installs; the default is a no-op so module
// init order can never explode.
export const hooks = {
  death: (_cause: string): void => {},
};

// ----- discoverable tally (HUD denominator): 9 planets + BELT ROCK -----
export const DISCOVERABLE_COUNT = 10;

// ============================================================
// Tuning pipeline (spec item 1). baseConfig snapshots every numeric CONFIG value at boot;
// applyTuning recomputes the upgraded fields from base x upgrade effect. The debug menu
// edits BASE then re-applies, so debug edits and purchased upgrades compose instead of
// stomping each other. Everything else keeps reading CONFIG, which is why the live sim and
// the predictor both pick changes up automatically (invariant 2/3).
// ============================================================
export const baseConfig: Record<string, number> = {};
for(const [k, v] of Object.entries(CONFIG)) {
  if(typeof v === 'number') baseConfig[k] = v;
}

export function upgLevel(id: string): number { return meta.upgrades[id] || 0; }

export function applyTuning(): void {
  const cfg = CONFIG as unknown as Record<string, number>;
  for(const k of Object.keys(baseConfig)) cfg[k] = baseConfig[k];
  cfg.jetThrust  = baseConfig.jetThrust  * (1 + CONFIG.upgThrustPct   * upgLevel('thrusters'));
  cfg.heatRate   = baseConfig.heatRate   * (1 - CONFIG.upgHeatsinkPct * upgLevel('heatsink'));
  cfg.coolRate   = baseConfig.coolRate   * (1 + CONFIG.upgRadiatorPct * upgLevel('radiator'));
  cfg.crashSpeed = baseConfig.crashSpeed + CONFIG.upgAeroshellFlat    * upgLevel('aeroshell');
}

// The debug menu's single write path for tunables.
export function setBaseValue(key: string, value: number): void {
  if(!(key in baseConfig) || !isFinite(value)) return;
  baseConfig[key] = value;
  applyTuning();
}

// ----- salvage / discovery API (leaf logic; toasts are the caller's job) -----
export function addSalvage(n: number): void {
  meta.salvage += n;
  if(run.active) run.salvageEarned += n;
  saveMeta();
}

// Returns true when this is a first-ever discovery (caller pays the bonus + toast).
export function discover(name: string): boolean {
  if(meta.discovered.includes(name)) return false;
  meta.discovered.push(name);
  if(run.active) run.discoveredThisRun++;
  saveMeta();
  return true;
}

export function startRun(simTime: number): void {
  run.active = true;
  run.startTime = simTime;
  run.salvageEarned = 0;
  run.discoveredThisRun = 0;
  run.collected.clear();
  meta.stats.runs++;
  saveMeta();
}

export function endRun(death: boolean): void {
  run.active = false;
  if(death) meta.stats.deaths++;
  saveMeta();
}

applyTuning();   // upgrades bought in past sessions take effect at boot

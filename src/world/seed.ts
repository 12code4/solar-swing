// ============================================================
// Run seed (v0.9 item 1). One integer scrambles every orbital phase — the roguelite "run"
// identity. `?seed=N` in the URL pins a layout (shareable); otherwise each page load rolls
// a fresh system. Only ORBITAL PHASE is seeded: terrain, crater layouts, rock shapes/sizes
// and radii stay fixed, so world identity (and the physical-rock budget) is stable while
// the map shuffles.
// ============================================================
const param = new URLSearchParams(location.search).get('seed');
export const runSeed: number =
  param && /^\d{1,9}$/.test(param) ? parseInt(param, 10) : Math.floor(Math.random()*1e9);

// Compact value for mixing into seededRand chains (keeps sin() arguments in a sane range).
export const seedMix: number = runSeed % 99991;

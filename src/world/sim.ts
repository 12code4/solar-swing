// The simulation clock — the single value every kinematic orbit is a function of (v0.6 item 1).
// A grouped module-level singleton (see main.ts on the state-management choice): every module
// reads and the loop advances `sim.time`, so there is exactly one clock and no threaded param.
export const sim = { time: 0 };

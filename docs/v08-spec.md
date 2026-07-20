# v0.8 spec — "Salvage Run" (exploration + roguelite) + debug menu

Owner request: add exploration and roguelite elements, plus an in-game debug menu for
checking stats and changing values. Built on branch `claude/roguelite-debug-menu-89966t`.

Scope note: CLAUDE.md's locked scope predates this request. This spec is the owner-sanctioned
expansion; CLAUDE.md's OUT list (farming, looting-inventory, moons, sound, sandbox save/load)
stays out. One deliberate exception: roguelite META progression needs persistence, so meta
state (salvage, upgrades, discoveries) uses localStorage. Sandbox world save/load remains
backlog.

## Design pillars

- The existing traversal IS the game. Roguelite elements add stakes (death) and a reason to
  go places (shards, discoveries). No new movement mechanics.
- Minimal-churn integration: everything reads/writes through the existing singletons and
  CONFIG. The three invariants (one shapeFn, one gravityAt, one CONFIG) are untouched.
- Upgrades must never break the design rule "thrust 38 < big-planet surface g 45".
  Thruster upgrade caps at +16% (44.1), still below 45.

## Item 1 — Run/meta state (`src/rogue/state.ts`)

- Meta (persists, localStorage key `solarSwingMeta.v1`, try/catch guarded):
  `salvage`, `upgrades` (levels per id), `discovered` (body names), `stats` {runs, deaths}.
- Run (in-memory): `active`, `startTime`, `salvageEarned`, `collected` (shard id set),
  `discoveredThisRun`.
- Cheats (debug menu writes, sim reads): `god`, `infiniteHeat`, `timeScale`.
- `hooks.death(cause)` — assigned by rogue UI; physics/loop call it instead of respawn()
  so the leaf modules never import UI (no cycles).
- Tuning pipeline: `baseConfig` snapshots every numeric CONFIG value at boot.
  `applyTuning()` recomputes the upgraded fields from base x upgrade effect:
  jetThrust, heatRate, coolRate, crashSpeed. Debug-menu edits write BASE then re-apply,
  so upgrades and debug edits compose instead of stomping each other.

## Item 2 — Death (roguelite stakes)

Run-ending deaths (all bank salvage; overlay shows cause + run stats + shop):
- SUN: the existing deadly-body branch in resolveSurface calls hooks.death instead of respawn.
- CRASH: landing with relative radial impact speed above CONFIG.crashSpeed (base 30 m/s;
  aeroshell upgrade raises it). Impact speed measured in resolveSurface where the radial
  component is cancelled — same relative-velocity rule as everything else.
- VOID: the boundsDist check in the loop becomes a death.
Gas giants stay non-lethal: landing on the core through NO RETURN is a feature (core shard
lives there); you grab it and R out. R stays a free abort/safety, not a death.

## Item 3 — Salvage shards (`src/rogue/pickups.ts`)

Seeded deterministic placement (reuses seededRand). Shards are small emissive octahedra
parented to the body's group so they ride the orbit exactly like placed blocks. Body groups
only ever translate, so local dir == world dir and surface placement can use shapeFn
directly (invariant 1 respected).

- Rocky planets (Mercury, Venus, Earth, Mars, Pluto): 6 surface shards (on terrain via
  shapeFn) + 6 orbital shards (ring band at 1.35-1.9 reach, y-wobbled).
- Gas giants: 8 orbital shards + 1 CORE shard on the core surface (worth coreShardValue —
  the paid NO RETURN dive).
- Belt majors: 3 surface shards each.
- Collection: proximity check per frame (lengthSq, ~130 shards, cheap). Collect = hide,
  +shardValue salvage, toast. Shards respawn on each new run; salvage is meta (kept on death).
- Gentle scale pulse driven by sim.time (frame-rate independent by construction).

## Item 4 — Discovery

First grounded contact with a body adds it to meta `discovered`, pays discoveryBonus,
toast "DISCOVERED: MARS". Belt rocks all count as one entry (BELT ROCK). Earth is
auto-discovered on first run (home). HUD shows salvage + discovery tally (n/10).

## Item 5 — Run UI + shop (`src/rogue/ui.ts` + index.html overlays)

- Toast line (top-center, CSS fade) for pickups/discoveries/deaths.
- RUN ENDED overlay: cause, run time, salvage earned, discoveries; upgrade shop; LAUNCH
  button -> respawn + new run. app.playing=false while open (input gates on it already).
- HOME BASE: same overlay opened with U while grounded on Earth (spend without dying);
  LAUNCH just resumes (no death counted, same run continues).
- Upgrades (permanent, cost scales cost = base x (level+1)):
  - THRUSTERS +4%/lv, max 4 (cap keeps jetThrust < 45 — design rule)
  - HEATSINK  heatRate -8%/lv, max 5
  - RADIATOR  coolRate +12%/lv, max 5
  - AEROSHELL crash tolerance +6 m/s/lv, max 5
- Upgrade effect magnitudes live in CONFIG (game-feel rule); costs live in the defs table.

## Item 6 — Debug menu (`src/ui/debug.ts`, desktop, ` / ~ key)

Right-side scrollable panel, DOM built in TS (auto-generated rows), pointer lock released on
open, panel inputs stopPropagation so typing doesn't walk the player.
- STATS (refreshed ~5Hz): fps, sim time, nearest body + dSurf, rel/world speed, g, heat,
  position, run/meta info.
- TIME: x0 / x0.25 / x1 / x4 buttons (cheats.timeScale multiplies dt in the loop).
- TUNING: one row per numeric scalar CONFIG key (auto-generated, filter box). Edits write
  baseConfig + applyTuning, so both the live sim AND the predictor pick them up (invariant 2
  — they read the same CONFIG). Keys that only matter at build time (terrain, belt, bloom,
  segs, AU...) are labeled STARTUP and still editable but flagged as needing reload.
- ACTIONS: teleport-to-body dropdown (arrive at 2.2x reach with body velocity matched —
  rendezvous rules respected), refill heat, god mode (no death), infinite heat, +100
  salvage, end run, wipe meta (double-confirm).

## Item 7 — New CONFIG keys (typed in Config)

crashSpeed 30, shardValue 5, coreShardValue 25, discoveryBonus 40, shardPickR 4,
surfShardsRocky 6, orbitShardsRocky 6, orbitShardsGas 8, beltShardsMajor 3,
upgThrustPct 0.04, upgHeatsinkPct 0.08, upgRadiatorPct 0.12, upgAeroshellFlat 6.

## Item 8 — Release ritual

Version -> v0.8 on the start screen; plan.md session log + milestone; CHANGELOG entry;
docs/devlog/v0.8.md draft. Drive folder copy is owner-side.

## Explicit non-goals

Procedural run seeds, per-run world randomisation, minimap fog-of-war, inventory, mobile
debug menu trigger (the menu itself is desktop-first; the game remains fully playable on
touch, deaths/shop overlays work there too).

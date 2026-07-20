# v0.9 spec — "Seeded Skies" (seeded orbits + linear throttle + full-range camera)

Owner request (2026-07-20): (1) planets start at random points in their orbits, driven by a
seed system that randomizes each "run", roguelite-style; (2) jetpack control moves from the
radial right stick to a LINEAR throttle slider, with directionality controlled entirely by
the camera; (3) the camera must have full range of motion at all times, not tied to the
motion of the player. Owner confirmed interpretation: full-range aim (straight up/down
included), thrust always fires along camera aim, throttle is a separate 1-axis control,
walking stays walking. Desktop burn stays hold-Shift/click at 100% (owner paused the
desktop-throttle question). Built off main (v0.7); the v0.8 salvage-run branch stays parked
and will be rebased onto this later.

## Item 1 — Run seed (`src/world/seed.ts`)

- `runSeed`: from URL `?seed=N` (shareable, pins a layout) or a fresh random integer per
  page load. On main, a page load IS the run boundary; when v0.8 merges, its LAUNCH flow can
  re-seed via reload.
- `seedMix = runSeed % 99991` — compact value mixed into seededRand chains.
- The seed only scrambles ORBITAL PHASE: every planet's starting angle, plus one whole-wedge
  rotation of the asteroid belt. Terrain, crater layouts, rock shapes/sizes, y offsets and
  radii stay fixed — world identity is stable, the map is what shuffles. Keeping rock sizes
  seeded-fixed also keeps the physical-rock budget deterministic.
- Spawn/respawn already derive from Earth's live position (v0.6), so they need no changes.
- The seed is displayed on the start screen (that IS the run's identity).

## Item 2 — Full-range camera

- Aim pitch clamp widens from +/-1.25 to +/-CONFIG.pitchMax (1.55 rad, ~89 deg) on both
  desktop mouse look and touch stick look. getLookDir()'s cos/sin form stays valid (< 90 deg,
  no backward flip).
- The camera.up hint fed to lookAt becomes the exact perpendicular `right x view` instead of
  the smoothed camUp. At steep pitch, look approaches parallel with camUp and the old hint
  makes lookAt degenerate (roll flips); the perpendicular hint is continuous at any pitch.
  During free look the hint uses the free-look-rotated right axis for the same reason.
- The smoothed camUp basis itself (up-blend near bodies) is UNTOUCHED — it is what keeps
  walking sane on a sphere, and CLAUDE.md marks it fragile. Free look offsets unchanged.

## Item 3 — Linear throttle (touch)

- New vertical slider, right screen edge (~38vh tall): drag sets throttle 0..1, value is
  PERSISTENT (cruise control; overheat still cuts the burn, heat still drains per throttle).
  Snap-to-zero below 5%. Fill + % label, HUD yellow.
- applyJetpack (touch): thrustDir = camera aim (`look`), throttle = slider value. Grounded
  burning is now allowed (aim up + throttle = liftoff); the old JUMP-held-to-burn gate dies.
  Desktop branch unchanged.
- The right dynamic stick loses its burn role: it walks when grounded (as before) and feeds
  free look while EYE is held (as before). Airborne, it does nothing.
- JUMP stays a plain jump. Walking no longer pauses while JUMP is held (that gate existed
  only to hand the right stick to burning).

## Item 4 — CONFIG/type additions

pitchMax 1.55, thrSnap 0.05. (Slider geometry lives in CSS like the other touch chrome.)

## Item 5 — Release ritual

Version v0.9 "Seeded Skies" (v0.8 number is reserved by the parked salvage-run branch);
start screen shows version + seed; plan.md, CHANGELOG, docs/devlog/v0.9.md; package.json.

## Non-goals

Desktop throttle (paused), re-seed without reload, seeding terrain/belt internals, any
change to the up-blend camera basis or free-look system, v0.8 merge/rebase (parked).

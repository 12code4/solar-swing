# Changelog — Solar Swing

All notable changes to this project. Format loosely follows keepachangelog.com.

## [0.10] - 2026-07-20 — FULL CIRCLE (executed from docs/v10-spec.md)
### Fixed
- HIGH-SPEED CAMERA LAG: the camera lerped its world position toward a moving target, leaving a steady-state lag of v/camSmooth (~52u behind at 400 m/s, with camDist 8 — look-around appeared dead). It now smooths the OFFSET in the player's frame: identical exponential feel at rest, zero velocity-proportional lag at speed. Aim basis, free look and constants untouched.
### Added
- Universal brake: hold B (desktop) or the BRAKE button (touch) for an auto-aimed retro-burn against velocity relative to the NEAREST body (the HUD's rendezvous frame). Same engine — jetThrust x brakeMult, same heat drain, overheat cuts it; the final step self-scales to null relative velocity exactly. It only removes energy, never adds. HUD shows BRAKING (coast blue).
- EARTH cloud deck: additive rotating shell from the CC-BY 8k clouds map; appears only if the texture loads (never a dependency, like all maps).
- Gas giant cloud shells slowly rotate (fixed per-planet rates) — bands wobble, Jupiter's spot drifts. Visual-only by design; cores, landings and blocks unaffected.
### Changed
- Asteroid belt is now a full sparse ring around the sun (was a 185-220 degree wedge): scatter covers the whole circle, the 3 cluster knots sit at seeded angles; 120 rocks, same radii, same size/budget rules. v0.9's whole-wedge rotation is superseded.
### Known issues
- Rocky planets still don't spin: mesh rotation would desync shapeFn collision unless composed in (belt-rock trick) AND ground-carry would need angular-velocity handling or the surface skids under your feet. Backlogged with that caveat.

## [0.9] - 2026-07-20 — SEEDED SKIES (executed from docs/v09-spec.md)
### Added
- Run seed system: every page load rolls a fresh system layout — each planet starts at a seeded random point in its orbit, and the asteroid belt wedge rotates as one unit. `?seed=N` pins a layout (shareable); the start screen shows the seed. Only ORBITAL PHASE is seeded: terrain, craters, rock shapes/sizes stay fixed so world identity and the physical-rock budget are stable.
- Linear throttle slider (touch): right-edge vertical slider sets a PERSISTENT throttle 0-100% (snap-to-zero under 5%); thrust always fires along the camera aim, on the ground too (the JUMP-held-to-burn gate is gone; JUMP is a plain jump). Heat drain still scales with throttle; overheat still cuts the burn.
- Full-range aim: pitch clamp widened from ±1.25 to ±CONFIG.pitchMax (1.55 rad, ~89°) on desktop mouse look and touch stick look — you can aim (and burn) almost straight up/down.
### Changed
- Touch control map: LEFT stick = look (this IS the burn direction now) · RIGHT stick = walk when grounded / free look while EYE held (its airborne burn role is gone) · SLIDER = throttle. JUMP/EYE buttons moved left of the slider rail.
- camera.up hint for lookAt is now the exact perpendicular (right x view) instead of the smoothed camUp — at steep pitch the old hint made lookAt roll-flip at the poles. The smoothed camUp basis itself (up-blend, the fragile system) is untouched, as is free look.
- BODY_DEFS keeps its `ang` column as the historical reference layout, but it is no longer read.
### Known issues
- Desktop keeps hold-to-burn at 100% (throttle slider is touch-only; owner paused the desktop-throttle question).
- A "run" reshuffles on page load; re-seeding without a reload waits for the v0.8 roguelite merge (that branch is parked on claude/roguelite-debug-menu-89966t and needs rebasing onto this).
- Earth remains vertically un-liftoffable at full throttle (thrust 38 < g 44.8) — that is the design, not a slider bug.

## [0.7] - 2026-07-20 — REFACTOR (executed from docs/v07-spec.md)
### Changed
- PURE REFACTOR, no behavior change. The single-file build became a Vite + TypeScript project with ES modules. Same physics, same feel, same visuals, same controls, same bugs (Jupiter imbalance included — that stays a backlog item). Verified against the v0.6 git tag: spawn-on-Earth starting state, gravity field, orbital/escape HUD, grounded relative-velocity settle, minimap/free-look/build toggles all match.
- `index.html` is now a minimal shell (canvas + HUD divs + `<script type="module" src="/src/main.ts">`); the game lives in `src/` split along the file's existing section banners: config, scene, bodies/ (shape, orbits, gravity, textures, build-bodies), player/ (state, physics, prediction), build/, ui/ (minimap, hud), input/ (desktop, touch), loop, main.
- three is now an npm dependency (was a CDN import map). Strict TypeScript passes with no `any` escapes except where three.js types require an assertion (each one commented).
- State model: grouped module-level singletons (pstate/view/app in player/state.ts, sim in world/sim.ts), not a threaded context object — the same mutable objects the single-file build used, now with module addresses. Documented at the top of src/main.ts. The three invariants survive intact: one `shapeFn` per body feeds both mesh and collision; one `gravityAt` feeds both the live sim and the predictor; one exported CONFIG.
- Build: `npm run build` typechecks then bundles to `dist/`. A GitHub Actions workflow (`.github/workflows/deploy.yml`) publishes `dist/` to Pages on push to main. Vite `base: './'` so the project-subpath deploy resolves assets.
- Post-parity rider (separate commit, after the parity build verified): planet texture URLs bumped 2k -> 8k (Uranus/Neptune stay 2k: no 8k in the source set, and they read fine featureless); anisotropy was already maxed in the loader. Graceful fallback unchanged.

## [0.6] - 2026-07-17 — THE SYSTEM MOVES (executed by Opus from docs/v06-spec.md)
### Added
- Kinematic circular orbits for every body: analytic position/velocity vs time, so the predictor stays exact and cheap. Earth ~50.5 m/s, Mercury 80.9, Pluto 8.0. New CONFIG.orbitTimeScale (default 1.0).
- bodyPosAt / bodyVelAt; gravityAt(pos, t, out) is now time-aware (live sim passes current time, predictor passes future time per step)
- NASA/CC-BY 2k textures on Mercury through Neptune, multiplied over existing procedural vertex paint; Saturn's rings use the ring alpha map with radially remapped UVs
- Asteroid belt 34 -> 120 rocks off 5 shared geometries; 3 cluster knots + sparse scatter; 4 majors up to R=60
- Minimap (M / tap): top-down sun-centred log-radial; orbit rings, belt annulus, planet dots, player + velocity arrow, prediction endpoint in outcome colour; expands to 70vmin
- Free look: hold ALT (desktop) or EYE button (touch) — camera orbits, aim stays frozen
### Changed
- GROUNDED PHYSICS IS NOW RELATIVE: walk/friction/jump/collision run in the frame of the body under you. Landing requires matching the planet's velocity — the rendezvous mechanic, intended.
- HUD v: shows speed relative to nearest body; blocks parent to the body's group and ride the planet; respawn tracks Earth's position and inherits its orbital velocity
- Planets/gas clouds moved to SphereGeometry (UVs for textures); cores and belt rocks stay Icosahedron
- Camera smoothing frame-rate independent (1-exp(-camSmooth*dt), camSmooth 7.7 matches v0.5 at 60fps)
### Fixed
- Atmospheric drag braked WORLD velocity (standing in Earth's atmosphere braked ~30 m/s² against the sun's frame; landing was impossible) — now brakes relative to the body
- Spec's double-counted orbital motion (vel composition + frame delta both applied) — you moved at 2x planet speed and slid
- Atmosphere shells sized from PEAK terrain radius (Earth's mountains poked 12.8u through the old shell)
- Sun exempted from the gravity cull (its 0.008 pull at Saturn fell under the pebble threshold, leaving the outer system orbiting an invisible force)
### Known issues
- Jupiter's field out-scales the player: cloud-top escape 398 m/s vs player 20-80, GM ~15x sun's; passes under ~12,000u are captures (pre-existing v0.5 tuning; rebalance in backlog)
- Predictor treats belt rocks as static (spec-sanctioned perf exception)
- Texture URLs unverified from build sandbox; graceful fallback tested (total failure = exact v0.5 look). Wikimedia Commons mirrors are the CORS-safe swap if hotlinking fails.

## [0.5] - 2026-07-16 — BEAUTIFUL ORBITS (executed by Opus from docs/v05-spec.md)
### Added
- Terrain: 5 noise octaves; baked crater bowls with raised rims on Mercury and Pluto (in shapeFn, so collision matches)
- Fresnel atmosphere shader (rim brightens at grazing angles) replacing static glow shells
- Sky tint inside atmospheres (Earth blue, Mars butterscotch; Venus keeps its darkening)
- Desktop-only bloom pipeline (EffectComposer + UnrealBloomPass + OutputPass); mobile renders untouched
- Adaptive trajectory prediction (step size scales with distance; deep-space lookahead spans minutes)
- Prediction outcome colors: green ORBIT / blue COAST / red IMPACT, plus ORBIT mode in the HUD
- Periapsis marker: yellow dot at closest approach, the "burn here" Oberth signpost
### Changed
- Lighting contrast: sun 2.4 -> 3.0, hemisphere fill 0.45 -> 0.3; stormier gas giant band turbulence
### Known issues
- Terrain peaks can poke through atmosphere shells (shells sized from base radius, peaks reach beyond)
- bloomThreshold 0.82 excludes atmosphere limbs (~0.30 linear) from blooming — aesthetic call pending playtest

## [0.4] - 2026-07-14 — THE PIVOT
### Removed
- Grapple/rope mechanic entirely (design pivot: jetpack + orbital mechanics are the core)
### Added
- Real orbital play: vacuum (zero space drag), gravity turns mandatory on big planets (thrust 38 < ~45g)
- Trajectory prediction line (~32s lookahead, shared gravityAt field, impact-terminated)
- Orbital / escape velocity HUD readouts; NO RETURN warning inside gas giants
- Mobile twin-stick touch controls: left = look, right = walk/burn with throttle; JUMP + RESET buttons
- Hold-left-click as desktop burn alternative to Shift
### Fixed
- Stuck keys on window blur (keys cleared)
### Changed
- Jetpack: thrust 30 -> 38, heat budget ~4s -> ~7.7s, faster cooldown
- Gas giant interior drag softened (0.8) so fast Oberth dive-throughs are survivable

## [0.3.1] - 2026-07-14
### Fixed
- Velocity drag made frame-rate independent (was ~3x stronger at 160Hz than 60Hz)

## [0.3] - 2026-07-12
### Added
- Mercury, Neptune, Pluto (full Mercury-to-Pluto map); planets ~2.7x bigger, distances ~3x
- Atmospheres with aerobraking drag + glow/haze shells (Venus, Earth, Mars, Pluto)
- Gas giants redesigned: cloud shells with tiny dark solid cores, crushing interior gravity,
  depth-driven screen darkness
- Realistic surface painting (Earth biomes/ice caps, Mars, Mercury craters-by-color, Pluto heart)
- Soft lighting: ACES tone mapping, sun point light + glow sprite, hemisphere fill
### Known issues
- Earth/Venus surface gravity (~43-45) exceeded jetpack thrust; escape required grapple (resolved by v0.4 pivot)

## [0.2] - 2026-07-12
### Added
- Solar system Venus-Uranus at relative scale (true radius ratios, 1 AU = 1200); sun (deadly, light source)
- N-body gravity (every body pulls, inverse square); asteroid belt (28 rocks)
- Jetpack with overheat/cooldown; stiff-rod grapple with W/S reeling
- Saturn + Uranus rings (grapple anchors); banded gas giants; painted rocky planets

## [0.1] - 2026-07-12
### Added
- First greybox: grapple swinging between procedural asteroids, local gravity,
  surface walking with smoothed local-up camera, block/platform/beacon building
- ES modules + import map; pointer-lock with no-lock fallback; on-screen error reporter

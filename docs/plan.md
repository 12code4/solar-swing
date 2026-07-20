# Plan — living checklist (Claude: check items off here as they're completed)

## Milestone 1-3: movement core, solar system, building — DONE (see session log)

## Milestone 4: THE PIVOT (v0.4) — DONE
- [x] Grapple removed; jetpack + orbital mechanics are the core
- [x] Real orbits: vacuum drag, gravity turns mandatory on big planets (thrust 38 < 45g)
- [x] Trajectory prediction line (shared gravityAt field, impact-terminated)
- [x] Orbital/escape velocity HUD; NO RETURN warning inside gas giants
- [x] Mobile: twin virtual sticks (look / walk-or-burn with throttle), JUMP + RESET buttons
- [x] Frame-rate independence fixes (drag, blur key-clear)

## Milestone 5: v0.5 "Beautiful Orbits" — DONE
See docs/v05-spec.md (the work order). Summary:
- [x] Item 1: terrain detail — extra noise octaves, craters on Mercury/Pluto, stormy gas bands
- [x] Item 2: fresnel atmosphere shader + sky tint inside atmospheres
- [x] Item 3: lighting contrast + desktop-only bloom (composer pipeline)
- [x] Item 4: orbit aids — adaptive long lookahead, outcome-colored line, periapsis marker
- [x] Item 5: version bump + session log entry

## Milestone 6: playtest + tune (after v0.5)
- [ ] Earth skim-to-orbit escape: thrilling skill check or opaque wall?
- [ ] Mobile stick feel on a real phone
- [ ] Jupiter dive: is NO RETURN fair? Is an Oberth dive-through survivable?
- [ ] Traversal pacing across outer-system gaps
- [ ] Terrain peaks reach ~1.24R but the atmo shell sits at 1.16R — mountains poke through it (pre-existing, now more visible with the fresnel rim)
- [ ] bloomThreshold 0.82 is spec'd but atmosphere limbs peak ~0.30 linear — drop to ~0.5 if limbs should bloom

## Milestone 7: repo + ship
- [x] GitHub account + solar-swing repo (docs live there; Drive = playable-build shelf)
- [ ] Contribution rhythm: ~3 sessions/week, each ends in a commit
- [x] Convert to Vite + TypeScript, split modules (v0.7, docs/v07-spec.md)
- [ ] Title polish, minimal audio, itch.io page, blog write-up

## Milestone 8: v0.6 "The System Moves" — DONE (docs/v06-spec.md, executed by Opus)
- [x] Item 1: realistic-fast kinematic orbits, relative-velocity landing (rendezvous), time-aware gravityAt
- [x] Item 2: NASA textures x procedural vertex-color blend, graceful fallback (URLs need one browser check; Wikimedia Commons is the CORS-safe swap if needed)
- [x] Item 3: belt to 120 rocks (5 shared geometries, decor tier, 4 majors)
- [x] Item 4: log-radial minimap, corner + M/tap expand
- [x] Item 5: free look (ALT / EYE button), aim frozen
- [x] Item 6: atmo-peak shell fix, frame-rate-independent camera, full release ritual
- [x] Executor-found fixes: atmo drag now brakes relative to body (was world-frame, made landing impossible); spec's double-counted orbital motion corrected; sun exempted from gravity cull

## Milestone 9: v0.7 "Refactor" — DONE (docs/v07-spec.md)
- [x] Vite + TypeScript + ES modules; index.html is a shell, game lives in src/
- [x] Modules split along the file's existing section banners (leaf-first: config -> shape -> orbits -> gravity -> textures -> scene -> build-bodies -> player/ -> build/ -> ui/ -> input/ -> loop -> main); tsc --noEmit run after each extraction
- [x] Strict mode passes; typed Body / BlockInstance / Config / GravInfo; no `any` except commented three.js assertions
- [x] State = grouped module-level singletons (Executor decision 1), documented atop main.ts; three invariants intact (one shapeFn feeds mesh+collision, one gravityAt feeds sim+predictor, one CONFIG)
- [x] Parity verified vs v0.6 tag: spawn-on-Earth start, gravity/HUD, grounded settle, minimap/free-look/build all match; runtime smoke-tested (no errors; texture-CDN block falls back to procedural exactly as designed)
- [x] npm run build -> dist/; GitHub Actions Pages deploy workflow (base './')
- [x] Post-parity rider (separate commit): texture URLs 2k -> 8k (Uranus/Neptune stay 2k), anisotropy already maxed, fallback intact
- [x] v0.6 tagged on main as the permanent parity reference

## Milestone 10: v0.9 "Seeded Skies" — DONE on main (docs/v09-spec.md)
- [x] Item 1: run seed — seeded planet phases + belt wedge rotation, ?seed=N pins a layout, seed shown on start screen
- [x] Item 2: full-range aim — pitch clamp ±1.25 -> ±1.55 (both platforms); pole-safe lookAt up-hint (right x view); up-blend basis untouched
- [x] Item 3: linear throttle slider (touch) — persistent 0-100%, thrust along camera aim, grounded burns allowed, JUMP demoted to plain jump, right stick = walk/free-look only
- [x] Verified headless: same-seed minimap overlap 0.93 vs diff-seed 0.11; airborne slider burn 44.5 m/s BURNING with heat drain; stick walking ~walk speed; no errors
- NOTE: v0.8 "Salvage Run" (shards/roguelite/debug menu) is PARKED on claude/roguelite-debug-menu-89966t, unmerged by owner decision; rebase it onto v0.9 before reviving

## Milestone 11: v0.10 "Full Circle" — DONE on main (docs/v10-spec.md)
- [x] BUGFIX: high-speed camera lag — offset-space smoothing in the player's frame (steady-state lag was v/camSmooth)
- [x] Belt: full sparse ring around the sun, seeded cluster knots + full-circle scatter (wedge retired)
- [x] Looks: Earth rotating cloud deck (texture-gated, fallback-safe), gas giant cloud spin (visual-only)
- [x] Universal brake: hold B / BRAKE button, retro-burn vs nearest body's frame, same engine + heat, exact null on final step, BRAKING HUD mode
- [x] Verified headless: burn -> brake 8.6 -> 0.0 m/s; airborne touch-brake shows BRAKING; at-speed framing sane; no errors
- NOTE for later: rocky planet spin/tilt backlogged — needs shapeFn rotation composition AND rotational ground-carry

## Backlog (ideas land here, not in the build)
- Rocky planet spin + axial tilt: compose the (time-dependent) rotation into shapeFn (belt-rock trick) so mesh and collision stay locked, AND extend the grounded frame-carry to angular velocity or the surface skids under the player's feet (v0.10 decision)
- Elegant CONTEXT-OBJECT state model: replace the grouped module-level singletons (chosen in v0.7 for parity-safety / minimal churn) with a threaded context. Protected by the v0.6 parity baseline; do it once there is coverage to catch a regression.
- Texture sharpness REAL fix: procedural LOD detail crossfade up close. v0.7's rider only swapped 2k->8k URLs (anisotropy was already maxed); an 8k map still blurs when a body fills the screen. LOD detail is the actual answer (see also the distance-blended detail-texture backlog note below).
- JUPITER GRAVITY REBALANCE (priority): GM = 45*1756^2 ≈ 1.39e8, ~15x the sun's — it out-dominates the outer system and cloud-top escape is 398 m/s vs player 20-80; any pass under ~12,000u is a capture. Fix direction: per-body gravity override targeting cloud-top escape ≈ 3-4x cruise speed; exact number from playtest.
- Predictor treats belt rocks as static (spec-sanctioned) — slightly wrong when landing on one
- dt clamp has no explicit floor (Math.max(0, ...) would make monotonicity assumption explicit)
- Free-look building raycasts from swung camera along frozen aim (harmless, slightly odd)
- Moons (Luna, Io/Europa, Titan); elliptical/inclined orbits
- Farming loop; looting + inventory; mobile building
- LOD crossfade for distance-blended detail textures (J's idea, credited)
- Longer past-trail (owner deferred from v0.5)
- Fast travel / ship; sound design; save/load (post repo conversion)

## Session log (one line per session: date, what happened)
- 2026-07-12 · v0.1: asteroid greybox — swing, land, build, camera local-up
- 2026-07-12 · v0.2: solar system Venus-Uranus, n-body gravity, jetpack, stiff rope
- 2026-07-12 · v0.3(.1): Mercury-Pluto, big scale, atmospheres, diveable gas giants, soft lighting; drag fix
- 2026-07-14 · v0.4: THE PIVOT — grapple removed, orbital mechanics core, prediction line, mobile twin-stick
- 2026-07-14 · v0.5 spec written (docs/v05-spec.md); execution handed to Opus
- 2026-07-16 · v0.5 BEAUTIFUL ORBITS: 5 terrain octaves + baked craters (Mercury/Pluto, detail 5), stormier gas bands, fresnel atmosphere shader + sky tint, desktop bloom composer (RenderPass/UnrealBloomPass/OutputPass), adaptive prediction dt with ORBIT/IMPACT/COAST colouring + periapsis marker
- 2026-07-17 · v0.6 THE SYSTEM MOVES (Opus): kinematic orbits + relative-velocity rendezvous physics, time-aware gravityAt, NASA textures x procedural blend, 120-rock belt, log-radial minimap, ALT/EYE free look; executor fixed 2 real bugs (world-frame atmo drag, spec's double-counted orbital motion)
- 2026-07-20 · v0.7 REFACTOR: single 1810-line HTML -> Vite + TypeScript, 18 ES modules split along the existing section banners. Zero behavior change (parity vs v0.6 tag). Grouped module-level singletons (not a context object); strict tsc passes after each extraction. npm build -> dist/ + Actions Pages deploy. Post-parity rider: texture URLs 2k -> 8k (ice giants stay 2k), anisotropy already maxed. Tagged v0.6 as the parity reference.
- 2026-07-20 · v0.8 SALVAGE RUN built then PARKED on claude/roguelite-debug-menu-89966t (owner call): roguelite deaths/shards/shop + debug menu; unmerged, rebase before reviving
- 2026-07-20 · v0.9 SEEDED SKIES (main): run-seed system scrambles planet phases + belt wedge per load (?seed=N pins), touch jetpack reworked to a linear right-edge throttle slider with thrust along camera aim, full-range pitch (±89°) with a pole-safe lookAt up-hint. Headless-verified (seed determinism, burn, walk).
- 2026-07-20 · v0.10 FULL CIRCLE (main): high-speed camera lag fixed (offset-space smoothing), belt = full sparse seeded ring, Earth rotating cloud deck + gas cloud spin (visual-only), universal brake (B / BRAKE, retro-burn vs nearest body, same engine+heat). Headless-verified.

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
- [ ] Convert to Vite + TypeScript, split modules
- [ ] Title polish, minimal audio, itch.io page, blog write-up

## Milestone 8: v0.6 "The System Moves" — SPEC'D (docs/v06-spec.md), awaiting Opus
- [ ] Item 1: realistic-fast kinematic orbits, relative-velocity landing (rendezvous), time-aware gravityAt
- [ ] Item 2: NASA textures x procedural vertex-color blend, graceful fallback
- [ ] Item 3: belt to ~120 rocks (shared geometries, decor tier)
- [ ] Item 4: log-radial minimap, corner + M/tap expand
- [ ] Item 5: free look (ALT / EYE button), aim frozen
- [ ] Item 6: atmo-peak shell fix, frame-rate-independent camera, full release ritual

## Backlog (ideas land here, not in the build)
- Moons (Luna, Io/Europa, Titan); orbital motion of planets (true slingshots)
- Farming loop; looting + inventory; mobile building
- Longer past-trail (owner deferred from v0.5)
- Fast travel / ship; sound design; save/load (post repo conversion)

## Session log (one line per session: date, what happened)
- 2026-07-12 · v0.1: asteroid greybox — swing, land, build, camera local-up
- 2026-07-12 · v0.2: solar system Venus-Uranus, n-body gravity, jetpack, stiff rope
- 2026-07-12 · v0.3(.1): Mercury-Pluto, big scale, atmospheres, diveable gas giants, soft lighting; drag fix
- 2026-07-14 · v0.4: THE PIVOT — grapple removed, orbital mechanics core, prediction line, mobile twin-stick
- 2026-07-14 · v0.5 spec written (docs/v05-spec.md); execution handed to Opus
- 2026-07-16 · v0.5 BEAUTIFUL ORBITS: 5 terrain octaves + baked craters (Mercury/Pluto, detail 5), stormier gas bands, fresnel atmosphere shader + sky tint, desktop bloom composer (RenderPass/UnrealBloomPass/OutputPass), adaptive prediction dt with ORBIT/IMPACT/COAST colouring + periapsis marker

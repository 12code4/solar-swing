# Changelog — Solar Swing

All notable changes to this project. Format loosely follows keepachangelog.com.

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

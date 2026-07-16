# WORK ORDER: v0.5 — "Beautiful Orbits"

Executor: implement against `solar-swing-v04.html`, produce `solar-swing-v05.html`.
Read CLAUDE.md first — its rules apply to every item here. Do items in order; each is
independently shippable. Verify (section V) after each item, not just at the end.

## Item 1 — Terrain detail (rocky planets)

- Add 2 higher-frequency octaves to `makeShapeFn` (current 3 octaves at amps 0.10/0.06/0.035;
  add ~0.018 and ~0.009 at 2-3x higher frequency vectors). Keep the returned function's
  signature identical — it must remain the single source for BOTH geometry and collision.
- Craters for MERCURY and PLUTO only: inside their shapeFn, add 6-10 seeded crater
  depressions (per crater: fixed unit direction, angular radius 0.08-0.2; depression =
  smooth bowl with a slight raised rim, depth ~0.02-0.04 of radius). Implement inside the
  shape function so collision matches automatically.
- Raise geometry detail one tier for bodies with R > 120 (detail 5 -> 6 is too heavy;
  instead go detail 5 and rely on the new octaves). Belt rocks unchanged.
- Gas giants: in `gasBandColor`, add a third wobble term (higher frequency, small amplitude)
  and increase band-edge turbulence so bands look stormy, not ruler-straight.

Accept: Mercury/Pluto visibly cratered; walking into a crater bowl works (no floating/clipping);
Earth/Mars terrain visibly finer; Jupiter bands turbulent; frame rate unchanged on desktop.

## Item 2 — Fresnel atmosphere shader

- Replace `addAtmoShells` additive/haze meshes with a single THREE.ShaderMaterial shell per
  atmosphere (radius baseR*(1+h), THREE.BackSide, transparent, depthWrite false):
  intensity = pow(1.0 - abs(dot(normalize(viewDir), normal)), falloff) * strength,
  falloff ~2.5, color from the body's atmo def. Rim must brighten at grazing angles.
- Gas giants keep a subtle version (lower strength) replacing their current limb glow.
- Sky tint: extend the darkness overlay system — per-atmo optional `sky` color
  (Earth '#3d6fb4', Mars '#b4713d', Venus keeps darken behavior). When inside an atmosphere,
  blend the fullscreen overlay's background toward the sky color with opacity up to ~0.35
  scaled by density (Venus keeps its stronger darken). Gas giant interior darkness unchanged.

Accept: approaching Earth shows a bright blue limb that intensifies at the horizon edge;
flying inside Earth's atmosphere tints the screen blue, Mars butterscotch; gas giant dive
darkness still works; no z-fighting with planet surface.

## Item 3 — Lighting + desktop-only bloom

- Sun PointLight intensity 2.4 -> 3.0; HemisphereLight 0.45 -> 0.3 (crisper terminators).
- Bloom, DESKTOP ONLY (skip entirely when isTouch):
  - Extend the importmap: add "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/"
  - Import EffectComposer, RenderPass, UnrealBloomPass from three/addons.
  - Composer = RenderPass + UnrealBloomPass(strength ~0.55, radius ~0.4, threshold ~0.82).
  - Render via composer on desktop, plain renderer.render on touch.
  - Resize handler must also call composer.setSize.
- New CONFIG entries: bloomStrength, bloomRadius, bloomThreshold.

Accept: on desktop the sun, beacons, and atmosphere limbs glow softly; scene not washed out
(threshold keeps planet surfaces clean); mobile path untouched and still 60fps; resizing
the window doesn't break rendering.

## Item 4 — Orbit aids (prediction upgrade)

- Adaptive prediction steps: replace fixed predictDt with per-step dt scaled by distance to
  the nearest body's reach: dt_i = clamp(predictDtBase * (dNearest / reachNearest), dtMin, dtMax),
  suggested base 0.09, min 0.04, max 1.2. Same predictSteps (360) now covers minutes in deep
  space and stays accurate near planets. Finding dNearest cheaply: reuse the gravityAt loop —
  extend gravityAt to optionally report nearest-body distance/reach, or compute inline in the
  predictor. Do NOT fork the gravity math.
- Outcome classification, evaluated each prediction update:
  - IMPACT: predictor hit a solid (existing stop flag) -> line color '#ff5544'.
  - ORBIT: no impact, AND the path passes within ~8% of its starting distance to the dominant
    body with total path angle around that body >= ~330 degrees (i.e. it comes back around)
    -> '#4dd68a'. A simpler acceptable heuristic: no impact and the point of max distance from
    the dominant body occurs mid-path with the final point closer again.
  - COAST/ESCAPE: everything else -> current '#66aaff'.
  Set predLine.material.color accordingly (one color per frame is fine; no per-vertex colors).
- Periapsis marker: small emissive sphere (radius ~ camDist*0.15, or scale with distance so it
  stays visible) placed at the prediction path's closest-approach point to the dominant body;
  visible only when not grounded and the closest approach is meaningfully below current
  distance (say < 0.9x). Yellow #ffdd33. This is the "burn here" Oberth signpost.
- Dominant body = the body contributing the largest gravity at the player's position
  (extend gravityAt to report it, or compute alongside).
- HUD: when classification is ORBIT, the mode line reads 'ORBIT' in green instead of COASTING.

Accept: circularizing around Mars turns the line green and mode says ORBIT; a plunging
trajectory shows red line ending at the surface; the yellow periapsis dot sits at the
trajectory's low point and disappears when grounded; deep-space lookahead visibly spans a
long arc; performance unchanged (prediction still every 2nd frame).

## Item 5 — Housekeeping

- Bump start-screen version to v0.5. Add one line to docs/plan.md session log describing the build.
- New tunables added in Items 1-4 must live in CONFIG.

## V — Verification (after EVERY item)

1. Extract the module script and run node --check (see CLAUDE.md rule). Zero parse errors.
2. Grep sanity: no references to grapple/rope (must stay removed).
3. Confirm gravityAt remains the single gravity implementation (one definition, two consumers).

## Out of scope for v0.5 (do not add)

Moons, moving planets, sound, save/load, mobile building, past-trail extension (owner deferred).

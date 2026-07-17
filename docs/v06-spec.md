# WORK ORDER: v0.6 — "The System Moves"

Executor: implement against `solar-swing-v05.html`, produce `solar-swing-v06.html`.
Read CLAUDE.md first (the version WITH the Release Ritual section) — its rules and ritual
apply. Do items in order; verify (section V) after each item. Item 1 is the big refactor;
land it fully before touching anything else.

## Item 1 — Planets orbit the sun (realistic-fast, kinematic)

Design: circular kinematic orbits in the XZ plane around the sun. Not force-simulated —
positions are analytic functions of time, which keeps the predictor exact and cheap.

- Per planet: orbital speed v = sqrt(g_sun(r) * r) where g_sun(r) = sunGravity*(sunR/r)^2,
  angular velocity omega = v/r, angle(t) = ang0 + omega*t. (Earth lands near ~50 m/s.)
  Keep each body's y offset fixed. Direction: all prograde (same sign).
- Group per body: planet/cloud mesh, core, atmosphere shells, rings move as one THREE.Group.
  The sun, its light, and its glow sprite stay at origin.
- Belt rocks orbit too (same formula per rock).
- `gravityAt(pos, t, out)` becomes time-aware: body centers computed at time t. The live sim
  passes current sim time; the predictor passes future time per step. PERF EXCEPTION: the
  predictor may treat belt rocks as static at their current positions (their gravity is
  negligible; planets and sun MUST be time-accurate).
- Body velocity: expose bodyVelAt(body, t) (analytic tangent, magnitude v). Needed below.
- RELATIVE-VELOCITY GROUNDED PHYSICS (the critical part):
  - While grounded on body b: compute vRel = vel - bodyVel(b). Run ALL walk/friction/jump
    logic on vRel, then vel = vRel + bodyVel(b). Additionally move the player by the body's
    frame delta so standing still on a moving planet works.
  - Surface collision: cancel the radial component of RELATIVE velocity, not world velocity.
  - Landing therefore requires matching the planet's motion — that is the rendezvous
    mechanic, intended and by design. Do not soften it.
- Blocks: on placement, parent the block to the body's Group (convert with worldToLocal /
  attach). Block collision math must use updated world matrices each frame.
- Spawn/respawn: compute Earth's CURRENT position at respawn time (spawnPoint becomes a
  function, and respawn sets vel = bodyVel(earth) so you don't spawn into a 50 m/s skid).
- HUD: 'v:' now shows speed RELATIVE to the nearest body (this is what rendezvous needs);
  orb/esc readouts unchanged in formula but computed against the nearest body as before.
- Prediction outcome/periapsis logic: dominant-body-relative, using time-accurate positions.
- New CONFIG: orbitTimeScale (default 1.0) — global multiplier on all omegas, so orbit speed
  is tunable to taste later without touching formulas.

Accept: standing on Earth, the minimap (Item 4) shows it sweeping its orbit and you stay
planted; jumping does not leave you behind; landing on Mars from a transfer requires killing
relative velocity; prediction line correctly curves toward where a planet WILL be; a close
pass behind a moving planet visibly changes your orbit (true slingshot); blocks placed on a
planet travel with it.

## Item 2 — NASA textures with procedural blend

- Swap planet geometry from IcosahedronGeometry to SphereGeometry (rocky: ~96x64 segments,
  gas clouds: 64x48) so UVs exist. Apply the SAME shapeFn radial displacement to rocky
  vertices (and keep computing vertex colors). Collision code unchanged.
- Load equirectangular texture maps per body as material.map. Candidate URLs (2k set,
  CC BY 4.0): https://www.solarsystemscope.com/textures/download/2k_mercury.jpg and
  siblings (2k_venus_atmosphere, 2k_earth_daymap, 2k_mars, 2k_jupiter, 2k_saturn,
  2k_uranus, 2k_neptune; Pluto: keep procedural). Saturn rings may use 2k_saturn_ring_alpha.png
  as the ring material's map with transparency.
- REQUIRED graceful fallback: load via TextureLoader with an onError that leaves the material
  texture-less — vertex colors alone must still render the current v0.5 look. No texture may
  be load-blocking.
- Keep vertexColors:true so the existing procedural paint MULTIPLIES with the texture
  (close-range detail layer). If the multiply reads too dark, brighten the procedural
  palettes toward white rather than disabling vertexColors — target: texture clearly visible,
  subtle procedural variation on top.
- Set texture.colorSpace = THREE.SRGBColorSpace. Anisotropy = renderer.capabilities max (or 8).
- Atmosphere fresnel shells, sky tint, gas darkness overlay, dive behavior: UNCHANGED.

Accept: from orbit, Earth/Jupiter are recognizably themselves; approaching the surface shows
procedural variation over the texture rather than pure blur; killing the network (or a 404)
still yields the v0.5 procedural look; fresnel limbs and gas dives look identical to v0.5.

## Item 3 — Populate the asteroid belt

- Raise belt count 34 -> ~120. To bound memory: generate 4-6 shared displaced geometries and
  reuse them across rocks with varied scale (0.5-2x) and random static rotation.
- Distribution: keep the 185-220 degree arc but add 2-3 denser clusters plus sparse scatter;
  y spread up to ~2000; radii 8-45 (a handful of 45+ "majors").
- All rocks remain physical (gravity sources, landable) EXCEPT rocks with R < 12 may be
  decor-only (no bodies[] entry, no raycast) to bound n-body cost — mark them visually
  smaller so players don't expect to land.
- All belt rocks orbit per Item 1.

Accept: crossing the belt feels populated (multiple rocks visible at once in clusters);
frame rate holds on desktop; landing on a major rock works; total bodies[] length <= ~90.

## Item 4 — Minimap (corner + expand, log-radial)

- 2D canvas overlay, top-down XZ projection, sun-centered. LOG-RADIAL mapping (linear
  crushes the inner system): rMap = k * log10(1 + dist/1000) scaled to fit — verify Mercury
  through Pluto all visibly separate.
- Draw: orbit circles per planet (faint), planet dots (approximate their palette colors,
  labels on the expanded view only), belt as a faint annulus, player as white dot with a
  short velocity-direction arrow, prediction endpoint as a tiny dot in the line's outcome color.
- Corner mode: ~150px, bottom-center-left of heat bar or top-right under error box (pick a
  spot that collides with nothing on mobile). Expanded: centered, ~70vmin, dark backdrop.
- Toggle: M key (desktop) and tapping the corner map (touch). ESC or second tap collapses.
- Update every ~6 frames. New CONFIG: minimap sizes + k.

Accept: at spawn, the map shows Earth's dot moving along its orbit ring; player dot tracks
across the system on a Jupiter transfer; expand/collapse works with M and tap; readable on
a phone; no HUD overlap.

## Item 5 — Free look

- Desktop: hold ALT — mouse now orbits the camera around the player (separate offset
  yaw/pitch) while the AIM basis (thrust direction, prediction, HUD) stays frozen at its
  pre-ALT state. Release ALT: camera eases back to aim over ~0.25s. Burning while in free
  look uses the frozen aim, not the camera direction.
- Touch: add a small EYE button (near JUMP). While held, the right stick orbits the camera
  the same way (walking/thrust suspended during free look); release eases back.
- Implementation hint: keep the existing camera basis untouched (per CLAUDE.md it is fragile);
  free look is an ADDITIVE offset applied only to the camera position/lookAt computation,
  never to camForward/camRight/camUp or getLookDir().

Accept: while coasting, hold ALT and look backward at a receding planet — the prediction
line and a subsequent burn direction are unaffected; release snaps back smoothly; mobile
EYE button behaves the same; the fragile camera basis code is not restructured.

## Item 6 — Small fixes + housekeeping

- Atmosphere shells: size from PEAK terrain radius, not base (shell radius =
  R*(1+maxTerrainAmp)*(1+atmo.h)) — fixes mountains poking through (plan.md Milestone 6 flag).
- Camera smoothing: replace per-frame position.lerp(ideal, 0.12) with frame-rate-independent
  1-exp(-k*dt) form (k in CONFIG, tuned to match current 60fps feel). Owner plays at 160Hz.
- Full Release Ritual per CLAUDE.md: version string v0.6, plan.md session line, CHANGELOG.md
  entry, devlog draft docs/devlog/v0.6.md (owner's voice rules apply), build filed.

## V — Verification (after EVERY item)

1. Extract module script, node --check. Zero errors.
2. gravityAt: still exactly ONE definition; now takes time; grep both consumers pass t.
3. No grapple/rope resurrection.
4. Mobile path: no bloom, sticks work, minimap tap works (reason through the code paths).

## Out of scope (do not add)

Moons, sound, save/load, mobile building, elliptical/inclined orbits, distance-blended
detail texture shaders (owner's LOD crossfade idea — backlog, credited), n-body simulated
planet motion.

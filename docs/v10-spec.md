# v0.10 spec — "Full Circle" (camera lag fix, ring belt, planet looks, universal brake)

Owner request (2026-07-20): (1) BUG: at high speeds the camera lags so far behind that
looking around stops working; (2) make the asteroid belt encircle the sun within its orbit,
sparsely; (3) make the planets look better; (4) add a universal brake — "no way to reset
direction" isn't fun.

## Item 1 — Camera lag fix (the bug)

The camera lerps its WORLD position toward the ideal point. Against a moving target that
leaves a steady-state lag of v/camSmooth: at 400 m/s the camera trails ~52u with camDist 8 —
it sits outside the whole action and the look controls appear dead. Fix: smooth the camera
in the player's frame — lerp the OFFSET (camera minus player) toward the ideal offset, then
re-anchor to the player. Identical feel at rest (same exponential, same rate), zero
velocity-proportional lag at speed. No change to the aim basis, free look, or smoothing
constants.

## Item 2 — Belt becomes a full sparse ring

The 185-220 degree wedge (a v0.2 relic) becomes a full circle: scatter rocks cover 0-360
(seeded per run), the 3 cluster knots sit at seeded angles, radii unchanged (2.2-3.3 AU).
beltCount stays 120 — over a full circle that IS sparse, per the request. v0.9's
whole-wedge beltPhase is superseded and removed. Sizes/shapes/budget rules untouched.

## Item 3 — Planet looks

Visual-only layers; physics, raycast targets and collision identities untouched:
- EARTH cloud layer: additive transparent shell at R*earthCloudLift using the CC-BY
  8k_earth_clouds map, built VISIBLE ONLY when the texture actually loads (same
  never-a-dependency rule as every other texture). Slowly rotates.
- Gas giant cloud shells spin slowly (per-planet fixed rate variation) — bands wobble and
  Jupiter's spot drifts. Clouds are already visual-only by design; cores don't move, so
  blocks and landings are unaffected.
- Rocky planet spin/tilt is NOT included: mesh rotation desyncs the shapeFn collision
  unless the rotation is composed into it (belt-rock trick) AND the ground-carry only
  handles translation today, so a spinning surface would skid under the player's feet.
  Goes to backlog with that caveat spelled out.

## Item 4 — Universal brake

Hold B (desktop) or the BRAKE button (touch): an auto-aimed retro-burn against velocity
RELATIVE TO THE NEAREST BODY — the same rendezvous frame the HUD v shows. Same engine:
thrust = jetThrust * brakeMult, same heat drain, overheat cuts it. Throttle self-scales on
the final step so it nulls the relative velocity exactly (no jitter around zero). No free
physics: it can only kill motion in the body's frame, never add energy, so orbits are spent
honestly. Brake overrides thrust while held; HUD shows BRAKING (coast blue).

## Item 5 — CONFIG additions

brakeMult 1.0, gasSpin 0.012, earthCloudSpin 0.0045, earthCloudOpacity 0.55,
earthCloudLift 1.02.

## Item 6 — Release ritual

v0.10 "Full Circle": start screen, package.json, plan.md, CHANGELOG, docs/devlog/v0.10.md.

## Non-goals

Rocky spin/tilt (backlog, see item 3), desktop throttle (still paused), belt density
increase, any restructuring of the camera basis or free look.

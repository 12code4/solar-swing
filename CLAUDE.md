# Solar Swing (working title)

3D orbital traversal sandbox: jetpack across a relative-scale solar system (Mercury to Pluto) using real orbital mechanics — gravity turns, Oberth burns, aerobraking. Build small bases on solid surfaces (desktop). Portfolio project — the goal is a small, finished, public v0, not the dream version.

## Current stage

Single self-contained HTML prototype (`solar-swing-v04.html`). Works on desktop (mouse+keyboard, pointer lock with fallback) and mobile (twin virtual sticks). Conversion to a Vite + TypeScript repo is a planned milestone, not the current state.

## Scope (locked — expansions go to docs/plan.md backlog, not into the build)

- IN: jetpack with overheat (thrust 38, deliberately below big-planet surface gravity ~45 so sideways burns are mandatory there), n-body gravity, trajectory prediction line, orbital/escape velocity HUD, walkable rocky planets, diveable gas giants (dark crushing interiors, NO RETURN threshold, tiny solid cores), atmospheres with aerobraking, block/platform/beacon building (desktop only), asteroid belt, twin-stick touch controls
- REMOVED in v0.4 (do not reintroduce): the grapple/rope mechanic
- OUT (backlog): farming, looting, moons, orbital motion of planets, sound, save/load
- Done means: playable in browser, on itch.io, short write-up on the blog

## Architecture notes (the decisions that matter)

- All game-feel constants live in the CONFIG object at the top of the script. New tunables go there, never inline.
- Terrain trick: each rocky body's displacement function (`shapeFn`) drives BOTH the mesh geometry and the analytic collision. Any terrain change (e.g. craters) MUST go through shapeFn so the two never diverge.
- `gravityAt(pos, out)` is the single shared gravity field — used by the live sim AND the trajectory predictor. Never fork it; if gravity rules change, both consumers update automatically. It also returns an inside-solid flag the predictor uses as impact detection.
- Scale rulers: radii keep true real-world ratios (CONFIG.earthR), distances compressed via CONFIG.AU.
- Space drag is 1.0 (vacuum) BY DESIGN — orbits must not decay. Braking comes from atmospheres only.
- Gas giants: cloud mesh is visual only (not a raycast target); the physics body is the small core. Interior gravity ramps to gasCoreGravityMult; screen darkness is a DOM overlay driven by dive depth.
- Camera: smoothed local-up basis (camUp/camRight/camForward). The most fragile system — do not restructure it.
- Input branches on `isTouch` (pointer:coarse). Desktop: mouse look + Shift/LMB burn. Touch: left stick look; right stick walks when grounded, thrusts (camera-relative, magnitude = throttle) when airborne or JUMP held.
- Runtime errors surface in an on-screen red box (top right). Keep that pattern.

## Rules (for ANY model executing changes)

- IMPORTANT: after any change, extract the module script and verify it parses (node --check) before handing over
- Make minimal changes; do not refactor unrelated code; one work-order item at a time
- Execution work comes from a spec in docs/ — implement what the spec says, flag conflicts instead of improvising
- When unsure between two approaches, explain both and let the owner choose
- The living task list is docs/plan.md — check items off there; new ideas go to its backlog, not into the build
- Preserve the visual identity: dark void, Courier New, yellow #ffdd33 accents
- Bump the version string on the start screen when shipping a build

## Release ritual (MANDATORY on every version bump)

1. Bump the version string on the start screen.
2. plan.md: add a one-line session log entry.
3. CHANGELOG.md: add an entry (sections as applicable: Added / Changed / Fixed / Removed / Known issues).
4. Devlog draft: write docs/devlog/vX.Y.md — a 150-400 word blog-post draft discussing what
   changed and WHY, aimed at the owner's public blog. Casual, first-person, concrete numbers
   and honest tradeoffs. No AI-sounding prose, no em dashes, short natural sentences.
5. The build goes into its Drive version folder (e.g. v05/), alongside that version's spec
   and devlog draft. Root of the Drive project folder holds the LIVING docs (CLAUDE.md,
   plan.md, CHANGELOG.md — always current); version folders are frozen snapshots.
   (Later: git tags replace this.)

A version is not "shipped" until all five exist.

## Owner context

- Solo dev, ~5-8 hrs/week, sessions are short — always leave the file in a runnable state
- Owner plays at 160Hz — all time-dependent code must be frame-rate independent (use dt; no bare per-frame multipliers or lerps for physics)
- I get lost when scope grows: if asked for something outside scope, remind me and add it to docs/plan.md backlog instead

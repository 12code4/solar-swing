# WORK ORDER: v0.7 — "Refactor" (Vite + TypeScript modules)

Executor: convert the single-file `index.html` (the v0.6 build) into a Vite + TypeScript
project with ES modules. Read CLAUDE.md first — its rules and the three invariants below are
binding. This is the ONE version where the deliverable is measured by SAMENESS: the game must
play byte-for-byte identically before and after. No features, no tuning, no "improvements."

## Prime directive

ZERO OBSERVABLE BEHAVIOR CHANGE. Same physics, same feel, same visuals, same controls, same
bugs (yes, even the known Jupiter imbalance — that is a separate backlog item, not this one).
If you are tempted to fix or improve something mid-refactor, STOP and add it to plan.md backlog
instead. A refactor that also changes behavior is how silent bugs enter; this spec forbids it.

## The three invariants (must survive intact)

1. `shapeFn` per body drives BOTH mesh geometry AND analytic collision — keep them fed by the
   one function. Do not let the split separate them.
2. `gravityAt` is the SINGLE gravity field, consumed by both the live sim and the trajectory
   predictor, and it is time-aware (takes t). Exactly one implementation after the refactor.
3. All game-feel tuning lives in one CONFIG object, now exported from one module.

## Target structure

```
solar-swing/
  index.html            # minimal shell: canvas, HUD divs, <script type="module" src="/src/main.ts">
  package.json          # vite + three + typescript + @types/three
  tsconfig.json         # strict: true
  vite.config.ts        # base: './' so GitHub Pages (project subpath) resolves assets
  src/
    main.ts             # entry: wire modules, start loop
    config.ts           # CONFIG (typed), exported
    scene.ts            # renderer, scene, camera, lighting, bloom (desktop-gated), stars, sun glow
    bodies/
      shape.ts          # makeShapeFn, seededRand — the displacement field
      orbits.ts         # bodyPosAt, bodyVelAt, kinematic orbit params
      textures.ts       # texture loader with graceful fallback
      build-bodies.ts   # addBody, planet/gas/belt construction, paint fns
      gravity.ts        # gravityAt (the single field) + nearest/dominant helpers
    player/
      state.ts          # player mesh, velocity, heat, mode flags
      physics.ts        # relative-velocity grounded physics, collision, jetpack, aerobrake
      prediction.ts     # trajectory predictor (consumes gravity.ts)
    build/
      building.ts       # block placement/removal/collision (desktop)
    ui/
      minimap.ts        # 2D canvas minimap
      hud.ts            # stats/heat/mode DOM updates
    input/
      desktop.ts        # mouse/keyboard, pointer lock, free look (ALT)
      touch.ts          # twin sticks, EYE button, JUMP/RESET
    loop.ts             # animate(): the per-frame orchestration, calling the above
  docs/ ...             # unchanged
  CLAUDE.md CHANGELOG.md README.md LICENSE
```

Module boundaries follow the existing section banners in the current file — this is a
mechanical extraction along lines that already exist, not a redesign.

## Executor decisions (binding — these settle the spec's open questions)

1. STATE MANAGEMENT: grouped module-level singletons, NOT a context object. Each state module
   (player/state.ts, and a small world/sim state module if needed) exports the SAME mutable
   objects the current file already uses — same variables, new addresses. Do not rewrite
   function signatures to thread a context through; that means hundreds of small edits, each a
   chance to introduce a bug. For a parity-measured refactor, minimal churn IS correctness.
   The elegant context version is a future backlog item, protected by the parity baseline.
   Document this choice at the top of main.ts.
2. EXTRACTION ORDER: leaves first, loop last. Pull pure-math modules with no DOM or mutable
   state deps first (config.ts → bodies/shape.ts → bodies/orbits.ts → bodies/gravity.ts),
   running `tsc --noEmit` after EACH extraction, not just at the end. Then textures, scene,
   build-bodies; then player/, build/, ui/, input/; loop.ts moves LAST, once everything it
   orchestrates already lives somewhere. The scary part happens when the codebase is most
   organized, not least.
3. GIT SAFETY: before touching anything, tag the current main as `v0.6` (permanent playable
   reference for side-by-side parity checks). All work happens on branch `refactor/v0.7`;
   main and the live Pages site stay untouched until verification passes.

## Rules for the extraction

- Preserve function bodies verbatim where possible; change only what module boundaries require
  (imports/exports, passing state that was previously file-scoped).
- Shared mutable state (vel, player, camUp/camRight/camForward, simTime, keys, heat...) is the
  main challenge. Follow Executor decision 1 above: grouped singletons, minimal churn. Do NOT
  scatter globals across modules. Document the chosen approach at the top of main.ts.
- The fragile camera basis (camUp/camRight/camForward + smoothing) stays one cohesive unit —
  do not split it across modules.
- Types: add interfaces for Body, BlockInstance, the CONFIG shape, and the gravity-info struct.
  strict mode must pass with no `any` escapes except where three.js types genuinely require it
  (comment each one).
- Keep the on-screen error reporter.
- Vite base must be './' (relative) or the Pages project-path deploy will 404 on assets.

## Build + deploy

- `npm run build` outputs to dist/. Document in README how to build and where output lands.
- GitHub Pages options — document both in README, recommend option A:
  A) Add a GitHub Actions workflow (.github/workflows/deploy.yml) that builds and publishes
     dist/ to Pages on push to main. This is the clean path once there is a build step.
  B) Or commit the built dist/ and point Pages at it.
- After this version, the playable URL serves the built app, not the raw source file.

## V — Verification

1. `npm install && npm run build` succeeds; `npm run dev` serves a playable game.
2. tsc --noEmit passes under strict.
3. Side-by-side parity check against the `v0.6` tag (document results in the devlog): spawn on
   Earth and confirm identical starting state; fly the same Earth-to-Mars path and confirm the
   prediction line, HUD numbers, and rendezvous behavior match v0.6; dive Jupiter and confirm
   identical NO RETURN behavior; toggle minimap, free look, building — all identical. Any
   "does it feel different?" question is answered by opening both builds side by side.
4. Grep the built output / source: gravityAt defined once; shapeFn feeds geometry and
   collision; no grapple/rope.
5. Mobile path intact (no bloom, sticks, minimap tap).

## Post-parity rider: texture sharpness (separate commit, only AFTER section V passes)

The 2K textures are not broken — they are 2048×1024 wrapped around enormous bodies, so they
blur exactly when a planet fills the screen. This rider is NOT part of the parity build; it
lands as its own clearly-labeled commit on the branch after verification, so the parity
baseline stays clean:

1. Swap texture URLs 2k → 4k (8k where the source set provides it) — one-line URL edits in
   bodies/textures.ts. Keep the graceful fallback intact.
2. Set `texture.anisotropy = renderer.capabilities.getMaxAnisotropy()` in the loader if not
   already maxed — free sharpness at grazing angles.
3. Note the real fix (procedural LOD detail crossfade up close) in plan.md backlog — it stays
   backlog, not this version.

## Release ritual

Full ritual per CLAUDE.md: version string v0.7, plan.md session line, CHANGELOG entry
(under a "### Changed" note that this is a pure refactor, no behavior change), devlog draft
docs/devlog/v0.7.md in the owner's voice discussing WHY modularize and what the split enables.

## Out of scope (do not do during the refactor)

Jupiter rebalance, any feature, any tuning, texture changes, moons, sound. The whole point is
that nothing observable changes. All temptations go to plan.md backlog.
```

# Solar Swing

A browser game about jetpacking across the solar system using real orbital mechanics.
No ship. No autopilot. Just you, a thruster that overheats, and gravity.

**Play it:** https://12code4.github.io/solar-swing/ (desktop or mobile, no install)

## What makes it interesting

- **Real n-body gravity.** Every planet pulls on you at once, inverse square. Orbits, gravity
  turns, and Oberth-effect slingshot burns all emerge from the sim rather than being scripted.
- **You cannot out-thrust a big planet.** Jetpack thrust is deliberately below Earth's surface
  gravity. Escaping means what it means in real rocketry: burn sideways, build tangential
  speed, and let the world curve away beneath you.
- **Honest scale.** Planet radii keep their true real-world ratios (Jupiter really is ~11
  Earths wide); distances are compressed so the map stays playable. Mercury to Pluto.
- **Diveable gas giants.** The banded sphere is just cloud tops. Below: darkness, crushing
  gravity, and a tiny solid core. The HUD tells you the moment you cross the point of no return.
- **A trajectory line that teaches.** Your predicted path is drawn minutes ahead and colored
  by outcome: green when you've achieved orbit, red when you're going to hit something.
  A yellow periapsis marker shows where a burn buys the most energy.
- **One shared source of truth.** The same displacement function drives terrain geometry and
  collision; the same gravity function drives the live sim and the prediction line. The
  physics can't disagree with what you see.

## Controls

Desktop: mouse to aim, hold click or Shift to burn, WASD to walk, Space to jump,
right-click to build, R to respawn.

Mobile: left stick looks, right stick walks on the ground and vectors your burn in the air
(deflection = throttle). Hold JUMP plus the stick to burn off the ground.

## Build & run

Vite + TypeScript. Three.js is an npm dependency; there is no other runtime dependency.

```
npm install      # once
npm run dev      # dev server with hot reload (prints a localhost URL)
npm run build    # typechecks (tsc --noEmit) then bundles to dist/
npm run preview  # serve the built dist/ locally
```

`npm run build` writes the built, bundled app to `dist/` (an `index.html` plus a hashed
JS bundle under `dist/assets/`). Everything is self-contained; open `dist/index.html`
through any static host.

### Deploying to GitHub Pages

Two options, both work; **A is recommended** now that there's a build step.

- **A — GitHub Actions (recommended).** `.github/workflows/deploy.yml` builds on CI and
  publishes `dist/` to Pages on every push to `main`. In the repo settings set
  Pages → Build and deployment → Source: **GitHub Actions**. The raw source is never
  served; the built app is.
- **B — commit the build.** Run `npm run build` locally, commit the `dist/` folder, and
  point Pages at it (a `docs/` folder or a `gh-pages` branch). Simpler, but you have to
  remember to rebuild and commit each release.

Vite is configured with `base: './'` so relative asset paths resolve under the project
subpath (`https://user.github.io/solar-swing/`) either way.

## How it's built

As of v0.7 the game is a small Vite + TypeScript project. `index.html` is a thin shell
(canvas + HUD); the code lives in `src/`, split along the boundaries the single-file
prototype already had: `config`, `scene`, `bodies/` (shape, orbits, gravity, textures,
build-bodies), `player/` (state, physics, prediction), `build/`, `ui/` (minimap, hud),
`input/` (desktop, touch), `loop`, `main`. All game-feel tuning still lives in one exported
`CONFIG` object (`src/config.ts`).

Solo project, developed in collaboration with AI: one model plans and reviews against a
written spec with acceptance criteria (docs/v05-spec.md is an example), another executes
it cold. Version history and process notes live in CHANGELOG.md and docs/devlog/.

Three.js r164, Vite, TypeScript. No other runtime dependencies.

## Copyright & usage

(c) 2026 12code4. All rights reserved. You're welcome to play the game and read the
source to learn from it. Reusing the code or assets in other projects requires
permission — see [LICENSE](LICENSE). This is a portfolio piece, not a template.

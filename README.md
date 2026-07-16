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

## The whole game is one HTML file

By design, for now: fastest possible iteration loop while finding the feel. Everything
tunable lives in a single CONFIG object at the top of the script. A proper module split
is on the roadmap (docs/plan.md).

## How it's built

Solo project, developed in collaboration with AI: one model plans and reviews against a
written spec with acceptance criteria (docs/v05-spec.md is an example), another executes
it cold. Version history and process notes live in CHANGELOG.md and docs/devlog/.

Three.js r164, ES modules, no other dependencies.

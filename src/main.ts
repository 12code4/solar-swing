// ============================================================
// SOLAR SWING — v0.7 entry point
// ============================================================
// STATE MANAGEMENT (Executor decision 1, v0.7 spec):
// This refactor uses GROUPED MODULE-LEVEL SINGLETONS, not a threaded context object. Each
// state module exports the SAME mutable objects the single-file v0.6 build used — same
// variables, new addresses — and every consumer imports them directly. Nothing threads state
// through function signatures.
//   • Objects that are only ever mutated in place (vel, player, camUp/camRight/camForward,
//     keys, the bodies[]/orbiters[]/solidMeshes[] registries) are exported `const` and
//     mutated by whoever imports them.
//   • Primitives that get reassigned from more than one module (heat, grounded, groundBody,
//     gMag, jumpQueued, mouseBurn, pitch, yaw, camDist, free-look angles, playing, locked,
//     sim.time) live INSIDE singleton objects — pstate/view/app in player/state.ts and sim in
//     world/sim.ts — so writers in other modules can set object properties without fighting
//     ES-module read-only import bindings.
//   • The extracted physics functions take only per-frame LOCALS as parameters (dt, near,
//     look, the touch stick axes, ...). That is not the forbidden "thread global state through
//     every signature" pattern — the globals stay singletons; the loop just hands physics the
//     values it computed that frame, which is also what breaks the input<->physics cycle.
//   • The fragile camera basis (camUp/camRight/camForward + getLookDir + the free-look/look
//     scalars) stays one cohesive unit in player/state.ts; only its per-frame smoothing runs
//     in loop.ts. The bodies[] gravity registry lives in bodies/gravity.ts; the solidMeshes[]
//     raycast registry in bodies/build-bodies.ts.
// The elegant context-object version is a plan.md backlog item, protected by the v0.6 parity
// baseline. For a parity-measured refactor, minimal churn IS correctness.
// ============================================================
import { canvas, isTouch } from './scene';
import { app, player, trailPts } from './player/state';
import { respawn } from './player/physics';
import { tryPointerLock } from './input/desktop';
import './input/touch';
import { btnJump, btnEye, btnReset } from './input/touch';
import { mmWrap } from './ui/minimap';
import { beginRun } from './rogue/ui';
import { startLoop } from './loop';

// Initial spawn on Earth + seed the trail so it doesn't streak from the origin.
respawn();
for(const p of trailPts) p.copy(player.position);

const heatBox = document.getElementById('heat') as HTMLElement;

function startGame(): void {
  (document.getElementById('start') as HTMLElement).style.display='none';
  app.playing = true;
  beginRun();   // v0.8: the roguelite run starts with the game
  if(!isTouch) { canvas.style.cursor = 'none'; tryPointerLock(); }
  else {
    btnJump.style.display = 'flex';
    btnEye.style.display = 'flex';
    btnReset.style.display = 'flex';
    (document.getElementById('blockbar') as HTMLElement).style.display = 'none';
    (document.getElementById('ui') as HTMLElement).innerHTML = '<b>LEFT</b> look · <b>RIGHT</b> walk / burn<br><b>JUMP</b> hold + stick = burn from ground';
    heatBox.style.bottom = ''; heatBox.style.top = '16px'; heatBox.style.right = '84px'; heatBox.style.width = '150px';
    // The bottom-right is where the right thumb lives (walk/burn stick), so the map goes
    // top-right under RESET, clear of both sticks and the JUMP button.
    mmWrap.style.bottom = ''; mmWrap.style.top = '132px'; mmWrap.style.right = '16px';
    mmWrap.style.width = '120px'; mmWrap.style.height = '120px';
    mmWrap.style.pointerEvents = 'auto';   // desktop stays 'none': pointer lock eats clicks
  }
}
(document.getElementById('playbtn') as HTMLElement).addEventListener('click', startGame);
if(isTouch) {
  (document.getElementById('startHelp') as HTMLElement).innerHTML =
    'LEFT stick: look &middot; RIGHT stick: walk, or burn while airborne<br>'
    + 'hold JUMP + right stick to burn off the ground &middot; heat is your fuel<br>'
    + 'you cannot out-thrust a big planet &mdash; burn sideways and let the world curve away';
  (document.getElementById('playbtn') as HTMLElement).addEventListener('touchstart', e => { e.preventDefault(); startGame(); }, {passive:false});
}

startLoop();

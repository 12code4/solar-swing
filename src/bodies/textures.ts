import * as THREE from 'three';
import { renderer } from '../scene';

// ============================================================
// NASA/CC-BY textures (v0.6 item 2; v0.7 post-parity sharpness rider)
// Every texture is a bonus layer, never a dependency. TextureLoader is async and nothing
// waits on it: the mesh is built and rendered from vertex colors immediately, and a map is
// swapped in later IF it arrives. A 404, an offline browser, or a blocked CDN therefore
// lands on exactly the v0.5 procedural look rather than a black planet.
// Source: solarsystemscope.com, CC BY 4.0. The 2k maps (2048x1024) blur when a body fills the
// screen, so the rider bumps them to the 8k set (the resolutions solarsystemscope provides for
// these bodies). Anisotropy is already maxed in the loader below. The graceful fallback is
// unchanged, so a body whose 8k URL fails simply keeps its procedural v0.5 look. The real fix
// for close-up blur is procedural LOD detail crossfade — that stays in plan.md backlog.
// ============================================================
const TEX_BASE = 'https://www.solarsystemscope.com/textures/download/';
export const TEX_FILES: Record<string, string> = {
  MERCURY: '8k_mercury.jpg',
  VENUS:   '8k_venus_atmosphere.jpg',
  EARTH:   '8k_earth_daymap.jpg',
  MARS:    '8k_mars.jpg',
  JUPITER: '8k_jupiter.jpg',
  SATURN:  '8k_saturn.jpg',
  URANUS:  '2k_uranus.jpg',    // no 8k in the source set for the two ice giants; they are
  NEPTUNE: '2k_neptune.jpg'    // near-featureless, so 2k reads fine even up close
  // PLUTO: procedural only, by design
};
const texLoader = new THREE.TextureLoader();
texLoader.setCrossOrigin('anonymous');
// capabilities is absent under a headless/stub renderer, hence the guard + the spec's fallback of 8
const MAX_ANISO = renderer.capabilities?.getMaxAnisotropy?.() ?? 8;

// The v0.5 palettes were the ONLY colour source, so they are dark by design (mean luminance
// runs 0.13 on Neptune to 0.61 on Saturn). Multiplied straight into a texture map they would
// crush it toward black and the texture would be pointless. The spec's fix is to brighten the
// palettes toward white — but its own accept criteria also demand that a 404 still render the
// v0.5 look, and a build-time brighten would wreck that. So the lift happens ONLY once a
// texture actually lands: textured path gets a clearly visible map with subtle procedural
// variation on top, fallback path keeps v0.5 pixel-for-pixel.
// Lerping toward white by t scales the surviving variation by (1-t).
export function liftVertexColors(geo: THREE.BufferGeometry, t: number): void {
  const col = geo.getAttribute('color');
  if(!col || geo.userData.colorsLifted) return;   // idempotent: never double-lift
  for(let i=0;i<col.count;i++){
    col.setXYZ(i, col.getX(i)*(1-t)+t, col.getY(i)*(1-t)+t, col.getZ(i)*(1-t)+t);
  }
  col.needsUpdate = true;
  geo.userData.colorsLifted = true;
}

// Attaches a map to an EXISTING material after the fact. Returns nothing: callers must never
// depend on the result. onError deliberately does nothing at all — leaving material.map null
// is the fallback, and vertex colors already carry the look.
export function applyTexture(mat: THREE.MeshStandardMaterial, file: string | undefined, onLoad?: (tex: THREE.Texture) => void): void {
  if(!file) return;
  texLoader.load(
    TEX_BASE + file,
    tex => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = MAX_ANISO;
      mat.map = tex;
      mat.needsUpdate = true;   // recompile: the shader was built without a map
      if(onLoad) onLoad(tex);
    },
    undefined,
    () => { /* texture-less by design: vertexColors keep the v0.5 render */ }
  );
}

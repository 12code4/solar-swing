import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { CONFIG } from './config';

export const canvas = document.getElementById('c') as HTMLCanvasElement;

// On-screen error reporter — bugs should be visible, not buried in the console. (CLAUDE.md)
const errBox = document.createElement('div');
errBox.style.cssText = 'position:fixed;top:16px;right:16px;max-width:40vw;background:rgba(60,0,0,0.85);color:#faa;font:12px/1.6 monospace;padding:8px 12px;border:1px solid #f55;border-radius:6px;display:none;z-index:99;white-space:pre-wrap;';
document.body.appendChild(errBox);
window.addEventListener('error', ev => {
  errBox.style.display = 'block';
  errBox.textContent = 'ERROR: ' + ev.message + (ev.lineno ? ' @line '+ev.lineno : '');
});

export const isTouch = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;

export const renderer = new THREE.WebGLRenderer({canvas, antialias:true, logarithmicDepthBuffer:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x04040c);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(72, window.innerWidth/window.innerHeight, 0.1, 400000);

// Soft lighting: sun point light (key) + hemisphere fill
const sunLight = new THREE.PointLight(0xfff0d8, 3.0, 0, 0);
sunLight.position.set(0,0,0);
scene.add(sunLight);
scene.add(new THREE.HemisphereLight(0x90a0c0, 0x1a1410, 0.3));

// Desktop-only bloom pipeline.
// OutputPass is load-bearing, not decoration: three only applies tone mapping when a
// material renders straight to the screen (WebGLPrograms checks currentRenderTarget ===
// null). RenderPass draws into the composer's HalfFloat target, so ACES never runs there
// and the buffer holds raw linear HDR. OutputPass applies ACES + the sRGB transfer at the
// end, reproducing exactly what the untouched mobile renderer.render() path does. Drop it
// and the desktop render is washed out and diverges from mobile.
export let composer: EffectComposer | null = null;
if(!isTouch) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    CONFIG.bloomStrength, CONFIG.bloomRadius, CONFIG.bloomThreshold
  ));
  composer.addPass(new OutputPass());
}

// Star shell that follows the camera
const starVerts: number[] = [];
for(let i=0;i<2400;i++){
  const r = 20000;
  const theta = Math.random()*Math.PI*2;
  const phi = Math.acos(2*Math.random()-1);
  starVerts.push(r*Math.sin(phi)*Math.cos(theta), r*Math.cos(phi), r*Math.sin(phi)*Math.sin(theta));
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerts,3));
export const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({color:0xffffff,size:1.6,sizeAttenuation:false}));
scene.add(stars);

// Sun glow sprite texture
export function makeGlowTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createRadialGradient(128,128,0,128,128,128);
  g.addColorStop(0, 'rgba(255,244,214,1)');
  g.addColorStop(0.25, 'rgba(255,220,150,0.55)');
  g.addColorStop(0.6, 'rgba(255,180,90,0.15)');
  g.addColorStop(1, 'rgba(255,160,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,256,256);
  return new THREE.CanvasTexture(cv);
}

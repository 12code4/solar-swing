import * as THREE from 'three';
import { CONFIG } from '../config';
import { scene, camera } from '../scene';
import { player, view, getLookDir } from '../player/state';
import { solidMeshes } from '../bodies/build-bodies';
import type { BlockType, BlockInstance } from '../types';

// ============================================================
// Building (desktop only for now)
// ============================================================
export const BLOCK_TYPES: BlockType[] = [
  { name:'CUBE',     half:new THREE.Vector3(0.8,0.8,0.8),   make:()=>new THREE.BoxGeometry(1.6,1.6,1.6),        color:0x8899aa, emissive:0x000000 },
  { name:'PLATFORM', half:new THREE.Vector3(1.6,0.18,1.6),  make:()=>new THREE.BoxGeometry(3.2,0.36,3.2),       color:0x667788, emissive:0x000000 },
  { name:'BEACON',   half:new THREE.Vector3(0.35,1.0,0.35), make:()=>new THREE.CylinderGeometry(0.14,0.35,2,8), color:0x332200, emissive:0xffdd33 }
];
export let selectedBlock = 0;
export const blocks: BlockInstance[] = [];
export const blockMeshes: THREE.Mesh[] = [];

export const ghost = new THREE.Mesh(
  BLOCK_TYPES[0].make(),
  new THREE.MeshStandardMaterial({color:0xffdd33, transparent:true, opacity:0.35, roughness:1})
);
ghost.visible = false;
scene.add(ghost);

export function setSelectedBlock(i: number): void {
  selectedBlock = i;
  for(let s=0;s<3;s++) (document.getElementById('slot'+s) as HTMLElement).className = 'slot'+(s===i?' sel':'');
  ghost.geometry.dispose();
  ghost.geometry = BLOCK_TYPES[i].make();
}

const raycaster = new THREE.Raycaster();
export function aimHit(range: number, includeBlocks: boolean): THREE.Intersection | null {
  raycaster.set(camera.position, getLookDir());
  raycaster.far = range + view.camDist + 20;
  const targets = includeBlocks ? (solidMeshes as THREE.Object3D[]).concat(blockMeshes) : solidMeshes;
  const hits = raycaster.intersectObjects(targets, false);
  for(const h of hits){
    if(h.point.distanceTo(player.position) <= range) return h;
  }
  return null;
}

// Walk up from a hit object to the body Group that owns it, so a placed block rides the
// planet instead of being left behind in world space (v0.6 item 1).
function ownerGroupOf(obj: THREE.Object3D): THREE.Object3D | null {
  let o: THREE.Object3D | null = obj;
  while(o) { if(o.userData && o.userData.orbitNode) return o; o = o.parent; }
  return null;
}

export function placeBlock(): void {
  const hit = aimHit(CONFIG.buildRange, true);
  if(!hit) return;
  const t = BLOCK_TYPES[selectedBlock];
  // aimHit only ever returns mesh hits, which always carry a face.
  const n = hit.face!.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
  const mesh = new THREE.Mesh(t.make(), new THREE.MeshStandardMaterial({color:t.color, emissive:t.emissive, emissiveIntensity:1.6, roughness:0.9}));
  mesh.position.copy(hit.point).addScaledVector(n, t.half.y);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), n);
  scene.add(mesh);
  mesh.updateMatrixWorld();
  // attach() re-parents while preserving the world transform we just computed.
  const owner = ownerGroupOf(hit.object);
  if(owner) owner.attach(mesh);
  mesh.updateMatrixWorld();
  blocks.push({mesh, half:t.half});
  blockMeshes.push(mesh);
}

export function removeBlock(): void {
  raycaster.set(camera.position, getLookDir());
  raycaster.far = CONFIG.buildRange + view.camDist + 20;
  const hits = raycaster.intersectObjects(blockMeshes, false);
  if(!hits.length) return;
  const mesh = hits[0].object;
  if(hits[0].point.distanceTo(player.position) > CONFIG.buildRange) return;
  if(mesh.parent) mesh.parent.remove(mesh);
  blockMeshes.splice(blockMeshes.indexOf(mesh as THREE.Mesh),1);
  blocks.splice(blocks.findIndex(b=>b.mesh===mesh),1);
}

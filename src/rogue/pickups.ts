import * as THREE from 'three';
import { CONFIG } from '../config';
import { seededRand } from '../bodies/shape';
import { bodies } from '../bodies/gravity';
import '../bodies/build-bodies';   // side-effect import: bodies[] must be populated first
import { player } from '../player/state';
import { sim } from '../world/sim';
import { run, addSalvage } from './state';
import type { Body } from '../types';

// ============================================================
// Salvage shards (v0.8 spec item 3). Seeded deterministic placement. Each shard mesh is a
// CHILD of its body's group, so it rides the orbit exactly like a placed block. Body groups
// only ever translate (never rotate), so local dir == world dir and surface placement can
// query shapeFn directly — the same one the mesh and collision use (invariant 1).
// ============================================================

interface Shard {
  id: string;
  mesh: THREE.Mesh;
  body: Body;
  value: number;
  baseScale: number;
  phase: number;
}

export const shards: Shard[] = [];

const shardGeo = new THREE.OctahedronGeometry(1, 0);
const shardMat = new THREE.MeshStandardMaterial({ color:0x332200, emissive:0xffdd33, emissiveIntensity:2.2, roughness:0.6 });
const coreMat  = new THREE.MeshStandardMaterial({ color:0x330011, emissive:0xff5544, emissiveIntensity:2.6, roughness:0.6 });

const _dir = new THREE.Vector3();
const _w = new THREE.Vector3();

function addShard(body: Body, id: string, localPos: THREE.Vector3, size: number, value: number, core: boolean): void {
  const mesh = new THREE.Mesh(shardGeo, core ? coreMat : shardMat);
  mesh.position.copy(localPos);
  mesh.scale.setScalar(size);
  body.node.add(mesh);
  shards.push({ id, mesh, body, value, baseScale: size, phase: seededRand(id.length*31) * Math.PI*2 });
}

// dir from two seeded rands — uniform enough for decoration
function seededDir(s: number, out: THREE.Vector3): THREE.Vector3 {
  const u = seededRand(s)*2 - 1;
  const a = seededRand(s+1)*Math.PI*2;
  const r = Math.sqrt(Math.max(0, 1 - u*u));
  return out.set(r*Math.cos(a), u, r*Math.sin(a));
}

function surfaceShards(body: Body, count: number, seed: number): void {
  const size = Math.max(1.2, body.R*0.012);
  for(let i=0;i<count;i++){
    seededDir(seed + i*7, _dir);
    const surfR = body.R * (body.shapeFn ? body.shapeFn(_dir) : 1);
    addShard(body, `${body.name}-s${i}`, _dir.clone().multiplyScalar(surfR + size*1.4), size, CONFIG.shardValue, false);
  }
}

function orbitShards(body: Body, count: number, seed: number): void {
  const reach = body.cloudR || body.R;
  const size = Math.max(2, reach*0.014);
  for(let i=0;i<count;i++){
    const alt = reach * (1.35 + seededRand(seed + i*11)*0.55);
    const a = (i/count)*Math.PI*2 + seededRand(seed + i*13)*0.6;
    const y = (seededRand(seed + i*17) - 0.5) * reach*0.5;
    addShard(body, `${body.name}-o${i}`,
      new THREE.Vector3(Math.cos(a)*alt, y, Math.sin(a)*alt), size, CONFIG.shardValue, false);
  }
}

// ----- build the field once at boot -----
{
  let beltIdx = 0;
  for(const b of bodies){
    if(b.star) continue;
    const seed = b.name.length*101 + b.R;
    if(b.belt) {
      // majors only — the biggest rocks, always landable (build order puts them first)
      if(beltIdx < CONFIG.beltMajors) surfaceShards(b, CONFIG.beltShardsMajor, seed + beltIdx*997);
      beltIdx++;
    } else if(b.gas) {
      orbitShards(b, CONFIG.orbitShardsGas, seed);
      // the CORE shard: the paid NO RETURN dive (spec item 3)
      seededDir(seed*3, _dir);
      const surfR = b.R * (b.shapeFn ? b.shapeFn(_dir) : 1);
      addShard(b, `${b.name}-core`, _dir.clone().multiplyScalar(surfR + 2), Math.max(2, b.R*0.05), CONFIG.coreShardValue, true);
    } else {
      surfaceShards(b, CONFIG.surfShardsRocky, seed);
      orbitShards(b, CONFIG.orbitShardsRocky, seed + 500);
    }
  }
}

export function resetShards(): void {
  for(const s of shards) s.mesh.visible = true;
  // run.collected is cleared by startRun
}

// Per-frame: proximity collection + a gentle scale pulse. ~130 shards of cheap vector math.
// Returns collected values so the caller (rogue UI) can toast — this module stays DOM-free.
export function updatePickups(collectedOut: number[]): void {
  for(const s of shards){
    if(!s.mesh.visible) continue;
    // body groups only translate, so world pos = group pos + local pos (no matrix walk)
    _w.copy(s.body.node.position).add(s.mesh.position);
    const pulse = 1 + 0.18*Math.sin(sim.time*3 + s.phase);
    s.mesh.scale.setScalar(s.baseScale*pulse);
    const pickR = CONFIG.shardPickR + s.baseScale*2;
    if(_w.distanceToSquared(player.position) < pickR*pickR) {
      s.mesh.visible = false;
      run.collected.add(s.id);
      addSalvage(s.value);
      collectedOut.push(s.value);
    }
  }
}

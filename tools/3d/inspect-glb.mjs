import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const input = process.argv[2];
if (!input) {
  console.error('Uso: node tools/3d/inspect-glb.mjs <arquivo.glb>');
  process.exit(2);
}

const path = resolve(input);
const bytes = await readFile(path);
if (bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'glTF') {
  throw new Error('Arquivo não é um GLB válido: magic header ausente.');
}

const version = bytes.readUInt32LE(4);
const declaredLength = bytes.readUInt32LE(8);
if (declaredLength !== bytes.length) {
  throw new Error(`GLB truncado ou com bytes extras: declarado=${declaredLength}, real=${bytes.length}`);
}

const jsonLength = bytes.readUInt32LE(12);
const jsonType = bytes.toString('ascii', 16, 20);
if (jsonType !== 'JSON') throw new Error(`Primeiro chunk inesperado: ${jsonType}`);
const json = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength).trim());

let triangles = 0;
for (const mesh of json.meshes ?? []) {
  for (const primitive of mesh.primitives ?? []) {
    const accessorIndex = primitive.indices ?? primitive.attributes?.POSITION;
    const count = accessorIndex === undefined ? 0 : (json.accessors?.[accessorIndex]?.count ?? 0);
    const mode = primitive.mode ?? 4;
    if (mode === 4) triangles += Math.floor(count / 3);
    if (mode === 5 || mode === 6) triangles += Math.max(0, count - 2);
  }
}

const summary = {
  file: basename(path),
  sha256: createHash('sha256').update(bytes).digest('hex'),
  bytes: bytes.length,
  mebibytes: Number((bytes.length / 1024 / 1024).toFixed(2)),
  glbVersion: version,
  generator: json.asset?.generator ?? null,
  gltfVersion: json.asset?.version ?? null,
  scenes: json.scenes?.length ?? 0,
  nodes: json.nodes?.length ?? 0,
  meshes: json.meshes?.length ?? 0,
  primitives: (json.meshes ?? []).reduce((total, mesh) => total + (mesh.primitives?.length ?? 0), 0),
  approximateTriangles: triangles,
  materials: json.materials?.length ?? 0,
  textures: json.textures?.length ?? 0,
  images: json.images?.length ?? 0,
  animations: json.animations?.length ?? 0,
  cameras: json.cameras?.length ?? 0,
  extensionsUsed: json.extensionsUsed ?? [],
  extensionsRequired: json.extensionsRequired ?? [],
};

console.log(JSON.stringify(summary, null, 2));


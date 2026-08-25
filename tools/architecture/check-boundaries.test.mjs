import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { checkWorkspace } from './check-boundaries.mjs';

async function withWorkspace(run) {
  const root = await mkdtemp(join(tmpdir(), 'midas-boundaries-'));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('aceita pacotes sem ciclos e módulos isolados', async () => {
  await withWorkspace(async (root) => {
    await mkdir(join(root, 'modules', 'identity', 'src'), { recursive: true });
    await mkdir(join(root, 'packages', 'kernel'), { recursive: true });
    await writeFile(join(root, 'modules', 'identity', 'package.json'), JSON.stringify({ name: '@midas/identity', dependencies: { '@midas/kernel': 'workspace:*' } }));
    await writeFile(join(root, 'packages', 'kernel', 'package.json'), JSON.stringify({ name: '@midas/kernel' }));
    await writeFile(join(root, 'modules', 'identity', 'src', 'index.ts'), "import { id } from '@midas/kernel';\nexport { id };\n");
    assert.deepEqual(await checkWorkspace(root), []);
  });
});

test('rejeita import interno entre módulos', async () => {
  await withWorkspace(async (root) => {
    await mkdir(join(root, 'modules', 'identity', 'src'), { recursive: true });
    await mkdir(join(root, 'modules', 'sellers', 'src'), { recursive: true });
    await writeFile(join(root, 'modules', 'identity', 'src', 'index.ts'), "import '../../sellers/src/private.ts';\n");
    const errors = await checkWorkspace(root);
    assert.ok(errors.some((error) => error.includes('import relativo cruza')));
  });
});

test('rejeita ciclo de dependências e entidade paralela', async () => {
  await withWorkspace(async (root) => {
    await mkdir(join(root, 'modules', 'identity', 'src'), { recursive: true });
    await mkdir(join(root, 'modules', 'sellers', 'src'), { recursive: true });
    await writeFile(join(root, 'modules', 'identity', 'package.json'), JSON.stringify({ name: '@midas/identity', dependencies: { '@midas/sellers': 'workspace:*' } }));
    await writeFile(join(root, 'modules', 'sellers', 'package.json'), JSON.stringify({ name: '@midas/sellers', dependencies: { '@midas/identity': 'workspace:*' } }));
    await writeFile(join(root, 'modules', 'identity', 'src', 'index.ts'), 'export interface SellerUser {}\n');
    const errors = await checkWorkspace(root);
    assert.ok(errors.some((error) => error.includes('ciclo de pacotes')));
    assert.ok(errors.some((error) => error.includes('SellerUser')));
  });
});

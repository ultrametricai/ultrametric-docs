import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { connectFixture, sourceModule } from './fixture.mjs';

const [cliRoot, apiRoot] = process.argv.slice(2);
if (!cliRoot || !apiRoot) throw new Error('Usage: npm run verify:examples -- /path/to/prepared-cli /path/to/prepared-api');
globalThis.fetch = async () => { throw new Error('External network is disabled in docs verification.'); };
const temp = await mkdtemp(join(tmpdir(), 'ultrametric-docs-check-'));
const dataDir = join(temp, 'data');
const project = join(temp, 'project');
const { mkdir } = await import('node:fs/promises');
await mkdir(project);
const bin = resolve(cliRoot, 'dist/bin.js');
const run = (...args) => JSON.parse(execFileSync(process.execPath, [bin, '--data-dir', dataDir, ...args, '--json'], { encoding: 'utf8' }));
try {
  assert.equal(execFileSync(process.execPath, [bin, '--version'], { encoding: 'utf8' }).trim(), '0.4.1');
  assert.equal(run().data.name, 'ultrametric');
  const preview = run('init', '--path', project, '--dry-run');
  assert.equal(preview.data.files.length, 2);
  assert.deepEqual(await readdir(project), []);
  await assert.rejects(stat(dataDir), { code: 'ENOENT' });
  for (const command of [['process', '--help'], ['context', 'get', '--help'], ['context', 'schema', '--help']]) {
    execFileSync(process.execPath, [bin, ...command], { stdio: 'pipe' });
  }
  const invalid = spawnSync(process.execPath, [bin, '--json', '--not-a-real-option'], { encoding: 'utf8' });
  assert.equal(invalid.status, 3);
  assert.equal(JSON.parse(invalid.stderr).error.code, 'USAGE');
  assert.equal(invalid.stdout, '');
  const fixture = await connectFixture(apiRoot);
  try {
    const tools = await fixture.client.listTools();
    assert.equal(tools.tools.length, 6);
    const list = await fixture.client.callTool({ name: 'list_processes', arguments: { limit: 1 } });
    const id = list.structuredContent.items[0].id;
    const result = await fixture.client.callTool({ name: 'get_process', arguments: { id } });
    assert.deepEqual(result.structuredContent, await fixture.service.get({ id }));
    assert.equal(result.structuredContent.process.id, fixture.document.id);
    assert.equal(result.structuredContent.guide.resultSchema.type, 'object');
    const { ProcessClient } = await sourceModule(cliRoot, 'dist/process/client.js');
    let reads = 0;
    const cliClient = new ProcessClient(async () => 'synthetic-docs-token', async (url, init) => {
      assert.equal(init?.method ?? 'GET', 'GET');
      const target = new URL(url);
      assert.equal(target.origin, 'https://api.ultrametric.ai');
      reads++;
      const data = target.pathname === '/processes' ? await fixture.service.list({ limit: 1 }) : await fixture.service.get({ id });
      return Response.json({ schemaVersion: 1, data });
    });
    const page = await cliClient.list(1);
    const guide = await cliClient.get(page.items[0].id);
    assert.deepEqual(guide, result.structuredContent);
    assert.equal(reads, 2);
  } finally { await fixture.client.close(); }
  console.log('PASS: v0.4.1 version/help/discovery; init dry-run leaves project/data absent; JSON stderr/exit 3; real MCP SDK list/get with synthetic source; CLI transport list/get matches MCP.');
  console.log('No OAuth, private records, database, real process execution, writes, client UI, or external services tested.');
} finally { await rm(temp, { recursive: true, force: true }); }

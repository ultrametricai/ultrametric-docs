import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, realpath, rm, stat } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { connectFixture, sourceModule } from './fixture.mjs';

const args = process.argv.slice(2);
const cliOnly = args[0] === '--cli-only';
const [cliRoot, apiRoot] = cliOnly ? args.slice(1) : args;
if (!cliRoot || (!cliOnly && !apiRoot)) throw new Error('Usage: npm run verify:examples -- --cli-only /path/to/unpacked-npm-release OR /path/to/prepared-cli /path/to/prepared-api');
const { cliVersion } = JSON.parse(await readFile('contracts/generated.json', 'utf8'));
const cliContract = JSON.parse(await readFile('contracts/cli-commands.json', 'utf8'));
globalThis.fetch = async () => { throw new Error('External network is disabled in docs verification.'); };
const temp = await mkdtemp(join(tmpdir(), 'ultrametric-docs-check-'));
const dataDir = join(temp, 'data');
const project = join(temp, 'project');
const { mkdir } = await import('node:fs/promises');
await mkdir(project);
const bin = resolve(cliRoot, 'dist/bin.js');
const run = (...args) => JSON.parse(execFileSync(process.execPath, [bin, '--data-dir', dataDir, ...args, '--json'], { encoding: 'utf8', cwd: project }));
try {
  assert.equal(execFileSync(process.execPath, [bin, '--version'], { encoding: 'utf8' }).trim(), cliVersion);
  assert.deepEqual(run(), cliContract);
  const userPreview = run('init', '--dry-run');
  assert.equal(userPreview.data.scope, 'user');
  assert.equal(userPreview.data.directory, await realpath(homedir()));
  assert.equal(userPreview.data.project, null);
  assert.equal(userPreview.data.files.length, 2);
  const preview = run('init', '--path', project, '--dry-run');
  assert.equal(preview.data.scope, 'project');
  assert.equal(preview.data.directory, await realpath(project));
  assert.equal(preview.data.files.length, 2);
  const projectPreview = run('init', '--project', '--dry-run');
  assert.equal(projectPreview.data.scope, 'project');
  assert.equal(projectPreview.data.directory, await realpath(project));
  assert.deepEqual(projectPreview.data.files, preview.data.files);
  for (const target of ['codex', 'claude']) {
    assert.equal(run('init', '--agent', target, '--project', '--dry-run').data.files.length, 1);
  }
  assert.deepEqual(await readdir(project), []);
  await assert.rejects(stat(dataDir), { code: 'ENOENT' });
  for (const command of [['process', '--help'], ['process', 'open', '--help'], ['context', 'get', '--help'], ['context', 'save', '--help'], ['context', 'schema', '--help']]) {
    execFileSync(process.execPath, [bin, ...command], { stdio: 'pipe' });
  }
  const invalid = spawnSync(process.execPath, [bin, '--json', '--not-a-real-option'], { encoding: 'utf8' });
  assert.equal(invalid.status, 3);
  assert.equal(JSON.parse(invalid.stderr).error.code, 'USAGE');
  assert.equal(invalid.stdout, '');
  console.log(`PASS: v${cliVersion} version/help/discovery matches the reference; user, project, path, and per-agent init dry-runs; project stays empty and data remains absent; JSON stderr/exit 3.`);
  if (!cliOnly) {
    const { openProcessInput, saveUpdateInput, getContextInput } = await sourceModule(apiRoot, 'src/context.ts');
    const runId = '11111111-1111-4111-8111-111111111111';
    const updateKey = '22222222-2222-4222-8222-222222222222';
    const recordId = '33333333-3333-4333-8333-333333333333';
    assert.equal(openProcessInput.parse({ processId: 'docs-read-only-fixture' }).period, '');
    const update = { organizationId: 'docs-fixture', runId, updateKey, text: 'Reviewed a synthetic brief.', progress: { status: 'waiting', detail: 'Waiting for an answer.' } };
    assert.equal(saveUpdateInput.parse(update).visibility, 'organization');
    assert.equal(saveUpdateInput.safeParse({ ...update, updateKey: undefined }).success, false);
    assert.equal(saveUpdateInput.safeParse({ ...update, progress: { status: 'done' } }).success, false);
    assert.equal(getContextInput.parse({}).limit, 10);
    assert.equal(getContextInput.parse({ runId }).runId, runId);
    assert.equal(getContextInput.parse({ recordId, history: true, beforeRevision: 2 }).beforeRevision, 2);
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
    console.log('PASS: open/save/resume input schemas; real MCP SDK list/get with synthetic source; CLI transport list/get matches MCP.');
  }
  console.log('No OAuth, private records, database, real process execution, writes, client UI, or external services tested.');
} finally { await rm(temp, { recursive: true, force: true }); }

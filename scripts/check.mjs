import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const root = process.cwd();
const config = JSON.parse(await readFile('docs.json', 'utf8'));
const spec = JSON.parse(await readFile('contracts/openapi.json', 'utf8'));
const mcp = JSON.parse(await readFile('contracts/mcp-tools.json', 'utf8'));
const cli = JSON.parse(await readFile('contracts/cli-commands.json', 'utf8'));
assert.equal(config.$schema, 'https://mintlify.com/docs.json');
assert.equal(config.theme, 'mint');
const generated = JSON.parse(await readFile('contracts/generated.json', 'utf8'));
for (const [path, expected] of Object.entries(generated.files)) {
  assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'), expected, `Regenerate edited reference: ${path}`);
}
assert.match(config.colors.primary, /^#[0-9a-f]{6}$/i);
const pages = config.navigation.groups.flatMap(group => group.pages);
assert.equal(new Set(pages).size, pages.length);
async function exists(path) { try { return (await stat(path)).isFile(); } catch { return false; } }
for (const page of pages) {
  const path = `${page}.mdx`;
  const text = await readFile(path, 'utf8');
  assert.match(text, /^---\ntitle: .+\ndescription: .+\n---\n/, path);
  assert.match(text, /[Ii]nternal documentation draft|Internal draft/, path);
  assert.equal((text.match(/^```/gm) ?? []).length % 2, 0, `Unclosed code fence: ${path}`);
  for (const match of text.matchAll(/\]\((\/[^)#]+)(?:#[^)]*)?\)/g)) {
    const target = resolve(root, '.' + match[1]);
    assert.ok(target.startsWith(root + '/'), `Invalid link in ${path}`);
    assert.ok(await exists(target) || await exists(`${target}.mdx`), `Broken link ${match[1]} in ${path}`);
  }
}
assert.equal(spec.openapi, '3.1.0');
assert.ok(Object.keys(spec.paths).every(path => !path.startsWith('/internal') && !path.startsWith('/views')));
assert.equal(cli.schemaVersion, 1);
assert.equal(cli.data.name, 'ultrametric');
const byName = new Map(mcp.tools.map(tool => [tool.name, tool]));
assert.equal(byName.size, 6);
for (const name of ['status', 'list_processes', 'get_process', 'get_context']) assert.equal(byName.get(name)?.annotations.readOnlyHint, true);
for (const name of ['open_process', 'save_update']) assert.equal(byName.get(name)?.annotations.readOnlyHint, false);
for (const name of ['list_processes', 'get_process']) assert.equal(byName.get(name)?.inputSchema.type, 'object');
const get = spec.paths['/processes/{id}'].get;
assert.equal(get.operationId, 'getProcess');
assert.ok(cli.data.commands.find(c => c.name === 'process').commands.some(c => c.name === 'get'));
assert.ok(cli.data.commands.find(c => c.name === 'context').commands.some(c => c.name === 'get'));
const publicDirs = ['.', 'cli', 'mcp', 'plugins', 'concepts', 'guides', 'api-reference', 'contracts'];
for (const dir of publicDirs) {
  for (const name of await readdir(dir)) {
    if (!/\.(mdx|json)$/.test(name)) continue;
    const text = await readFile(`${dir}/${name}`, 'utf8');
    assert.ok(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sk_live_|ghp_)[A-Za-z0-9]{15,}/.test(text), `Potential credential: ${dir}/${name}`);
  }
}
console.log(`PASS: ${pages.length} navigated MDX pages; local links; draft labels; JSON contracts; six MCP effect annotations; CLI discovery; credential-pattern scan.`);
console.log('This check does not compile MDX, render Mintlify, authenticate a client, or validate external links.');

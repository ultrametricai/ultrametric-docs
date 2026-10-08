import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, matchesGlob, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const root = process.cwd();
const config = JSON.parse(await readFile('docs.json', 'utf8'));
const mcp = JSON.parse(await readFile('contracts/mcp-tools.json', 'utf8'));
const cli = JSON.parse(await readFile('contracts/cli-commands.json', 'utf8'));
const install = await readFile('cli/install.mdx', 'utf8');
assert.match(install, /npm install -g ultrametric@latest\n/, 'Fresh installs must use the current npm release.');
assert.ok(!/npm install -g ultrametric@\d/.test(install), 'Do not pin the install guide to an old CLI release.');
assert.equal(config.$schema, 'https://mintlify.com/docs.json');
assert.equal(config.theme, 'mint');
const generated = JSON.parse(await readFile('contracts/generated.json', 'utf8'));
for (const [path, expected] of Object.entries(generated.files)) {
  assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'), expected, `Regenerate edited reference: ${path}`);
}
assert.match(config.colors.primary, /^#[0-9a-f]{6}$/i);
const pages = config.navigation.groups.flatMap(group => group.pages);
assert.equal(new Set(pages).size, pages.length);
const ignorePatterns = (await readFile('.mintignore', 'utf8')).split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
const ignored = path => ignorePatterns.some(pattern => pattern.endsWith('/') ? path.startsWith(pattern) : matchesGlob(path, pattern));
for (const path of ['AGENTS.md', 'CONTRIBUTING.md', 'README.md', 'scripts/check.mjs', 'package.json', 'contracts/generated.json', 'contracts/cli-commands.json']) {
  assert.ok(ignored(path), `Maintenance file must be excluded from the site: ${path}`);
}
for (const path of ['contracts/mcp-tools.json']) assert.ok(!ignored(path), `Public schema must be available: ${path}`);
async function filesBelow(dir = '.') {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (['.git', '.work', 'node_modules'].includes(entry.name)) continue;
    const path = dir === '.' ? entry.name : `${dir}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await filesBelow(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}
const files = await filesBelow();
assert.ok(ignored('plugins/overview.mdx'), 'Retired skill pages must be excluded from the site.');
assert.ok(!files.some(path => path.startsWith('plugins/') && path.endsWith('.mdx')), 'Keep skill setup in the CLI install page.');
assert.ok(!JSON.stringify(config.navigation).includes('plugins/'), 'Keep standalone skill pages out of navigation.');
for (const path of ['api-reference/overview.mdx', 'api-reference/operations.mdx', 'contracts/openapi.json']) {
  assert.ok(!files.includes(path), `Remove retired HTTP reference output: ${path}`);
  assert.ok(ignored(path), `Retired HTTP reference must be excluded: ${path}`);
}
assert.ok(!JSON.stringify(config.navigation).includes('api-reference'), 'Keep HTTP references out of navigation.');
assert.ok(!config.api?.openapi, 'Do not generate public HTTP endpoints from an OpenAPI import.');
for (const path of files.filter(path => !ignored(path) && /\.(mdx|json)$/.test(path) && path !== 'docs.json')) {
  const content = await readFile(path, 'utf8');
  assert.ok(!/\bopenapi\b|\/api-reference\/|```http\b|https:\/\/api\.ultrametric\.(?:ai|dev)\/(?:processes|context|auth\/workspace|status)\b|(?:curl|fetch)\b[^\n]*https:\/\/api\.ultrametric\./i.test(content), `Keep public docs focused on consumer interfaces: ${path}`);
}
assert.deepEqual(files.filter(path => path.endsWith('.mdx')).sort(), pages.map(page => `${page}.mdx`).sort(), 'Every MDX page must be in navigation.');
const editorialNotes = /internal documentation draft|internal draft|source[- ]inspected|verification scope|release evidence|not yet (?:tested|verified)|untested client|synthetic (?:in-memory )?fixture|pending validation|documentation scaffold/i;
for (const path of [...pages.map(page => `${page}.mdx`), 'README.md', 'docs.json', 'contracts/mcp-tools.json']) {
  assert.ok(!editorialNotes.test(await readFile(path, 'utf8')), `Move internal review commentary out of ${path}`);
}
async function exists(path) { try { return (await stat(path)).isFile(); } catch { return false; } }
for (const path of [...pages.map(page => `${page}.mdx`), 'README.md', 'CONTRIBUTING.md']) {
  const text = await readFile(path, 'utf8');
  if (path.endsWith('.mdx')) {
    assert.match(text, /^---\ntitle: .+\ndescription: .+\n---\n/, path);
    assert.ok(!ignored(path), `Navigated page is excluded from the site: ${path}`);
  }
  assert.equal((text.match(/^```/gm) ?? []).length % 2, 0, `Unclosed code fence: ${path}`);
  for (const match of text.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)) {
    if (/^[a-z][a-z\d+.-]*:/i.test(match[1])) continue;
    const target = match[1].startsWith('/') ? resolve(root, '.' + match[1]) : resolve(root, dirname(path), match[1]);
    assert.ok(target.startsWith(root + '/'), `Invalid link in ${path}`);
    assert.ok(await exists(target) || await exists(`${target}.mdx`), `Broken link ${match[1]} in ${path}`);
    if (path.endsWith('.mdx')) {
      const linkedFile = (await exists(target) ? target : `${target}.mdx`).slice(root.length + 1);
      assert.ok(!ignored(linkedFile), `Link to an excluded file ${match[1]} in ${path}`);
    }
  }
}
assert.equal(cli.schemaVersion, 1);
assert.equal(cli.data.name, 'ultrametric');
const byName = new Map(mcp.tools.map(tool => [tool.name, tool]));
assert.equal(byName.size, 6);
for (const name of ['status', 'list_processes', 'get_process', 'get_context']) assert.equal(byName.get(name)?.annotations.readOnlyHint, true);
for (const name of ['open_process', 'save_update']) assert.equal(byName.get(name)?.annotations.readOnlyHint, false);
for (const name of ['list_processes', 'get_process']) assert.equal(byName.get(name)?.inputSchema.type, 'object');
assert.ok(cli.data.commands.find(c => c.name === 'process').commands.some(c => c.name === 'get'));
assert.ok(cli.data.commands.find(c => c.name === 'context').commands.some(c => c.name === 'get'));
for (const path of files) {
  if (!/\.(md|mdx|json|mjs|svg)$/.test(path)) continue;
  const text = await readFile(path, 'utf8');
  assert.ok(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sk_live_|ghp_)[A-Za-z0-9]{15,}/.test(text), `Potential credential: ${path}`);
}
console.log(`PASS: ${pages.length} navigated MDX pages; local links; public content rules; site exclusions; JSON contracts; six MCP effect annotations; CLI discovery; credential-pattern scan.`);
console.log('This check does not compile MDX, render Mintlify, authenticate a client, or validate external links.');

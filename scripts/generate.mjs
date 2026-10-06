import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { sourceModule, connectFixture } from './fixture.mjs';
import { sourceFingerprint, fileHash } from './source-integrity.mjs';

const [cliRoot, apiRoot, pinFile] = process.argv.slice(2);
if (!cliRoot || !apiRoot || !pinFile) throw new Error('Usage: npm run generate -- /path/to/prepared-cli /path/to/prepared-api /path/to/private-source-pins.json');
const pins = JSON.parse(await readFile(pinFile, 'utf8'));
const { createHash } = await import('node:crypto');
for (const [root, pin, extra] of [[cliRoot, pins.cli, ['skills/ultrametric/SKILL.md', 'scripts/build.mjs', 'tsconfig.json']], [apiRoot, pins.api, []]]) {
  if (await sourceFingerprint(root, extra) !== pin.sourceFingerprint) {
    throw new Error('Source drift. Review the owning source and update provenance before generation.');
  }
}
for (const [path, expected] of Object.entries(pins.cli.buildArtifacts)) {
  if (await fileHash(resolve(cliRoot, 'dist', path)) !== expected) throw new Error('CLI build does not match the recorded source export.');
}
if (await fileHash(resolve(apiRoot, 'dist/ui-resource.ts')) !== pins.mcp.uiFixtureSha256) throw new Error('MCP fixture asset changed; verify the supporting build.');
const output = async (path, value) => writeFile(path, JSON.stringify(value, null, 2) + '\n');
const cli = JSON.parse(execFileSync(process.execPath, [resolve(cliRoot, 'dist/bin.js'), '--json'], { encoding: 'utf8' }));
await output('contracts/cli-commands.json', cli);
const { openApi } = await sourceModule(apiRoot, 'src/openapi.ts');
const full = openApi({ origin: 'https://api.ultrametric.ai', issuer: 'https://auth.ultrametric.ai',
  authkit: { clientId: 'client_docs_fixture', issuer: 'https://auth.example.test' } });
const publicPaths = ['/status', '/auth/workspace', '/processes', '/processes/{id}', '/context/open', '/context/save', '/context/get'];
const spec = { ...full, paths: Object.fromEntries(publicPaths.map(path => [path, full.paths[path]])) };
if (Object.values(spec.paths).some(value => !value)) throw new Error('An expected API operation is missing.');
await output('contracts/openapi.json', spec);
const fixture = await connectFixture(apiRoot);
let mcp;
try { mcp = await fixture.client.listTools(); } finally { await fixture.client.close(); }
await output('contracts/mcp-tools.json', mcp);
const frontmatter = (title, description) => `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(description)}\n---\n\n`;
const banner = '> Internal documentation draft. Generated from pinned source; see the [verification scope](/index).\n\n';
const cell = text => String(text ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
let commands = frontmatter('CLI commands', 'Generated command names, arguments, and options for Ultrametric 0.4.1.') + banner;
commands += 'Package: `ultrametric@0.4.1`. Command discovery is local and does not log in, read company records, or execute leaf commands. Descriptions state effects; this reference is not an instruction to run every command.\n\n';
function walk(command, parent = '') {
  const name = `${parent} ${command.name}`.trim();
  commands += `## ${name}\n\n${command.description}\n\n\`\`\`text\n${name} ${command.usage}\n\`\`\`\n\n`;
  if (command.options.length) {
    commands += '| Option | Meaning | Choices | Required |\n| --- | --- | --- | --- |\n';
    for (const option of command.options) commands += `| \`${cell(option.flags)}\` | ${cell(option.description)} | ${cell(option.choices?.join(', '))} | ${option.required ? 'Yes' : 'No'} |\n`;
    commands += '\n';
  }
  for (const child of command.commands) walk(child, name);
}
walk(cli.data);
await writeFile('cli/commands.mdx', commands.trimEnd() + '\n');
let tools = frontmatter('MCP tools', 'Generated tool inputs and effects from the Ultrametric API source.') + banner;
tools += 'These tools were discovered through the actual server handler with a synthetic in-memory fixture. The test did not authenticate a hosted client. Context tools appear when the server has context operations configured.\n\n';
for (const tool of mcp.tools) {
  tools += `## ${tool.name}\n\n${tool.description}\n\nEffect annotation: **${tool.annotations?.readOnlyHint ? 'read-only' : 'writes context'}**.\n\n\`\`\`json\n${JSON.stringify(tool.inputSchema, null, 2)}\n\`\`\`\n\n`;
}
await writeFile('mcp/tools.mdx', tools.trimEnd() + '\n');
let operations = frontmatter('HTTP operations', 'Generated request contracts for process and context operations.') + banner;
operations += 'Source: the owning API’s `openApi()` exporter. The downloadable [OpenAPI contract](/contracts/openapi.json) retains success and error response schemas. Internal status and snapshot-preview endpoints are outside this product reference.\n\n';
for (const [path, methods] of Object.entries(spec.paths)) {
  for (const [method, operation] of Object.entries(methods)) {
    operations += `## ${operation.operationId}\n\n\`\`\`http\n${method.toUpperCase()} ${path}\n\`\`\`\n\n${operation.summary}\n\n`;
    const input = operation.requestBody?.content?.['application/json']?.schema ?? operation.parameters;
    if (input) operations += `\`\`\`json\n${JSON.stringify(input, null, 2)}\n\`\`\`\n\n`;
  }
}
await writeFile('api-reference/operations.mdx', operations.trimEnd() + '\n');
const generated = {};
for (const path of ['contracts/cli-commands.json', 'contracts/openapi.json', 'contracts/mcp-tools.json', 'cli/commands.mdx', 'mcp/tools.mdx', 'api-reference/operations.mdx']) {
  generated[path] = createHash('sha256').update(await readFile(path)).digest('hex');
}
await output('contracts/generated.json', { schemaVersion: 1, files: generated });
console.log(`Generated ${mcp.tools.length} MCP tools, ${Object.keys(spec.paths).length} HTTP paths, and the CLI command tree.`);

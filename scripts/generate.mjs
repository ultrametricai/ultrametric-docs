import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { connectFixture } from './fixture.mjs';
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
const fixture = await connectFixture(apiRoot);
let mcp;
try { mcp = await fixture.client.listTools(); } finally { await fixture.client.close(); }
await output('contracts/mcp-tools.json', mcp);
const frontmatter = (title, description) => `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(description)}\n---\n\n`;
const cell = text => String(text ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
const code = value => `\`${cell(typeof value === 'string' ? value : JSON.stringify(value))}\``;
function schemaType(schema) {
  const alternatives = schema.anyOf ?? schema.oneOf;
  if (alternatives) return [...new Set(alternatives.map(schemaType))].join(' or ');
  if (schema.$ref) return 'JSON value';
  return Array.isArray(schema.type) ? schema.type.join(' or ') : schema.type ?? 'JSON value';
}
function constraints(schema) {
  const notes = [];
  if (schema.description) notes.push(cell(schema.description));
  if (schema.enum) notes.push(schema.enum.map(code).join(', '));
  if ('const' in schema) notes.push(`Value: ${code(schema.const)}`);
  if (schema.format) notes.push(`Format: ${code(schema.format)}`);
  for (const [key, label] of [['minimum', 'Minimum'], ['maximum', 'Maximum'], ['minLength', 'Minimum characters'], ['maxLength', 'Maximum characters'], ['maxItems', 'Maximum items']]) {
    if (key in schema) notes.push(`${label}: ${schema[key]}`);
  }
  for (const alternative of schema.anyOf ?? []) {
    const details = constraints(alternative);
    if (details) notes.push(details);
  }
  if ('default' in schema) notes.push(`Default: ${code(schema.default === '' ? '""' : schema.default)}`);
  return notes.join('; ');
}
function inputTable(schema) {
  let content = '| Field | Type | Required | Values and limits |\n| --- | --- | --- | --- |\n';
  for (const [name, property] of Object.entries(schema.properties ?? {})) {
    content += `| ${code(name)} | ${cell(schemaType(property))} | ${schema.required?.includes(name) ? 'Yes' : 'No'} | ${constraints(property)} |\n`;
  }
  content += '\n';
  for (const [name, property] of Object.entries(schema.properties ?? {})) {
    if (property.properties) content += `### ${name}\n\n${inputTable(property)}`;
    for (const variant of property.items?.oneOf ?? []) {
      content += `### ${name}: ${variant.properties?.kind?.const ?? 'item'}\n\n${inputTable(variant)}`;
    }
  }
  return content;
}
let commands = frontmatter('CLI commands', 'Commands, arguments, and options for Ultrametric 0.4.1.');
commands += 'Use `--json` for structured output and `--help` on any command for its usage. Start with [installation and sign-in](/cli/install), or follow the guide to [start a run and save progress](/guides/save-progress).\n\n';
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
let tools = frontmatter('MCP tools', 'Find processes, read instructions, and keep progress through your agent.');
tools += 'After [connecting your agent](/mcp/connect), use `status` to check the account and `list_processes` to find work. Use `get_process` to read instructions, or `open_process` to start a run that can keep progress.\n\n';
tools += 'The [complete MCP schemas](/contracts/mcp-tools.json) include exact input constraints and output formats. For saving and resuming, follow [save progress](/guides/save-progress) and [resume work](/guides/resume-work).\n\n';
tools += '| Tool | Effect |\n| --- | --- |\n';
for (const tool of mcp.tools) tools += `| ${code(tool.name)} | ${tool.annotations?.readOnlyHint ? 'Read only' : 'Writes saved context'} |\n`;
tools += '\n';
for (const tool of mcp.tools) {
  tools += `## ${tool.name}\n\n${tool.description}\n\n${inputTable(tool.inputSchema)}`;
}
await writeFile('mcp/tools.mdx', tools.trimEnd() + '\n');
const generated = {};
for (const path of ['contracts/cli-commands.json', 'contracts/mcp-tools.json', 'cli/commands.mdx', 'mcp/tools.mdx']) {
  generated[path] = createHash('sha256').update(await readFile(path)).digest('hex');
}
await output('contracts/generated.json', { schemaVersion: 1, files: generated });
console.log(`Generated ${mcp.tools.length} MCP tools and the CLI command tree.`);

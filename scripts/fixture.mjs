import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export async function sourceModule(root, path) {
  return import(pathToFileURL(resolve(root, path)).href);
}

export async function connectFixture(apiRoot) {
  const require = createRequire(resolve(apiRoot, 'package.json'));
  const { Client, StreamableHTTPClientTransport } = require('@modelcontextprotocol/client');
  const { processMcp } = await sourceModule(apiRoot, 'src/mcp.ts');
  const { createProcessService } = await sourceModule(apiRoot, 'src/process.ts');
  const { requestLog } = await sourceModule(apiRoot, 'src/logging.ts');
  const document = {
    id: 'docs-read-only-fixture', version: 1, name: 'Review a synthetic project brief',
    description: 'Documentation test fixture; not a published process.',
    instructions: 'Summarize the supplied synthetic project brief. Preserve unknowns. Do not save records or take external actions.',
    resultSchema: { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'], additionalProperties: false },
  };
  const { instructions, resultSchema, ...summary } = document;
  const store = {
    list: async (after, limit, allowed) => allowed.includes(document.id) && after < document.id ? [summary].slice(0, limit) : [],
    get: async (id, version) => id === document.id && (version === undefined || version === 1) ? document : null,
  };
  const service = createProcessService(store, async () => new Set([document.id]));
  const rejectWrite = async () => { throw new Error('Writes are disabled in documentation verification.'); };
  const handler = processMcp(service, requestLog(new Request('https://docs-fixture.invalid/mcp')), async () => ({
    origin: 'https://docs-fixture.invalid', environment: 'docs-fixture',
    user: { id: 'docs-fixture', email: null, emailVerified: null },
    selectedOrganizationId: null, internalUser: false, process: null,
  }), { open: rejectWrite, save: rejectWrite, get: async () => { throw new Error('Private context reads are disabled in this fixture.'); } });
  const client = new Client({ name: 'ultrametric-docs-verifier', version: '0.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL('https://docs-fixture.invalid/mcp'), {
    fetch: async (input, init) => {
      const request = new Request(input, init);
      if (new URL(request.url).origin !== 'https://docs-fixture.invalid') throw new Error('External requests are disabled.');
      return handler.fetch(request);
    },
  });
  await client.connect(transport);
  return { client, service, document };
}

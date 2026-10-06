import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

const [schemaPath, apiRoot] = process.argv.slice(2);
if (!schemaPath || !apiRoot) throw new Error('Usage: node scripts/verify-mintlify-schema.mjs /path/to/mintlify-schema.json /path/to/prepared-api');
const require = createRequire(resolve(apiRoot, 'package.json'));
const { Ajv, addFormats } = require('@modelcontextprotocol/client/validators/ajv');
// The published schema contains identity escapes that require non-Unicode regex mode.
const ajv = new Ajv({ strict: false, allErrors: true, unicodeRegExp: false });
addFormats(ajv);
const validate = ajv.compile(JSON.parse(await readFile(schemaPath, 'utf8')));
if (!validate(JSON.parse(await readFile('docs.json', 'utf8')))) {
  console.error(JSON.stringify(validate.errors, null, 2));
  process.exitCode = 1;
} else {
  console.log('PASS: docs.json validates against the supplied Mintlify JSON Schema, including URI formats. No renderer was run.');
}

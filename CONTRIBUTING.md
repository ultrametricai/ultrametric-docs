# Maintain contracts and examples

`contracts/provenance.json` records public release observations and limits of verification. Updating that file requires reviewing the new contract. A version number alone does not establish compatibility or deployment. Private repository locations, source pins, build evidence, and per-file inventories stay outside this repository.

## Prepare sources

Use isolated, reviewed source copies outside the docs repository. The CLI exporter needs the source's `dist/bin.js`, built with matching dependencies. The API exporter needs its dependencies and existing UI resource because MCP registration imports it. No UI rendering is required for tool discovery.

Keep the reviewed source-pin manifest outside this repository. It contains `cli.sourceFingerprint`, `cli.buildArtifacts`, `api.sourceFingerprint`, and `mcp.uiFixtureSha256`. The fingerprint helper in `scripts/source-integrity.mjs` hashes source inputs. CLI build-artifact keys are filenames relative to its build directory. Verify the owning revisions and supporting builds before recording hashes; do not publish that private manifest.

Do not rebuild shared worktrees or change another task's ports. Do not copy environment files, credentials, private records, or process content. Normal documentation checks use the checked-in generated files and need neither source checkout.

## Generate references

```sh
npm run generate -- /path/to/prepared-cli /path/to/prepared-api /path/to/private-source-pins.json
npm run verify:examples -- /path/to/prepared-cli /path/to/prepared-api
npm run check
```

The paths are author-supplied local source directories. Generation checks pinned source hashes, invokes the CLI's JSON command-discovery entry point, calls the API's `openApi()` exporter, and discovers MCP tools through the real handler and SDK transport with synthetic data.

Generated files:

- `contracts/cli-commands.json` and `cli/commands.mdx`
- `contracts/openapi.json` and `api-reference/operations.mdx`
- `contracts/mcp-tools.json` and `mcp/tools.mdx`

`contracts/generated.json` records their hashes so the offline check detects manual edits. For an optional configuration-schema check, save the current official `https://mintlify.com/docs.json` schema outside tracked content and run `node scripts/verify-mintlify-schema.mjs /path/to/schema.json /path/to/prepared-api`. This reuses the source checkout's installed validator and does not install Mintlify.

The HTTP exporter selects seven product paths. Staff-only and UI snapshot-preview operations remain outside the reference. It retains the owning schemas and does not invent or relax fields. Compare the selected contract with the target environment's public `/openapi.json` before publication. Preserve errors and input bounds.

`verify:examples` calls only CLI help/discovery, `init --dry-run`, and an invalid-option check in a temporary directory, then performs process list/get through the API service, MCP SDK, and CLI transport with one synthetic record. Network access is disabled for in-process fixture calls. Context writes throw if called. It does not validate OAuth, a database, hosted private data, real process quality, client UI, or a marketplace installation.

## Review content

Retrieve IDs, versions, guide instructions, and result schemas at use time. Do not copy process guides into this repository or infer universal availability from a test account. Source instructions identify public `ultrametricai/ultrametric` as the process origin; private additions are versioned API data.

Mark new capabilities as source-inspected, locally tested, publicly observed, or pending. Add platform installation pages only after finding the actual manifest and checking its installation path. A CLI-installed skill and an MCP connection do not establish marketplace distribution.

Use real task inputs, output fields, and failure recovery. Describe user review and external effects separately from saving. Keep drafts and unknown facts visible.

## Preview and publish later

The `docs.json` structure follows [Mintlify's configuration reference](https://www.mintlify.com/docs/organize/settings). All pages use ordinary Markdown within MDX. Install/preview commands are deferred until Mintlify installation is authorized; use the then-current official CLI instructions. An offline structure check is not a successful Mintlify build.

Before deploying the site, review the draft markers, run the official Mintlify validation and preview, verify the chosen hosted client, and confirm the repo/domain/plan. Account connection, DNS, deployment, and paid actions require separate authorization. A documentation PR can be reviewed with the current validation limits stated explicitly.

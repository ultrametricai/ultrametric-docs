# Contribute to the documentation

Write for a person using Ultrametric through their agent. Describe the task, inputs, commands or tools, expected result, and recovery steps. Put a limitation where it affects the user's next action.

Keep review notes, test transcripts, release coordination, and source audits outside this repository. Do not add placeholders for unavailable integrations. Document a setup flow only when its commands or connection contract exist.

## Check a change

```sh
npm run check
```

The check covers navigation, local links, generated-file hashes, and reader-facing content rules. It does not render the site. Use the current [Mintlify CLI instructions](https://www.mintlify.com/docs/cli/install) for a local preview when the CLI is available.

## Maintain references

The CLI, MCP, and HTTP references are generated from their owning implementations. Update the generator as well as the source metadata when changing a reference. Process guides remain in the service; do not copy the catalog here.

Maintainers with source access can run:

```sh
npm run generate -- /path/to/prepared-cli /path/to/prepared-api /path/to/private-source-pins.json
npm run verify:examples -- /path/to/prepared-cli /path/to/prepared-api
```

Keep the reviewed source-pin file and prepared source copies outside this repository. The generator checks source and build fingerprints before exporting contracts. The example verifier uses synthetic data and blocks external requests and context writes.

`contracts/generated.json` records the generated-file hashes. Full HTTP and MCP schemas remain available for users who need exact input and output formats.

## Site content

`.mintignore` excludes repository maintenance files from the published site. Every MDX page must be reachable through `docs.json`. Keep normal product draft states, such as an unfinished document, distinct from editorial notes about the documentation itself.

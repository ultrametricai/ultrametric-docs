# ultrametric-docs
Documentation for Ultrametric CLI, MCP, and more

## Documentation draft

This repository contains 18 Mintlify-ready MDX pages for CLI, MCP, process guidance, and company context. Start with `index.mdx` and `quickstart.mdx`. The root `docs.json` defines navigation and styling.

The reference targets the published `ultrametric@0.4.1` CLI. HTTP schemas are generated from the owning API and compared with its public contract. MCP tools are discovered through the actual server handler with synthetic data. The docs do not maintain a separate process catalog.

## Check locally

```sh
npm run check
```

This dependency-free command runs offline. It checks navigation, local links, draft labels, generated-content hashes, and selected contract invariants. See [CONTRIBUTING.md](CONTRIBUTING.md) for regeneration and synthetic example verification. [Provenance](contracts/provenance.json) records public release metadata and the scope of verification.

The Mintlify configuration passes its official JSON Schema. Mintlify rendering, real OAuth/client use, and marketplace plugin installation remain unverified. No software installation is required for the offline check.

## Publication

The site is a draft. Review its markers and remaining validation before publication. No Mintlify account connection, domain binding, or deployment is configured here. Publication and installation require separate authorization.

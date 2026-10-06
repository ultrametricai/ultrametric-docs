# Documentation rules

Write for people using Ultrametric through their agent. Lead with the task and show actual commands, inputs, outputs, and recovery steps.

- Public pages contain product guidance. Keep internal review notes, source audits, release coordination, and test evidence outside the repository.
- Document supported behavior from authoritative commands and service contracts. Omit speculative integrations and placeholder setup pages.
- Describe limits as concrete behavior that helps the reader choose the next step.
- Preserve the distinction between retrieving guidance, recording progress, user approval, and external actions.
- Generate CLI, MCP, and HTTP references from the owning implementations. Change generation templates when changing reference presentation.
- Keep process definitions in their authoritative source and retrieve the available catalog through the service.
- Do not include credentials, private records, internal dashboards, or private configuration.
- Run `npm run check` after changes. Use synthetic data for example verification. Report test limits in the PR, not in user guides.
- Preserve user edits and obtain target-specific authorization before pushing, merging, connecting a service, or deploying.

# Documentation rules

This repository is a local documentation draft. Publication is a separate action.

- Use public release metadata in `contracts/provenance.json` and the maintainer's external source pins for regeneration. Distinguish released packages, public contract observations, local fixture tests, and untested client behavior.
- Public `ultrametricai/ultrametric` owns process definitions. The API assembles and serves guides and schemas. Do not maintain a process catalog here.
- Generate command, tool, and HTTP references from the owning implementations. Do not edit generated files by hand.
- A retrieved guide, a recorded run, a saved update, a reported approval, and an external result are different events. Describe the actual effect.
- Keep credentials, private records, internal dashboards, and raw process content out of this repository. Use synthetic fixtures for validation.
- Use short, specific instructions. Preserve unknowns and access limits. Do not advertise a platform without evidence.
- Run `npm run check` after changes. Regeneration requires pinned, prepared source checkouts; follow `CONTRIBUTING.md`.
- Store dated research, validation logs, and handoffs outside this repository. Maintained contracts and checks must work without local working notes.
- Do not publish, push, create a remote repository, connect a Mintlify account, change DNS, or deploy without target-specific authorization.

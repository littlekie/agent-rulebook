# Working on Agent Rulebook

Agent Rulebook initializes repository instructions and review configuration. It does
not run models, approve PRs, configure remote protections or merge changes.

- Read `docs/architecture.md` before changing package boundaries or configuration.
- Runtime code lives in `src/agent_rulebook/`; bundled templates live under `data/`.
  The English and Chinese templates express the same risk and review policy.
- Preserve existing target files. Keep preview read-only, creation exclusive,
  and rollback limited to files this invocation wrote and nobody else changed.
- Config is data: parse JSON, never execute target code during init or doctor.
- Additive configuration must preserve default risk floors and required checks.
- File-write, policy, review instruction and CI changes require independent
  review; report evidence and unresolved issues. Never claim a local doctor
  result establishes remote enforcement or permission to merge.
- Run `python -m unittest discover -s tests -v` and
  `python scripts/check_source.py`. Packaging changes also require building and
  installing the wheel in an isolated environment and running its CLI outside
  this checkout. See `CONTRIBUTING.md`.
- Do not include private project profiles, machine paths, credentials or user
  artifacts in source or distributions. Publish only with explicit authorization.

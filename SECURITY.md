# Security

Agent Rulebook writes into a user-selected local directory. Use trusted local
checkouts, review the preview and preserve normal version-control backups. See
docs/architecture.md for file-write and rollback boundaries.

Generated instructions are guidance. The evaluator is not an authentication service;
never accept PR-supplied JSON as trusted evidence. Commands should run in appropriately
isolated workers. The initializer and doctor do not execute target commands.

Only the latest development version is currently maintained. No hosted service or
security response SLA is provided.

## Reporting a vulnerability

Avoid publishing credentials or sensitive exploit details in a public issue. If the
repository's Security tab offers private vulnerability reporting, use that channel.
Otherwise contact the repository owner through a private channel they publish. If no
private channel is available, open a minimal issue requesting one without exploit
details. Maintainers should enable private reporting before the first public release;
this source file does not claim that a GitHub setting is already enabled.

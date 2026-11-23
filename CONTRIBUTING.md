# Contributing

Use Node.js 22+ and npm with the checked-in package-lock.json. Runtime code is
TypeScript; tests use the built-in Node test runner. The installed CLI and generated
helpers bundle their runtime code. TypeScript, esbuild and Node type definitions are
build dependencies; cross-spawn supports Windows command shims and is bundled with
its transitive license notices.

```sh
npm ci --ignore-scripts
npm test
npm run check
npm run test:package
```

Read AGENTS.md, docs/architecture.md and docs/migration-v0.2.md before boundary changes.
Preserve read-only preview, exclusive creation, existing-file protection, cumulative
risk requirements and honest doctor results. Keep templates aligned across languages.

Tests use temporary repositories and synthetic evidence, never real approvals.
The Windows command-shim case runs on Windows; symlink tests report a skip if the
host lacks the required privilege. Report actual results and limitations.

The package smoke test packs an allowlist of files, installs the tarball offline with
lifecycle scripts disabled, executes npm's CLI entry outside the source checkout and
runs the generated helpers. This catches source-only installations and missing assets.

For pull requests, describe the problem, resulting behavior, compatibility, risk,
executed checks and unresolved gaps. Filesystem writes, policy, instructions and CI
require independent review against requirements and the actual diff. Fix supported
blockers and recheck affected behavior. Publish only within maintainer authorization.

Contributions use MIT; preserve third-party notices and keep private project material
out of fixtures and distributions. See docs/releasing.md for registry publication.

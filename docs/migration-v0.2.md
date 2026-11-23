# Migrating from the Python CLI

Version 0.2 replaces the Python distribution with a TypeScript CLI running on Node.js 22+.
The command name, configuration fields, exit codes, default check matrix and risk semantics remain.
Reversed character ranges such as `[z-a!]` are now explicitly invalid. Rewrite these
patterns as ordinary ranges or explicit alternatives before migration; the CLI and
evaluator reject them rather than silently interpreting a lower risk floor.
The npm package is scoped as `@littlekie/agent-rulebook`; the unscoped package is unrelated.

Existing repositories are not rewritten automatically. Create a temporary baseline with
the same configuration and language, compare it with your repository, and integrate changes
in a reviewed branch. Keep existing commands, policies and project instructions.
Replace `ci/quality_gate.py` with `ci/quality-gate.mjs` and `ci/run_check.py` with
`ci/run-check.cjs`, then update callers from Python to Node. Remove the old helpers
only after no callers remain. Keep inventory and template hashes with the reviewed changes.
A direct reinitialization of an old baseline reports conflicts; there is no force upgrade.

The generated helpers are standalone bundles: they require Node.js but neither Python
nor npm dependencies in the target project. Target projects can use any language.
Actual project commands remain explicitly configured argument arrays.

L2 migration review: filesystem protection, risk floors, approval requirements and evidence
trust boundaries must stay intact. Test the installed npm tarball and generated helpers
outside the source checkout, including Windows command shims. Roll back via the target
repository's version history if integration fails. No deployed data formats are migrated.

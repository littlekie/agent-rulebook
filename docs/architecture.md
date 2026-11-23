# Architecture and decisions

Agent Rulebook is a local initializer whose initialization makes no network calls.
Its npm tarball bundles runtime code; Git-based installation builds via npm prepare.
The current release installs a baseline into an existing repository. It does not
implement a hosted review service or manage GitHub permissions.

## Module boundaries

`cli` coordinates `templates` and `filesystem` in TypeScript. `templates` reads package resources,
validates JSON configuration and calls the policy validator. `filesystem` owns
preview, conflict detection and exclusive file creation. `policy` owns deterministic evaluation, using a bounded fnmatch-style matcher.
`json` validates duplicate keys before use. `runner` owns explicit command execution.
None imports the CLI. esbuild bundles the CLI and the quality-gate/run-check entrypoints;
generated workers require Node.js 22+ without installing this package in the target.
The command worker bundles cross-spawn for Windows shims and carries dependency licenses.
See migration-v0.2.md for the approved runtime change and existing-project integration.

The target owns all generated files after initialization. There is no background
sync, update daemon, central account or implicit migration. The inventory records
the initial template hashes; it is not a signature or evidence of later integrity.

## Configuration decision

Use explicit JSON rather than executable configuration or autodetected commands.
A project can add command mappings, high-risk paths and required checks. Additional
checks propagate to higher risk levels. The initializer preserves default risk
floors and check requirements. Direct changes to an installed policy remain
possible, but require review under the generated engineering policy.

This favors auditable behavior over automatic stack detection. A command's presence
does not prove that it checks the intended behavior. `doctor` validates structure
only; trusted CI and reviewers establish execution evidence.

## File creation contract

Preview creates no files or directories. Existing differing AGENTS.md and REVIEW.md
produce integration proposals; their original bytes are preserved. Other differing
files block the entire plan. Identical initialization is a no-op, including mtimes.
Target paths containing symlinks are rejected; the user-selected root is resolved
once to support ordinary platform aliases such as a temporary directory.

Apply rechecks the plan and creates files exclusively. On a caught write failure,
rollback removes only files with the identity and contents this invocation wrote.
Concurrent edits are retained and reported. Empty directories may remain.
This is not a filesystem transaction: process termination, power loss and hostile
concurrent directory replacement are outside the guarantee. Work in a trusted
local checkout and inspect partial output after interruption. Re-running with the
same inputs can complete unchanged partial output; there is no force-overwrite mode.

## Review and enforcement boundary

L0/L1/L2 express increasing risk. Policy evaluation combines path floors, declared
risk and independent review, and can only increase the effective level. L1/L2
require complete independent review; L2 also requires current authorized approval.
Every check is tied to repository, PR, head, base, tested commit and policy digest.

The evaluator assumes its inputs are authentic. A separate trusted controller must
verify identities, source versions, complete diffs and evidence provenance before
calling it. That controller, model adapter, protected final check and merge-queue
adapter are not implemented in this release. Local `eligible` is not merge authority.
The generated workflow is an inactive example for isolated checks only.

## Validation

Behavior tests cover file protection, failure recovery, JSON validation, cumulative
configuration, risk escalation, stale evidence and command execution. TypeScript runs
in strict mode. npm package tests install a packed tarball offline with scripts disabled,
then exercise npm exec and generated workers outside the checkout. The CI matrix covers
Node.js 22/24 across Linux, Windows and macOS. A configured workflow is not a completed run.

The npm distribution allowlist excludes source tests and local artifacts. Generated
helpers bundle any required runtime library; their third-party notices are appended at
build time. This adds build dependencies, not installation steps in target repositories.

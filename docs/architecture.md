# Architecture and decisions

Agent Rulebook is a local initializer with no network access or runtime dependencies.
The first release installs a baseline into an existing repository. It does not
implement a hosted review service or manage GitHub permissions.

## Module boundaries

`cli` coordinates `templates` and `filesystem`. `templates` reads package resources,
validates JSON configuration and calls the policy validator. `filesystem` owns
preview, conflict detection and exclusive file creation. `policy` is a standalone
deterministic evaluator; `runner` is a standalone command worker. Neither imports
the CLI. The last two modules are copied into target repositories so consumers
can run them without installing Agent Rulebook there.

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

Behavior tests cover non-destructive initialization, failure recovery, configuration
composition, risk escalation and stale/missing evidence. Packaging validation builds
both distribution types and installs the wheel in an isolated environment, then
executes its console command outside the source checkout. CI exercises supported
Python versions on Linux, Windows and macOS; configured CI is not a claim that those
remote runs have already passed.

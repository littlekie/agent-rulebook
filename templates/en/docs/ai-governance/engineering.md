# AI engineering policy

This policy covers implementation, fixes, refactoring and review. Follow applicable
directory rules; explicit current-task requirements take priority. Resolve conflicts
that change business behavior, security or compatibility before dependent work.
Proceed with already authorized work and ordinary implementation choices.

## 1. Establish scope

Read the target module, direct callers, tests and relevant documentation. Identify
reusable implementations. Confirm the toolchain and required checks from package,
lock and CI files. Inspect the working tree and preserve others' changes.
State the behavior to change, acceptance criteria, compatibility needs and risk
level. For complex work, briefly describe affected boundaries and verification.
Reassess risk when scope expands. Use existing conventions for routine omissions;
resolve ambiguities about permissions, money and data meaning before relying on them.

Done when the change, verification, affected modules and review level are clear.

## 2. Keep implementation focused

Connect every change to the request, defect or necessary verification. Reuse existing
patterns after checking their suitability. Keep business rules in their owning module;
add abstractions for demonstrated duplication or known variation. Prefer clear names,
direct control flow and boundary validation with supported type constraints.
Explain necessary assertions or type escapes. Comments explain reasons and constraints;
update documentation when behavior changes. Leave unrelated refactoring for other work.

## 3. Correct behavior and failures

Check empty, invalid, boundary and repeated inputs and important failure paths.
Do not conceal invalid data with defaults or turn errors into success. Handle errors
at an appropriate layer with useful context; distinguish recoverable failures.
Use existing timeout, cancellation and cleanup mechanisms for external operations.
Bound retries and confirm idempotency. Define consistency for concurrent or multistep
writes; use suitable transactions or concurrency control. Check callers and historical
data when changing public APIs, configuration or persistent formats; explain migrations.

## 4. Dependencies, security and performance

Check existing capabilities before adding dependencies. Explain necessary additions
and update the existing lockfile without unrelated upgrades. Treat external input as
untrusted; enforce authorization and resource ownership at the trusted server boundary.
Use parameterized queries, output encoding and safe paths. Keep secrets and personal
data out of code, fixtures and logs; use established secret configuration.
Plan migrations for existing data, repeat execution and recovery. Explain irreversible
steps within the task's authorization. Check hot paths for unbounded queries, repeated
requests, per-item database access and unbounded caches. Optimize measured bottlenecks
and verify behavior is preserved.

## 5. Verify behavior

Derive expectations from section 7, covering normal behavior, critical boundaries and
failures. Add a regression for reproducible bugs and, where possible, observe it fail
before the fix and pass after it. Record alternative evidence and limits when needed.
Control time, randomness and external services; mock external boundaries rather than
business logic. Scale verification to risk, including permissions, concurrency and
data migrations. Run relevant tests and required format, lint, type and build checks;
cover callers of shared changes. Preserve valid tests and assertions. Change obsolete
tests only with changed requirements and an explanation. Distinguish new failures,
existing failures and environment limitations; fix new failures before delivery.

Done when the actual results support the change and uncovered behavior is explicit.

## 6. Review the final diff and deliver

Inspect the final diff for scope, debugging leftovers, unintended files, types,
exceptions, callers and security boundaries. Keep examples and migration guidance
consistent with the implementation. Complete the section 9 review. Repeat affected
verification when later edits invalidate it. Implementation completion and permission
to merge or publish are separate states. Follow existing task authorization for
commits, pushes, deployment and production actions.

Report: change and risk rationale; acceptance-to-test evidence and actual check
results; independent review and unresolved findings; decisions needing human judgment
(or none); delivery status and any migration, release and recovery steps.

## 7. Establish business expectations first

Use confirmed requirements, domain documents, contracts and acceptance cases as rule
sources. Existing code helps explain behavior but does not prove intended behavior.
Record affected rule identifiers, preconditions, action, expected results and state
after failure. Reuse the project's existing format; simple tasks need no new system.
For amounts, quantities, transitions and ownership, define units, precision, valid
ranges and invariants. Unconfirmed critical assumptions block release; obtain evidence.
Reuse confirmed unchanged rules without requesting approval again. Present only new
or changed critical rules and their effects for human judgment.

Test expectations must come from rules, fixed examples or independent calculations,
not from calling the implementation. For funds, inventory and multistep writes, check
duplicates, concurrent conflicts, partial failure and recovery. Use property tests,
database constraints or state-machine tests when useful. Resolve rule/code conflicts
against their sources; update rules and tests explicitly when requirements change.

Done when each affected rule has verification or an explicit gap and every critical
assumption has evidence or is marked as blocking release.

## 8. Respect architecture boundaries

Follow existing architecture and decisions. Map affected responsibilities, dependencies
and data ownership before introducing layers or frameworks. Keep dependency direction,
check cycles, use public interfaces and write data through its owner. Use established
adapters for external services, databases and messaging; preserve infrastructure
separation where the existing architecture defines it.

For shared contracts, events and data formats, check producers, consumers and stored
data with suitable compatibility tests. Automate real dependency and contract rules
without freezing accidental implementation details. Core design changes need a short
decision record: problem, constraints, recommendation, alternatives, ownership,
dependencies, failure recovery and migration. Resolve key uncertainties with small
prototypes, integration tests or measurements. Humans judge unresolved responsibility,
consistency and irreversible decisions; a passing build does not establish architecture.

Done when affected boundaries have evidence and core decisions are reviewable.

## 9. Risk and release

Take the highest applicable risk across the whole change. Few lines, high coverage
or splitting a change into small commits do not lower its actual risk.

| Level | Scope | Verification and release |
| --- | --- | --- |
| L0 | Text, local style or documentation with no business, contract or security effect | Relevant static or visual checks and final self-review. Automatic merge only under existing project authorization. |
| L1 | Ordinary behavior or fixes within confirmed rules and architecture | Behavioral tests, relevant checks and independent review. No unresolved blockers; automatic merge only if the project permits it. |
| L2 | Funds, authorization, sensitive data, persistent migration, critical concurrency, breaking APIs, core architecture or weakened gates | L1 plus risk-specific evidence and applicable migration/release/recovery plans. Human confirmation of critical rules, design and residual risk before release; do not repeat existing confirmation when scope is unchanged. |

L1/L2 use a review process independent of implementation. Give the reviewer requirement
sources, acceptance rules and final diff, not only the implementer's account. Inspect
missing rules, failure/concurrency paths, boundaries, compatibility and weakened gates.
Findings need location, trigger, impact and evidence, with a minimal reproduction when
possible. Supported correctness, security, consistency or compatibility defects and
missing critical acceptance/design evidence block release. Style preferences do not.

Fix findings and verify affected behavior against the final version. If independent
review is unavailable, mark the change pending targeted human review; self-review is
not independent review. Agreement among models does not replace acceptance evidence.
Humans handle unresolved business meaning, core design and required exceptions. Finish
independent authorized work while waiting. Missing checks or L2 confirmation keep work
pending regardless of reviewer availability. Merge and deployment have separate
authorization. Use staged rollout, flags and observation where appropriate; data
recovery may require more than a code rollback.

## 10. Quality gate integration

Before changing CI, automated merge, risk classification or independent AI review,
read `docs/ai-governance/SETUP.md`. Active local configuration is `ci/commands.json`
and `ci/quality-policy.json`. Generated examples remain inactive until explicitly
integrated. Existing project standards and quality gates take priority.

This policy is an instruction set, not configured enforcement. Mark acceptance,
architecture and gate changes separately in the diff and review at their actual risk.
Protect required checks and approval rules against self-modification by the PR.
Report missing gates and their release impact; implement tooling only within task
scope. Coverage and AI conclusions assist judgment but cannot alone permit release.

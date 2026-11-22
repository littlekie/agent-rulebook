# Connect the baseline to your project

Initialization creates local files only. Model review, security services, authenticated
evidence collection, GitHub protection and automatic merging are **not configured**.
The bundled Python helpers require Python 3.10+; the target project may use any stack.

## 1. Integrate instructions and commands

If proposal files exist in this directory, merge applicable guidance into your existing
AGENTS.md / REVIEW.md, preserving project rules, then remove the integrated proposals.
Configure your agent to load the root instructions through its supported mechanism.
Generating a file does not prove a particular agent loaded it.

Active configuration lives at `ci/commands.json` and `ci/quality-policy.json`.
Fill command entries with real project checks, each a list of argument arrays:

```json
{
  "setup": [["npm", "ci"]],
  "unit": [["npm", "test", "--", "--runInBand"]]
}
```

This example is not a complete configuration and must match your toolchain. Commands
run from the current working directory, so invoke the worker from the project root.
Use real behavioral, architecture and security checks. A dummy success command does
not establish coverage. If a check does not apply, review and document a policy change
rather than substituting a no-op. `null` checks fail as UNCONFIGURED. A trusted platform
adapter may supply evidence for checks that cannot be performed by local commands.

Run `agent-rulebook doctor .` to find local configuration gaps. It never executes
commands or verifies remote enforcement. Once reviewed, explicitly run required checks
in an appropriate environment, for example `python ci/run_check.py unit`.

## 2. Start with ordinary CI and review reports

Adapt `ci/templates/github-checks.yml.example` to your existing CI, configure pinned
runtimes, and only then add an active workflow. The example runs a full check matrix
and a summary. It is not a trusted final release gate. Execute untrusted PR code in
isolated workers without model keys, production secrets or merge credentials.

Select a review provider separately. Use `ci/ai-review-prompt.md` in an independent
review context and inspect actual historical or current PRs for missed issues, false
positives and missing context. Default to one independent code reviewer; add focused
security review for concrete risks. No model service is included in the CLI.

## 3. Add a trusted controller before automatic release

The standalone `ci/quality_gate.py` checks logical relationships in supplied JSON.
It does **not** authenticate evidence. Anyone can fabricate local eligible output.
A controller must load approved policy, commands, instructions and gate code from
outside the candidate PR; verify platform identities, complete diffs, check issuers
and run versions; and collect review/approval evidence from authenticated sources.
PR artifacts and self-reported success are not trusted evidence.

Every evidence item is bound to repository, PR number, head SHA, base SHA, actual tested
SHA and approved policy byte digest. New context invalidates prior evidence. L2 approval
must be from an authorized independent human for the relevant current context. Recheck
the latest revision before signing a result. See the project's evaluator source and
tests when implementing an adapter; no controller is shipped here.

Protect the final required check and bind it to its intended issuer. Protect policy
and workflow changes and inspect bypass permissions. Only explicit success satisfies
the evaluator; missing, skipped, stale or failed evidence holds the change. Keep code
execution, model review, result signing and merging in separate permission boundaries.

Merge authorization is a repository decision. Stage any automation from L0 to L1,
keeping human confirmation for L2. The example listens for merge_group, but the
evaluator models a single PR: merge queues also need a controller that validates all
constituent PRs and the tested group. Leave queue enforcement pending until implemented.

## 4. Prove the integration

Exercise forged results, changed gate code, renamed high-risk files, incomplete diffs,
skipped checks, model timeout, partial context, new commits, changed base revisions,
unauthorized approvals and pushes after result signing. Unit tests of this evaluator
do not prove platform identity, isolation or race handling. Record those integration
results before enabling automatic release. Data migrations need data recovery plans.

`quality_gate.py` takes --policy, --context and --evidence paths. Exit codes are 0 for
eligible under supplied evidence, 1 for hold and 2 for invalid input; 0 grants no merge
permission. Generated helpers and templates are provided under the adjacent LICENSE.

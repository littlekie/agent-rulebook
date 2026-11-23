# Project configuration

Pass a UTF-8 JSON file using `--config path/to/project.json`. The file is read as data;
initialization and doctor never execute it or its command entries. Unknown top-level
fields and duplicate JSON keys are rejected before writing. Command paths are resolved
by the command worker when explicitly invoked, from its current working directory.

```json
{
  "name": "example-service",
  "commands": {
    "setup": [["npm", "ci"]],
    "lint": [["npm", "run", "lint"]],
    "contract-tests": [["npm", "run", "test:contracts"]]
  },
  "high_risk_paths": ["src/identity/*"],
  "required_checks": {"L1": ["contract-tests"]}
}
```

| Field | Meaning |
| --- | --- |
| name | Optional profile label: 1–64 ASCII letters, numbers, dots, underscores or hyphens; first character alphanumeric. Default custom. |
| commands | Optional nonempty object mapping check names to null or nonempty lists of argument arrays. Supplied names replace their default mappings; omitted names retain defaults. |
| high_risk_paths | Optional additional relative POSIX glob patterns. Defaults remain in place. |
| required_checks | Optional L0/L1/L2 keys containing nonempty lists of unique additional check names. Requirements also propagate to higher levels. |

An empty object selects defaults with the profile label custom. No config file selects
the default profile. Unknown check names are allowed for custom checks; misspelled
required check names remain unconfigured and are reported by doctor. A configured
command that is not required by any level is not automatically run.

Paths use fnmatch-style semantics: case-sensitive matching against the entire
repository-relative POSIX string; `*` can match `/`. For example `src/identity/*` covers
descendants, not just immediate children. There is no negation or regex support.
High-risk patterns take precedence. Unknown paths default to L1; only the configured
usage-documentation patterns default to L0. Paths are risk floors, not semantic proof.
Reversed character ranges such as `[z-a]` or `[z-a!]` invalidate the policy. They are
rejected before initialization writes or evidence evaluation; see the migration guide.

Argument arrays use no shell expansion. `&&`, pipes, `$VAR` and globs are literal
arguments; use separate arrays for multiple steps or an actual reviewed project script.
Calling a shell explicitly still executes that shell: JSON is not a sandbox. Commands
run only when you explicitly invoke `ci/run-check.cjs` or integrate the worker in CI.
The worker stops on failure and allows at most 600 seconds per command.

The conservative baseline includes format, secrets, lint, types, unit, acceptance,
architecture, build and security checks, with integration and risk-validation at L2.
Project owners can explicitly review changes to an installed policy for checks that
do not apply. The initializer deliberately has no option to remove baseline checks.

## Languages and existing files

Use `--language en` (default) or `--language zh-CN`. Both share the same policy matrix
and helper code. Choose a language at initialization; rerunning with another language
is not a migration and will report conflicts in previously generated files.

Integration proposals preserve existing root instructions. Integrate them and remove
them after review. Rerunning init can propose them again because existing project-owned
rules differ; init is not a stateful upgrade manager. The inventory is an initial
snapshot, not proof that local files or remote checks remain authentic.

## Exit codes

| Command | 0 | 1 | 2 |
| --- | --- | --- | --- |
| init | Preview or apply completed | File conflicts; no planned writes | Invalid input or filesystem error |
| doctor | Local configuration structurally valid | Missing content, proposals or unconfigured checks | Invalid/missing JSON, invalid target or unsafe path |
| quality-gate.mjs | Eligible under supplied evidence | Hold | Invalid input or policy |
| run-check.cjs | Command steps succeeded | Execution failed or timed out | Missing/invalid configuration |

Use `--json` with init or doctor for machine-readable output. Status fields do not
grant permission to merge. Doctor does not check command availability, test coverage,
model access, authentic evidence, protected branches or remote CI. Syntax is necessary,
not sufficient. The generated SETUP.md describes the remaining integration work.

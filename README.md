# Agent Rulebook

**A CLI for AI coding rules, reviews, and quality gates.**

[简体中文](README.zh-CN.md) · [Configuration](docs/configuration.md) · [Migration](docs/migration-v0.2.md) · [Contributing](CONTRIBUTING.md)

Initialize shared AI development instructions, independent review expectations and
risk-based check configuration in repositories of any programming language.
The TypeScript CLI and standalone generated helpers require **Node.js 22+**.
Python is not required. English and Simplified Chinese templates are included.

## Quick start from GitHub

The npm package name is `@littlekie/agent-rulebook`. It has not been published to the
npm registry yet; the unscoped `agent-rulebook` registry package is unrelated.
Until registry publication, install this project's source through npm's Git installer:

```sh
npm install --global git+https://github.com/littlekie/agent-rulebook.git
agent-rulebook init ./my-project
agent-rulebook init ./my-project --apply
agent-rulebook doctor ./my-project
```

Git installation requires Git and network access and builds the TypeScript sources
using the package's prepare script. For reproducible adoption, append `#COMMIT_SHA`
to the Git URL with a reviewed revision. Initialization itself makes no network calls.
The first init command previews without writing; --apply creates missing files.
A fresh doctor run intentionally reports unconfigured checks (exit 1).
Direct Git-URL npm exec is unreliable with some npm 10 versions; use the installation
command above or npm exec with the prebuilt local tarball below.

Or build and install a local npm tarball:

```sh
git clone https://github.com/littlekie/agent-rulebook.git
cd agent-rulebook
npm ci
npm pack
npm install --global ./littlekie-agent-rulebook-0.2.0.tgz
agent-rulebook init ../my-project --language en
# Or use the tarball through npx without a global installation:
npx --yes --package=./littlekie-agent-rulebook-0.2.0.tgz agent-rulebook init ../my-project
```

The packed CLI already contains its runtime code; installed tarballs and generated
helpers need no extra npm dependencies. Windows command shims are supported through
bundled cross-spawn, including its license notices.

## What it creates

```text
AGENTS.md                              # concise agent entrypoint
REVIEW.md                              # independent review expectations
docs/ai-governance/
  engineering.md                       # full engineering policy
  SETUP.md                             # CI and review integration steps
  LICENSE                              # generated materials license
ci/
  commands.json                        # actual project commands, initially null
  quality-policy.json                  # risk floors and required checks
  ai-review-prompt.md                   # structured reviewer instructions
  quality-gate.mjs                      # deterministic evidence evaluator
  run-check.cjs                        # explicit command worker
  agent_rulebook.json                   # initial template inventory
  templates/github-checks.yml.example   # inactive CI example
```

Use npm/pnpm, Maven/Gradle, Go, Cargo or another toolchain in commands.json. The target
project does not need to be a Node project. The generated worker invokes those actual
commands; it does not install the project's toolchain or invent checks.

Instructions guide agents; real tests and protected CI enforce checks. This CLI does
not call models, configure branch protection, approve PRs or merge. The evaluator
requires a separate trusted evidence controller before production use. Doctor validates
local structure only and never executes target code or commands.

## Preserve existing projects

- Preview is the default; writing requires --apply.
- Existing AGENTS.md and REVIEW.md remain unchanged. Different templates become explicit
  integration proposals under docs/ai-governance/.
- Other differing files block the entire initialization. There is no force-overwrite.
- Identical inputs preserve bytes and timestamps; internal symlink paths are rejected.
- Generated files are project-owned. This is initialization, not automatic synchronization.

See [failure boundaries](docs/architecture.md) and the [Python-to-Node migration guide](docs/migration-v0.2.md).

## Project configuration

```sh
agent-rulebook init ../my-project --config examples/project.json --language zh-CN --apply
```

Configure real argument arrays, additional high-risk paths and cumulative required
checks. Defaults cannot be removed by initializer configuration. Replace illustrative
example commands with your project's own commands. [Configuration reference](docs/configuration.md).

| Risk | Typical change | Evidence |
| --- | --- | --- |
| L0 | Approved non-behavioral documentation | Relevant checks and self-review |
| L1 | Ordinary logic within confirmed rules | Behavioral tests and independent review |
| L2 | Permissions, funds, migrations, core architecture or gates | L1, risk-specific checks and human confirmation |

One independent code reviewer is the default; add security expertise for concrete risks.
Model agreement does not replace acceptance evidence. Projects retain merge/release authority.

MIT © 2026 Agent Rulebook contributors. Independently developed; not affiliated with
similarly named projects, Vercel or any model provider. See [SECURITY.md](SECURITY.md).

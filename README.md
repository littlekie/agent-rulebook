# Agent Rulebook

**A CLI for AI coding rules, reviews, and quality gates.**

[简体中文](README.zh-CN.md) · [Configuration](docs/configuration.md) ·
[Contributing](CONTRIBUTING.md)

Give repositories a shared baseline for AI-assisted development: engineering
instructions, independent review expectations, risk levels and configurable checks.
Use the same tool across projects while keeping each project's commands and rules.

Agent Rulebook is an early-stage, local-first Python CLI. It requires Python 3.10+
and has no runtime dependencies or API keys. Templates are available in English and
Simplified Chinese. It can initialize repositories using any programming language.

## Quick start

Install from this source checkout in a virtual environment:

```sh
git clone https://github.com/littlekie/agent-rulebook.git
cd agent-rulebook
python -m venv .venv
# macOS / Linux:
source .venv/bin/activate
# Windows PowerShell instead: .venv\Scripts\Activate.ps1
python -m pip install .

agent-rulebook init ../my-project             # preview, no writes
agent-rulebook init ../my-project --apply     # create missing files
agent-rulebook doctor ../my-project          # report configuration gaps
```

A fresh installation intentionally reports unconfigured checks. Fill in real project
commands and follow the generated setup guide. This source release does not imply
that the unscoped package name is published on PyPI; install from source or a verified
release wheel. `python -m agent_rulebook` is also supported.

## What it creates

```text
AGENTS.md                              # concise agent entrypoint
REVIEW.md                              # independent review expectations
docs/ai-governance/
  engineering.md                       # full engineering policy
  SETUP.md                             # CI and review integration steps
  LICENSE                              # generated materials license
ci/
  commands.json                        # real project commands, initially null
  quality-policy.json                  # risk floors and required checks
  ai-review-prompt.md                   # structured reviewer instructions
  quality_gate.py                       # deterministic evidence evaluator
  run_check.py                         # explicit command worker
  agent_rulebook.json                   # initial template inventory
  templates/github-checks.yml.example   # inactive CI example
```

Instructions guide agents; tests and protected CI enforce checks. The CLI does not
call a model, install a review bot, configure branch protection, approve PRs or merge.
The evaluator requires a separate trusted evidence controller before production use.
`doctor` checks local structure only and never executes project commands.

## Designed for existing repositories

- Preview is the default. Files are created only with `--apply`.
- Existing AGENTS.md and REVIEW.md are preserved; differing templates become explicit
  integration proposals under `docs/ai-governance/`.
- Other differing files block the whole initialization. There is no overwrite flag.
- Repeating identical inputs preserves bytes and timestamps.
- Paths containing symlinks inside the selected target are rejected.

This is initialization, not an automatic updater. Review and maintain generated files
as project-owned code. See [failure and recovery guarantees](docs/architecture.md).

## Configure a project

```sh
agent-rulebook init ../my-project --config examples/project.json --language zh-CN
agent-rulebook init ../my-project --config examples/project.json --language zh-CN --apply
```

Configuration maps check names to argument arrays and can add high-risk paths or
required checks. It cannot remove default risk floors. Example commands are illustrative;
replace them with commands that exist in your project. [Full configuration reference](docs/configuration.md).

## Review by risk

| Level | Typical change | Expected evidence |
| --- | --- | --- |
| L0 | Approved non-behavioral documentation | Relevant checks and final self-review |
| L1 | Ordinary logic within confirmed rules | Behavioral checks and independent review |
| L2 | Permissions, money, migrations, core architecture or gate changes | L1 evidence, risk-specific checks and human confirmation |

One independent code reviewer is the default. Add security expertise for concrete
risks. Multiple model votes do not replace business acceptance evidence. Actual merge
and release permissions remain with the project. The generated policy contains a
conservative starting matrix; review project-specific adaptations before enforcing it.

## Development and license

See [CONTRIBUTING.md](CONTRIBUTING.md) for tests and packaging,
[architecture](docs/architecture.md) for trust boundaries, and
[SECURITY.md](SECURITY.md) for security reporting.

MIT © 2026 Agent Rulebook contributors. This project is independently developed and
is not affiliated with similarly named repositories, Vercel or any model provider.

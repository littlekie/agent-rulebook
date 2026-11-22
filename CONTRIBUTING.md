# Contributing

Bug reports, focused fixes, template improvements and documentation are welcome.
For larger changes, describe the affected behavior and tradeoffs before implementation.
Be respectful and keep reviews about evidence and code.

## Local development

Use Python 3.10+ and a virtual environment. The runtime and unit tests use only the
standard library; setuptools and wheel are build dependencies.

```sh
python -m venv .venv
# Activate the environment as shown in README.md.
python -m pip install -e .
python -m unittest discover -s tests -v
python scripts/check_source.py
```

Read AGENTS.md and docs/architecture.md. Keep filesystem ownership in filesystem.py,
resource/config composition in templates.py and policy evaluation standalone. Preserve
preview without writes, existing-file protection, cumulative policy requirements and
honest doctor results. Document observable behavior changes and add meaningful tests.
Keep English and Chinese templates aligned in safety and review semantics.

Tests use temporary repositories and synthetic evidence; those fixtures are never
real approval or CI evidence. Symlink tests require the platform's symlink capability.
Document any skipped check or environment limitation rather than calling it passed.

## Pull requests

Describe the problem and resulting behavior, risk, executed checks and remaining gaps.
Filesystem writes, policy changes, review instructions and CI require review independent
of implementation. Provide requirements and the actual diff. Keep unresolved blockers
pending. Publishing and changes to remote protection require maintainer authorization.

## Package verification

```sh
python -m pip install build
python -m build
python scripts/smoke_wheel.py dist/agent_rulebook-0.1.0-py3-none-any.whl
```

The smoke script creates an isolated temporary environment, installs the wheel without
network dependencies, and exercises the installed console command outside this checkout.
Inspect both wheel and sdist contents for unwanted files. See docs/releasing.md.

Contributions are distributed under the project's MIT license. Preserve attribution
for any third-party material you propose; do not copy another project's instructions
or proprietary project profiles without appropriate permission and attribution.

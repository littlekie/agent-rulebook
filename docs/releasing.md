# Release checklist

The source repository is [littlekie/agent-rulebook](https://github.com/littlekie/agent-rulebook).
Publishing the repository does not publish a versioned release or a package registry entry.

1. Verify the release version in pyproject.toml, package __init__.py and changelog.
2. Run the contribution checks, obtain independent review and resolve blockers.
3. Build a wheel and sdist using `python -m build`. Inspect both archives: include
   license, templates and required source; exclude private profiles, local artifacts,
   virtual environments and credentials. Test the wheel with scripts/smoke_wheel.py.
4. Test installation from the sdist and run the same suite. Record actual OS/Python
   results; a configured GitHub workflow is not a completed run.
5. Before publishing, verify ownership and availability of the chosen package-registry
   name independently of GitHub naming. Do not direct users to an unrelated same-name
   package. Keep source/wheel installation instructions until the package is verified.
6. With explicit owner authorization, publish the source repository, enable private
   security reporting, configure review/protection and publish a versioned release.
   Inspect the actual remote CI run before stating it passed. Tag only reviewed source.
7. Change the changelog from Unreleased only when releasing. Publish distribution
   checksums with artifacts. Registry publishing requires separate credentials and
   authorization; no publishing workflow is included.

For a bad release, publish a corrected version with migration notes. Avoid rewriting
existing release tags or silently replacing artifacts. Generated target files are
project-owned: users review changes and use their repository history for restoration.

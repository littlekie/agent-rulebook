# Release checklist

Source: [littlekie/agent-rulebook](https://github.com/littlekie/agent-rulebook).
The npm distribution is named `@littlekie/agent-rulebook`. The unscoped registry
package is unrelated. The scoped package has not yet been published by this project.

1. Update package.json, package-lock.json, the changelog and versioned examples together.
2. Run npm ci, npm test, npm run check and npm run test:package. Obtain independent
   review for policy, filesystem and CI changes and resolve blockers.
3. Inspect npm pack output. Include compiled CLI, standalone helpers, templates,
   license notices and documentation; exclude tests, private data and local artifacts.
4. Verify the exact commit's Actions jobs on Linux, macOS and Windows. A local pass
   does not establish a remote pass. Exercise Git-based npm installation if documenting it.
5. With explicit authorization and an authenticated npm account that owns the scope,
   publish the verified package with public access. A GitHub username does not establish
   npm ownership. Use the registry's required authentication/2FA or trusted publishing;
   never put credentials in the repository. No registry publishing workflow is included.
6. Only after publication, change installation docs to the verified scoped registry
   command and mark the release date. A GitHub push is not an npm publication.

Keep versioned artifacts immutable; use a corrected new version for fixes. Existing
generated files remain project-owned and are migrated through reviewed diffs, not
silent replacement. Follow docs/migration-v0.2.md when upgrading Python-era projects.

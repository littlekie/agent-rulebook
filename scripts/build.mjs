import { build } from 'esbuild';
import { appendFileSync, chmodSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

for (const [entry, outfile, format] of [
  ['src/cli.mts', 'dist/cli.mjs', 'esm'],
  ['src/quality-gate.mts', 'dist/helpers/quality-gate.mjs', 'esm'],
  ['src/run-check.mts', 'dist/helpers/run-check.cjs', 'cjs'],
]) {
  const result = await build({ entryPoints: [entry], outfile, bundle: true, platform: 'node',
    target: 'node22', format, legalComments: 'inline', metafile: true });
  // Bundled third-party code must carry its license into generated repositories.
  const packages = new Set();
  for (const input of Object.keys(result.metafile.inputs)) {
    if (!input.includes('node_modules/')) continue;
    let directory = path.dirname(path.resolve(input));
    while (!existsSync(path.join(directory, 'package.json'))) {
      const parent = path.dirname(directory);
      if (parent === directory) throw new Error('Cannot locate bundled dependency license: ' + input);
      directory = parent;
    }
    packages.add(directory);
  }
  for (const directory of [...packages].sort()) {
    const metadata = JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8'));
    const license = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'].map((name) => path.join(directory, name)).find(existsSync);
    if (!license) throw new Error('Missing bundled license: ' + metadata.name);
    const notice = readFileSync(license, 'utf8').replaceAll('*/', '* /');
    appendFileSync(outfile, `\n/*! ${metadata.name}@${metadata.version}\n${notice}\n*/\n`);
  }
}
chmodSync('dist/cli.mjs', 0o755);

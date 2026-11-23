import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import spawn from 'cross-spawn';

const root = process.cwd(), base = fs.mkdtempSync(path.join(os.tmpdir(), 'rulebook-pack-'));
try {
  const userconfig = path.join(base, 'npmrc'); fs.writeFileSync(userconfig, '');
  const env = { ...process.env, npm_config_userconfig: userconfig, npm_config_cache: path.join(base, 'cache') };
  function run(command, args, cwd = base, status = 0) {
    const r = spawn.sync(command, args, { cwd, env, encoding: 'utf8', timeout: 120000 });
    assert.equal(r.status, status, r.stdout + r.stderr + String(r.error ?? '')); return r.stdout;
  }
  const [packed] = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', base], root));
  const names = packed.files.map((f) => f.path);
  for (const name of names) assert.ok(!/\.py$|node_modules\/|dist\/test-lib\/|^src\//.test(name), name);
  for (const name of ['dist/cli.mjs', 'dist/helpers/quality-gate.mjs', 'dist/helpers/run-check.cjs', 'templates/en/AGENTS.md', 'templates/zh-CN/AGENTS.md', 'LICENSE']) assert.ok(names.includes(name), name);
  const tarball = path.join(base, packed.filename), install = path.join(base, 'install');
  run('npm', ['install', '--prefix', install, '--offline', '--ignore-scripts', '--no-audit', '--no-fund', tarball]);
  const installed = path.join(install, 'node_modules/@littlekie/agent-rulebook');
  const cli = path.join(installed, 'dist/cli.mjs');
  assert.match(run(process.execPath, [cli, '--version']), /^agent-rulebook 0\.2\.0/);
  for (const language of ['en', 'zh-CN']) {
    const target = path.join(base, '项目 ' + language);
    assert.equal(JSON.parse(run(process.execPath, [cli, 'init', target, '--language', language, '--json'])).status, 'preview');
    assert.equal(fs.existsSync(target), false);
    assert.equal(JSON.parse(run(process.execPath, [cli, 'init', target, '--language', language, '--apply', '--json'])).status, 'initialized');
    const repeat = JSON.parse(run(process.execPath, [cli, 'init', target, '--language', language, '--apply', '--json']));
    assert.ok(repeat.files.every((entry) => entry.action === 'unchanged'));
    const doctor = JSON.parse(run(process.execPath, [cli, 'doctor', target, '--json'], base, 1));
    assert.equal(doctor.checks_executed, false);
    run(process.execPath, [path.join(target, 'ci/run-check.cjs'), 'unit'], base, 2);
    fs.writeFileSync(path.join(target, 'ci/commands.json'), JSON.stringify({ probe: [[process.execPath, '-e', 'console.log("standalone")']] }));
    assert.equal(run(process.execPath, [path.join(target, 'ci/run-check.cjs'), 'probe'], base).trim(), 'standalone');
    const invalid = JSON.parse(run(process.execPath, [path.join(target, 'ci/quality-gate.mjs')], base, 2));
    assert.equal(invalid.decision, 'invalid');
  }
  assert.match(run('npm', ['exec', '--offline', '--yes', '--ignore-scripts', '--package', tarball, '--', 'agent-rulebook', '--version']), /^agent-rulebook 0\.2\.0/m);
  fs.mkdirSync('artifacts', { recursive: true });
  fs.copyFileSync(tarball, path.join('artifacts', packed.filename));
  console.log('npm pack smoke passed: offline install, npm exec, both languages, standalone workers; no runtime dependencies.');
} finally { fs.rmSync(base, { recursive: true, force: true }); }

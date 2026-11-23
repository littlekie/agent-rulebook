import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { plan, applyPlan } from '../dist/test-lib/filesystem.mjs';
import { bundle, validateConfig } from '../dist/test-lib/templates.mjs';
import { parseJson } from '../dist/test-lib/json.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = path.join(root, 'dist/cli.mjs');
function workspace(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'rulebook-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  return { base, target: path.join(base, '项目 with spaces') };
}
function call(base, ...args) {
  const result = spawnSync(process.execPath, [cli, ...args, '--json'], { cwd: base, encoding: 'utf8', timeout: 20000 });
  assert.equal(result.stderr, '', result.stderr);
  assert.equal(result.error, undefined);
  return { code: result.status, ...JSON.parse(result.stdout) };
}
function init(base, target, ...args) {
  const r = call(base, 'init', target, '--apply', ...args); assert.equal(r.code, 0, JSON.stringify(r)); return r;
}
function snapshot(target) {
  return fs.readdirSync(target, { recursive: true }).sort().flatMap((name) => {
    const p = path.join(target, name), s = fs.statSync(p);
    return s.isFile() ? [[name, fs.readFileSync(p).toString('base64'), s.mtimeMs]] : [];
  });
}
test('preview creates no target directory', (t) => {
  const { base, target } = workspace(t);
  assert.equal(call(base, 'init', target).status, 'preview'); assert.equal(fs.existsSync(target), false);
});
test('initialization is repeatable, preserves mtimes, and creates only Node helpers', (t) => {
  const { base, target } = workspace(t); init(base, target);
  const before = snapshot(target), repeat = init(base, target);
  assert.deepEqual(snapshot(target), before); assert.ok(repeat.files.every((e) => e.action === 'unchanged'));
  assert.equal(fs.existsSync(path.join(target, '.github')), false);
  assert.ok(fs.existsSync(path.join(target, 'ci/quality-gate.mjs')));
  assert.ok(fs.existsSync(path.join(target, 'ci/run-check.cjs')));
  assert.equal(before.some(([name]) => name.endsWith('.py')), false);
});
test('root instructions are preserved byte-for-byte and proposals need integration', (t) => {
  const { base, target } = workspace(t); fs.mkdirSync(target);
  for (const name of ['AGENTS.md', 'REVIEW.md']) fs.writeFileSync(path.join(target, name), 'existing\r\n');
  const r = init(base, target); assert.equal(r.proposals.length, 2);
  for (const name of ['AGENTS.md', 'REVIEW.md']) assert.equal(fs.readFileSync(path.join(target, name), 'utf8'), 'existing\r\n');
  const before = snapshot(target); init(base, target); assert.deepEqual(snapshot(target), before);
  assert.ok(call(base, 'doctor', target).issues.some((s) => s.includes('proposal')));
});
test('one conflicting file prevents the whole apply', (t) => {
  const { base, target } = workspace(t); fs.mkdirSync(path.join(target, 'ci'), { recursive: true });
  fs.writeFileSync(path.join(target, 'ci/commands.json'), '{"custom":null}');
  const before = snapshot(target), r = call(base, 'init', target, '--apply');
  assert.equal(r.code, 1); assert.equal(r.status, 'conflict'); assert.deepEqual(snapshot(target), before);
});
test('edited files are preserved on repeat', (t) => {
  const { base, target } = workspace(t); init(base, target);
  fs.appendFileSync(path.join(target, 'docs/ai-governance/engineering.md'), 'project rule\n');
  const before = snapshot(target); assert.equal(call(base, 'init', target, '--apply').code, 1); assert.deepEqual(snapshot(target), before);
});
for (const directory of [true, false]) test(`reject ${directory ? 'directory' : 'file'} symlink`, (t) => {
  const { base, target } = workspace(t); fs.mkdirSync(target);
  const outside = path.join(base, 'outside');
  if (directory) fs.mkdirSync(outside); else fs.writeFileSync(outside, 'keep');
  const link = path.join(target, directory ? 'ci' : 'AGENTS.md');
  try { fs.symlinkSync(outside, link, directory ? (process.platform === 'win32' ? 'junction' : 'dir') : 'file'); }
  catch (error) { if (error.code === 'EPERM') { t.skip('Symlink privilege unavailable'); return; } throw error; }
  assert.equal(call(base, 'init', target, '--apply').code, 2); assert.deepEqual(fs.readdirSync(target), [path.basename(link)]);
  if (!directory) assert.equal(fs.readFileSync(outside, 'utf8'), 'keep');
});
test('reject a file where a parent directory is needed', (t) => {
  const { base, target } = workspace(t); fs.mkdirSync(target); fs.writeFileSync(path.join(target, 'ci'), 'keep');
  assert.equal(call(base, 'init', target, '--apply').code, 2); assert.deepEqual(fs.readdirSync(target), ['ci']);
});
test('config is parsed but its commands and target scripts never execute', (t) => {
  const { base, target } = workspace(t), config = path.join(base, 'config.json'), marker = path.join(base, 'executed');
  fs.writeFileSync(config, JSON.stringify({ commands: { setup: [[process.execPath, '-e', `require('fs').writeFileSync(${JSON.stringify(marker)}, 'bad')`]] } }));
  init(base, target, '--config', config);
  fs.writeFileSync(path.join(target, 'ci/quality-gate.mjs'), `throw Error('must not import');`);
  assert.equal(call(base, 'doctor', target).code, 1); assert.equal(fs.existsSync(marker), false);
});
test('doctor is read-only and reports unconfigured checks honestly', (t) => {
  const { base, target } = workspace(t); init(base, target); const before = snapshot(target);
  const r = call(base, 'doctor', target); assert.equal(r.code, 1); assert.equal(r.status, 'needs-configuration');
  assert.equal(r.checks_executed, false); assert.equal(r.automation, 'not-verified'); assert.deepEqual(snapshot(target), before);
});
test('syntactically configured commands do not imply execution', (t) => {
  const { base, target } = workspace(t); init(base, target);
  const policy = JSON.parse(fs.readFileSync(path.join(target, 'ci/quality-policy.json')));
  fs.writeFileSync(path.join(target, 'ci/commands.json'), JSON.stringify(Object.fromEntries(['setup', ...policy.required_checks.L2].map((name) => [name, [['nonexistent']]]))));
  const r = call(base, 'doctor', target); assert.equal(r.status, 'local-config-valid'); assert.equal(r.checks_executed, false);
});
test('doctor rejects missing target and malformed policy', (t) => {
  const { base, target } = workspace(t); assert.equal(call(base, 'doctor', target).code, 2); init(base, target);
  fs.writeFileSync(path.join(target, 'ci/quality-policy.json'), '[]'); assert.equal(call(base, 'doctor', target).code, 2);
});
test('unsupported or duplicate configuration causes zero writes', (t) => {
  const { base, target } = workspace(t), config = path.join(base, 'config.json');
  for (const value of ['[]', '{"commands":{"lint":"npm run lint"}}', '{"commands":{"lint":[]}}', '{"name":"a","name":"b"}', '{"required_checks":{"L1":[]}}']) {
    fs.writeFileSync(config, value); assert.equal(call(base, 'init', target, '--apply', '--config', config).code, 2); assert.equal(fs.existsSync(target), false);
  }
});
test('configuration only adds paths and cumulative requirements', (t) => {
  const { base } = workspace(t), file = path.join(base, 'config.json');
  fs.writeFileSync(file, JSON.stringify({ name: 'custom', high_risk_paths: ['src/identity/*'], required_checks: { L0: ['docs'], L1: ['contract'], L2: ['recovery'] } }));
  const before = JSON.parse(bundle(root).output['ci/quality-policy.json']), after = JSON.parse(bundle(root, 'en', file).output['ci/quality-policy.json']);
  assert.ok(before.high_risk_paths.every((p) => after.high_risk_paths.includes(p)));
  for (const l of ['L0', 'L1', 'L2']) { assert.ok(before.required_checks[l].every((n) => after.required_checks[l].includes(n))); assert.ok(after.required_checks[l].includes('docs')); }
  assert.equal(after.required_checks.L0.includes('contract'), false); assert.ok(after.required_checks.L1.includes('contract')); assert.ok(after.required_checks.L2.includes('contract'));
  assert.equal(after.required_checks.L1.includes('recovery'), false); assert.ok(after.required_checks.L2.includes('recovery'));
});
test('reversed range configuration is rejected before any writes', (t) => {
  const { base, target } = workspace(t), config = path.join(base, 'config.json');
  fs.writeFileSync(config, JSON.stringify({ high_risk_paths: ['src/[z-a!].ts'] }));
  const result = call(base, 'init', target, '--apply', '--config', config);
  assert.equal(result.code, 2); assert.match(result.message, /Reversed character range/); assert.equal(fs.existsSync(target), false);
});
for (const config of [{ low_risk_paths: ['*'] }, { name: '../bad' }, { commands: null }, { high_risk_paths: ['/x'] }, { high_risk_paths: ['a/../b'] }, { required_checks: { L3: ['a'] } }, { required_checks: { L1: ['a', 'a'] } }]) {
  test('reject invalid config ' + JSON.stringify(config), () => assert.throws(() => validateConfig(config)));
}
test('duplicate escaped keys and prototype-sensitive keys are handled as data', () => {
  assert.throws(() => parseJson('{"a":1,"\u005c\u00750061":2}'), /Duplicate/);
  const value = parseJson('{"__proto__":{"polluted":true},"constructor":1}');
  assert.equal(Object.hasOwn(value, '__proto__'), true); assert.equal({}.polluted, undefined);
});
test('both languages share policy and helpers and carry license', () => {
  const a = bundle(root, 'en').output, b = bundle(root, 'zh-CN').output;
  assert.deepEqual(Object.keys(a), Object.keys(b));
  for (const name of ['ci/quality-policy.json', 'ci/commands.json', 'ci/quality-gate.mjs', 'ci/run-check.cjs']) assert.deepEqual(a[name], b[name]);
  assert.match(b['AGENTS.md'].toString(), /AI 开发规范/); assert.match(a['ci/run-check.cjs'].toString(), /cross-spawn@/);
});
test('write failure removes only our unmodified files', (t) => {
  const { target } = workspace(t); fs.mkdirSync(target); fs.writeFileSync(path.join(target, 'keep'), 'keep');
  const entries = plan(target, { a: Buffer.from('new'), b: Buffer.from('new') });
  const io = { ...fs, openSync(file, ...args) { if (path.basename(file) === 'b') throw Error('disk failure'); return fs.openSync(file, ...args); } };
  assert.throws(() => applyPlan(target, entries, io)); assert.deepEqual(fs.readdirSync(target), ['keep']);
});
test('concurrent changes before apply are preserved', (t) => {
  const { target } = workspace(t); fs.mkdirSync(target); const entries = plan(target, { a: Buffer.from('new'), b: Buffer.from('new') });
  fs.writeFileSync(path.join(target, 'b'), 'other work'); assert.throws(() => applyPlan(target, entries));
  assert.equal(fs.existsSync(path.join(target, 'a')), false); assert.equal(fs.readFileSync(path.join(target, 'b'), 'utf8'), 'other work');
});
test('rollback retains edits made after creation', (t) => {
  const { target } = workspace(t); fs.mkdirSync(target); const entries = plan(target, { a: Buffer.from('new'), b: Buffer.from('new') });
  const io = { ...fs, openSync(file, ...args) { if (path.basename(file) === 'b') { fs.writeFileSync(path.join(target, 'a'), 'concurrent'); throw Error('disk failure'); } return fs.openSync(file, ...args); } };
  assert.throws(() => applyPlan(target, entries, io), /retained/); assert.equal(fs.readFileSync(path.join(target, 'a'), 'utf8'), 'concurrent');
});
test('short writes followed by disk failure roll back partial file', (t) => {
  const { target } = workspace(t); fs.mkdirSync(target); let called = false;
  const io = { ...fs, writeSync(fd, buffer, offset) { if (called) throw Error('disk full'); called = true; return fs.writeSync(fd, buffer, offset, 2); } };
  assert.throws(() => applyPlan(target, plan(target, { a: Buffer.from('abcdef') }), io)); assert.equal(fs.existsSync(path.join(target, 'a')), false);
});
test('old baseline conflicts safely instead of silently migrating', (t) => {
  const { base, target } = workspace(t); fs.mkdirSync(path.join(target, 'ci'), { recursive: true });
  fs.writeFileSync(path.join(target, 'ci/agent_rulebook.json'), '{"version":"0.1.0"}');
  fs.writeFileSync(path.join(target, 'ci/run_check.py'), '# existing');
  const before = snapshot(target); assert.equal(call(base, 'init', target, '--apply').status, 'conflict'); assert.deepEqual(snapshot(target), before);
});

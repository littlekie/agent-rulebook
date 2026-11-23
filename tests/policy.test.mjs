import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { evaluate, classify, validatePolicy } from '../dist/test-lib/policy.mjs';
import { globMatch } from '../dist/test-lib/glob.mjs';
import { parseJson } from '../dist/test-lib/json.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const policyPath = path.join(root, 'templates/shared/ci/quality-policy.json');
function fixture() {
  const policy = JSON.parse(fs.readFileSync(policyPath));
  const context = { repository: 'example/project', pr_number: 12, head_sha: 'a'.repeat(40), base_sha: 'b'.repeat(40), tested_sha: 'c'.repeat(40), policy_sha256: createHash('sha256').update(fs.readFileSync(policyPath)).digest('hex') };
  // Synthetic fixtures, never real CI evidence. Expected decisions follow L0/L1/L2 rules.
  const evidence = { context: structuredClone(context), changes_complete: true,
    changed_files: [{ path: 'src/orders/service.js', status: 'modified' }],
    checks: policy.required_checks.L2.map((name) => ({ name, status: 'success', context: structuredClone(context) })),
    review: { context: structuredClone(context), status: 'complete', minimum_risk: 'L1', coverage: 'complete', unresolved_questions: [], findings: [] } };
  return { policy, context, evidence };
}
function verdict(edit) { const f = fixture(); edit?.(f); return evaluate(f.policy, f.context, f.evidence); }
test('complete L1 evidence is eligible', () => assert.equal(verdict().decision, 'eligible'));
test('approved L0 documentation needs only L0 checks', () => {
  const r = verdict(({ evidence }) => { evidence.changed_files[0].path = 'docs/usage/start.md'; delete evidence.review; evidence.checks = evidence.checks.slice(0, 2); });
  assert.equal(r.risk, 'L0'); assert.equal(r.decision, 'eligible');
});
for (const [name, edit] of [
  ['unknown path requires review', ({ evidence: e }) => { e.changed_files[0].path = 'unknown/file'; delete e.review; }],
  ['incomplete diff', ({ evidence: e }) => { e.changes_complete = false; }],
  ['missing check', ({ evidence: e }) => { e.checks.shift(); }],
  ['missing review', ({ evidence: e }) => { delete e.review; }],
  ['partial review', ({ evidence: e }) => { e.review.coverage = 'partial'; }],
  ['unavailable review', ({ evidence: e }) => { e.review.status = 'unavailable'; }],
  ['unresolved rules', ({ evidence: e }) => { e.review.unresolved_questions = ['Confirm refund policy']; }],
  ['stale review', ({ evidence: e }) => { e.review.context.head_sha = 'd'.repeat(40); }],
  ['stale evidence', ({ evidence: e }) => { e.context.base_sha = 'e'.repeat(40); }],
]) test(name + ' holds', () => assert.equal(verdict(edit).decision, 'hold'));
for (const status of ['skipped', 'neutral', 'failure', 'cancelled', 'timed_out', 'pending', null]) {
  test('check status ' + status + ' holds', () => assert.equal(verdict(({ evidence }) => { evidence.checks[0].status = status; }).decision, 'hold'));
}
for (const field of ['head_sha', 'base_sha', 'tested_sha', 'policy_sha256']) test('stale check ' + field + ' holds', () => {
  assert.equal(verdict(({ evidence }) => { evidence.checks[0].context[field] = 'd'.repeat(field === 'policy_sha256' ? 64 : 40); }).decision, 'hold');
});
for (const [name, changes] of [
  ['modified workflow', [{ status: 'modified', path: '.github/workflows/check.yml' }]],
  ['renamed policy', [{ status: 'renamed', previous_path: 'ci/quality-policy.json', path: 'docs/usage/old.md' }]],
  ['deleted rule', [{ status: 'removed', path: 'docs/business/rules.md' }]],
]) test(name + ' cannot be downgraded by the model', () => {
  const r = verdict(({ evidence }) => { evidence.changed_files = changes; evidence.review.minimum_risk = 'L0'; });
  assert.equal(r.risk, 'L2'); assert.equal(r.decision, 'hold');
});
test('model L2 upgrade requires additional checks and human approval', () => {
  const r = verdict(({ evidence }) => { evidence.review.minimum_risk = 'L2'; evidence.checks = evidence.checks.slice(0, -2); });
  assert.equal(r.risk, 'L2'); assert.equal(r.reasons.length, 3);
});
test('L2 approval must be authorized and match current context', () => {
  const f = fixture(); f.evidence.declared_risk = 'L2';
  assert.equal(evaluate(f.policy, f.context, f.evidence).decision, 'hold');
  f.evidence.human_approval = { state: 'approved', authorized: true, reviewer: 'owner', context: structuredClone(f.context) };
  assert.equal(evaluate(f.policy, f.context, f.evidence).decision, 'eligible');
  f.evidence.human_approval.authorized = false; assert.equal(evaluate(f.policy, f.context, f.evidence).decision, 'hold');
  f.evidence.human_approval.authorized = true; f.evidence.human_approval.context.head_sha = 'f'.repeat(40);
  assert.equal(evaluate(f.policy, f.context, f.evidence).decision, 'hold');
});
test('supported blockers hold; suggestions do not', () => {
  const f = fixture(); f.evidence.review.findings = [{ blocking: true, file: 'src/orders/service.js', line: 8, title: 'Duplicate request', trigger: 'Retry', impact: 'Duplicate order', evidence: 'Missing idempotency' }];
  assert.equal(evaluate(f.policy, f.context, f.evidence).decision, 'hold');
  f.evidence.review.findings[0].blocking = false; assert.equal(evaluate(f.policy, f.context, f.evidence).decision, 'eligible');
});
for (const [name, edit] of [
  ['duplicate checks', ({ evidence: e }) => { e.checks.push(structuredClone(e.checks[0])); }],
  ['string blocking flag', ({ evidence: e }) => { e.review.findings = [{ blocking: 'false' }]; }],
  ['rename without old path', ({ evidence: e }) => { e.changed_files[0].status = 'renamed'; }],
  ['noncumulative policy', ({ policy: p }) => { p.required_checks.L2 = ['format']; }],
  ['null declared risk', ({ evidence: e }) => { e.declared_risk = null; }],
  ['array change status', ({ evidence: e }) => { e.changed_files[0].status = ['modified']; }],
  ['array review status', ({ evidence: e }) => { e.review.status = ['complete']; }],
  ['array review coverage', ({ evidence: e }) => { e.review.coverage = ['complete']; }],
  ['unsafe integer context', ({ context: c }) => { c.pr_number = 2 ** 54; }],
]) test(name + ' is invalid', () => assert.throws(() => verdict(edit)));
for (const p of ['../ci/x', '/ci/x', 'ci/../x', 'ci\\x', 'ci//x', 'ci/\0x']) test('reject unsafe path ' + JSON.stringify(p), () => {
  assert.throws(() => verdict(({ evidence }) => { evidence.changed_files[0].path = p; }));
});
test('prototype-sensitive check names remain ordinary keys', () => {
  const f = fixture(); for (const l of ['L1', 'L2']) f.policy.required_checks[l].push('__proto__');
  assert.equal(evaluate(f.policy, f.context, f.evidence).decision, 'hold');
  f.evidence.checks.push({ name: '__proto__', status: 'success', context: f.context });
  assert.equal(evaluate(f.policy, f.context, f.evidence).decision, 'eligible');
});
test('fnmatch-compatible patterns cover slash, ranges, negation and literal brackets', () => {
  for (const [value, pattern, expected] of [
    ['a/b/c', 'a/*', true], ['a/b', 'a?b', true], ['a/B', 'a/b', false],
    ['a2', 'a[0-9]', true], ['aX', 'a[!0-9]', true], ['a2', 'a[!0-9]', false],
    [']', '[]]', true], ['[', '[[]', true], ['[x', '[x', true],
    ['^', '[^]', true], ['a/b', '*b', true], ['a-b', 'a[-]b', true], ['💡', '?', true],
    ['💡', '[\uE000-💡]', true],
  ]) assert.equal(globMatch(value, pattern), expected, JSON.stringify({ value, pattern }));
});
test('reversed ranges invalidate the policy instead of silently lowering risk', () => {
  for (const pattern of ['src/[z-a!].ts', 'src/[z-a].ts', 'src/[!z-a].ts']) {
    const f = fixture(); f.policy.high_risk_paths.push(pattern);
    assert.throws(() => evaluate(f.policy, f.context, f.evidence), /Reversed character range/);
  }
});
test('strict JSON rejects nested and escaped duplicate keys and nonfinite numbers', () => {
  for (const value of ['{"a":{"x":1,"x":2}}', String.raw`{"a":1,"\u0061":2}`, '{"x":1e400}']) assert.throws(() => parseJson(value));
  assert.deepEqual(parseJson('{"array":[true,null,"\\\"",2],"other":{}}'), { array: [true, null, '"', 2], other: {} });
});
function temporary(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rulebook-gate-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir;
}
test('standalone gate returns 0, 1, 2 and binds the policy digest', (t) => {
  const dir = temporary(t), f = fixture();
  const run = () => {
    for (const key of ['context', 'evidence']) fs.writeFileSync(path.join(dir, key + '.json'), JSON.stringify(f[key]));
    const r = spawnSync(process.execPath, [path.join(root, 'dist/helpers/quality-gate.mjs'), '--policy', policyPath, '--context', path.join(dir, 'context.json'), '--evidence', path.join(dir, 'evidence.json')], { cwd: dir, encoding: 'utf8', timeout: 20000 });
    assert.equal(r.stderr, ''); return { code: r.status, ...JSON.parse(r.stdout) };
  };
  assert.equal(run().code, 0); delete f.evidence.review; assert.equal(run().code, 1);
  f.context.policy_sha256 = '0'.repeat(64); assert.equal(run().code, 2);
});
function worker(dir, config, name = 'probe') {
  const file = path.join(dir, 'commands.json'); fs.writeFileSync(file, typeof config === 'string' ? config : JSON.stringify(config));
  return spawnSync(process.execPath, [path.join(root, 'dist/helpers/run-check.cjs'), name, '--config', file], { cwd: dir, encoding: 'utf8', timeout: 20000 });
}
for (const config of ['[]', '{', '{"probe":null,"probe":[]}','{"probe":null}']) test('worker rejects missing or invalid command ' + config, (t) => {
  assert.equal(worker(temporary(t), config).status, 2);
});
test('worker validates every step before running the first', (t) => {
  const dir = temporary(t), marker = path.join(dir, 'executed');
  const r = worker(dir, { probe: [[process.execPath, '-e', `require('fs').writeFileSync(${JSON.stringify(marker)}, 'bad')`], ['bad\0arg']] });
  assert.equal(r.status, 2); assert.equal(fs.existsSync(marker), false);
});
test('worker preserves literal arguments without shell expansion', (t) => {
  const literal = 'literal;$(do-not-run) & | "quoted" %PATH%';
  const r = worker(temporary(t), { probe: [[process.execPath, '-e', 'console.log(process.argv[1])', literal]] });
  assert.equal(r.status, 0, r.stderr); assert.equal(r.stdout.trim(), literal);
});
test('worker stops after failure', (t) => {
  const r = worker(temporary(t), { probe: [[process.execPath, '-e', 'process.exit(7)'], [process.execPath, '-e', 'console.log("must-not-run")']] });
  assert.equal(r.status, 1); assert.equal(r.stdout.includes('must-not-run'), false);
});
test('worker supports native npm commands on all platforms', (t) => {
  const r = worker(temporary(t), { probe: [['npm', '--version']] }); assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /\d+\.\d+\.\d+/);
});
test('Windows cmd shim preserves metacharacter arguments', { skip: process.platform !== 'win32' }, (t) => {
  const dir = temporary(t);
  fs.writeFileSync(path.join(dir, 'echo.cjs'), 'console.log(JSON.stringify(process.argv.slice(2)))');
  fs.writeFileSync(path.join(dir, 'probe.cmd'), `@"${process.execPath}" "%~dp0echo.cjs" %*\r\n`);
  const args = ['two words', 'literal&data', 'x|y', '"quotes"'];
  const r = worker(dir, { probe: [[path.join(dir, 'probe.cmd'), ...args]] });
  assert.equal(r.status, 0, r.stderr); assert.deepEqual(JSON.parse(r.stdout), args);
});

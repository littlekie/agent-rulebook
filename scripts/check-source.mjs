import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { bundle } from '../dist/test-lib/templates.mjs';
import { parseJson } from '../dist/test-lib/json.mjs';

const root = process.cwd();
const excluded = new Set(['.git', 'node_modules', 'dist', 'build', 'artifacts', '__pycache__']);
let count = 0;
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name) || entry.name.endsWith('.egg-info')) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { walk(file); continue; }
    if (!/\.(mts|mjs|json|md|yml|example)$/.test(entry.name)) continue;
    const content = fs.readFileSync(file, 'utf8');
    assert.ok(!content.includes('\r') && content.endsWith('\n'), file + ': expected LF and final newline');
    assert.ok(content.split('\n').every((line) => line.trimEnd() === line), file + ': trailing whitespace');
    if (entry.name.endsWith('.json')) parseJson(content);
    count++;
  }
}
walk(root);
for (const language of ['en', 'zh-CN']) {
  const { output } = bundle(root, language);
  for (const [name, content] of Object.entries(output)) {
    assert.ok(content.length, name); assert.ok(!content.includes('/' + 'Users/'), name + ': private path');
    assert.ok(!/\bpython(?:3)?\s+ci\//i.test(content.toString()), name + ': old worker invocation');
  }
  assert.deepEqual(output['docs/ai-governance/LICENSE'], fs.readFileSync('LICENSE'));
}
for (const dir of ['.', 'docs']) for (const name of fs.readdirSync(dir).filter((name) => name.endsWith('.md'))) {
  const file = path.join(dir, name), content = fs.readFileSync(file, 'utf8');
  for (const [, target] of content.matchAll(/\]\(([^)]+)\)/g)) {
    if (target.includes('://') || target.startsWith('#')) continue;
    assert.ok(fs.existsSync(path.resolve(path.dirname(file), target.split('#')[0])), file + ': broken link ' + target);
  }
}
console.log(`Source checks passed (${count} files; both template languages).`);

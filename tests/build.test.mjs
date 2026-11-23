import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readLicense } from '../scripts/licenses.mjs';

for (const name of ['license', 'LICENSE.md', 'LICENCE.txt']) test('bundle preserves dependency notice named ' + name, (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rulebook-license-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, name), 'Copyright test author\nPermission notice\n');
  assert.equal(readLicense(dir), 'Copyright test author\nPermission notice\n');
});
test('missing dependency notice blocks build', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rulebook-license-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  assert.throws(() => readLicense(dir), /Missing bundled license/);
});

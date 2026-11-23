import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export function readLicense(directory) {
  const filename = readdirSync(directory).sort().find((name) => /^licen[sc]e(?:\.(?:md|txt))?$/i.test(name));
  if (!filename) throw new Error('Missing bundled license: ' + path.basename(directory));
  return readFileSync(path.join(directory, filename), 'utf8');
}

import * as fs from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';
import { message, requireValue } from './json.mjs';

export const PROPOSALS: Record<string, string> = {
  'AGENTS.md': 'docs/ai-governance/AGENTS.proposed.md',
  'REVIEW.md': 'docs/ai-governance/REVIEW.proposed.md',
};
export function missing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
function stat(file: string, io = fs): fs.Stats | undefined {
  try { return io.lstatSync(file); } catch (error) { if (missing(error)) return undefined; throw error; }
}
export function rootPath(value: string): string {
  if (value === '~' || value.startsWith('~/') || value.startsWith('~\\')) value = homedir() + value.slice(1);
  let root = path.resolve(value);
  const suffix: string[] = [];
  while (!stat(root)) { suffix.unshift(path.basename(root)); root = path.dirname(root); }
  root = path.join(fs.realpathSync(root), ...suffix);
  const current = stat(root);
  requireValue(!current || current.isDirectory(), 'Target is not a directory: ' + root);
  return root;
}
export function checkedPath(root: string, relative: string, io = fs): string {
  const parts = relative.split('/');
  requireValue(!/[\\\0:]/.test(relative) && parts.every((p) => !['', '.', '..'].includes(p)), 'Invalid relative path: ' + relative);
  let current = root;
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]!);
    const info = stat(current, io);
    if (!info) continue;
    requireValue(!info.isSymbolicLink(), 'Target path contains a symlink: ' + relative);
    requireValue(i === parts.length - 1 ? info.isFile() : info.isDirectory(), 'Target path type conflict: ' + relative);
  }
  return current;
}
export interface Entry { path: string; content: Buffer; action: 'create' | 'unchanged' | 'conflict' }
export function plan(root: string, files: Record<string, Buffer>): Entry[] {
  return Object.keys(files).sort().map((original) => {
    let name = original, content = files[original]!;
    let target = checkedPath(root, name);
    if (Object.hasOwn(PROPOSALS, name) && fs.existsSync(target) && !fs.readFileSync(target).equals(content)) {
      name = PROPOSALS[name]!;
      content = Buffer.concat([Buffer.from('<!-- Integration proposal: preserve existing project rules; paths are relative to the project root. -->\n'), content]);
      target = checkedPath(root, name);
    }
    return { path: name, content, action: fs.existsSync(target) ? (fs.readFileSync(target).equals(content) ? 'unchanged' : 'conflict') : 'create' };
  });
}
export function applyPlan(root: string, entries: Entry[], io = fs): void {
  const pending = entries.filter((entry) => {
    const target = checkedPath(root, entry.path, io);
    if (!stat(target, io)) return true;
    requireValue(io.readFileSync(target).equals(entry.content), 'File changed before writing: ' + entry.path);
    return false;
  });
  const created: { path: string; identity: fs.Stats; written: Buffer }[] = [];
  try {
    for (const entry of pending) {
      const target = checkedPath(root, entry.path, io);
      io.mkdirSync(path.dirname(target), { recursive: true });
      const fd = io.openSync(target, 'wx');
      try {
        const record: (typeof created)[number] = { path: entry.path, identity: io.fstatSync(fd), written: Buffer.alloc(0) };
        created.push(record);
        let offset = 0;
        while (offset < entry.content.length) {
          const count = io.writeSync(fd, entry.content, offset, entry.content.length - offset);
          requireValue(count > 0, 'Write made no progress: ' + target);
          offset += count; record.written = entry.content.subarray(0, offset);
        }
      } finally { io.closeSync(fd); }
    }
  } catch (error) {
    const retained: string[] = [];
    for (const record of created.reverse()) {
      try {
        const target = checkedPath(root, record.path, io), current = stat(target, io);
        if (!current) continue;
        if (current.dev === record.identity.dev && current.ino === record.identity.ino
          && io.readFileSync(target).equals(record.written)) io.unlinkSync(target);
        else retained.push(record.path);
      } catch { retained.push(record.path); }
    }
    if (retained.length) throw new Error(message(error) + '; changed or unsafe-to-clean files were retained: ' + retained.join(', '));
    throw error;
  }
}

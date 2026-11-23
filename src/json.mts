import { readFileSync } from 'node:fs';

export type JsonObject = Record<string, unknown>;
export function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !value.includes('\0');
}
export function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// JSON.parse alone silently accepts duplicate keys. Scan the already validated
// grammar as well, comparing decoded keys so escaped duplicates also fail.
export function parseJson(source: string): unknown {
  const parsed: unknown = JSON.parse(source);
  let offset = 0;
  const space = () => { while (/\s/.test(source[offset] ?? '') && offset < source.length) offset++; };
  const string = (): string => {
    const start = offset++;
    while (source[offset] !== '"') {
      if (source[offset] === '\\') offset++;
      offset++;
    }
    offset++;
    return JSON.parse(source.slice(start, offset)) as string;
  };
  const value = (): void => {
    space();
    if (source[offset] === '{') {
      offset++; space();
      const keys = new Set<string>();
      while (source[offset] !== '}') {
        const key = string();
        requireValue(!keys.has(key), 'Duplicate JSON field: ' + key);
        keys.add(key); space(); offset++; value(); space();
        if (source[offset] !== ',') break;
        offset++; space();
      }
      offset++;
    } else if (source[offset] === '[') {
      offset++; space();
      while (source[offset] !== ']') {
        value(); space();
        if (source[offset] !== ',') break;
        offset++;
      }
      offset++;
    } else if (source[offset] === '"') string();
    else {
      const start = offset;
      while (offset < source.length && !/[\s,\]}]/.test(source[offset]!)) offset++;
      const token = source.slice(start, offset);
      if (/^-?\d/.test(token)) requireValue(Number.isFinite(Number(token)), 'Non-finite JSON number');
    }
  };
  value();
  return parsed;
}
export const readJson = (path: string): unknown => parseJson(readFileSync(path, 'utf8'));
export const jsonBytes = (value: unknown): Buffer => Buffer.from(JSON.stringify(value, null, 2) + '\n');

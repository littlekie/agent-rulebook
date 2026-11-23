// Case-sensitive fnmatch-style matching. Unlike path globs, * and ? include /.
// A dynamic-programming matcher avoids backtracking on untrusted path patterns.
type Token = { star: true } | { matches: (character: string) => boolean };
export function globMatch(path: string, pattern: string): boolean {
  const characters = Array.from(pattern);
  const tokens: Token[] = [];
  for (let i = 0; i < characters.length; i++) {
    const c = characters[i]!;
    if (c === '*') { tokens.push({ star: true }); continue; }
    if (c === '?') { tokens.push({ matches: () => true }); continue; }
    if (c === '[') {
      let end = i + 1;
      if (characters[end] === '!') end++;
      if (characters[end] === ']') end++;
      while (end < characters.length && characters[end] !== ']') end++;
      if (end < characters.length) {
        const values = characters.slice(i + 1, end);
        const negate = values[0] === '!';
        if (negate) values.shift();
        const ranges: [string, string][] = [];
        for (let k = 0; k < values.length; k++) {
          const start = values[k]!;
          if (values[k + 1] === '-' && k + 2 < values.length) {
            ranges.push([start, values[k + 2]!]); k += 2;
          } else ranges.push([start, start]);
        }
        tokens.push({ matches: (v) => ranges.some(([a, b]) => a.codePointAt(0)! <= v.codePointAt(0)!
          && v.codePointAt(0)! <= b.codePointAt(0)!) !== negate });
        i = end; continue;
      }
    }
    tokens.push({ matches: (v) => v === c });
  }
  const input = Array.from(path);
  let row = Array<boolean>(input.length + 1).fill(false); row[0] = true;
  for (const token of tokens) {
    const next = Array<boolean>(input.length + 1).fill(false);
    if ('star' in token) next[0] = row[0]!;
    for (let i = 1; i <= input.length; i++) {
      next[i] = 'star' in token ? row[i]! || next[i - 1]! : row[i - 1]! && token.matches(input[i - 1]!);
    }
    row = next;
  }
  return row[input.length]!;
}

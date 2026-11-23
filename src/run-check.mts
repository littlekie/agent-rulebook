import { parseArgs } from 'node:util';
import path from 'node:path';
import { run } from './runner.mjs';
import { message, requireValue } from './json.mjs';

try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { config: { type: 'string' } } });
  requireValue(positionals.length === 1, 'Usage: node run-check.cjs NAME [--config FILE]');
  // This entry is bundled as CommonJS, next to commands.json in the target.
  process.exitCode = run(positionals[0]!, values.config ?? path.join(__dirname, 'commands.json'));
} catch (error) { console.error(message(error)); process.exitCode = 2; }

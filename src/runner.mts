// Copyright (c) 2026 Agent Rulebook contributors. MIT license.
import spawn from 'cross-spawn';
import { isObject, message, nonempty, readJson } from './json.mjs';

export function run(name: string, configPath: string): number {
  let config: unknown;
  try { config = readJson(configPath); if (!isObject(config)) throw new Error('Commands must be an object'); }
  catch (error) { console.error('INVALID CONFIG: ' + message(error)); return 2; }
  const steps = Object.hasOwn(config, name) ? config[name] : undefined;
  if (!Array.isArray(steps) || !steps.length) { console.error('UNCONFIGURED: ' + name); return 2; }
  const validated: string[][] = [];
  for (const argv of steps) {
    if (!Array.isArray(argv) || !argv.length || !argv.every(nonempty)) { console.error('INVALID COMMAND: ' + name); return 2; }
    validated.push(argv);
  }
  for (const argv of validated) {
    // cross-spawn quotes Windows cmd shims; argument arrays are never joined as shell text.
    const result = spawn.sync(argv[0]!, argv.slice(1), { stdio: 'inherit', timeout: 600_000, killSignal: 'SIGKILL' });
    if (result.error || result.status !== 0) {
      console.error(result.error ? message(result.error) : 'Command failed: ' + String(result.signal ?? result.status)); return 1;
    }
  }
  return 0;
}

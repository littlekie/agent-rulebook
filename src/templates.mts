import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isObject, nonempty, parseJson, readJson, jsonBytes, requireValue as need, type JsonObject } from './json.mjs';
import { LEVELS, validatePolicy } from './policy.mjs';

export const LANGUAGES = ['en', 'zh-CN'];
const texts = ['AGENTS.md', 'REVIEW.md', 'ci/ai-review-prompt.md', 'docs/ai-governance/engineering.md', 'docs/ai-governance/SETUP.md'];
const shared = ['ci/commands.json', 'ci/quality-policy.json', 'ci/templates/github-checks.yml.example', 'docs/ai-governance/LICENSE'];
export function validateCommands(value: unknown): asserts value is Record<string, string[][] | null> {
  need(isObject(value) && Object.keys(value).length, 'Commands must be a nonempty JSON object');
  for (const [name, steps] of Object.entries(value)) {
    need(nonempty(name), 'Invalid check name');
    if (steps === null) continue;
    need(Array.isArray(steps) && steps.length > 0, 'Use a nonempty list of argument arrays, or null: ' + name);
    for (const argv of steps) need(Array.isArray(argv) && argv.length > 0 && argv.every(nonempty), 'Invalid command arguments: ' + name);
  }
}
export function validateConfig(config: unknown): asserts config is JsonObject {
  need(isObject(config) && Object.keys(config).every((k) => ['name', 'commands', 'high_risk_paths', 'required_checks'].includes(k)), 'Config accepts only: name, commands, high_risk_paths, required_checks');
  if (Object.hasOwn(config, 'name')) need(typeof config.name === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(config.name), 'Invalid config name');
  if (Object.hasOwn(config, 'commands')) validateCommands(config.commands);
  if (Object.hasOwn(config, 'high_risk_paths')) need(Array.isArray(config.high_risk_paths)
    && config.high_risk_paths.every((p) => nonempty(p) && !p.includes('\\') && p.split('/').every((s) => !['', '.', '..'].includes(s))), 'Invalid high-risk path pattern');
  if (Object.hasOwn(config, 'required_checks')) {
    need(isObject(config.required_checks) && Object.keys(config.required_checks).every((l) => LEVELS.some((v) => v === l)), 'required_checks accepts only L0, L1 and L2');
    for (const names of Object.values(config.required_checks)) need(Array.isArray(names) && names.length > 0 && names.every(nonempty)
      && names.length === new Set(names).size, 'Additional checks must be a nonempty list of unique names');
  }
}
export function bundle(root: string, language = 'en', configPath?: string) {
  need(LANGUAGES.includes(language), 'Unsupported template language');
  const output: Record<string, Buffer> = Object.fromEntries(texts.map((name) => [name, readFileSync(path.join(root, 'templates', language, name))]));
  for (const name of shared) output[name] = readFileSync(path.join(root, 'templates/shared', name));
  for (const name of ['quality-gate.mjs', 'run-check.cjs']) output['ci/' + name] = readFileSync(path.join(root, 'dist/helpers', name));
  const commands = parseJson(output['ci/commands.json']!.toString('utf8'));
  const policy = parseJson(output['ci/quality-policy.json']!.toString('utf8'));
  validateCommands(commands); validatePolicy(policy);
  let profile = 'default';
  if (configPath) {
    const config = readJson(configPath); validateConfig(config);
    profile = typeof config.name === 'string' ? config.name : 'custom';
    if (config.commands !== undefined) {
      validateCommands(config.commands);
      for (const [key, value] of Object.entries(config.commands)) Object.defineProperty(commands, key, { value, enumerable: true, writable: true, configurable: true });
    }
    if (Array.isArray(config.high_risk_paths)) for (const p of config.high_risk_paths) {
      need(nonempty(p), 'Invalid risk path'); if (!policy.high_risk_paths.includes(p)) policy.high_risk_paths.push(p);
    }
    const extra: string[] = [];
    for (const l of LEVELS) {
      const names = isObject(config.required_checks) ? config.required_checks[l] : undefined;
      if (Array.isArray(names)) for (const name of names) { need(nonempty(name), 'Invalid check name'); extra.push(name); }
      for (const name of extra) if (!policy.required_checks[l].includes(name)) policy.required_checks[l].push(name);
    }
  }
  validateCommands(commands); validatePolicy(policy);
  output['ci/commands.json'] = jsonBytes(commands); output['ci/quality-policy.json'] = jsonBytes(policy);
  const metadata = readJson(path.join(root, 'package.json'));
  need(isObject(metadata) && nonempty(metadata.version), 'Invalid package version');
  output['ci/agent_rulebook.json'] = jsonBytes({ version: metadata.version, profile, language, automation: 'not-configured',
    files: Object.fromEntries(Object.keys(output).sort().map((name) => [name, createHash('sha256').update(output[name]!).digest('hex')])) });
  return { output, profile };
}

#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { rootPath, checkedPath, plan, applyPlan, PROPOSALS } from './filesystem.mjs';
import { bundle, LANGUAGES, validateCommands } from './templates.mjs';
import { validatePolicy } from './policy.mjs';
import { isObject, readJson, message, requireValue as need } from './json.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const metadata = readJson(fileURLToPath(new URL('../package.json', import.meta.url)));
need(isObject(metadata), 'Invalid package metadata');
const help = `Agent Rulebook — AI coding rules, reviews, and quality gates.
Usage: agent-rulebook init [target] [--config FILE] [--language en|zh-CN] [--apply] [--json]
       agent-rulebook doctor [target] [--json]
       agent-rulebook --version
Init previews by default. Doctor only inspects local configuration. Requires Node.js 22+.`;
let json = process.argv.slice(2).includes('--json');
try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    config: { type: 'string' }, language: { type: 'string' }, apply: { type: 'boolean' },
    json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' }, version: { type: 'boolean' },
  } });
  json = values.json === true;
  if (values.help) console.log(help);
  else if (values.version) console.log('agent-rulebook ' + String(metadata.version));
  else {
    const [command, target = '.'] = positionals;
    need(positionals.length <= 2 && (command === 'init' || command === 'doctor'), help);
    need(command === 'init' || (!values.apply && values.config === undefined && values.language === undefined), 'doctor accepts only target and --json');
    const directory = rootPath(target);
    let result: Record<string, unknown>, code: number;
    if (command === 'init') {
      const language = values.language ?? 'en'; need(LANGUAGES.includes(language), 'Unsupported template language');
      const { output, profile } = bundle(root, language, values.config);
      const entries = plan(directory, output), conflicts = entries.some((e) => e.action === 'conflict');
      if (values.apply && !conflicts) applyPlan(directory, entries);
      result = { status: conflicts ? 'conflict' : values.apply ? 'initialized' : 'preview', target: directory, profile, language,
        files: entries.map(({ path, action }) => ({ path, action })),
        proposals: entries.filter((e) => Object.values(PROPOSALS).includes(e.path)).map((e) => e.path),
        automation: 'not-configured', next: 'Integrate proposals, configure ci/commands.json, run doctor, then follow docs/ai-governance/SETUP.md.' };
      code = conflicts ? 1 : 0;
    } else {
      need(existsSync(directory) && statSync(directory).isDirectory(), 'Target directory does not exist');
      const issues: string[] = [];
      for (const name of ['AGENTS.md', 'REVIEW.md', 'ci/ai-review-prompt.md', 'ci/quality-gate.mjs', 'ci/run-check.cjs', 'docs/ai-governance/engineering.md', 'docs/ai-governance/SETUP.md']) {
        const p = checkedPath(directory, name);
        if (!existsSync(p) || !readFileSync(p, 'utf8').trim()) issues.push('Missing or empty file: ' + name);
      }
      for (const name of Object.values(PROPOSALS)) if (existsSync(checkedPath(directory, name))) issues.push('Integrate, then remove proposal: ' + name);
      const policy = readJson(checkedPath(directory, 'ci/quality-policy.json')), commands = readJson(checkedPath(directory, 'ci/commands.json'));
      validatePolicy(policy); validateCommands(commands);
      for (const name of [...new Set(['setup', ...Object.values(policy.required_checks).flat()])].sort()) {
        if (!Object.hasOwn(commands, name) || commands[name] === null) issues.push('Unconfigured check (platform checks need a trusted adapter): ' + name);
      }
      result = { status: issues.length ? 'needs-configuration' : 'local-config-valid', target: directory, issues,
        automation: 'not-verified', checks_executed: false,
        notice: 'Local structure only. Project commands, model review, CI, rulesets and merge permissions were not verified.' };
      code = issues.length ? 1 : 0;
    }
    if (json) console.log(JSON.stringify(result, null, 2));
    else {
      console.log('Agent Rulebook · ' + String(result.status));
      if (Array.isArray(result.files)) for (const entry of result.files) console.log(`  ${entry.action} ${entry.path}`);
      if (Array.isArray(result.issues)) for (const issue of result.issues) console.log('  - ' + String(issue));
      for (const key of ['next', 'notice', 'automation']) if (result[key]) console.log(String(result[key]));
    }
    process.exitCode = code;
  }
} catch (error) {
  console.log(json ? JSON.stringify({ status: 'error', message: message(error) }) : 'Agent Rulebook · error\n' + message(error));
  process.exitCode = 2;
}

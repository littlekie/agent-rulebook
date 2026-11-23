// Copyright (c) 2026 Agent Rulebook contributors. MIT license.
// Generated copies include docs/ai-governance/LICENSE.
import { isDeepStrictEqual } from 'node:util';
import { globMatch, validateGlob } from './glob.mjs';
import { isObject, nonempty, requireValue as need, type JsonObject } from './json.mjs';

export const LEVELS = ['L0', 'L1', 'L2'] as const;
export type Level = typeof LEVELS[number];
export interface Policy {
  version: 1;
  low_risk_paths: string[];
  high_risk_paths: string[];
  required_checks: Record<Level, string[]>;
}
export interface Context {
  repository: string; pr_number: number; head_sha: string; base_sha: string;
  tested_sha: string; policy_sha256: string;
}
const contextFields = ['repository', 'pr_number', 'head_sha', 'base_sha', 'tested_sha', 'policy_sha256'];
export function validPath(path: unknown): string {
  need(nonempty(path) && !path.startsWith('/') && !path.includes('\\'), 'Path must be relative POSIX');
  need(path.split('/').every((p) => !['', '.', '..'].includes(p)), 'Unsafe file path');
  return path;
}
export function level(value: unknown): Level {
  need(value === 'L0' || value === 'L1' || value === 'L2', 'Invalid risk level');
  return value;
}
export function validateContext(value: unknown): asserts value is Context {
  need(isObject(value) && Object.keys(value).length === contextFields.length
    && contextFields.every((key) => Object.hasOwn(value, key)), 'Invalid context fields');
  need(nonempty(value.repository) && value.repository.split('/').length === 2
    && value.repository.split('/').every(Boolean), 'Invalid repository');
  need(typeof value.pr_number === 'number' && Number.isSafeInteger(value.pr_number) && value.pr_number > 0, 'Invalid PR number');
  for (const key of ['head_sha', 'base_sha', 'tested_sha']) need(typeof value[key] === 'string'
    && /^[0-9a-f]{40}$/.test(value[key]), 'Invalid ' + key);
  need(typeof value.policy_sha256 === 'string' && /^[0-9a-f]{64}$/.test(value.policy_sha256), 'Invalid policy digest');
}
export function validatePolicy(value: unknown): asserts value is Policy {
  need(isObject(value) && value.version === 1, 'Unsupported policy version');
  for (const key of ['low_risk_paths', 'high_risk_paths']) {
    const patterns = value[key];
    need(Array.isArray(patterns) && patterns.every(nonempty), 'Invalid ' + key);
    patterns.forEach(validateGlob);
  }
  const checks = value.required_checks;
  need(isObject(checks) && Object.keys(checks).length === 3
    && LEVELS.every((l) => Object.hasOwn(checks, l)), 'Invalid check matrix');
  let previous: string[] = [];
  for (const l of LEVELS) {
    const names = checks[l];
    need(Array.isArray(names) && names.length > 0 && names.every(nonempty), 'Empty/invalid checks');
    need(new Set(names).size === names.length && previous.every((name) => names.includes(name)), 'Checks must be unique and cumulative');
    previous = names;
  }
}
export function classify(policy: Policy, changes: unknown): Level {
  need(Array.isArray(changes) && changes.length > 0, 'Complete nonempty change list required');
  const paths: string[] = [];
  for (const item of changes) {
    need(isObject(item), 'Invalid change record');
    need(typeof item.status === 'string' && ['added', 'modified', 'removed', 'renamed', 'copied', 'changed'].includes(item.status), 'Unknown change status');
    paths.push(validPath(item.path));
    if (['renamed', 'copied'].includes(item.status) || Object.hasOwn(item, 'previous_path')) paths.push(validPath(item.previous_path));
  }
  if (paths.some((path) => policy.high_risk_paths.some((p) => globMatch(path, p)))) return 'L2';
  return paths.every((path) => policy.low_risk_paths.some((p) => globMatch(path, p))) ? 'L0' : 'L1';
}
function review(value: unknown): JsonObject & { minimum_risk: Level; findings: JsonObject[]; unresolved_questions: string[] } {
  need(isObject(value), 'Invalid review');
  need(typeof value.status === 'string' && ['complete', 'unavailable', 'error'].includes(value.status), 'Invalid review status');
  const minimum_risk = level(value.minimum_risk);
  need(typeof value.coverage === 'string' && ['complete', 'partial'].includes(value.coverage), 'Invalid review coverage');
  const questions = value.unresolved_questions;
  need(Array.isArray(questions) && questions.every(nonempty), 'Invalid review questions');
  const findings = value.findings;
  need(Array.isArray(findings), 'Invalid review findings');
  const checked: JsonObject[] = [];
  for (const item of findings) {
    need(isObject(item) && typeof item.blocking === 'boolean', 'Invalid finding blocking flag');
    validPath(item.file);
    need(typeof item.line === 'number' && Number.isSafeInteger(item.line) && item.line > 0, 'Invalid finding line');
    for (const key of ['title', 'trigger', 'impact', 'evidence']) need(nonempty(item[key]) && item[key].trim(), 'Missing finding ' + key);
    checked.push(item);
  }
  return { ...value, minimum_risk, findings: checked, unresolved_questions: questions };
}
export function evaluate(policy: unknown, context: unknown, evidence: unknown) {
  validatePolicy(policy); validateContext(context); need(isObject(evidence), 'Invalid evidence');
  let risk = classify(policy, evidence.changed_files);
  const reasons: string[] = [];
  const raise = (other: Level) => { if (LEVELS.indexOf(other) > LEVELS.indexOf(risk)) risk = other; };
  if (!isDeepStrictEqual(evidence.context, context)) reasons.push('evidence context is stale or mismatched');
  if (evidence.changes_complete !== true) reasons.push('change list is incomplete');
  raise(level(Object.hasOwn(evidence, 'declared_risk') ? evidence.declared_risk : 'L0'));
  if (evidence.review !== undefined && evidence.review !== null) {
    const r = review(evidence.review); raise(r.minimum_risk);
    if (!isDeepStrictEqual(r.context, context)) reasons.push('review context is stale or mismatched');
    if (r.status !== 'complete' || r.coverage !== 'complete') reasons.push('independent review is incomplete');
    if (r.unresolved_questions.length) reasons.push('review has unresolved questions');
    if (r.findings.some((f) => f.blocking)) reasons.push('review has blocking findings');
  } else if (risk !== 'L0') reasons.push('independent review is missing');
  need(Array.isArray(evidence.checks), 'Invalid check results');
  const checks = new Map<string, JsonObject>();
  for (const c of evidence.checks) {
    need(isObject(c) && nonempty(c.name), 'Invalid check');
    need(!checks.has(c.name), 'Duplicate check name'); checks.set(c.name, c);
  }
  for (const name of policy.required_checks[risk]) {
    const c = checks.get(name);
    if (!c || c.status !== 'success') reasons.push('required check is not successful: ' + name);
    else if (!isDeepStrictEqual(c.context, context)) reasons.push('check context is stale or mismatched: ' + name);
  }
  if (risk === 'L2') {
    const a = evidence.human_approval;
    if (!(isObject(a) && a.state === 'approved' && a.authorized === true
      && isDeepStrictEqual(a.context, context) && nonempty(a.reviewer) && a.reviewer.trim())) {
      reasons.push('current authorized human approval is required for L2');
    }
  }
  return { decision: reasons.length ? 'hold' : 'eligible', risk, required_checks: policy.required_checks[risk], reasons };
}

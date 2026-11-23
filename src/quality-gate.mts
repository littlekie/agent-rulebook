// Copyright (c) 2026 Agent Rulebook contributors. MIT license.
// Requires authenticated inputs from a trusted controller. No merge authority.
import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readJson, message, requireValue } from './json.mjs';
import { evaluate, validateContext } from './policy.mjs';

try {
  const { values } = parseArgs({ options: { policy: { type: 'string' }, context: { type: 'string' }, evidence: { type: 'string' } } });
  requireValue(values.policy && values.context && values.evidence, 'Required: --policy FILE --context FILE --evidence FILE');
  const policy = readJson(values.policy), context = readJson(values.context), evidence = readJson(values.evidence);
  validateContext(context);
  requireValue(createHash('sha256').update(readFileSync(values.policy)).digest('hex') === context.policy_sha256, 'Policy digest does not match active policy');
  const result = evaluate(policy, context, evidence);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.decision === 'eligible' ? 0 : 1;
} catch (error) {
  console.log(JSON.stringify({ decision: 'invalid', reasons: [message(error)] })); process.exitCode = 2;
}

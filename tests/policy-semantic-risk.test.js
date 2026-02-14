import test from 'node:test';
import assert from 'node:assert/strict';

import { scoreSemanticChanges, riskBand } from '../services/repo-generator/semanticRisk.js';
import { evaluatePolicy } from '../services/repo-generator/policy.js';

test('scoreSemanticChanges applies weights and hard blocks deterministically', () => {
  const result = scoreSemanticChanges([
    { type: 'function_added', name: 'x' },
    { type: 'export_removed', name: 'legacyExport' },
    { type: 'ci_permissions_changed' },
  ]);

  assert.equal(result.score, 15);
  assert.equal(result.blocked, true);
  assert.deepEqual(result.hits[0], { type: 'function_added', name: 'x', weight: 1 });
  assert.deepEqual(result.hits[1], { type: 'export_removed', name: 'legacyExport', weight: 5 });
  assert.deepEqual(result.hits[3], { type: 'HARD_BLOCK', name: 'ci_permissions_changed', weight: 999 });
});

test('riskBand classifies scores by configured thresholds', () => {
  assert.equal(riskBand(3, { low: 4, medium: 10 }), 'low');
  assert.equal(riskBand(8, { low: 4, medium: 10 }), 'medium');
  assert.equal(riskBand(11, { low: 4, medium: 10 }), 'high');
});

test('evaluatePolicy surfaces semantic risk metadata and blocks without approval', () => {
  const policy = evaluatePolicy({
    task: { id: 'T1', explicit_high_risk_approval: false },
    verifier: { status: 'pass' },
    ci: { conclusion: 'success' },
    diffSummary: {
      files: ['src/foo.ts'],
      semantic: [{ type: 'secrets_reference_added', name: 'TOKEN' }],
    },
    budget: { tokens_used: 1, api_calls: 1 },
    config: {
      max_tokens: 120000,
      max_api_calls: 80,
      max_files_per_task: 10,
      high_risk_paths: ['.github/workflows/', 'server.js', 'policy.js', 'package.json'],
      semantic_thresholds: { low: 4, medium: 10 },
      semantic_soft_cap: 12,
      semantic_weights: { export_removed: 7 },
      semantic_hard_block: ['ci_permissions_changed', 'secrets_reference_added'],
    },
  });

  assert.equal(policy.allow_merge, false);
  assert.equal(policy.risk_level, 'medium');
  assert.equal(policy.semantic_risk.score, 7);
  assert.equal(policy.semantic_risk.band, 'medium');
  assert.ok(policy.reasons.includes('Semantic hard-block triggered (requires explicit approval).'));
});

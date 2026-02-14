import { scoreSemanticChanges, riskBand } from './semanticRisk.js';

function parseEnvNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function buildPolicyConfig(overrides = {}) {
  const envConfig = {
    max_tokens: parseEnvNumber(process.env.POLICY_MAX_TOKENS, 120000),
    max_api_calls: parseEnvNumber(process.env.POLICY_MAX_API_CALLS, 80),
    max_files_per_task: parseEnvNumber(process.env.POLICY_MAX_FILES_PER_TASK, 10),
    high_risk_paths: process.env.POLICY_HIGH_RISK_PATHS
      ? process.env.POLICY_HIGH_RISK_PATHS.split(',').map((item) => item.trim()).filter(Boolean)
      : ['.github/workflows/', 'server.js', 'policy.js', 'package.json'],
    semantic_thresholds: {
      low: parseEnvNumber(process.env.POLICY_SEMANTIC_LOW_THRESHOLD, 4),
      medium: parseEnvNumber(process.env.POLICY_SEMANTIC_MEDIUM_THRESHOLD, 10),
    },
    semantic_soft_cap: parseEnvNumber(process.env.POLICY_SEMANTIC_SOFT_CAP, 12),
    semantic_weights: {
      export_removed: parseEnvNumber(process.env.POLICY_SEMANTIC_WEIGHT_EXPORT_REMOVED, 7),
    },
    semantic_hard_block: process.env.POLICY_SEMANTIC_HARD_BLOCK
      ? process.env.POLICY_SEMANTIC_HARD_BLOCK.split(',').map((item) => item.trim()).filter(Boolean)
      : ['ci_permissions_changed', 'secrets_reference_added'],
  };

  return {
    ...envConfig,
    ...overrides,
  };
}

export function evaluatePolicy({ task, verifier, ci, diffSummary, budget, config }) {
  const resolvedConfig = buildPolicyConfig(config);
  const reasons = [];
  let risk = 'low';

  if (!verifier || verifier.status !== 'pass') {
    reasons.push('Verifier did not approve patch.');
  }

  if (!ci || ci.conclusion !== 'success') {
    reasons.push('CI not green.');
  }

  if (budget) {
    if (budget.tokens_used > resolvedConfig.max_tokens) {
      reasons.push('Token budget exceeded.');
      risk = risk === 'high' ? risk : 'medium';
    }

    if (budget.api_calls > resolvedConfig.max_api_calls) {
      reasons.push('API call budget exceeded.');
      risk = risk === 'high' ? risk : 'medium';
    }
  }

  const highRiskPaths = resolvedConfig.high_risk_paths || ['.github/workflows/', 'package.json', 'server.js'];
  const touched = diffSummary?.files || [];

  const riskyTouched = touched.some((filePath) => highRiskPaths.some((riskPath) => filePath.startsWith(riskPath)));

  if (riskyTouched && !task?.explicit_high_risk_approval) {
    reasons.push('High-risk files modified without approval.');
    risk = 'high';
  }

  if (touched.length > resolvedConfig.max_files_per_task) {
    reasons.push('Too many files modified in single task.');
    risk = risk === 'high' ? risk : 'medium';
  }

  const semanticEvents = diffSummary?.semantic || [];
  const semantic = scoreSemanticChanges(semanticEvents, resolvedConfig);
  const semanticBand = riskBand(semantic.score, resolvedConfig.semantic_thresholds || { low: 4, medium: 10 });

  const bandRank = { low: 0, medium: 1, high: 2 };
  if (bandRank[semanticBand] > bandRank[risk]) {
    risk = semanticBand;
  }

  if (semantic.blocked && !task?.explicit_high_risk_approval) {
    reasons.push('Semantic hard-block triggered (requires explicit approval).');
  }

  if (semantic.score > (resolvedConfig.semantic_soft_cap ?? 12) && !task?.explicit_high_risk_approval) {
    reasons.push(`Semantic risk score too high (${semantic.score}).`);
  }

  return {
    allow_merge: reasons.length === 0,
    reasons,
    risk_level: risk,
    semantic_risk: {
      score: semantic.score,
      band: semanticBand,
      hits: semantic.hits,
    },
  };
}

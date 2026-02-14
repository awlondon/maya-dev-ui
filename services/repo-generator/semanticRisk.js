const DEFAULT_WEIGHTS = {
  function_added: 1,
  function_removed: 4,
  export_added: 2,
  export_removed: 5,
  class_added: 2,
  class_removed: 5,
  react_component_added: 2,
  react_component_removed: 6,
  dependency_added: 2,
  dependency_removed: 6,
  dependency_version_changed: 3,
  ci_job_added: 3,
  ci_job_removed: 8,
  ci_runner_changed: 6,
  ci_permissions_changed: 9,
  ci_trigger_changed: 7,
  env_var_added: 5,
  secrets_reference_added: 7,
};

const DEFAULT_HARD_BLOCK = new Set(['ci_permissions_changed', 'secrets_reference_added']);

export function scoreSemanticChanges(semanticChanges = [], config = {}) {
  const weights = { ...DEFAULT_WEIGHTS, ...(config.semantic_weights || {}) };
  const hardBlock = new Set([...DEFAULT_HARD_BLOCK, ...((config.semantic_hard_block || []))]);

  let score = 0;
  const hits = [];

  for (const change of semanticChanges) {
    const type = change?.type;
    if (!type) continue;

    const weight = weights[type] ?? 1;
    score += weight;
    hits.push({ type, name: change?.name, weight });

    if (hardBlock.has(type)) {
      hits.push({ type: 'HARD_BLOCK', name: type, weight: 999 });
    }
  }

  const blocked = hits.some((hit) => hit.type === 'HARD_BLOCK');
  return { score, blocked, hits };
}

export function riskBand(score, thresholds = { low: 4, medium: 10 }) {
  if (score <= thresholds.low) return 'low';
  if (score <= thresholds.medium) return 'medium';
  return 'high';
}

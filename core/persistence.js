const STORAGE_KEY = 'pdco_agents_state_v2';
const LEGACY_STORAGE_KEY = 'pdco_agent_state_v1';

export function persistAgentsState(agentsState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(agentsState));
  } catch (e) {
    console.warn('Persist failed:', e);
  }
}

export function loadAgentsState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearAgentsState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures while clearing.
  }
}

export function migrateLegacyAgentState() {
  try {
    const old = localStorage.getItem(LEGACY_STORAGE_KEY);
    const hasNew = localStorage.getItem(STORAGE_KEY);
    if (!old || hasNew) {
      return;
    }

    const legacyAgent = JSON.parse(old);
    if (!legacyAgent || typeof legacyAgent !== 'object') {
      return;
    }

    const agentId = legacyAgent.agentId || 'agent-1';
    persistAgentsState({
      byId: { [agentId]: { ...legacyAgent, agentId } },
      activeAgentId: agentId
    });
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Ignore migration failures.
  }
}

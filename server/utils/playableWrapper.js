const DEFAULT_CODE_CHAR_LIMIT = 1200;

export function selectRelevantPlayableCode(code = '', maxChars = DEFAULT_CODE_CHAR_LIMIT) {
  const normalized = String(code || '').trim();
  if (!normalized) {
    return '';
  }

  if (normalized.length <= maxChars) {
    return normalized;
  }

  const lines = normalized.split('\n');
  const selected = [];
  let size = 0;

  const pushLine = (line) => {
    if (size >= maxChars) {
      return;
    }
    const next = line.length + 1;
    if (size + next <= maxChars || selected.length === 0) {
      selected.push(line);
      size += next;
    }
  };

  for (const line of lines) {
    if (/\b(function|class|const|let|var|if|for|while|switch|return|addEventListener|keydown|keyup|click|mousedown|mouseup|canvas|requestAnimationFrame)\b/.test(line)) {
      pushLine(line);
    }
  }

  for (let index = lines.length - 1; index >= 0 && size < maxChars; index -= 1) {
    pushLine(lines[index]);
  }

  return selected.join('\n').slice(0, maxChars);
}

export function buildPlayablePrompt({ prompt = '', code = '' } = {}) {
  const normalizedPrompt = String(prompt || '').trim();
  const relevantCode = selectRelevantPlayableCode(code);

  return `You are an AI game designer. Transform the user request into an interactive, playable experience.

Requirements:
- Include clear game objectives, progression, and core mechanics.
- Add feedback loops that react to user actions.
- Include mouse and keyboard interaction affordances where applicable.
- Add rewards/incentives inspired by simple game theory concepts (risk/reward, resource tradeoffs, or strategic choices).
- Keep it practical, runnable, and user-facing.
- At the end of your output, include a brief design explanation summarizing key game decisions.
- If the request is ambiguous, do not ask follow-up questions; proceed immediately with a sensible default playable interpretation and briefly state your assumptions.

User prompt:
${normalizedPrompt || '(none provided)'}

Relevant code context:
${relevantCode || '(none provided)'}
`;
}

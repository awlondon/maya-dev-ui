const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('btn-send');
const codeEditor = document.getElementById('code-editor');
const consoleOutput = document.getElementById('console-output');
const previewFrame = document.getElementById('preview-frame');
const statusLabel = document.getElementById('status-label');
const regenModeRegenerate = document.getElementById('regen-mode-regenerate');
const regenModeLock = document.getElementById('regen-mode-lock');
const BACKEND_URL =
  "https://text-code.primarydesigncompany.workers.dev";

codeEditor.value = `// Write JavaScript here to experiment with the editor.\n\nconst greeting = "Hello from Maya Dev UI";\nconsole.log(greeting);\n\n(() => greeting.toUpperCase())();`;

function setStatusOnline(isOnline) {
  statusLabel.textContent = isOnline ? 'API online' : 'Offline';
  statusLabel.classList.toggle('online', isOnline);
}

function appendMessage(role, content) {
  const message = document.createElement('div');
  message.className = `message ${role}`;
  message.textContent = content;
  chatMessages.appendChild(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return message;
}

function appendOutput(content, variant = 'success') {
  const line = document.createElement('div');
  line.className = `output-line ${variant}`;
  line.textContent = content;
  consoleOutput.appendChild(line);
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function handleConsoleLog(...args) {
  appendOutput(args.map((item) => String(item)).join(' '), 'success');
}

function buildWrappedPrompt(userInput, options = {}) {
  const { isLocked, existingCode } = options;
  const codeContext = isLocked && existingCode
    ? `\nCurrent code to modify (do not replace entirely):\n${existingCode}\n`
    : '';
  const lockInstruction = isLocked
    ? '- You must update the current code based on the request, preserving structure when possible\n'
    : '- Generate a fresh implementation from scratch\n';

  return `
Return JSON ONLY. No markdown. No commentary.

Schema:
{
  "text": "Plain-language explanation for the user",
  "code": "Complete self-contained HTML/CSS/JS runnable in a browser"
}

Rules:
- "code" must be executable as-is
- No external libraries
- Inline CSS and JS only
- Do not escape HTML
${lockInstruction}

${codeContext}
User request:
${userInput}
`;
}

function runGeneratedCode(code) {
  if (!previewFrame) {
    return;
  }
  previewFrame.srcdoc = code;
}

async function sendChat() {
  const prompt = chatInput.value.trim();
  if (!prompt) {
    return;
  }

  chatInput.value = '';
  appendMessage('user', prompt);

  const assistantBubble = appendMessage('assistant', '');

  sendButton.disabled = true;
  setStatusOnline(false);

  try {
    const messages = [
      {
        role: 'system',
        content: 'You generate interactive UI code and explanations.'
      },
      {
        role: 'user',
        content: buildWrappedPrompt(prompt, {
          isLocked: regenModeLock?.checked,
          existingCode: codeEditor.value.trim()
        })
      }
    ];

    const res = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || 'Unable to reach the chat service.');
    }

    setStatusOnline(true);
    const reply = data?.choices?.[0]?.message?.content || 'No response.';
    let parsed;
    try {
      parsed = JSON.parse(reply);
    } catch {
      assistantBubble.remove();
      appendMessage('assistant', '⚠️ Model returned invalid JSON.');
      return;
    }

    if (!parsed.text || !parsed.code) {
      assistantBubble.remove();
      appendMessage('assistant', '⚠️ Response missing required fields.');
      return;
    }

    assistantBubble.textContent = parsed.text;
    chatMessages.scrollTop = chatMessages.scrollHeight;
    codeEditor.value = parsed.code;
    runGeneratedCode(parsed.code);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.';
    appendMessage('system', message);
  } finally {
    sendButton.disabled = false;
  }
}

chatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  sendChat();
});

setStatusOnline(false);

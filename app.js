const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('btn-send');
const codeEditor = document.getElementById('code-editor');
const runButton = document.getElementById('btn-run');
const consoleOutput = document.getElementById('console-output');
const statusLabel = document.getElementById('status-label');
const apiKeyInput = document.getElementById('api-key-input');
const apiKeySaveBtn = document.getElementById('api-key-save-btn');

const chatHistory = [];

codeEditor.value = `// Write JavaScript here and click Run Code.\n\nconst greeting = "Hello from Maya Dev UI";\nconsole.log(greeting);\n\n(() => greeting.toUpperCase())();`;

const savedApiKey = localStorage.getItem('openai_api_key');
if (savedApiKey && apiKeyInput) {
  apiKeyInput.value = savedApiKey;
}

if (apiKeySaveBtn) {
  apiKeySaveBtn.addEventListener('click', () => {
    const key = apiKeyInput?.value?.trim();
    if (key) {
      localStorage.setItem('openai_api_key', key);
      alert('API key saved.');
    } else {
      alert('Please enter a valid API key before saving.');
    }
  });
}

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

function getOpenAiApiKey() {
  const inputKey = apiKeyInput?.value?.trim();
  let apiKey = localStorage.getItem('openai_api_key');
  if (inputKey) {
    apiKey = inputKey;
    localStorage.setItem('openai_api_key', apiKey);
  }
  if (!apiKey) {
    throw new Error('No API key provided. Please enter your OpenAI API key in the API key field and click Save.');
  }
  return apiKey;
}

async function sendChat() {
  const prompt = chatInput.value.trim();
  if (!prompt) {
    return;
  }

  chatInput.value = '';
  const userMessage = { role: 'user', content: prompt };
  chatHistory.push(userMessage);
  appendMessage('user', prompt);

  const assistantMessage = { role: 'assistant', content: '' };
  chatHistory.push(assistantMessage);
  const assistantBubble = appendMessage('assistant', '');

  sendButton.disabled = true;
  setStatusOnline(false);

  try {
    const apiKey = getOpenAiApiKey();
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ messages: chatHistory, apiKey })
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text();
      throw new Error(errorText || 'Unable to reach the chat service.');
    }

    setStatusOnline(true);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) {
          continue;
        }

        const payload = trimmed.replace(/^data:\s*/, '');
        if (payload === '[DONE]') {
          continue;
        }

        let deltaText = '';
        try {
          const parsed = JSON.parse(payload);
          deltaText = parsed.choices?.[0]?.delta?.content || '';
        } catch (error) {
          deltaText = '';
        }

        if (deltaText) {
          assistantMessage.content += deltaText;
          assistantBubble.textContent = assistantMessage.content;
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.';
    appendMessage('system', message);
  } finally {
    sendButton.disabled = false;
  }
}

function runCode() {
  consoleOutput.innerHTML = '';
  const originalConsoleLog = console.log;
  console.log = handleConsoleLog;

  try {
    const result = eval(codeEditor.value);
    if (result !== undefined) {
      appendOutput(String(result), 'success');
    } else {
      appendOutput('Code executed (no return value).', 'success');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error.';
    appendOutput(`Error: ${message}`, 'error');
  } finally {
    console.log = originalConsoleLog;
  }
}

chatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  sendChat();
});

runButton.addEventListener('click', runCode);

setStatusOnline(false);

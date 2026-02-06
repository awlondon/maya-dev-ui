// Simple dev sandbox for HTML/CSS/JS prototyping
const editor = document.getElementById('code-editor');
const preview = document.getElementById('preview-iframe');
const btnRun = document.getElementById('btn-run');
const btnReset = document.getElementById('btn-reset');
const statusLabel = document.getElementById('status-label');

// Provide an initial template so users know the context
editor.value = `<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8" />\n  <title>Preview</title>\n  <style>\n    body { background:#0b0b0f; color:#eee; font-family:sans-serif; padding: 1rem; }\n  </style>\n</head>\n<body>\n  <h1>Hello from the dev iframe</h1>\n  <p>Write your HTML/JS/CSS here.</p>\n</body>\n</html>`;

/**
 * Render the current content of the editor into the preview iframe.
 */
function runCode() {
  const doc = preview.contentDocument || preview.contentWindow.document;
  // Reset the iframe document and write new content
  doc.open();
  doc.write(editor.value);
  doc.close();

  // Notify parent window (host) that code ran successfully
  if (window.parent !== window) {
    window.parent.postMessage({
      type: 'RUN_CODE_RESULT',
      payload: { ok: true }
    }, '*');
  }
}

// Bind run action to button
btnRun.addEventListener('click', runCode);

// Reset the editor and preview pane to a blank state
btnReset.addEventListener('click', () => {
  editor.value = '';
  const doc = preview.contentDocument || preview.contentWindow.document;
  doc.open();
  doc.write('<!DOCTYPE html><html><body></body></html>');
  doc.close();
});

// Listen for messages from host (e.g., conversation context, focus events)
window.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  if (type === 'UPDATE_FROM_HOST') {
    statusLabel.textContent = 'Update received';
    // Prepend context into a comment at top if not already there
    const header = `<!-- Context: ${JSON.stringify(payload).slice(0, 200)} -->\n`;
    if (!editor.value.startsWith('<!-- Context:')) {
      editor.value = header + '\n' + editor.value;
    }
  }

  if (type === 'FOCUS_IFRAME') {
    // Focus this window when instructed by host
    window.focus();
  }
});

// Detect whether this window is embedded in host or standalone
if (window.parent === window) {
  statusLabel.textContent = 'Standalone window';
} else {
  statusLabel.textContent = 'Embedded in host UI';
}

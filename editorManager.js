const MONACO_VERSION = '0.50.0';
const MONACO_BASE_URL = `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min`;
const MONACO_LOADER_URL = `${MONACO_BASE_URL}/vs/loader.js`;
const MONACO_WORKER_MAIN_URL = `${MONACO_BASE_URL}/vs/base/worker/workerMain.js`;

const LOADER_DATA_ATTRIBUTE = 'data-monaco-amd-loader';
const loaderScriptId = 'monaco-amd-loader';

function buildEditorApi(editor) {
  const withModel = (callback) => {
    const model = editor.getModel();
    if (model) {
      callback(model);
    }
  };

  return {
    editor,
    keybindings: {
      outdent: monaco.KeyMod.Shift | monaco.KeyCode.Tab,
      gotoLine: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyG,
      runCode: monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter
    },
    getValue: () => editor.getValue(),
    setValue: (value) => editor.setValue(value),
    getPosition: () => editor.getPosition(),
    setPosition: (position) => editor.setPosition(position),
    getScrollTop: () => editor.getScrollTop(),
    setScrollTop: (value) => editor.setScrollTop(value),
    focus: () => editor.focus(),
    revealLineInCenter: (lineNumber) => editor.revealLineInCenter(lineNumber),
    onDidChangeModelContent: (handler) => editor.onDidChangeModelContent(handler),
    addCommand: (...args) => editor.addCommand(...args),
    addAction: (action) => editor.addAction(action),
    trigger: (...args) => editor.trigger(...args),
    updateOptions: (optionsToApply) => editor.updateOptions(optionsToApply),
    updateModelOptions: (optionsToApply) => withModel((model) => model.updateOptions(optionsToApply)),
    getLineCount: () => editor.getModel()?.getLineCount() ?? 0,
    setLanguage: (language) => {
      withModel((model) => monaco.editor.setModelLanguage(model, language));
    },
    clearMarkers: () => {
      withModel((model) => monaco.editor.setModelMarkers(model, 'runtime', []));
    },
    setMarkers: (errors = []) => {
      withModel((model) => {
        const markers = errors.map((error) => ({
          startLineNumber: error.line || 1,
          startColumn: error.column || 1,
          endLineNumber: error.line || 1,
          endColumn: (error.column || 1) + 1,
          message: error.message || 'Error',
          severity: error.severity === 'warning'
            ? monaco.MarkerSeverity.Warning
            : monaco.MarkerSeverity.Error
        }));
        monaco.editor.setModelMarkers(model, 'runtime', markers);
      });
    }
  };
}

class EditorManager {
  constructor() {
    this.loaderPromise = null;
    this.monacoPromise = null;
    this.requireConfigured = false;
    this.isReady = false;
    this.instances = new Map();

    if (!window.MonacoEnvironment) {
      window.MonacoEnvironment = {
        getWorkerUrl() {
          return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
            self.MonacoEnvironment = { baseUrl: '${MONACO_BASE_URL}/' };
            importScripts('${MONACO_WORKER_MAIN_URL}');
          `)}`;
        }
      };
    }

    window.__monacoReady = false;
  }

  async ensureLoader() {
    if (window.require?.config) {
      return;
    }

    if (this.loaderPromise) {
      return this.loaderPromise;
    }

    this.loaderPromise = new Promise((resolve, reject) => {
      const existingLoader = document.querySelector(`script[${LOADER_DATA_ATTRIBUTE}="true"]`)
        || document.getElementById(loaderScriptId);

      if (existingLoader) {
        existingLoader.addEventListener('load', () => resolve(), { once: true });
        existingLoader.addEventListener('error', () => reject(new Error('Failed to load Monaco AMD loader.')), { once: true });

        if (window.require?.config) {
          resolve();
        }
        return;
      }

      const loaderScript = document.createElement('script');
      loaderScript.id = loaderScriptId;
      loaderScript.src = MONACO_LOADER_URL;
      loaderScript.async = true;
      loaderScript.setAttribute(LOADER_DATA_ATTRIBUTE, 'true');
      loaderScript.addEventListener('load', () => resolve(), { once: true });
      loaderScript.addEventListener('error', () => reject(new Error('Failed to load Monaco AMD loader.')), { once: true });
      document.head.appendChild(loaderScript);
    });

    return this.loaderPromise;
  }

  async load() {
    if (this.monacoPromise) {
      return this.monacoPromise;
    }

    this.monacoPromise = (async () => {
      await this.ensureLoader();

      if (!this.requireConfigured) {
        window.require.config({
          paths: {
            vs: `${MONACO_BASE_URL}/vs`
          }
        });
        this.requireConfigured = true;
      }

      await new Promise((resolve, reject) => {
        window.require(['vs/editor/editor.main'], resolve, reject);
      });

      if (!this.isReady) {
        this.isReady = true;
        window.__monacoReady = true;
        window.dispatchEvent(new Event('monaco:ready'));
      }

      return window.monaco;
    })();

    return this.monacoPromise;
  }

  async whenReady() {
    await this.load();
  }

  async mount(containerId, options = {}) {
    await this.whenReady();

    const container = typeof containerId === 'string'
      ? document.getElementById(containerId)
      : containerId;

    if (!container) {
      throw new Error(`Editor container not found: ${containerId}`);
    }

    this.unmount(container);

    const editor = monaco.editor.create(container, options);
    container.__editorInstance = editor;
    this.instances.set(container, editor);

    return buildEditorApi(editor);
  }

  unmount(containerId) {
    const container = typeof containerId === 'string'
      ? document.getElementById(containerId)
      : containerId;

    if (!container) {
      return;
    }

    const editor = this.instances.get(container) || container.__editorInstance;
    if (editor) {
      editor.dispose();
    }

    this.instances.delete(container);
    delete container.__editorInstance;
  }
}

export const editorManager = new EditorManager();

window.EditorManager = editorManager;
window.mountEditor = (...args) => editorManager.mount(...args);
window.unmountEditor = (...args) => editorManager.unmount(...args);

editorManager.load().catch((error) => {
  console.error('Failed to load Monaco editor.', error);
});

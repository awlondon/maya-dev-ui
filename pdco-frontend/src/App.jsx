import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const isDev = import.meta.env.DEV;
const layoutStorageKey = 'pdco.devstudio.layout.v1';

const panelDefinitions = {
  editor: { title: 'Editor', zone: 'center', allowUndock: false },
  preview: { title: 'Preview', zone: 'right', allowUndock: true },
  console: { title: 'Console / Logs', zone: 'bottom', allowUndock: true },
  files: { title: 'Files', zone: 'left', allowUndock: true },
  tasks: { title: 'Tasks', zone: 'right', allowUndock: true },
  settings: { title: 'Settings', zone: 'right', allowUndock: true }
};

const defaultLayout = {
  left: 280,
  right: 360,
  panels: {
    editor: { visible: true, docked: true },
    preview: { visible: true, docked: true },
    console: { visible: true, docked: true },
    files: { visible: true, docked: true },
    tasks: { visible: true, docked: true },
    settings: { visible: false, docked: true }
  }
};

function readStoredLayout() {
  if (typeof window === 'undefined') {
    return defaultLayout;
  }

  try {
    const raw = window.localStorage.getItem(layoutStorageKey);
    if (!raw) {
      return defaultLayout;
    }
    const parsed = JSON.parse(raw);

    return {
      ...defaultLayout,
      ...parsed,
      panels: {
        ...defaultLayout.panels,
        ...(parsed?.panels || {})
      }
    };
  } catch {
    return defaultLayout;
  }
}

function useRenderCounter(name) {
  const countRef = useRef(0);
  countRef.current += 1;

  useEffect(() => {
    if (isDev) {
      window.__workspaceRenderCounts = window.__workspaceRenderCounts || {};
      window.__workspaceRenderCounts[name] = countRef.current;
    }
  });

  return isDev ? countRef.current : null;
}

const RenderBadge = memo(function RenderBadge({ name }) {
  const count = useRenderCounter(name);
  if (!isDev) {
    return null;
  }
  return <span className="render-badge">renders: {count}</span>;
});

const PanelFrame = memo(function PanelFrame({ id, title, layout, onToggleVisible, onToggleDock, children }) {
  const isVisible = layout.visible;
  return (
    <section className={`panel ${isVisible ? '' : 'panel-hidden'}`}>
      <header className="panel-header">
        <strong>{title}</strong>
        <div className="panel-actions">
          <button onClick={() => onToggleVisible(id)}>{isVisible ? 'Hide' : 'Show'}</button>
          {panelDefinitions[id].allowUndock && (
            <button onClick={() => onToggleDock(id)}>{layout.docked ? 'Undock' : 'Dock'}</button>
          )}
        </div>
      </header>
      <RenderBadge name={title} />
      <div className="panel-body">{children}</div>
    </section>
  );
});

const EditorPanel = memo(function EditorPanel({ value, onChange, panelLayout, onToggleVisible }) {
  return (
    <PanelFrame
      id="editor"
      title={panelDefinitions.editor.title}
      layout={panelLayout}
      onToggleVisible={onToggleVisible}
      onToggleDock={() => {}}
    >
      <textarea
        className="editor-input"
        value={value}
        onChange={onChange}
        spellCheck={false}
        placeholder="Type code here..."
      />
    </PanelFrame>
  );
});

const PreviewPanel = memo(function PreviewPanel({ panelLayout, onToggleVisible, onToggleDock }) {
  const previewText = useMemo(() => `API base URL: ${apiUrl}`, []);
  return (
    <PanelFrame
      id="preview"
      title={panelDefinitions.preview.title}
      layout={panelLayout}
      onToggleVisible={onToggleVisible}
      onToggleDock={onToggleDock}
    >
      {previewText}
    </PanelFrame>
  );
});

const ConsolePanel = memo(function ConsolePanel({ panelLayout, onToggleVisible, onToggleDock }) {
  const [logs] = useState(['Build started…', 'Dev server ready on :5173', '0 errors · 0 warnings']);
  return (
    <PanelFrame
      id="console"
      title={panelDefinitions.console.title}
      layout={panelLayout}
      onToggleVisible={onToggleVisible}
      onToggleDock={onToggleDock}
    >
      {logs.map((line) => (
        <div key={line}>{line}</div>
      ))}
    </PanelFrame>
  );
});

const FilesPanel = memo(function FilesPanel({ panelLayout, onToggleVisible, onToggleDock }) {
  const [filter, setFilter] = useState('');
  return (
    <PanelFrame
      id="files"
      title={panelDefinitions.files.title}
      layout={panelLayout}
      onToggleVisible={onToggleVisible}
      onToggleDock={onToggleDock}
    >
      <input className="panel-input" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter files…" />
      <div>app.js</div>
      <div>editorManager.js</div>
      <div>sandboxController.js</div>
    </PanelFrame>
  );
});

const TasksPanel = memo(function TasksPanel({ panelLayout, onToggleVisible, onToggleDock }) {
  const [draft, setDraft] = useState('Implement smoke test');
  return (
    <PanelFrame
      id="tasks"
      title={panelDefinitions.tasks.title}
      layout={panelLayout}
      onToggleVisible={onToggleVisible}
      onToggleDock={onToggleDock}
    >
      <input className="panel-input" value={draft} onChange={(event) => setDraft(event.target.value)} />
      <div>Open tasks: 3</div>
    </PanelFrame>
  );
});

const SettingsPanel = memo(function SettingsPanel({ panelLayout, onToggleVisible, onToggleDock }) {
  const [safeMode, setSafeMode] = useState(true);
  return (
    <PanelFrame
      id="settings"
      title={panelDefinitions.settings.title}
      layout={panelLayout}
      onToggleVisible={onToggleVisible}
      onToggleDock={onToggleDock}
    >
      <label className="settings-toggle">
        <input type="checkbox" checked={safeMode} onChange={(event) => setSafeMode(event.target.checked)} />
        Safe mode rollout
      </label>
    </PanelFrame>
  );
});

function App() {
  const [layout, setLayout] = useState(() => readStoredLayout());
  const [editorValue, setEditorValue] = useState('<h1>PDCo Dev Studio</h1>');
  const shellRef = useRef(null);
  const dragRef = useRef({ active: false, side: null, value: 0 });

  const hasLeftPanel = layout.panels.files.visible && layout.panels.files.docked;
  const hasRightPanel = ['preview', 'tasks', 'settings'].some((id) => layout.panels[id].visible && layout.panels[id].docked);
  const dockIsVisible = layout.panels.console.visible && layout.panels.console.docked;

  const shellStyle = useMemo(
    () => ({
      '--left-width': `${hasLeftPanel ? layout.left : 48}px`,
      '--right-width': `${hasRightPanel ? layout.right : 48}px`,
      '--dock-height': dockIsVisible ? '180px' : '40px'
    }),
    [dockIsVisible, hasLeftPanel, hasRightPanel, layout.left, layout.right]
  );

  useEffect(() => {
    window.localStorage.setItem(layoutStorageKey, JSON.stringify(layout));
  }, [layout]);

  const onEditorChange = useCallback((event) => {
    setEditorValue(event.target.value);
  }, []);

  const togglePanelVisible = useCallback((panelId) => {
    setLayout((current) => ({
      ...current,
      panels: {
        ...current.panels,
        [panelId]: {
          ...current.panels[panelId],
          visible: !current.panels[panelId].visible
        }
      }
    }));
  }, []);

  const togglePanelDock = useCallback((panelId) => {
    setLayout((current) => ({
      ...current,
      panels: {
        ...current.panels,
        [panelId]: {
          ...current.panels[panelId],
          docked: !current.panels[panelId].docked,
          visible: true
        }
      }
    }));
  }, []);

  const resetLayout = useCallback(() => {
    setLayout(defaultLayout);
  }, []);

  const exportLayout = useCallback(() => {
    const layoutJson = JSON.stringify(layout, null, 2);
    const blob = new Blob([layoutJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'pdco-layout.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }, [layout]);

  const onDividerStart = useCallback((side) => (event) => {
    dragRef.current = {
      active: true,
      side,
      value: side === 'left' ? layout.left : layout.right
    };
    event.preventDefault();
  }, [layout.left, layout.right]);

  useEffect(() => {
    const onMove = (event) => {
      if (!dragRef.current.active || !shellRef.current) {
        return;
      }

      const shellRect = shellRef.current.getBoundingClientRect();
      const minPanelWidth = 180;
      const maxPanelWidth = 420;

      if (dragRef.current.side === 'left') {
        const next = Math.min(maxPanelWidth, Math.max(minPanelWidth, event.clientX - shellRect.left));
        dragRef.current.value = next;
        shellRef.current.style.setProperty('--left-width', `${next}px`);
      }

      if (dragRef.current.side === 'right') {
        const fromRight = shellRect.right - event.clientX;
        const next = Math.min(maxPanelWidth, Math.max(minPanelWidth, fromRight));
        dragRef.current.value = next;
        shellRef.current.style.setProperty('--right-width', `${next}px`);
      }
    };

    const onUp = () => {
      if (!dragRef.current.active) {
        return;
      }
      const { side, value } = dragRef.current;
      dragRef.current = { active: false, side: null, value: 0 };
      setLayout((current) => ({ ...current, ...(side === 'left' ? { left: value } : { right: value }) }));
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const floatingPanels = Object.keys(layout.panels).filter((id) => id !== 'editor' && layout.panels[id].visible && !layout.panels[id].docked);

  return (
    <>
      <div className="workspace-toolbar">
        <strong>Workspace Layout</strong>
        <button onClick={resetLayout}>Reset layout</button>
        <button onClick={exportLayout}>Export layout JSON</button>
      </div>

      <main className="workspace-shell" ref={shellRef} style={shellStyle}>
        <div className="left-column">
          <FilesPanel panelLayout={layout.panels.files} onToggleVisible={togglePanelVisible} onToggleDock={togglePanelDock} />
        </div>
        <div className="divider" onMouseDown={onDividerStart('left')} />

        <section className="center-column">
          <EditorPanel value={editorValue} onChange={onEditorChange} panelLayout={layout.panels.editor} onToggleVisible={togglePanelVisible} />
          <ConsolePanel panelLayout={layout.panels.console} onToggleVisible={togglePanelVisible} onToggleDock={togglePanelDock} />
        </section>

        <div className="divider" onMouseDown={onDividerStart('right')} />

        <section className="right-column">
          <PreviewPanel panelLayout={layout.panels.preview} onToggleVisible={togglePanelVisible} onToggleDock={togglePanelDock} />
          <TasksPanel panelLayout={layout.panels.tasks} onToggleVisible={togglePanelVisible} onToggleDock={togglePanelDock} />
          <SettingsPanel panelLayout={layout.panels.settings} onToggleVisible={togglePanelVisible} onToggleDock={togglePanelDock} />
        </section>
      </main>

      {!!floatingPanels.length && (
        <aside className="floating-area">
          {floatingPanels.includes('preview') && (
            <PreviewPanel panelLayout={layout.panels.preview} onToggleVisible={togglePanelVisible} onToggleDock={togglePanelDock} />
          )}
          {floatingPanels.includes('console') && (
            <ConsolePanel panelLayout={layout.panels.console} onToggleVisible={togglePanelVisible} onToggleDock={togglePanelDock} />
          )}
          {floatingPanels.includes('files') && (
            <FilesPanel panelLayout={layout.panels.files} onToggleVisible={togglePanelVisible} onToggleDock={togglePanelDock} />
          )}
          {floatingPanels.includes('tasks') && (
            <TasksPanel panelLayout={layout.panels.tasks} onToggleVisible={togglePanelVisible} onToggleDock={togglePanelDock} />
          )}
          {floatingPanels.includes('settings') && (
            <SettingsPanel panelLayout={layout.panels.settings} onToggleVisible={togglePanelVisible} onToggleDock={togglePanelDock} />
          )}
        </aside>
      )}
    </>
  );
}

export default App;

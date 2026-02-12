import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const isDev = import.meta.env.DEV;
const defaultLayout = {
  left: 280,
  right: 360,
  sidebarOpen: true,
  previewOpen: true,
  dockOpen: true
};

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

const Sidebar = memo(function Sidebar({ isOpen, onToggle }) {
  return (
    <aside className={`panel sidebar ${isOpen ? '' : 'collapsed'}`}>
      <header className="panel-header">
        <strong>Sidebar</strong>
        <button onClick={onToggle}>{isOpen ? 'Hide' : 'Show'}</button>
      </header>
      <RenderBadge name="Sidebar" />
      {isOpen && <div className="panel-body">Project files, search, and symbols.</div>}
    </aside>
  );
});

const Dock = memo(function Dock({ isOpen, onToggle }) {
  return (
    <section className="panel dock">
      <header className="panel-header">
        <strong>Dock</strong>
        <button onClick={onToggle}>{isOpen ? 'Collapse' : 'Expand'}</button>
      </header>
      <RenderBadge name="Dock" />
      {isOpen && <div className="panel-body">Terminal · Problems · Logs</div>}
    </section>
  );
});

const EditorPanel = memo(function EditorPanel({ value, onChange }) {
  return (
    <section className="panel editor-panel">
      <header className="panel-header">
        <strong>Editor</strong>
      </header>
      <RenderBadge name="Editor" />
      <textarea
        className="editor-input"
        value={value}
        onChange={onChange}
        spellCheck={false}
        placeholder="Type code here..."
      />
    </section>
  );
});

const PreviewPanel = memo(function PreviewPanel({ isOpen, onToggle }) {
  const previewText = useMemo(
    () => `API base URL: ${apiUrl}`,
    []
  );

  return (
    <section className={`panel preview-panel ${isOpen ? '' : 'collapsed'}`}>
      <header className="panel-header">
        <strong>Preview</strong>
        <button onClick={onToggle}>{isOpen ? 'Hide' : 'Show'}</button>
      </header>
      <RenderBadge name="Preview" />
      {isOpen && <div className="panel-body">{previewText}</div>}
    </section>
  );
});

function App() {
  const [layout, setLayout] = useState(defaultLayout);
  const [editorValue, setEditorValue] = useState('<h1>PDCo Dev Studio</h1>');
  const shellRef = useRef(null);
  const dragRef = useRef({ active: false, side: null, value: 0 });

  const shellStyle = useMemo(
    () => ({
      '--left-width': `${layout.sidebarOpen ? layout.left : 48}px`,
      '--right-width': `${layout.previewOpen ? layout.right : 48}px`,
      '--dock-height': layout.dockOpen ? '150px' : '40px'
    }),
    [layout]
  );

  const updateLayout = useCallback((patch) => {
    setLayout((current) => ({ ...current, ...patch }));
  }, []);

  const onEditorChange = useCallback((event) => {
    setEditorValue(event.target.value);
  }, []);

  const toggleSidebar = useCallback(() => {
    updateLayout({ sidebarOpen: !layout.sidebarOpen });
  }, [layout.sidebarOpen, updateLayout]);

  const togglePreview = useCallback(() => {
    updateLayout({ previewOpen: !layout.previewOpen });
  }, [layout.previewOpen, updateLayout]);

  const toggleDock = useCallback(() => {
    updateLayout({ dockOpen: !layout.dockOpen });
  }, [layout.dockOpen, updateLayout]);

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
      updateLayout(side === 'left' ? { left: value } : { right: value });
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [updateLayout]);

  return (
    <main className="workspace-shell" ref={shellRef} style={shellStyle}>
      <Sidebar isOpen={layout.sidebarOpen} onToggle={toggleSidebar} />
      <div className="divider" onMouseDown={onDividerStart('left')} />

      <section className="center-column">
        <EditorPanel value={editorValue} onChange={onEditorChange} />
        <Dock isOpen={layout.dockOpen} onToggle={toggleDock} />
      </section>

      <div className="divider" onMouseDown={onDividerStart('right')} />
      <PreviewPanel isOpen={layout.previewOpen} onToggle={togglePreview} />
    </main>
  );
}

export default App;

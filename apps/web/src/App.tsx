import { ReactFlowProvider } from '@xyflow/react';
import { useEffect } from 'react';
import { CanvasArea } from './components/CanvasArea';
import { CanvasErrorBoundary } from './components/CanvasErrorBoundary';
import { InspectorPanel } from './components/InspectorPanel';
import { LibraryPanel } from './components/LibraryPanel';
import { ProjectPanel } from './components/ProjectPanel';
import { ShortcutsPanel } from './components/ShortcutsPanel';
import { SidebarRail } from './components/SidebarRail';
import { TopBar } from './components/TopBar';
import { useHotkeys } from './hooks/useHotkeys';
import { useProjectStore } from './store/useProjectStore';

export default function App() {
  const toast = useProjectStore((state) => state.toast);
  const clearToast = useProjectStore((state) => state.clearToast);
  const theme = useProjectStore((state) => state.theme);
  const sidebarCollapsed = useProjectStore((state) => state.sidebarCollapsed);

  useHotkeys();

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(clearToast, 3200);
    return () => window.clearTimeout(timer);
  }, [toast, clearToast]);

  // 主题通过 data-theme 挂到根元素，样式表按 [data-theme] 切换变量
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <ReactFlowProvider>
      <div className="app">
        <TopBar />
        <div className="body">
          {/* 收起后只渲染窄条（不渲染面板），避免隐藏内容仍参与渲染与订阅 */}
          <aside className={`sidebar${sidebarCollapsed ? ' is-collapsed' : ''}`}>
            {sidebarCollapsed ? (
              <SidebarRail />
            ) : (
              <>
                <LibraryPanel />
                <InspectorPanel />
              </>
            )}
          </aside>
          <CanvasErrorBoundary>
            <CanvasArea />
          </CanvasErrorBoundary>
        </div>
        <ProjectPanel />
        <ShortcutsPanel />
        {toast ? <div className={`toast toast-${toast.kind}`}>{toast.text}</div> : null}
      </div>
    </ReactFlowProvider>
  );
}

/**
 * 顶部栏：项目名、开发板与规则集信息、示例/清空、导入导出、运行按钮（右上角）。
 */
import { useRef } from 'react';
import { ESP32_DEVKITC_V4 } from '@sim/definitions';
import { RULE_SET_VERSION } from '@sim/rule-engine';
import { apiMode } from '../api/client';
import { useBackendStatus } from '../hooks/useBackendStatus';
import { useProjectStore } from '../store/useProjectStore';

export const TopBar = () => {
  const projectName = useProjectStore((state) => state.projectName);
  const theme = useProjectStore((state) => state.theme);
  const setTheme = useProjectStore((state) => state.setTheme);
  const setProjectPanelOpen = useProjectStore((state) => state.setProjectPanelOpen);
  const setShortcutsOpen = useProjectStore((state) => state.setShortcutsOpen);
  const { status: backendStatus, info: backendInfo } = useBackendStatus();
  const running = useProjectStore((state) => state.running);
  const runValidation = useProjectStore((state) => state.runValidation);
  const loadSampleProject = useProjectStore((state) => state.loadSampleProject);
  const clearProject = useProjectStore((state) => state.clearProject);
  const exportJson = useProjectStore((state) => state.exportJson);
  const importJson = useProjectStore((state) => state.importJson);
  const undo = useProjectStore((state) => state.undo);
  const redo = useProjectStore((state) => state.redo);
  // 只读取布尔值（稳定引用），不要在 selector 内构造对象
  const canUndo = useProjectStore((state) => state.historyPast.length > 0);
  const canRedo = useProjectStore((state) => state.historyFuture.length > 0);
  const fileRef = useRef<HTMLInputElement>(null);

  const onExport = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${projectName.replace(/\s+/g, '-')}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const onImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    importJson(text);
    event.target.value = '';
  };

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">2D</span>
        <div>
          <div className="brand-title">单片机接线仿真与校验平台</div>
          <div className="brand-sub">前后端分离 · 定义与校验由后端服务提供</div>
        </div>
      </div>

      <input
        className="project-name"
        value={projectName}
        onChange={(event) => useProjectStore.setState({ projectName: event.target.value })}
        title="项目名称"
      />

      <span className="chip">{ESP32_DEVKITC_V4.displayName}</span>
      <span className="chip chip-muted">
        规则集 {backendInfo?.ruleSetVersion ?? RULE_SET_VERSION}
      </span>
      <span
        className={`chip ${
          backendStatus === 'online' ? 'chip-ok' : backendStatus === 'offline' ? 'chip-warn' : ''
        }`}
        title={
          backendStatus === 'online'
            ? `后端已连接（${apiMode} 模式）：校验结果以后端权威结论为准`
            : backendStatus === 'offline'
              ? `后端不可达（${apiMode} 模式）：使用本地规则集，结论可能与最新规则不同`
              : '正在探测后端连通性'
        }
      >
        {backendStatus === 'online'
          ? `后端已连接 · ${backendInfo?.componentCount ?? 0} 组件 / ${backendInfo?.ruleCount ?? 0} 规则`
          : backendStatus === 'offline'
            ? apiMode === 'mock'
              ? 'Mock 模式（离线演示）'
              : '后端离线 · 本地规则集'
            : '检查后端…'}
      </span>

      <span className="topbar-spacer" />

      <button
        type="button"
        className="btn icon-btn"
        onClick={undo}
        disabled={!canUndo}
        title="撤销（Ctrl/Cmd + Z）"
        aria-label="撤销"
      >
        ↶
      </button>
      <button
        type="button"
        className="btn icon-btn"
        onClick={redo}
        disabled={!canRedo}
        title="重做（Ctrl/Cmd + Shift + Z）"
        aria-label="重做"
      >
        ↷
      </button>

      <button
        type="button"
        className="btn"
        onClick={() => setShortcutsOpen(true)}
        title="查看快捷键与操作技巧（也可按 Esc 关闭）"
      >
        ⌨ 快捷键
      </button>

      <button
        type="button"
        className="btn"
        onClick={() => setProjectPanelOpen(true)}
        title="新建 / 打开 / 保存服务端项目"
      >
        项目…
      </button>
      <button
        type="button"
        className="btn"
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        title="切换明暗主题"
      >
        {theme === 'light' ? '深色' : '浅色'}
      </button>
      <button type="button" className="btn" onClick={loadSampleProject}>
        载入示例
      </button>
      <button type="button" className="btn" onClick={clearProject}>
        清空画布
      </button>
      <button type="button" className="btn" onClick={onExport}>
        导出 JSON
      </button>
      <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
        导入 JSON
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={onImportFile}
      />
      <button type="button" className="run-btn" onClick={runValidation} disabled={running}>
        {running ? '校验中…' : '▶ 运行'}
      </button>
    </header>
  );
};

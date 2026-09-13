/**
 * 顶部栏：项目名、开发板与规则集信息、示例/清空、导入导出、运行按钮（右上角）。
 */
import { useRef } from 'react';
import { ESP32_DEVKITC_V4 } from '../definitions/esp32';
import { RULE_SET_VERSION } from '../rules/engine';
import { useProjectStore } from '../store/useProjectStore';

export const TopBar = () => {
  const projectName = useProjectStore((state) => state.projectName);
  const running = useProjectStore((state) => state.running);
  const runValidation = useProjectStore((state) => state.runValidation);
  const loadSampleProject = useProjectStore((state) => state.loadSampleProject);
  const clearProject = useProjectStore((state) => state.clearProject);
  const exportJson = useProjectStore((state) => state.exportJson);
  const importJson = useProjectStore((state) => state.importJson);
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
          <div className="brand-sub">Demo · 数据为模拟，尚未接入真实后端</div>
        </div>
      </div>

      <input
        className="project-name"
        value={projectName}
        onChange={(event) => useProjectStore.setState({ projectName: event.target.value })}
        title="项目名称"
      />

      <span className="chip">{ESP32_DEVKITC_V4.displayName}</span>
      <span className="chip chip-muted">规则集 {RULE_SET_VERSION}</span>

      <span className="topbar-spacer" />

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

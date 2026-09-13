/**
 * 校验结果面板（画布底部抽屉）：
 *  - 状态条：通过 / 警告 / 错误 + 规则集版本 + 结果来源（后端权威 / 离线本地）
 *  - 诊断列表：严重度 + 规则码 + 结论 + 修复建议 + 可点击定位（画布高亮并聚焦）
 */
import { useReactFlow } from '@xyflow/react';
import { useState } from 'react';
import type { Diagnostic, DiagnosticTarget, Severity } from '../definitions/types';
import { useActiveResult, useProjectStore } from '../store/useProjectStore';

const SEVERITY_TEXT: Record<Severity, string> = {
  error: '错误',
  warning: '警告',
  info: '提示',
};

const STATUS_TEXT = {
  passed: '校验通过',
  warning: '存在警告',
  failed: '存在错误',
} as const;

export const ValidationPanel = () => {
  const result = useActiveResult();
  const running = useProjectStore((state) => state.running);
  const hasRun = useProjectStore((state) => state.hasRun);
  const selectInstance = useProjectStore((state) => state.selectInstance);
  const selectConnection = useProjectStore((state) => state.selectConnection);
  const { fitView } = useReactFlow();
  const [collapsed, setCollapsed] = useState(false);
  const [problemsOnly, setProblemsOnly] = useState(false);

  const focus = (target: DiagnosticTarget) => {
    if (target.type === 'instance') {
      selectInstance(target.id);
      void fitView({ nodes: [{ id: target.id }], duration: 400, maxZoom: 1.1 });
      return;
    }
    if (target.type === 'port') {
      if (target.instanceId) {
        selectInstance(target.instanceId);
        void fitView({ nodes: [{ id: target.instanceId }], duration: 400, maxZoom: 1.1 });
      }
      return;
    }
    if (target.type === 'pin') {
      // 引脚级别：聚焦开发板（引脚本身已按诊断严重度高亮）
      void fitView({ nodes: [{ id: 'board' }], duration: 400, maxZoom: 1.2 });
      return;
    }
    if (target.type === 'connection') {
      selectConnection(target.id);
    }
  };

  const diagnostics: Diagnostic[] = (result?.diagnostics ?? []).filter((item) =>
    problemsOnly ? item.severity !== 'info' : true,
  );
  const errorCount = (result?.diagnostics ?? []).filter((item) => item.severity === 'error').length;
  const warningCount = (result?.diagnostics ?? []).filter((item) => item.severity === 'warning').length;
  const passedCount = (result?.diagnostics ?? []).filter((item) => item.severity === 'info').length;

  return (
    <div className={`result-panel${collapsed ? ' result-collapsed' : ''}`}>
      <div className="result-bar">
        <button
          type="button"
          className="collapse-btn"
          onClick={() => setCollapsed((value) => !value)}
          title={collapsed ? '展开结果面板' : '收起结果面板'}
        >
          {collapsed ? '▲' : '▼'}
        </button>

        {!hasRun ? (
          <span className="result-hint">尚未校验：点击右上角「运行」开始检查接线</span>
        ) : (
          <>
            <span className={`result-status result-${result?.status ?? 'passed'}`}>
              {result ? STATUS_TEXT[result.status] : '校验中…'}
            </span>
            <span className="result-counts">
              <em className="count-error">✖ {errorCount} 错误</em>
              <em className="count-warning">⚠ {warningCount} 警告</em>
              {passedCount > 0 ? <em className="count-ok">✔ {passedCount} 提示</em> : null}
            </span>
            <span className={`result-source${result?.offline ? ' source-offline' : ''}`}>
              {result?.offline
                ? `离线模式 · 本地规则集 ${result.ruleSetVersion}（可能过期）`
                : `后端权威校验 · 规则集 ${result?.ruleSetVersion ?? '-'}`}
            </span>
            {typeof result?.durationMs === 'number' ? (
              <span className="result-duration">{result.durationMs} ms</span>
            ) : null}
            {running ? <span className="result-running">校验中…</span> : null}
          </>
        )}

        <span className="result-spacer" />
        {hasRun ? (
          <label className="filter-row">
            <input
              type="checkbox"
              checked={problemsOnly}
              onChange={(event) => setProblemsOnly(event.target.checked)}
            />
            <span>只看问题</span>
          </label>
        ) : null}
      </div>

      {!collapsed && hasRun ? (
        <div className="result-list">
          {diagnostics.length === 0 ? (
            <p className="result-empty">
              {result?.status === 'passed'
                ? '接线检查全部通过：连通性、端口选择与引脚能力均未发现问题。'
                : '当前过滤条件下没有项目。'}
            </p>
          ) : (
            diagnostics.map((item, index) => (
              <div className={`diag-item diag-${item.severity}`} key={`${item.code}-${index}`}>
                <div className="diag-head">
                  <span className="diag-code">{item.code}</span>
                  <span className="diag-severity">{SEVERITY_TEXT[item.severity]}</span>
                  <span className="diag-msg">{item.message}</span>
                </div>
                {item.suggestion ? <div className="diag-sug">建议：{item.suggestion}</div> : null}
                <div className="diag-targets">
                  {item.targets.map((target) => (
                    <button
                      type="button"
                      className="target-chip"
                      key={`${target.type}-${target.id}`}
                      onClick={() => focus(target)}
                      title="在画布中定位"
                    >
                      {target.type === 'pin'
                        ? `引脚 ${target.id.replace('pin-esp32-', '').toUpperCase()}`
                        : target.type === 'instance'
                          ? '组件'
                          : target.type === 'port'
                            ? `端口 ${target.portId ?? ''}`
                            : '连线'}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
};

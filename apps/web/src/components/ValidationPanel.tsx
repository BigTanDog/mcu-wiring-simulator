/**
 * 校验结果面板（画布底部抽屉）：
 *  - 状态条：通过 / 警告 / 错误 + 规则集版本 + 结果来源（后端权威 / 离线本地）
 *  - 诊断列表：严重度 + 规则码 + 结论 + 修复建议 + 可点击定位（画布高亮并聚焦）
 */
import { useReactFlow } from '@xyflow/react';
import { useMemo, useState } from 'react';
import type { Diagnostic, DiagnosticTarget, Severity } from '@sim/contracts';
import { ruleDocOf } from '@sim/rule-engine';
import { useActiveResult, useProjectStore } from '../store/useProjectStore';
import { groupDiagnostics } from './diagGroups';

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
  /**
   * 悬停/聚焦时临时显示的说明（移开即消失）。
   * 说明区是常驻区块（布局恒定），悬停时只替换内容 —— 避免出现/消失推挤列表造成 hover 抖动。
   */
  const [whyCode, setWhyCode] = useState<string | null>(null);
  /**
   * 点击「为什么」后**固定住**的说明：优先于悬停值。
   * 目的是解决"鼠标一移开说明就没了、长文案来不及看"的问题（用户反馈）。
   */
  const [pinnedCode, setPinnedCode] = useState<string | null>(null);
  const activeCode = pinnedCode ?? whyCode;
  const whyDoc = activeCode ? ruleDocOf(activeCode) : undefined;

  /**
   * 定位前先确认目标仍在画布中：诊断可能来自上一次校验，其间用户可能已
   * 删除组件或撤销操作 —— 对已卸载节点调用 fitView 会触发第三方库异常。
   */
  const focus = (target: DiagnosticTarget) => {
    const scene = useProjectStore.getState();

    if (target.type === 'instance') {
      if (!scene.instances.some((item) => item.id === target.id)) {
        scene.showToast('该组件已不在画布中（可能已被删除或撤销）', 'warn');
        return;
      }
      selectInstance(target.id);
      void fitView({ nodes: [{ id: target.id }], duration: 400, maxZoom: 1.1 });
      return;
    }
    if (target.type === 'port') {
      if (target.instanceId) {
        if (!scene.instances.some((item) => item.id === target.instanceId)) {
          scene.showToast('该组件已不在画布中（可能已被删除或撤销）', 'warn');
          return;
        }
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
      if (!scene.connections.some((item) => item.id === target.id)) {
        scene.showToast('该连线已不存在', 'warn');
        return;
      }
      selectConnection(target.id);
    }
  };

  const diagnostics: Diagnostic[] = (result?.diagnostics ?? []).filter((item) =>
    problemsOnly ? item.severity !== 'info' : true,
  );
  const errorCount = (result?.diagnostics ?? []).filter((item) => item.severity === 'error').length;
  const warningCount = (result?.diagnostics ?? []).filter((item) => item.severity === 'warning').length;
  const passedCount = (result?.diagnostics ?? []).filter((item) => item.severity === 'info').length;

  /**
   * 按规则码分组（Q-T5）：同规则的多处命中（如 5 个 strapping 引脚）折叠为一行。
   * 展开状态按规则码记忆 —— 重新校验后仍保持用户的展开偏好。
   */
  const groups = useMemo(() => groupDiagnostics(diagnostics), [diagnostics]);
  const [expandedCodes, setExpandedCodes] = useState<Set<string>>(new Set());
  const toggleGroup = (code: string) =>
    setExpandedCodes((previous) => {
      const next = new Set(previous);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  /** 单条渲染（nested = 收起组内的条目，不再重复显示规则码与严重度） */
  const renderDiagnostic = (item: Diagnostic, nested: boolean, index: number) => {
    const doc = ruleDocOf(item.code);
    return (
      <div
        className={`diag-item diag-${item.severity}${nested ? ' diag-item-nested' : ''}`}
        key={`${item.code}-${index}`}
      >
        <div
          className="diag-head"
          onMouseEnter={() => setWhyCode(doc ? item.code : null)}
          onMouseLeave={() => setWhyCode(null)}
        >
          {nested ? (
            <span className="diag-index">#{index + 1}</span>
          ) : (
            <>
              <span className="diag-code">{item.code}</span>
              <span className="diag-severity">{SEVERITY_TEXT[item.severity]}</span>
            </>
          )}
          <span className="diag-msg">{item.message}</span>
          {/* 悬停即临时显示；点击可把说明固定在上方（再次点击取消固定） */}
          {doc ? (
            <button
              type="button"
              className={`why-tip${pinnedCode === item.code ? ' is-pinned' : ''}`}
              title={
                pinnedCode === item.code
                  ? `${item.code} · ${doc.title}（已固定，点击取消）`
                  : `${item.code} · ${doc.title}（点击固定到上方）`
              }
              onClick={() => setPinnedCode((current) => (current === item.code ? null : item.code))}
              onFocus={() => setWhyCode(item.code)}
              onBlur={() => setWhyCode(null)}
            >
              {pinnedCode === item.code ? '已固定' : '为什么'}
            </button>
          ) : null}
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
    );
  };

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

      {/*
        规则说明区：固定高度的常驻区块（布局恒定，悬停时只替换内容）。
        早期实现用绝对定位浮层，会被画布层叠/裁剪影响且会推挤布局导致 hover 抖动。
      */}
      {!collapsed && hasRun && diagnostics.length > 0 ? (
        <div className={`why-banner${pinnedCode ? ' is-pinned' : ''}`} aria-live="polite">
          {activeCode && whyDoc ? (
            <>
              <div className="why-head">
                <strong className="why-title">
                  {activeCode} · {whyDoc.title}
                </strong>
                {pinnedCode ? (
                  <button
                    type="button"
                    className="why-unpin"
                    onClick={() => setPinnedCode(null)}
                    title="取消固定，恢复为悬停显示"
                  >
                    取消固定
                  </button>
                ) : null}
              </div>
              <span className="why-line">
                <em>原理</em>
                {whyDoc.why}
              </span>
              <span className="why-line">
                <em>正确做法</em>
                {whyDoc.howTo}
              </span>
              {whyDoc.example ? (
                <span className="why-line">
                  <em>例外</em>
                  {whyDoc.example}
                </span>
              ) : null}
            </>
          ) : (
            <span className="why-idle">
              把鼠标移到任一条诊断上，这里会显示该规则的原理与正确做法；点「为什么」可固定住慢慢看
            </span>
          )}
        </div>
      ) : null}

      {!collapsed && hasRun ? (
        <div className="result-list">
          {diagnostics.length === 0 ? (
            <p className="result-empty">
              {result?.status === 'passed'
                ? '接线检查全部通过：连通性、端口选择与引脚能力均未发现问题。'
                : '当前过滤条件下没有项目。'}
            </p>
          ) : (
            groups.map((group) => {
              // 单处命中：直接平铺，不引入多余点击
              if (group.items.length === 1) return renderDiagnostic(group.items[0], false, 0);

              const expanded = expandedCodes.has(group.code);
              return (
                <div className={`diag-group diag-${group.severity}`} key={group.code}>
                  <button
                    type="button"
                    className="diag-group-head"
                    onClick={() => toggleGroup(group.code)}
                    onMouseEnter={() => setWhyCode(group.code)}
                    onMouseLeave={() => setWhyCode(null)}
                    aria-expanded={expanded}
                  >
                    <span className="diag-code">{group.code}</span>
                    <span className="diag-severity">{SEVERITY_TEXT[group.severity]}</span>
                    <span className="diag-group-title">{group.title}</span>
                    <span className="diag-group-count">{group.items.length} 处</span>
                    <span className="diag-group-caret">{expanded ? '▾' : '▸'}</span>
                  </button>
                  {expanded
                    ? group.items.map((item, index) => renderDiagnostic(item, true, index))
                    : null}
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
};

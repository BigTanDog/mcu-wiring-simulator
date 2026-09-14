/**
 * 面包板节点：简化模型（Q-T4）——每一「列」是一个等电位组。
 *
 * 渲染为孔位网格：
 *  - 上下两条电源轨各一个 Handle（整条轨互通）；
 *  - 中间 12 列每列一个 Handle（列内互通），点击/连线都按列进行；
 *  - 每列视觉上画两个孔，表示"同一列的多个孔是连通的"这一教学要点。
 *
 * Handle 的定位用 CSS 覆盖到各自列的正上方（`Position.Top` 只决定默认样式类）。
 */
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { getComponentDef } from '@sim/definitions';
import { useDiagnosticIndex } from '../../store/useDiagnostics';
import { portHandleId } from '../../store/useProjectStore';

interface BreadboardNodeData {
  slug: string;
  label: string;
}

export const BreadboardNode = memo(function BreadboardNode(props: NodeProps) {
  const data = props.data as unknown as BreadboardNodeData;
  const def = getComponentDef(data.slug);
  const index = useDiagnosticIndex();

  /** 端口级诊断高亮（与 ComponentNode 行为一致） */
  const classOf = (portId: string, base: string): string => {
    const severity = index.port.get(`${props.id}:${portId}`);
    if (severity === 'error') return `${base} port-error`;
    if (severity === 'warning') return `${base} port-warning`;
    return base;
  };

  const columns = def.ports.filter((port) => port.id.startsWith('c'));
  const rails = def.ports.filter((port) => port.id === 'vcc' || port.id === 'gnd');

  const renderRail = (portId: string) => {
    const port = rails.find((item) => item.id === portId);
    if (!port) return null;
    return (
      <div className={classOf(port.id, 'bb-rail')} key={port.id}>
        <Handle
          type="source"
          position={Position.Top}
          id={portHandleId(props.id, port.id)}
          className="port-handle bb-rail-handle"
          title={`${port.name}｜${port.note ?? ''}`}
        />
        <span className="bb-rail-text">{port.name}</span>
      </div>
    );
  };

  return (
    <div
      className={`breadboard-node${props.selected ? ' is-selected' : ''}`}
      data-testid={`component-${props.id}`}
    >
      <div className="bb-head">
        <span className="component-icon">{def.icon}</span>
        <span className="component-title">{data.label}</span>
        <span className="bb-badge">每列等电位</span>
      </div>

      {renderRail('vcc')}

      <div className="bb-grid">
        {columns.map((port, columnIndex) => (
          <div
            className={classOf(port.id, 'bb-col')}
            key={port.id}
            data-testid={`port-${props.id}-${port.id}`}
            title={`${port.name}：${port.note ?? ''}`}
          >
            <Handle
              type="source"
              position={Position.Top}
              id={portHandleId(props.id, port.id)}
              className="port-handle bb-col-handle"
            />
            <span className="bb-hole" />
            <span className="bb-hole" />
            <span className="bb-col-no">{columnIndex + 1}</span>
          </div>
        ))}
      </div>

      {renderRail('gnd')}
    </div>
  );
});

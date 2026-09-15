/**
 * 面包板节点：简化模型（Q-T4）——每一「列」是一个等电位组。
 *
 * 版式（M-02 追加修正）：**所有接线点都落在节点边缘**，连线不会再被板体挡住：
 *  - 正 / 负电源轨竖排在**左右两侧**，Handle 位于节点左 / 右边缘中点；
 *  - 12 列的接线点与列一一对齐，落在**下边缘**（每列正下方一个 Handle）；
 *  - 列内画两个孔，表示"同一列的多个孔是连通的"这一教学要点。
 *
 * 说明：Handle 的实际位置由 CSS 覆盖（React Flow 的 `position` 只决定默认样式类），
 * 因此"列 Handle"必须与列使用同一套 grid 布局，才能保证上下严格对齐。
 */
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { getComponentDef } from '@sim/definitions';
import { useDiagnosticIndex } from '../../store/useDiagnostics';
import { portHandleId, useProjectStore } from '../../store/useProjectStore';

interface BreadboardNodeData {
  slug: string;
  label: string;
}

export const BreadboardNode = memo(function BreadboardNode(props: NodeProps) {
  const data = props.data as unknown as BreadboardNodeData;
  const def = getComponentDef(data.slug);
  const index = useDiagnosticIndex();
  // 导轨是"已接线"的被动端点，这里读取实例以便将来做端口级高亮扩展
  const instance = useProjectStore((state) => state.instances.find((item) => item.id === props.id));

  const classOf = (portId: string, base: string): string => {
    const severity = index.port.get(`${props.id}:${portId}`);
    if (severity === 'error') return `${base} port-error`;
    if (severity === 'warning') return `${base} port-warning`;
    return base;
  };

  const columns = def.ports.filter((port) => port.id.startsWith('c'));

  const renderRail = (portId: 'vcc' | 'gnd', side: 'left' | 'right') => {
    const port = def.ports.find((item) => item.id === portId);
    if (!port) return null;
    const connected = instance ? instance.portConfig[portId] !== undefined : false;
    return (
      <div className={classOf(port.id, 'bb-rail')} key={port.id} title={`${port.name}｜${port.note ?? ''}`}>
        <span className="bb-rail-text">{port.name.slice(0, 1)}</span>
        <Handle
          type="source"
          position={side === 'left' ? Position.Left : Position.Right}
          id={portHandleId(props.id, port.id)}
          className="port-handle bb-rail-handle"
          title={`${port.name}｜${port.note ?? ''}`}
        />
        {connected ? <span className="bb-rail-dot" /> : null}
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

      <div className="bb-main">
        {renderRail('vcc', 'left')}

        <div className="bb-center">
          <div className="bb-grid">
            {columns.map((port, columnIndex) => (
              <div
                className={classOf(port.id, 'bb-col')}
                key={port.id}
                data-testid={`port-${props.id}-${port.id}`}
                title={`${port.name}：${port.note ?? ''}`}
              >
                <span className="bb-hole" />
                <span className="bb-hole" />
                <span className="bb-col-no">{columnIndex + 1}</span>
              </div>
            ))}
          </div>

          {/* 列接线点：与上面各列严格对齐（同一套 grid），落在节点下边缘 */}
          <div className="bb-grid bb-grid-handles" aria-hidden>
            {columns.map((port) => (
              <div className="bb-handle-cell" key={port.id}>
                <Handle
                  type="source"
                  position={Position.Bottom}
                  id={portHandleId(props.id, port.id)}
                  className="port-handle bb-col-handle"
                  title={`${port.name}：${port.note ?? ''}`}
                />
              </div>
            ))}
          </div>
        </div>

        {renderRail('gnd', 'right')}
      </div>
    </div>
  );
});

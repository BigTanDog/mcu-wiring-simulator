/**
 * 组件节点：渲染组件的端口 Handle（电源/地在左，信号线在右）。
 * 端口按角色着色，校验后按诊断严重度高亮；端口标签在悬停/选中时展开。
 */
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { getComponentDef } from '@sim/definitions';
import type { PortDef } from '@sim/contracts';
import { useDiagnosticIndex } from '../../store/useDiagnostics';
import { portHandleId, useProjectStore } from '../../store/useProjectStore';

interface ComponentNodeData {
  slug: string;
  label: string;
}

const portColor = (port: PortDef): string => {
  if (port.role === 'ground') return 'var(--cap-gnd)';
  if (port.role === 'power') return 'var(--cap-3v3)';
  if ((port.protocols ?? []).includes('I2C')) return 'var(--cap-i2c)';
  return 'var(--cap-gpio)';
};

/**
 * 用 memo 包裹：拖动节点/画布时避免"全体节点重渲染"（M-04 基准优化）。
 * 数据更新仍通过 store 订阅生效（实例内容或诊断变化时正常刷新）。
 */
export const ComponentNode = memo(function ComponentNode(props: NodeProps) {
  const data = props.data as unknown as ComponentNodeData;
  const def = getComponentDef(data.slug);
  const index = useDiagnosticIndex();
  const instance = useProjectStore((state) => state.instances.find((item) => item.id === props.id));
  const selectedInstanceId = useProjectStore((state) => state.selectedInstanceId);
  const isSelected = props.selected || selectedInstanceId === props.id;

  const leftPorts = def.ports.filter((port) => port.role !== 'signal');
  const rightPorts = def.ports.filter((port) => port.role === 'signal');

  const renderPort = (port: PortDef, side: 'left' | 'right') => {
    const severity = index.port.get(`${props.id}:${port.id}`);
    const classes = ['port-row', `port-${side}`, `port-role-${port.role}`];
    if (severity === 'error') classes.push('port-error');
    if (severity === 'warning') classes.push('port-warning');

    return (
      <div className={classes.join(' ')} key={port.id} data-testid={`port-${props.id}-${port.id}`}>
        <Handle
          type="source"
          position={side === 'left' ? Position.Left : Position.Right}
          id={portHandleId(props.id, port.id)}
          className="port-handle"
          title={`${port.name}｜${port.role === 'signal' ? '信号' : port.role === 'power' ? '电源' : '地'}｜${port.voltageDomain}${port.note ? `\n${port.note}` : ''}`}
        />
        {side === 'left' ? (
          <>
            <span className="port-dot" style={{ background: portColor(port) }} />
            <span className="port-name">{port.name}</span>
          </>
        ) : (
          <>
            <span className="port-name">{port.name}</span>
            <span className="port-dot" style={{ background: portColor(port) }} />
          </>
        )}
      </div>
    );
  };

  const address = instance ? String(instance.portConfig.address ?? '') : '';
  /**
   * 只显示组件「确实声明了」的选项：之前无条件渲染"已接上拉/未接上拉"，
   * 导致电阻、面包板这类没有上拉概念的元件也被标上"未接上拉"（误导）。
   */
  const pullupOption = def.portOptions?.find((option) => option.key === 'pullup');
  const resistanceOption = def.portOptions?.find((option) => option.key === 'resistance');
  const pullup = instance ? instance.portConfig.pullup === true : false;
  const resistance = instance
    ? String(instance.portConfig.resistance ?? resistanceOption?.defaultValue ?? '')
    : '';

  /**
   * 型号行：去掉 displayName 开头的型号前缀，只留中文名。
   * 注意不能用 `split(' ').slice(1)` —— 像「电阻（1/4W）」这种没有空格的名称会被切空，
   * 之前因此退化成 slug（画布上显示 "resistor"，与组件库里的"电阻（1/4W）"对不上）。
   */
  const modelLabel =
    def.displayName.replace(/^[A-Za-z0-9][A-Za-z0-9+\-./ ]*/, '').trim() || def.displayName;

  return (
    <div
      className={`component-node${isSelected ? ' is-selected' : ''}`}
      data-testid={`component-${props.id}`}
    >
      <div className="component-head">
        <span className="component-icon">{def.icon}</span>
        <span className="component-title">{data.label}</span>
      </div>
      <div className="component-body">
        <div className="port-column">{leftPorts.map((port) => renderPort(port, 'left'))}</div>
        <div className="component-core">
          <div className="component-model">{modelLabel}</div>
          {address ? <div className="component-badge">I2C {address}</div> : null}
          {resistanceOption && resistance ? (
            <div className="component-badge">{resistance}</div>
          ) : null}
          {pullupOption ? (
            <div className={`component-badge${pullup ? '' : ' badge-warn'}`}>
              {pullup ? '已接上拉' : '未接上拉'}
            </div>
          ) : null}
        </div>
        <div className="port-column">{rightPorts.map((port) => renderPort(port, 'right'))}</div>
      </div>
    </div>
  );
});

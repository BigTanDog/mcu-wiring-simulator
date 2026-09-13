/**
 * 开发板节点：按真实排针顺序渲染两列引脚，每个引脚是一个可连线 Handle。
 * 引脚按能力着色（GPIO / ADC / I2C / 电源 / 地 / Flash 保留 / Strapping），
 * 校验后按诊断严重度高亮。
 */
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ESP32_DEVKITC_V4 } from '../../definitions/esp32';
import type { PinDef } from '../../definitions/types';
import { useDiagnosticIndex } from '../../store/useDiagnostics';
import { pinHandleId } from '../../store/useProjectStore';

const capColor = (pin: PinDef): string => {
  if (pin.kind === 'ground') return 'var(--cap-gnd)';
  if (pin.kind === 'power') return pin.voltageDomain === '5V' ? 'var(--cap-5v)' : 'var(--cap-3v3)';
  if (pin.kind === 'enable') return 'var(--cap-en)';
  if (pin.capabilities.includes('FLASH_RESERVED')) return 'var(--cap-flash)';
  if (pin.capabilities.includes('INPUT_ONLY')) return 'var(--cap-input)';
  if (pin.capabilities.includes('I2C_SDA') || pin.capabilities.includes('I2C_SCL')) return 'var(--cap-i2c)';
  if (pin.capabilities.includes('ADC1') || pin.capabilities.includes('ADC2')) return 'var(--cap-adc)';
  if (pin.capabilities.includes('STRAP')) return 'var(--cap-strap)';
  return 'var(--cap-gpio)';
};

const capLabel = (pin: PinDef): string => {
  const labels: string[] = [];
  if (pin.kind === 'ground') labels.push('GND');
  if (pin.kind === 'power') labels.push(pin.voltageDomain);
  if (pin.capabilities.includes('INPUT_ONLY')) labels.push('仅输入');
  if (pin.capabilities.includes('FLASH_RESERVED')) labels.push('Flash 保留');
  if (pin.capabilities.includes('ADC1')) labels.push('ADC1');
  if (pin.capabilities.includes('ADC2')) labels.push('ADC2');
  if (pin.capabilities.includes('DAC')) labels.push('DAC');
  if (pin.capabilities.includes('TOUCH')) labels.push('Touch');
  if (pin.capabilities.includes('I2C_SDA')) labels.push('I2C SDA');
  if (pin.capabilities.includes('I2C_SCL')) labels.push('I2C SCL');
  if (pin.capabilities.includes('SPI')) labels.push('SPI');
  if (pin.capabilities.includes('UART0')) labels.push('UART0');
  if (pin.capabilities.includes('UART2')) labels.push('UART2');
  if (pin.capabilities.includes('STRAP')) labels.push('Strapping');
  return labels.join(' · ');
};

export const BoardNode = (props: NodeProps) => {
  const index = useDiagnosticIndex();
  const leftPins = ESP32_DEVKITC_V4.pins.filter((pin) => pin.side === 'left');
  const rightPins = ESP32_DEVKITC_V4.pins.filter((pin) => pin.side === 'right');

  const renderPin = (pin: PinDef) => {
    const severity = index.pin.get(pin.id);
    const classes = ['pin-row', `pin-${pin.side}`];
    if (severity === 'error') classes.push('pin-error');
    if (severity === 'warning') classes.push('pin-warning');
    const tooltip = [
      `${pin.physicalLabel}（排针序号 ${pin.number}）`,
      capLabel(pin) || 'GPIO',
      pin.note ?? '',
    ]
      .filter(Boolean)
      .join('\n');

    return (
      <div className={classes.join(' ')} key={pin.id} data-pin-id={pin.id} data-testid={`pin-${pin.physicalLabel}`}>
        <Handle
          type="source"
          position={pin.side === 'left' ? Position.Left : Position.Right}
          id={pinHandleId(pin.id)}
          className="pin-handle"
          title={tooltip}
        />
        {pin.side === 'left' ? (
          <>
            <span className="pin-dot" style={{ background: capColor(pin) }} />
            <span className="pin-label">{pin.physicalLabel}</span>
            <span className="pin-number">{pin.number}</span>
          </>
        ) : (
          <>
            <span className="pin-number">{pin.number}</span>
            <span className="pin-label">{pin.physicalLabel}</span>
            <span className="pin-dot" style={{ background: capColor(pin) }} />
          </>
        )}
      </div>
    );
  };

  return (
    <div className={`board-node${props.selected ? ' is-selected' : ''}`}>
      <div className="board-head">
        <div className="board-title">{ESP32_DEVKITC_V4.displayName}</div>
        <div className="board-sub">
          {ESP32_DEVKITC_V4.mcuFamily} · 逻辑电平 {ESP32_DEVKITC_V4.logicVoltage}
        </div>
      </div>
      <div className="board-body">
        <div className="pin-column">{leftPins.map(renderPin)}</div>
        <div className="board-core">
          <div className="board-core-label">USB</div>
          <div className="board-core-chip">ESP32</div>
        </div>
        <div className="pin-column">{rightPins.map(renderPin)}</div>
      </div>
      <div className="board-legend">
        <span>
          <i style={{ background: 'var(--cap-gpio)' }} />
          GPIO
        </span>
        <span>
          <i style={{ background: 'var(--cap-input)' }} />
          仅输入
        </span>
        <span>
          <i style={{ background: 'var(--cap-adc)' }} />
          ADC
        </span>
        <span>
          <i style={{ background: 'var(--cap-i2c)' }} />
          I2C
        </span>
        <span>
          <i style={{ background: 'var(--cap-3v3)' }} />
          3V3
        </span>
        <span>
          <i style={{ background: 'var(--cap-5v)' }} />
          5V
        </span>
        <span>
          <i style={{ background: 'var(--cap-gnd)' }} />
          GND
        </span>
        <span>
          <i style={{ background: 'var(--cap-flash)' }} />
          Flash 保留
        </span>
      </div>
    </div>
  );
};

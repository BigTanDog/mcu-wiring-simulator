/**
 * 规则引擎单元测试
 *
 * 覆盖：引脚真实性断言 + 关键规则正/反例 + 输出稳定性 + 连线启用开关语义。
 * 运行：pnpm/npm test（vitest）
 */
import { describe, expect, it } from 'vitest';
import { DHT11, SSD1306_I2C } from '../../definitions/components';
import { ESP32_DEVKITC_V4 } from '../../definitions/esp32';
import type { ComponentInstance, Connection } from '../../definitions/types';
import { validateProject } from '../engine';

const DEFS = [DHT11, SSD1306_I2C];
const BOARD = ESP32_DEVKITC_V4;

const dht11 = (pullup = true): ComponentInstance => ({
  id: 'c-dht11',
  definitionSlug: 'dht11',
  label: 'DHT11-1',
  position: { x: 0, y: 0 },
  portConfig: { pullup },
});

const oled = (pullup = true): ComponentInstance => ({
  id: 'c-oled',
  definitionSlug: 'ssd1306-i2c',
  label: 'OLED-1',
  position: { x: 0, y: 0 },
  portConfig: { address: '0x3C', pullup },
});

let seq = 0;
const wire = (
  pinId: string,
  instanceId: string,
  portId: string,
  enabled = true,
): Connection => {
  seq += 1;
  return {
    id: `e-${seq}`,
    from: { type: 'pin', pinId },
    to: { type: 'port', instanceId, portId },
    kind: portId === 'GND' ? 'ground' : portId === 'VCC' ? 'power' : 'signal',
    enabled,
  };
};

const run = (
  instances: ComponentInstance[],
  connections: Connection[],
  options?: { wifiEnabled?: boolean; mode?: 'strict' | 'loose' },
) =>
  validateProject({
    board: BOARD,
    instances,
    connections,
    defs: DEFS,
    options,
  });

const codes = (result: ReturnType<typeof run>): string[] =>
  [...new Set(result.diagnostics.map((item) => item.code))].sort();

const dhtWires = (portId: string, pinId: string, enabled = true): Connection =>
  wire(pinId, 'c-dht11', portId, enabled);

describe('ESP32 引脚定义真实性（与产品文档 8.2 基线一致）', () => {
  it('仅输入引脚：34/35/36/39 不允许输出能力', () => {
    for (const gpio of [34, 35, 36, 39]) {
      const pin = BOARD.pins.find((item) => item.id === `pin-esp32-gpio${gpio}`);
      expect(pin, `GPIO${gpio} 应存在`).toBeDefined();
      expect(pin?.capabilities).toContain('INPUT_ONLY');
      expect(pin?.capabilities).not.toContain('GPIO');
    }
  });

  it('GPIO6–11 标记为 Flash 保留', () => {
    for (const gpio of [6, 7, 8, 9, 10, 11]) {
      const pin = BOARD.pins.find((item) => item.id === `pin-esp32-gpio${gpio}`);
      expect(pin?.capabilities).toContain('FLASH_RESERVED');
    }
  });

  it('ADC1 = {32,33,34,35,36,39}，且 ADC2 引脚与 WiFi 冲突标记齐全', () => {
    const adc1 = BOARD.pins
      .filter((pin) => pin.capabilities.includes('ADC1'))
      .map((pin) => Number(pin.physicalLabel.replace('GPIO', '')))
      .sort((a, b) => a - b);
    expect(adc1).toEqual([32, 33, 34, 35, 36, 39]);

    const adc2 = BOARD.pins
      .filter((pin) => pin.capabilities.includes('ADC2'))
      .map((pin) => Number(pin.physicalLabel.replace('GPIO', '')))
      .sort((a, b) => a - b);
    expect(adc2).toEqual([0, 2, 4, 12, 13, 14, 15, 25, 26, 27]);
  });

  it('默认 I2C 为 SDA=GPIO21、SCL=GPIO22；Strapping = {0,2,5,12,15}', () => {
    expect(BOARD.pins.find((pin) => pin.capabilities.includes('I2C_SDA'))?.physicalLabel).toBe('GPIO21');
    expect(BOARD.pins.find((pin) => pin.capabilities.includes('I2C_SCL'))?.physicalLabel).toBe('GPIO22');

    const straps = BOARD.pins
      .filter((pin) => pin.capabilities.includes('STRAP'))
      .map((pin) => Number(pin.physicalLabel.replace('GPIO', '')))
      .sort((a, b) => a - b);
    expect(straps).toEqual([0, 2, 5, 12, 15]);
  });

  it('引脚 id 唯一且物理序号连续 1..38', () => {
    const ids = BOARD.pins.map((pin) => pin.id);
    expect(new Set(ids).size).toBe(ids.length);
    const numbers = BOARD.pins.map((pin) => pin.number).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 38 }, (_, index) => index + 1));
  });
});

describe('正确接线（示例项目）', () => {
  const connections = [
    dhtWires('VCC', 'pin-esp32-3v3'),
    dhtWires('DATA', 'pin-esp32-gpio4'),
    dhtWires('GND', 'pin-esp32-gnd-1'),
    wire('pin-esp32-3v3', 'c-oled', 'VCC'),
    wire('pin-esp32-gpio22', 'c-oled', 'SCL'),
    wire('pin-esp32-gpio21', 'c-oled', 'SDA'),
    wire('pin-esp32-gnd-2', 'c-oled', 'GND'),
  ];

  it('无错误、无警告（上拉已接）', () => {
    const result = run([dht11(true), oled(true)], connections);
    expect(result.status).toBe('passed');
    expect(result.diagnostics).toHaveLength(0);
  });

  it('未接上拉 → R-12 警告（每器件一条）', () => {
    const result = run([dht11(false), oled(false)], connections);
    expect(result.status).toBe('warning');
    expect(codes(result)).toEqual(['R-12']);
    expect(result.diagnostics.filter((item) => item.code === 'R-12')).toHaveLength(2);
  });

  it('严格模式下警告视为未通过', () => {
    const result = run([dht11(false), oled(false)], connections, { mode: 'strict' });
    expect(result.status).toBe('failed');
  });

  it('同输入重复校验，诊断集合与顺序完全一致（可复现）', () => {
    const first = run([dht11(false), oled(false)], connections);
    const second = run([dht11(false), oled(false)], connections);
    expect(JSON.stringify(first.diagnostics)).toBe(JSON.stringify(second.diagnostics));
  });
});

describe('错误接线', () => {
  it('未连接 GND → R-07 未共地', () => {
    const result = run(
      [dht11()],
      [dhtWires('VCC', 'pin-esp32-3v3'), dhtWires('DATA', 'pin-esp32-gpio4')],
    );
    expect(codes(result)).toContain('R-01');
    expect(result.status).toBe('failed');
  });

  it('GND 接到非地引脚 → R-07', () => {
    const result = run(
      [dht11()],
      [
        dhtWires('VCC', 'pin-esp32-3v3'),
        dhtWires('DATA', 'pin-esp32-gpio4'),
        dhtWires('GND', 'pin-esp32-gpio13'),
      ],
    );
    expect(codes(result)).toContain('R-07');
  });

  it('DATA 接到仅输入引脚 GPIO34 → R-08', () => {
    const result = run(
      [dht11()],
      [
        dhtWires('VCC', 'pin-esp32-3v3'),
        dhtWires('DATA', 'pin-esp32-gpio34'),
        dhtWires('GND', 'pin-esp32-gnd-1'),
      ],
    );
    expect(result.status).toBe('failed');
    const diagnostic = result.diagnostics.find((item) => item.code === 'R-08');
    expect(diagnostic?.message).toContain('GPIO34');
  });

  it('OLED SCL（输出语义）接到仅输入引脚 → R-08', () => {
    const result = run(
      [oled()],
      [
        wire('pin-esp32-3v3', 'c-oled', 'VCC'),
        wire('pin-esp32-gpio35', 'c-oled', 'SCL'),
        wire('pin-esp32-gpio21', 'c-oled', 'SDA'),
        wire('pin-esp32-gnd-2', 'c-oled', 'GND'),
      ],
    );
    expect(codes(result)).toContain('R-08');
  });

  it('接到 Flash 保留引脚 GPIO6 → R-10', () => {
    const result = run(
      [dht11()],
      [
        dhtWires('VCC', 'pin-esp32-3v3'),
        dhtWires('DATA', 'pin-esp32-gpio6'),
        dhtWires('GND', 'pin-esp32-gnd-1'),
      ],
    );
    expect(codes(result)).toContain('R-10');
  });

  it('信号线接到 5V → R-05', () => {
    const result = run(
      [dht11()],
      [
        dhtWires('VCC', 'pin-esp32-3v3'),
        dhtWires('DATA', 'pin-esp32-5v'),
        dhtWires('GND', 'pin-esp32-gnd-1'),
      ],
    );
    expect(codes(result)).toContain('R-05');
  });

  it('3V3 与 GND 直接短接 → R-18', () => {
    const connection: Connection = {
      id: 'e-short',
      from: { type: 'pin', pinId: 'pin-esp32-3v3' },
      to: { type: 'pin', pinId: 'pin-esp32-gnd-1' },
      kind: 'power',
      enabled: true,
    };
    const result = run([], [connection]);
    expect(codes(result)).toContain('R-18');
  });

  it('同一 GPIO 被两个器件占用 → R-03（电源/地引脚允许多器件共享）', () => {
    const result = run(
      [dht11(), oled()],
      [
        dhtWires('VCC', 'pin-esp32-3v3'),
        dhtWires('DATA', 'pin-esp32-gpio4'),
        dhtWires('GND', 'pin-esp32-gnd-1'),
        wire('pin-esp32-gpio4', 'c-oled', 'SCL'),
        wire('pin-esp32-gpio21', 'c-oled', 'SDA'),
        wire('pin-esp32-gnd-2', 'c-oled', 'GND'),
      ],
    );
    expect(codes(result)).toContain('R-03');
    // 电源与地引脚被两个器件共享，不应触发 R-03
    const r03 = result.diagnostics.filter((item) => item.code === 'R-03');
    expect(r03).toHaveLength(1);
    expect(r03[0].message).toContain('GPIO4');
  });

  it('占用 Strapping 引脚 GPIO0 与 UART0 引脚 GPIO1 → R-16 / R-17 警告', () => {
    const result = run(
      [oled()],
      [
        wire('pin-esp32-3v3', 'c-oled', 'VCC'),
        wire('pin-esp32-gpio0', 'c-oled', 'SCL'),
        wire('pin-esp32-gpio1', 'c-oled', 'SDA'),
        wire('pin-esp32-gnd-2', 'c-oled', 'GND'),
      ],
    );
    const resultCodes = codes(result);
    expect(resultCodes).toContain('R-16');
    expect(resultCodes).toContain('R-17');
  });

  it('使用非默认 I2C 引脚 → R-14 警告', () => {
    const result = run(
      [oled()],
      [
        wire('pin-esp32-3v3', 'c-oled', 'VCC'),
        wire('pin-esp32-gpio18', 'c-oled', 'SCL'),
        wire('pin-esp32-gpio23', 'c-oled', 'SDA'),
        wire('pin-esp32-gnd-2', 'c-oled', 'GND'),
      ],
    );
    expect(codes(result)).toContain('R-14');
  });

  it('两个 OLED 使用相同 I2C 地址 → R-13', () => {
    const second: ComponentInstance = {
      id: 'c-oled2',
      definitionSlug: 'ssd1306-i2c',
      label: 'OLED-2',
      position: { x: 0, y: 0 },
      portConfig: { address: '0x3C', pullup: true },
    };
    const result = run(
      [oled(), second],
      [
        wire('pin-esp32-3v3', 'c-oled', 'VCC'),
        wire('pin-esp32-gpio22', 'c-oled', 'SCL'),
        wire('pin-esp32-gpio21', 'c-oled', 'SDA'),
        wire('pin-esp32-gnd-2', 'c-oled', 'GND'),
        wire('pin-esp32-3v3', 'c-oled2', 'VCC'),
        wire('pin-esp32-gpio22', 'c-oled2', 'SCL'),
        wire('pin-esp32-gpio21', 'c-oled2', 'SDA'),
        wire('pin-esp32-gnd-2', 'c-oled2', 'GND'),
      ],
    );
    expect(codes(result)).toContain('R-13');
  });

  it('启用 WiFi 后 ADC2 引脚提示 R-11', () => {
    const result = run(
      [dht11()],
      [
        dhtWires('VCC', 'pin-esp32-3v3'),
        dhtWires('DATA', 'pin-esp32-gpio4'),
        dhtWires('GND', 'pin-esp32-gnd-1'),
      ],
      { wifiEnabled: true },
    );
    expect(codes(result)).toContain('R-11');
  });
});

describe('连线启用开关语义', () => {
  it('禁用连线视为断开：重连 GND 出现 R-07/R-01', () => {
    const connections = [
      dhtWires('VCC', 'pin-esp32-3v3'),
      dhtWires('DATA', 'pin-esp32-gpio4'),
      dhtWires('GND', 'pin-esp32-gnd-1', false),
    ];
    const result = run([dht11()], connections);
    expect(result.status).toBe('failed');
    expect(codes(result)).toContain('R-01');
  });
});

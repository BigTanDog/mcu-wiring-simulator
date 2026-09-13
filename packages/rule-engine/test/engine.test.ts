/**
 * 规则引擎单元测试
 *
 * 覆盖：引脚真实性断言 + 关键规则正/反例 + 输出稳定性 + 连线启用开关语义 + RuleConfig 启停。
 * 运行：npm test -w @sim/rule-engine
 */
import { COMPONENTS, ESP32_DEVKITC_V4 } from '@sim/definitions';
import type { ComponentInstance, Connection } from '@sim/contracts';
import { describe, expect, it } from 'vitest';
import { RULE_DOCS, RULES, RULE_SET_VERSION, getRuleSetInfo, validateProject } from '../src/index';

const DEFS = COMPONENTS;
const BOARD = ESP32_DEVKITC_V4;

const instance = (
  id: string,
  slug: string,
  label: string,
  portConfig: Record<string, string | boolean> = {},
): ComponentInstance => ({ id, definitionSlug: slug, label, position: { x: 0, y: 0 }, portConfig });

const dht11 = (pullup = true): ComponentInstance =>
  instance('c-dht11', 'dht11', 'DHT11-1', { pullup });

const oled = (pullup = true): ComponentInstance =>
  instance('c-oled', 'ssd1306-i2c', 'OLED-1', { address: '0x3C', pullup });

const led = (seriesResistor = false): ComponentInstance =>
  instance('c-led', 'led', 'LED-1', { seriesResistor });

const button = (internalPullup = false): ComponentInstance =>
  instance('c-key', 'push-button', 'KEY-1', { internalPullup });

const resistor = (): ComponentInstance => instance('c-res', 'resistor', 'RES-1', { resistance: '10kΩ' });

let seq = 0;
const wire = (pinId: string, instanceId: string, portId: string, enabled = true): Connection => {
  seq += 1;
  return {
    id: `e-${seq}`,
    from: { type: 'pin', pinId },
    to: { type: 'port', instanceId, portId },
    kind: portId === 'GND' || portId === 'K' || portId === 'P2' ? 'ground' : portId === 'VCC' ? 'power' : 'signal',
    enabled,
  };
};

const run = (
  instances: ComponentInstance[],
  connections: Connection[],
  options?: Parameters<typeof validateProject>[0]['options'],
) => validateProject({ board: BOARD, instances, connections, defs: DEFS, options });

const codes = (result: ReturnType<typeof run>): string[] =>
  [...new Set(result.diagnostics.map((item) => item.code))].sort();

describe('ESP32 引脚定义真实性（与 docs/产品计划文档.md §8.2 基线一致）', () => {
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

  it('ADC1 = {32,33,34,35,36,39}，ADC2 = {0,2,4,12,13,14,15,25,26,27}', () => {
    const collect = (capability: 'ADC1' | 'ADC2') =>
      BOARD.pins
        .filter((pin) => pin.capabilities.includes(capability))
        .map((pin) => Number(pin.physicalLabel.replace('GPIO', '')))
        .sort((a, b) => a - b);
    expect(collect('ADC1')).toEqual([32, 33, 34, 35, 36, 39]);
    expect(collect('ADC2')).toEqual([0, 2, 4, 12, 13, 14, 15, 25, 26, 27]);
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
    wire('pin-esp32-3v3', 'c-dht11', 'VCC'),
    wire('pin-esp32-gpio4', 'c-dht11', 'DATA'),
    wire('pin-esp32-gnd-1', 'c-dht11', 'GND'),
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

  it('规则集版本由规则集合内容哈希得出', () => {
    expect(RULE_SET_VERSION).toMatch(/^rules-[a-z0-9]+$/);
    const info = getRuleSetInfo();
    expect(info.version).toBe(RULE_SET_VERSION);
    expect(info.rules.length).toBeGreaterThanOrEqual(19);
    expect(info.rules.find((rule) => rule.code === 'R-01')?.enabled).toBe(true);
  });
});

describe('错误接线', () => {
  it('未连接 GND → R-01 必要端口未连接', () => {
    const result = run([dht11()], [wire('pin-esp32-3v3', 'c-dht11', 'VCC'), wire('pin-esp32-gpio4', 'c-dht11', 'DATA')]);
    expect(codes(result)).toContain('R-01');
    expect(result.status).toBe('failed');
  });

  it('GND 接到非地引脚 → R-07', () => {
    const result = run(
      [dht11()],
      [
        wire('pin-esp32-3v3', 'c-dht11', 'VCC'),
        wire('pin-esp32-gpio4', 'c-dht11', 'DATA'),
        wire('pin-esp32-gpio13', 'c-dht11', 'GND'),
      ],
    );
    expect(codes(result)).toContain('R-07');
  });

  it('DATA 接到仅输入引脚 GPIO34 → R-08', () => {
    const result = run(
      [dht11()],
      [
        wire('pin-esp32-3v3', 'c-dht11', 'VCC'),
        wire('pin-esp32-gpio34', 'c-dht11', 'DATA'),
        wire('pin-esp32-gnd-1', 'c-dht11', 'GND'),
      ],
    );
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
        wire('pin-esp32-3v3', 'c-dht11', 'VCC'),
        wire('pin-esp32-gpio6', 'c-dht11', 'DATA'),
        wire('pin-esp32-gnd-1', 'c-dht11', 'GND'),
      ],
    );
    expect(codes(result)).toContain('R-10');
  });

  it('信号线接到 5V → R-05', () => {
    const result = run(
      [dht11()],
      [
        wire('pin-esp32-3v3', 'c-dht11', 'VCC'),
        wire('pin-esp32-5v', 'c-dht11', 'DATA'),
        wire('pin-esp32-gnd-1', 'c-dht11', 'GND'),
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
    expect(codes(run([], [connection]))).toContain('R-18');
  });

  it('同一 GPIO 被两个器件占用 → R-03（电源/地引脚允许多器件共享）', () => {
    const result = run(
      [dht11(), oled()],
      [
        wire('pin-esp32-3v3', 'c-dht11', 'VCC'),
        wire('pin-esp32-gpio4', 'c-dht11', 'DATA'),
        wire('pin-esp32-gnd-1', 'c-dht11', 'GND'),
        wire('pin-esp32-gpio4', 'c-oled', 'SCL'),
        wire('pin-esp32-gpio21', 'c-oled', 'SDA'),
        wire('pin-esp32-gnd-2', 'c-oled', 'GND'),
      ],
    );
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
    expect(codes(result)).toContain('R-16');
    expect(codes(result)).toContain('R-17');
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
    const second = instance('c-oled2', 'ssd1306-i2c', 'OLED-2', { address: '0x3C', pullup: true });
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
        wire('pin-esp32-3v3', 'c-dht11', 'VCC'),
        wire('pin-esp32-gpio4', 'c-dht11', 'DATA'),
        wire('pin-esp32-gnd-1', 'c-dht11', 'GND'),
      ],
      { wifiEnabled: true },
    );
    expect(codes(result)).toContain('R-11');
  });
});

describe('LED / 按键 / 电阻（新增经典元件）', () => {
  const ledWires = [
    wire('pin-esp32-gpio4', 'c-led', 'A'),
    wire('pin-esp32-gnd-1', 'c-led', 'K'),
  ];

  it('LED 未接限流电阻 → R-19 警告', () => {
    const result = run([led(false)], ledWires);
    expect(codes(result)).toContain('R-19');
    expect(result.diagnostics.find((item) => item.code === 'R-19')?.severity).toBe('warning');
  });

  it('LED 勾选已串联电阻 → 无 R-19', () => {
    const result = run([led(true)], ledWires);
    expect(codes(result)).not.toContain('R-19');
    expect(result.status).toBe('passed');
  });

  it('LED 串入真实电阻元件 → 无 R-19（net 中存在 passive 元件）', () => {
    const result = run(
      [led(false), resistor()],
      [
        wire('pin-esp32-gpio4', 'c-res', '1'),
        wire('pin-esp32-gpio4', 'c-led', 'A'),
        wire('pin-esp32-gnd-1', 'c-led', 'K'),
        wire('pin-esp32-gnd-1', 'c-res', '2'),
      ],
    );
    expect(codes(result)).not.toContain('R-19');
  });

  it('按键未启用上拉 → R-12 警告', () => {
    const result = run([button(false)], [wire('pin-esp32-gpio4', 'c-key', 'P1'), wire('pin-esp32-gnd-1', 'c-key', 'P2')]);
    expect(codes(result)).toContain('R-12');
  });

  it('按键在仅输入引脚上启用内部上拉 → R-09 警告（该引脚无内部上拉）', () => {
    const result = run(
      [button(true)],
      [wire('pin-esp32-gpio34', 'c-key', 'P1'), wire('pin-esp32-gnd-1', 'c-key', 'P2')],
    );
    expect(codes(result)).toContain('R-09');
  });

  it('按键外接上拉电阻（电阻接到 3V3 与信号线）→ 无 R-12', () => {
    const result = run(
      [button(false), resistor()],
      [
        wire('pin-esp32-gpio4', 'c-key', 'P1'),
        wire('pin-esp32-gnd-1', 'c-key', 'P2'),
        wire('pin-esp32-3v3', 'c-res', '1'),
        wire('pin-esp32-gpio4', 'c-res', '2'),
      ],
    );
    expect(codes(result)).not.toContain('R-12');
  });
});

describe('连线启用开关与规则配置', () => {
  it('禁用连线视为断开：重连 GND 出现 R-01', () => {
    const result = run(
      [dht11()],
      [
        wire('pin-esp32-3v3', 'c-dht11', 'VCC'),
        wire('pin-esp32-gpio4', 'c-dht11', 'DATA'),
        wire('pin-esp32-gnd-1', 'c-dht11', 'GND', false),
      ],
    );
    expect(result.status).toBe('failed');
    expect(codes(result)).toContain('R-01');
  });

  it('RuleConfig 可关闭规则与覆盖严重度', () => {
    const base = run([dht11(false)], [wire('pin-esp32-3v3', 'c-dht11', 'VCC'), wire('pin-esp32-gpio4', 'c-dht11', 'DATA'), wire('pin-esp32-gnd-1', 'c-dht11', 'GND')]);
    expect(codes(base)).toContain('R-12');

    const disabled = run(
      [dht11(false)],
      [wire('pin-esp32-3v3', 'c-dht11', 'VCC'), wire('pin-esp32-gpio4', 'c-dht11', 'DATA'), wire('pin-esp32-gnd-1', 'c-dht11', 'GND')],
      { ruleConfigs: [{ code: 'R-12', enabled: false }] },
    );
    expect(codes(disabled)).not.toContain('R-12');

    const overridden = run(
      [dht11(false)],
      [wire('pin-esp32-3v3', 'c-dht11', 'VCC'), wire('pin-esp32-gpio4', 'c-dht11', 'DATA'), wire('pin-esp32-gnd-1', 'c-dht11', 'GND')],
      { ruleConfigs: [{ code: 'R-12', enabled: true, severityOverride: 'error' }] },
    );
    expect(overridden.status).toBe('failed');
    expect(overridden.diagnostics.find((item) => item.code === 'R-12')?.severity).toBe('error');
  });
});

describe('新增经典组件与规则（R-15 独立供电 / R-20 串口交叉 / R-21 5V 直连）', () => {
  it('板定义标注 UART 收发角色（R-20 的判定依据）', () => {
    const hasCap = (label: string, capability: string): boolean =>
      BOARD.pins.find((pin) => pin.physicalLabel === label)?.capabilities.includes(
        capability as never,
      ) ?? false;

    expect(hasCap('GPIO1', 'UART0_TX')).toBe(true);
    expect(hasCap('GPIO3', 'UART0_RX')).toBe(true);
    expect(hasCap('GPIO17', 'UART2_TX')).toBe(true);
    expect(hasCap('GPIO16', 'UART2_RX')).toBe(true);
  });

  it('组件库包含本批新增的经典组件', () => {
    const slugs = COMPONENTS.map((def) => def.slug);
    for (const slug of [
      'hc-sr04',
      'servo-sg90',
      'buzzer-active',
      'usb-ttl',
      'dht11',
      'ssd1306-i2c',
      'led',
      'push-button',
      'resistor',
    ]) {
      expect(slugs).toContain(slug);
    }
  });

  const sr04Wires = (echoPin: string) => [
    wire('pin-esp32-5v', 'c-sr04', 'VCC'),
    wire('pin-esp32-gpio5', 'c-sr04', 'TRIG'),
    wire(echoPin, 'c-sr04', 'ECHO'),
    wire('pin-esp32-gnd-1', 'c-sr04', 'GND'),
  ];

  it('HC-SR04 的 ECHO 直连 GPIO18 → R-21（5V 直连 3.3V）', () => {
    const sr04 = instance('c-sr04', 'hc-sr04', 'HC-SR04-1', {
      levelShifted: false,
      externalSupply: true,
    });
    const result = run([sr04], sr04Wires('pin-esp32-gpio18'));
    const r21 = result.diagnostics.find((item) => item.code === 'R-21');
    expect(r21?.severity).toBe('error');
    expect(r21?.message).toContain('GPIO18');
  });

  it('HC-SR04 勾选"已分压/已电平转换" → 无 R-21', () => {
    const sr04 = instance('c-sr04', 'hc-sr04', 'HC-SR04-1', {
      levelShifted: true,
      externalSupply: true,
    });
    expect(codes(run([sr04], sr04Wires('pin-esp32-gpio18')))).not.toContain('R-21');
  });

  it('SG90 舵机由板载 3V3 供电 → R-15（需独立供电）', () => {
    const servo = instance('c-servo', 'servo-sg90', 'SG90-1', { externalSupply: false });
    const result = run(
      [servo],
      [
        wire('pin-esp32-3v3', 'c-servo', 'VCC'),
        wire('pin-esp32-gpio13', 'c-servo', 'SIG'),
        wire('pin-esp32-gnd-1', 'c-servo', 'GND'),
      ],
    );
    const r15 = result.diagnostics.find((item) => item.code === 'R-15');
    expect(r15?.severity).toBe('warning');
    expect(r15?.message).toContain('SG90-1');
  });

  it('SG90 勾选"已使用独立电源" → 无 R-15', () => {
    const servo = instance('c-servo', 'servo-sg90', 'SG90-1', { externalSupply: true });
    const result = run(
      [servo],
      [
        wire('pin-esp32-3v3', 'c-servo', 'VCC'),
        wire('pin-esp32-gpio13', 'c-servo', 'SIG'),
        wire('pin-esp32-gnd-1', 'c-servo', 'GND'),
      ],
    );
    expect(codes(result)).not.toContain('R-15');
  });

  it('USB-TTL 的 TX 接到开发板 TX 引脚（未交叉）→ R-20', () => {
    const ttl = instance('c-ttl', 'usb-ttl', 'USB-TTL-1', { voltage: '3V3' });
    const result = run(
      [ttl],
      [
        wire('pin-esp32-gpio1', 'c-ttl', 'TX'),
        wire('pin-esp32-gpio3', 'c-ttl', 'RX'),
        wire('pin-esp32-gnd-1', 'c-ttl', 'GND'),
      ],
    );
    const r20 = result.diagnostics.filter((item) => item.code === 'R-20');
    expect(r20.length).toBeGreaterThanOrEqual(1);
    expect(r20[0].message).toContain('GPIO1');
  });

  it('USB-TTL 正确交叉（TX→GPIO3 / RX→GPIO1）→ 无 R-20', () => {
    const ttl = instance('c-ttl', 'usb-ttl', 'USB-TTL-1', { voltage: '3V3' });
    const result = run(
      [ttl],
      [
        wire('pin-esp32-gpio3', 'c-ttl', 'TX'),
        wire('pin-esp32-gpio1', 'c-ttl', 'RX'),
        wire('pin-esp32-gnd-1', 'c-ttl', 'GND'),
      ],
    );
    expect(codes(result)).not.toContain('R-20');
  });

  it('有源蜂鸣器正确接线 → 全部通过', () => {
    const buzzer = instance('c-bz', 'buzzer-active', '蜂鸣器-1', { triggerLevel: '高电平触发' });
    const result = run(
      [buzzer],
      [
        wire('pin-esp32-3v3', 'c-bz', 'VCC'),
        wire('pin-esp32-gpio4', 'c-bz', 'IO'),
        wire('pin-esp32-gnd-1', 'c-bz', 'GND'),
      ],
    );
    expect(result.status).toBe('passed');
    expect(result.diagnostics).toHaveLength(0);
  });
});

describe('规则教学说明（为什么 / 正确做法）', () => {
  it('规则集内每条规则都有说明文案，且字段完整', () => {
    for (const rule of RULES) {
      const doc = RULE_DOCS[rule.meta.code];
      expect(doc, `规则 ${rule.meta.code} 缺少说明文案`).toBeTruthy();
      expect(doc.title).toBe(rule.meta.name);
      expect(doc.why.length).toBeGreaterThan(10);
      expect(doc.howTo.length).toBeGreaterThan(5);
    }
  });

  it('说明表没有孤儿条目（每个 code 都能对应到规则）', () => {
    const codes = new Set(RULES.map((rule) => rule.meta.code));
    for (const code of Object.keys(RULE_DOCS)) {
      expect(codes.has(code), `说明 ${code} 找不到对应规则`).toBe(true);
    }
  });
});

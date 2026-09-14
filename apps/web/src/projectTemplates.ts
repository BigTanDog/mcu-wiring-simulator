/**
 * 示例项目模板：用现有组件预置的「正确接线」，一键载入即可在画布上查看、
 * 运行并与自己的接法对比。
 *
 * 约定：
 *  - 实例/连线 id 带模板前缀（如 t2-*），避免跨模板冲突；
 *  - 每个模板都必须通过校验（允许 warning，不允许 error）——由单测强制；
 *  - 「教学要点」会展示在项目管理面板的卡片上。
 */
import type { ComponentInstance, Connection } from '@sim/contracts';

export interface ProjectTemplate {
  id: string;
  name: string;
  /** 一句话说明这个模板演示什么 */
  summary: string;
  /** 教学要点（卡片上的标签） */
  highlights: string[];
  projectName: string;
  options: { wifiEnabled: boolean; mode: 'strict' | 'loose' };
  instances: ComponentInstance[];
  connections: Connection[];
}

const inst = (
  id: string,
  definitionSlug: string,
  label: string,
  x: number,
  y: number,
  portConfig: Record<string, string | boolean>,
): ComponentInstance => ({ id, definitionSlug, label, position: { x, y }, portConfig });

const wire = (
  id: string,
  from: Connection['from'],
  to: Connection['to'],
  kind: Connection['kind'],
): Connection => ({ id, from, to, kind, enabled: true });

const pin = (pinId: string): Connection['from'] => ({ type: 'pin', pinId });
const port = (instanceId: string, portId: string): Connection['to'] => ({
  type: 'port',
  instanceId,
  portId,
});

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'dht11-oled',
    name: '温湿度显示',
    summary: 'DHT11 读温湿度，OLED 显示结果。覆盖单总线数据线、I2C 显示、上拉电阻三件事。',
    highlights: ['单总线', 'I2C 显示', '上拉电阻'],
    projectName: '示例：温湿度显示（DHT11 + OLED）',
    options: { wifiEnabled: false, mode: 'loose' },
    instances: [
      inst('t1-dht11', 'dht11', 'DHT11-1', 470, 110, { pullup: true }),
      inst('t1-oled', 'ssd1306-i2c', 'OLED-1', 470, 350, { address: '0x3C', pullup: true }),
    ],
    connections: [
      wire('t1-e1', pin('pin-esp32-3v3'), port('t1-dht11', 'VCC'), 'power'),
      wire('t1-e2', pin('pin-esp32-gpio4'), port('t1-dht11', 'DATA'), 'signal'),
      wire('t1-e3', pin('pin-esp32-gnd-1'), port('t1-dht11', 'GND'), 'ground'),
      wire('t1-e4', pin('pin-esp32-3v3'), port('t1-oled', 'VCC'), 'power'),
      wire('t1-e5', pin('pin-esp32-gpio22'), port('t1-oled', 'SCL'), 'bus'),
      wire('t1-e6', pin('pin-esp32-gpio21'), port('t1-oled', 'SDA'), 'bus'),
      wire('t1-e7', pin('pin-esp32-gnd-2'), port('t1-oled', 'GND'), 'ground'),
    ],
  },
  {
    id: 'ultrasonit1-oled',
    name: '超声波测距',
    summary:
      'HC-SR04 测距并在 OLED 显示。重点：ECHO 是 5V 输出，必须分压后才能接 3.3V 引脚（已勾选"已分压"）。',
    highlights: ['5V 电平分压', '非默认 I2C 地址', '大电流负载'],
    projectName: '示例：超声波测距（HC-SR04 + OLED）',
    options: { wifiEnabled: false, mode: 'loose' },
    instances: [
      inst('t2-sr04', 'hc-sr04', 'HC-SR04-1', 470, 90, {
        levelShifted: true,
        externalSupply: false,
      }),
      inst('t2-oled', 'ssd1306-i2c', 'OLED-1', 470, 400, { address: '0x3F', pullup: true }),
    ],
    connections: [
      wire('t2-e1', pin('pin-esp32-5v'), port('t2-sr04', 'VCC'), 'power'),
      wire('t2-e2', pin('pin-esp32-gpio13'), port('t2-sr04', 'TRIG'), 'signal'),
      wire('t2-e3', pin('pin-esp32-gpio18'), port('t2-sr04', 'ECHO'), 'signal'),
      wire('t2-e4', pin('pin-esp32-gnd-1'), port('t2-sr04', 'GND'), 'ground'),
      wire('t2-e5', pin('pin-esp32-3v3'), port('t2-oled', 'VCC'), 'power'),
      wire('t2-e6', pin('pin-esp32-gpio22'), port('t2-oled', 'SCL'), 'bus'),
      wire('t2-e7', pin('pin-esp32-gpio21'), port('t2-oled', 'SDA'), 'bus'),
      wire('t2-e8', pin('pin-esp32-gnd-2'), port('t2-oled', 'GND'), 'ground'),
    ],
  },
  {
    id: 'motor-driver',
    name: '电机调速',
    summary:
      'L298N 驱动直流电机，按键控制启停。演示“器件直连”：电机接驱动模块输出端，而不是 GPIO。',
    highlights: ['器件直连', 'PWM 调速', '驱动模块'],
    projectName: '示例：电机调速（L298N + 直流电机）',
    options: { wifiEnabled: false, mode: 'loose' },
    instances: [
      inst('t3-l298', 'l298n', 'L298N-1', 470, 60, { externalSupply: true }),
      inst('t3-motor', 'dc-motor', '电机-1', 820, 110, { externalSupply: true }),
      inst('t3-key', 'push-button', 'KEY-1', 470, 450, { internalPullup: true }),
    ],
    connections: [
      wire('t3-e1', pin('pin-esp32-gpio25'), port('t3-l298', 'ENA'), 'signal'),
      wire('t3-e2', pin('pin-esp32-gpio26'), port('t3-l298', 'IN1'), 'signal'),
      wire('t3-e3', pin('pin-esp32-gpio27'), port('t3-l298', 'IN2'), 'signal'),
      wire('t3-e4', pin('pin-esp32-gnd-1'), port('t3-l298', 'GND'), 'ground'),
      wire('t3-e5', pin('pin-esp32-5v'), port('t3-l298', '+12V'), 'power'),
      // 器件直连：驱动模块输出 → 电机两端
      wire('t3-e6', port('t3-l298', 'OUT1'), port('t3-motor', '+'), 'power'),
      wire('t3-e7', port('t3-l298', 'OUT2'), port('t3-motor', '-'), 'power'),
      wire('t3-e8', pin('pin-esp32-gpio14'), port('t3-key', 'P1'), 'signal'),
      wire('t3-e9', pin('pin-esp32-gnd-2'), port('t3-key', 'P2'), 'ground'),
    ],
  },
  {
    id: 'uart-debug',
    name: '串口调试',
    summary:
      'USB-TTL 与开发板串口通信。重点：TX/RX 必须交叉，且 GPIO1/GPIO3 被占用会影响程序下载与日志。',
    highlights: ['TX/RX 交叉', 'UART0 占用', '共地'],
    projectName: '示例：串口调试（USB-TTL）',
    options: { wifiEnabled: false, mode: 'loose' },
    instances: [inst('t4-ttl', 'usb-ttl', 'USB-TTL-1', 470, 150, { voltage: '3V3' })],
    connections: [
      // 模块 TX → 开发板 RX（GPIO3）；模块 RX → 开发板 TX（GPIO1）—— 交叉正确
      wire('t4-e1', pin('pin-esp32-gpio3'), port('t4-ttl', 'TX'), 'signal'),
      wire('t4-e2', pin('pin-esp32-gpio1'), port('t4-ttl', 'RX'), 'signal'),
      wire('t4-e3', pin('pin-esp32-gnd-1'), port('t4-ttl', 'GND'), 'ground'),
    ],
  },
  // 多组件大项目（放在数组末尾：模板卡片按顺序展示，常规教学模板在前）
  buildLabProject(),
  {
    id: 'breadboard-fanout',
    name: '面包板一拖多',
    summary:
      '用面包板的「列」把 1 个 GPIO 分给 3 个 LED —— 一个引脚驱动多路负载的经典做法，同时演示正负电源轨的用法。',
    highlights: ['面包板分接', '一拖多', '电源轨'],
    projectName: '示例：面包板一拖多（1 个 GPIO 驱动 3 路 LED）',
    options: { wifiEnabled: false, mode: 'loose' },
    instances: [
      inst('t6-bb', 'breadboard', '面包板-1', 620, 40, {}),
      inst('t6-r1', 'resistor', 'R-1', 1220, 40, { resistance: '220Ω' }),
      inst('t6-led1', 'led', 'LED-1', 1460, 40, { seriesResistor: false }),
      inst('t6-r2', 'resistor', 'R-2', 1220, 300, { resistance: '220Ω' }),
      inst('t6-led2', 'led', 'LED-2', 1460, 300, { seriesResistor: false }),
      inst('t6-r3', 'resistor', 'R-3', 1220, 560, { resistance: '220Ω' }),
      inst('t6-led3', 'led', 'LED-3', 1460, 560, { seriesResistor: false }),
    ],
    connections: [
      // 开发板 → 面包板：1 路信号进第 1 列，3V3/GND 分别进正负轨
      wire('t6-e1', pin('pin-esp32-gpio4'), port('t6-bb', 'c1'), 'signal'),
      wire('t6-e2', pin('pin-esp32-3v3'), port('t6-bb', 'vcc'), 'power'),
      wire('t6-e3', pin('pin-esp32-gnd-1'), port('t6-bb', 'gnd'), 'ground'),
      // 三条 LED 支路都从「同一列」取信号、从负轨取地（列内等电位）
      wire('t6-e4', port('t6-r1', '1'), port('t6-bb', 'c1'), 'signal'),
      wire('t6-e5', port('t6-r1', '2'), port('t6-led1', 'A'), 'signal'),
      wire('t6-e6', port('t6-led1', 'K'), port('t6-bb', 'gnd'), 'ground'),
      wire('t6-e7', port('t6-r2', '1'), port('t6-bb', 'c1'), 'signal'),
      wire('t6-e8', port('t6-r2', '2'), port('t6-led2', 'A'), 'signal'),
      wire('t6-e9', port('t6-led2', 'K'), port('t6-bb', 'gnd'), 'ground'),
      wire('t6-e10', port('t6-r3', '1'), port('t6-bb', 'c1'), 'signal'),
      wire('t6-e11', port('t6-r3', '2'), port('t6-led3', 'A'), 'signal'),
      wire('t6-e12', port('t6-led3', 'K'), port('t6-bb', 'gnd'), 'ground'),
    ],
  },
];

/**
 * 综合实验项目（多组件大项目）：把传感器 / 显示 / 执行器 / 交互元件接在同一块板上，
 * 用于观察「多组件下」的画布表现与校验结果，也是性能基准（NFR-01）的人眼可读场景。
 *
 * 接线要点：
 *  - LED 采用真实串联拓扑：`GPIO → 限流电阻 → LED 阳极`，`LED 阴极 → GND`（两处用到器件直连）；
 *  - 舵机由 3.3V 电源模块独立供电（器件直连）并与开发板共地；
 *  - 超声波 ECHO 已分压（5V → 3.3V，勾选豁免）；
 *  - 按键统一使用芯片内部上拉；
 *  - 电源/地引脚按"电源轨"语义共享（同一 GND 引脚可接多个 GND 端口）；
 *  - 结果允许存在警告（strapping 引脚 / UART0 占用 / 超声波板载供电），但不得有 error —— 由单测强制。
 */
function buildLabProject(): ProjectTemplate {
  const instances: ComponentInstance[] = [];
  const connections: Connection[] = [];
  let slot = 0;
  let seq = 0;

  const nextPosition = (): { x: number; y: number } => {
    const position = { x: 620 + (slot % 4) * 320, y: 40 + Math.floor(slot / 4) * 170 };
    slot += 1;
    return position;
  };

  const add = (
    id: string,
    slug: string,
    label: string,
    portConfig: Record<string, string | boolean> = {},
  ): void => {
    instances.push({ id, definitionSlug: slug, label, position: nextPosition(), portConfig });
  };

  const pin = (pinId: string): Connection['from'] => ({ type: 'pin', pinId });
  const port = (instanceId: string, portId: string): Connection['to'] => ({
    type: 'port',
    instanceId,
    portId,
  });
  const w = (from: Connection['from'], to: Connection['to'], kind: Connection['kind']): void => {
    seq += 1;
    connections.push({ id: `t5-e${seq}`, from, to, kind, enabled: true });
  };

  /* ------------------------------ 元件 ------------------------------ */
  add('t5-dht11', 'dht11', 'DHT11-1', { pullup: true });
  add('t5-sr04', 'hc-sr04', 'HC-SR04-1', { levelShifted: true, externalSupply: false });
  add('t5-servo', 'servo-sg90', 'SG90-1', { externalSupply: false });
  add('t5-buzzer', 'buzzer-active', '蜂鸣器-1', { triggerLevel: '高电平触发' });
  add('t5-l298', 'l298n', 'L298N-1', { externalSupply: true });
  add('t5-motor', 'dc-motor', '电机-1', { externalSupply: true });
  add('t5-power', 'power-3v3', '电源模块-1');
  add('t5-oled', 'ssd1306-i2c', 'OLED-1', { address: '0x3C', pullup: true });
  add('t5-lcd', 'lcd1602-i2c', 'LCD1602-1', { address: '0x27', pullup: true });

  const keyPins = ['pin-esp32-gpio18', 'pin-esp32-gpio19', 'pin-esp32-gpio23', 'pin-esp32-gpio25'];
  keyPins.forEach((_, index) => {
    add(`t5-key${index + 1}`, 'push-button', `KEY-${index + 1}`, { internalPullup: true });
  });

  const ledPins = [
    'pin-esp32-gpio4',
    'pin-esp32-gpio5',
    'pin-esp32-gpio13',
    'pin-esp32-gpio14',
    'pin-esp32-gpio15',
    'pin-esp32-gpio12',
  ];
  ledPins.forEach((_, index) => {
    add(`t5-r${index + 1}`, 'resistor', `R-${index + 1}`, { resistance: '220Ω' });
    add(`t5-led${index + 1}`, 'led', `LED-${index + 1}`, { seriesResistor: false });
  });

  add('t5-ttl', 'usb-ttl', 'USB-TTL-1', { voltage: '3V3' });

  /* ------------------------------ 连线 ------------------------------ */
  // DHT11（单总线）
  w(pin('pin-esp32-3v3'), port('t5-dht11', 'VCC'), 'power');
  w(pin('pin-esp32-gpio26'), port('t5-dht11', 'DATA'), 'signal');
  w(pin('pin-esp32-gnd-1'), port('t5-dht11', 'GND'), 'ground');

  // 超声波（ECHO 已分压）
  w(pin('pin-esp32-5v'), port('t5-sr04', 'VCC'), 'power');
  w(pin('pin-esp32-gpio16'), port('t5-sr04', 'TRIG'), 'signal');
  w(pin('pin-esp32-gpio17'), port('t5-sr04', 'ECHO'), 'signal');
  w(pin('pin-esp32-gnd-1'), port('t5-sr04', 'GND'), 'ground');

  // 舵机：电源模块独立供电（器件直连）+ 共地
  w(pin('pin-esp32-gpio32'), port('t5-servo', 'SIG'), 'signal');
  w(pin('pin-esp32-gnd-2'), port('t5-servo', 'GND'), 'ground');
  w(port('t5-power', 'OUT'), port('t5-servo', 'VCC'), 'power');
  w(pin('pin-esp32-gnd-2'), port('t5-power', 'GND'), 'ground');

  // 蜂鸣器
  w(pin('pin-esp32-3v3'), port('t5-buzzer', 'VCC'), 'power');
  w(pin('pin-esp32-gpio27'), port('t5-buzzer', 'IO'), 'signal');
  w(pin('pin-esp32-gnd-1'), port('t5-buzzer', 'GND'), 'ground');

  // L298N + 直流电机（输出侧器件直连）
  w(pin('pin-esp32-gpio2'), port('t5-l298', 'ENA'), 'signal');
  w(pin('pin-esp32-gpio33'), port('t5-l298', 'IN1'), 'signal');
  w(pin('pin-esp32-gpio0'), port('t5-l298', 'IN2'), 'signal');
  w(pin('pin-esp32-gnd-2'), port('t5-l298', 'GND'), 'ground');
  w(pin('pin-esp32-5v'), port('t5-l298', '+12V'), 'power');
  w(port('t5-l298', 'OUT1'), port('t5-motor', '+'), 'power');
  w(port('t5-l298', 'OUT2'), port('t5-motor', '-'), 'power');

  // I2C 显示：OLED 与 LCD1602 共用总线（地址不同）
  w(pin('pin-esp32-3v3'), port('t5-oled', 'VCC'), 'power');
  w(pin('pin-esp32-gpio22'), port('t5-oled', 'SCL'), 'bus');
  w(pin('pin-esp32-gpio21'), port('t5-oled', 'SDA'), 'bus');
  w(pin('pin-esp32-gnd-1'), port('t5-oled', 'GND'), 'ground');

  w(pin('pin-esp32-5v'), port('t5-lcd', 'VCC'), 'power');
  w(pin('pin-esp32-gpio22'), port('t5-lcd', 'SCL'), 'bus');
  w(pin('pin-esp32-gpio21'), port('t5-lcd', 'SDA'), 'bus');
  w(pin('pin-esp32-gnd-1'), port('t5-lcd', 'GND'), 'ground');

  // 按键（内部上拉）
  keyPins.forEach((pinId, index) => {
    w(pin(pinId), port(`t5-key${index + 1}`, 'P1'), 'signal');
    w(pin('pin-esp32-gnd-2'), port(`t5-key${index + 1}`, 'P2'), 'ground');
  });

  // LED 支路：GPIO → 限流电阻 → LED 阳极，阴极 → GND
  ledPins.forEach((pinId, index) => {
    w(pin(pinId), port(`t5-r${index + 1}`, '1'), 'signal');
    w(port(`t5-r${index + 1}`, '2'), port(`t5-led${index + 1}`, 'A'), 'signal');
    w(pin('pin-esp32-gnd-2'), port(`t5-led${index + 1}`, 'K'), 'ground');
  });

  // USB-TTL（TX/RX 交叉）
  w(pin('pin-esp32-gpio3'), port('t5-ttl', 'TX'), 'signal');
  w(pin('pin-esp32-gpio1'), port('t5-ttl', 'RX'), 'signal');
  w(pin('pin-esp32-gnd-1'), port('t5-ttl', 'GND'), 'ground');

  return {
    id: 'lab-showcase',
    name: '综合实验项目',
    summary: `把 ${instances.length} 个元件接在同一块板上（传感器 / 显示 / 执行器 / 交互），用于观察多组件下的画布表现与校验结果。`,
    highlights: [`${instances.length} 组件 / ${connections.length} 连线`, '器件直连', 'I2C 双设备'],
    projectName: `示例：综合实验项目（${instances.length} 组件）`,
    options: { wifiEnabled: false, mode: 'loose' },
    instances,
    connections,
  };
}

/** 默认模板（顶栏「载入示例」按钮使用） */
export const SAMPLE_TEMPLATE_ID = 'dht11-oled';

export const findTemplate = (id: string): ProjectTemplate | undefined =>
  PROJECT_TEMPLATES.find((item) => item.id === id);

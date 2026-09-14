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
];

/** 默认模板（顶栏「载入示例」按钮使用） */
export const SAMPLE_TEMPLATE_ID = 'dht11-oled';

export const findTemplate = (id: string): ProjectTemplate | undefined =>
  PROJECT_TEMPLATES.find((item) => item.id === id);

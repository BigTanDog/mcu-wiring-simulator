/**
 * 组件定义（Demo 版：ESP32 主控 + DHT11 传感器 + SSD1306 OLED 显示模块）
 *
 * 设计约束（对齐 docs/产品计划文档.md 第 7.3 / 12 章）：
 *  - 约束通过 requirements[] 声明（如上拉需求），由通用规则读取，避免为每个组件写专属规则。
 *  - 端口、可选项全部声明式，新增组件不需要改引擎与画布代码。
 */
import type { ComponentDef } from './types';

export const DHT11: ComponentDef = {
  slug: 'dht11',
  displayName: 'DHT11 温湿度传感器',
  category: 'sensor',
  icon: 'DHT',
  version: '1.0.0',
  description: '单总线数字温湿度传感器，DATA 需外接 4.7k–10k 上拉电阻。',
  ports: [
    { id: 'VCC', name: 'VCC', role: 'power', direction: 'in', voltageDomain: '3V3', required: true },
    {
      id: 'DATA',
      name: 'DATA',
      role: 'signal',
      direction: 'io',
      voltageDomain: '3V3',
      required: true,
      protocols: ['OneWire'],
      note: '单总线数据线，需上拉电阻',
    },
    { id: 'GND', name: 'GND', role: 'ground', direction: 'in', voltageDomain: 'GND', required: true },
  ],
  protocols: ['OneWire'],
  requirements: ['onewire-pullup'],
  portOptions: [
    { key: 'pullup', label: '已外接 10k 上拉电阻', kind: 'toggle', defaultValue: false, satisfies: 'onewire-pullup' },
  ],
};

export const SSD1306_I2C: ComponentDef = {
  slug: 'ssd1306-i2c',
  displayName: 'SSD1306 OLED 0.96"',
  category: 'display',
  icon: 'OLED',
  version: '1.0.0',
  description: '128×64 I2C OLED 显示屏，SCL/SDA 需总线上拉，地址 0x3C / 0x3D。',
  ports: [
    { id: 'VCC', name: 'VCC', role: 'power', direction: 'in', voltageDomain: '3V3', required: true },
    { id: 'GND', name: 'GND', role: 'ground', direction: 'in', voltageDomain: 'GND', required: true },
    {
      id: 'SCL',
      name: 'SCL',
      role: 'signal',
      // 校验视角是"主控如何驱动该线"：I2C 时钟由主机输出，故为 out（接到仅输入引脚会报 R-08）
      direction: 'out',
      voltageDomain: '3V3',
      required: true,
      protocols: ['I2C'],
      note: 'I2C 时钟线，默认接 GPIO22',
    },
    {
      id: 'SDA',
      name: 'SDA',
      role: 'signal',
      direction: 'io',
      voltageDomain: '3V3',
      required: true,
      protocols: ['I2C'],
      note: 'I2C 数据线，默认接 GPIO21',
    },
  ],
  protocols: ['I2C'],
  requirements: ['i2c-pullup'],
  portOptions: [
    { key: 'address', label: 'I2C 地址', kind: 'select', options: ['0x3C', '0x3D'], defaultValue: '0x3C' },
    { key: 'pullup', label: '总线已接 4.7k 上拉', kind: 'toggle', defaultValue: false, satisfies: 'i2c-pullup' },
  ],
};

export const COMPONENTS: ComponentDef[] = [DHT11, SSD1306_I2C];

export const getComponentDef = (slug: string): ComponentDef => {
  const def = COMPONENTS.find((item) => item.slug === slug);
  if (!def) throw new Error(`未找到组件定义: ${slug}`);
  return def;
};

export const CATEGORY_LABELS: Record<ComponentDef['category'], string> = {
  mcu: '主控芯片',
  sensor: '传感器',
  actuator: '执行器',
  display: '显示模块',
};

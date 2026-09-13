import type { ComponentDef } from '@sim/contracts';

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
    {
      key: 'pullup',
      label: '总线已接 4.7kΩ 上拉',
      kind: 'toggle',
      defaultValue: false,
      satisfies: 'i2c-pullup',
    },
  ],
};

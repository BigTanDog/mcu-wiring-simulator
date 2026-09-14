import type { ComponentDef } from '@sim/contracts';

export const LCD1602_I2C: ComponentDef = {
  slug: 'lcd1602-i2c',
  displayName: 'LCD1602（I2C 背包）',
  category: 'display',
  icon: 'LCD',
  version: '1.0.0',
  description:
    '16×2 字符液晶 + I2C 背包（默认地址 0x27，部分模块为 0x3F）。5V 供电；与 OLED 同时使用时必须避免地址冲突。',
  ports: [
    {
      id: 'VCC',
      name: 'VCC',
      role: 'power',
      direction: 'in',
      voltageDomain: '5V',
      required: true,
      note: 'I2C 背包工作电压 5V（3.3V 下对比度可能偏淡）',
    },
    { id: 'GND', name: 'GND', role: 'ground', direction: 'in', voltageDomain: 'GND', required: true },
    {
      id: 'SCL',
      name: 'SCL',
      role: 'signal',
      direction: 'out',
      voltageDomain: '3V3',
      required: true,
      protocols: ['I2C'],
      note: 'I2C 时钟线，默认接 GPIO22（开漏总线，电平由主控侧上拉决定）',
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
    {
      key: 'address',
      label: 'I2C 地址',
      kind: 'select',
      options: ['0x27', '0x3F'],
      defaultValue: '0x27',
    },
    {
      key: 'pullup',
      label: '总线已接 4.7kΩ 上拉',
      kind: 'toggle',
      defaultValue: false,
      satisfies: 'i2c-pullup',
    },
  ],
};

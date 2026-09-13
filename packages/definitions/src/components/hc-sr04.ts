import type { ComponentDef } from '@sim/contracts';

export const HC_SR04: ComponentDef = {
  slug: 'hc-sr04',
  displayName: 'HC-SR04 超声波测距',
  category: 'sensor',
  icon: 'US',
  version: '1.0.0',
  description:
    '2–400cm 超声波测距模块。ECHO 输出 5V 电平，接 3.3V 引脚必须在分压/电平转换后接入；建议 5V 独立供电。',
  ports: [
    {
      id: 'VCC',
      name: 'VCC',
      role: 'power',
      direction: 'in',
      voltageDomain: '5V',
      required: true,
      note: '建议 5V 供电（3.3V 下测距不稳）',
    },
    {
      id: 'TRIG',
      name: 'TRIG',
      role: 'signal',
      direction: 'in',
      voltageDomain: '3V3',
      required: true,
      protocols: ['GPIO'],
      note: '触发输入，10µs 高电平触发一次测距',
    },
    {
      id: 'ECHO',
      name: 'ECHO',
      role: 'signal',
      direction: 'out',
      voltageDomain: '5V',
      required: true,
      protocols: ['GPIO'],
      note: '回响输出为 5V 电平 —— 接 3.3V 引脚必须分压（如 1kΩ+2kΩ）或用电平转换模块',
    },
    { id: 'GND', name: 'GND', role: 'ground', direction: 'in', voltageDomain: 'GND', required: true },
  ],
  protocols: [],
  requirements: ['signal-voltage-match', 'external-power'],
  portOptions: [
    {
      key: 'levelShifted',
      label: 'ECHO 已分压 / 已用电平转换模块',
      kind: 'toggle',
      defaultValue: false,
      satisfies: 'signal-voltage-match',
    },
    {
      key: 'externalSupply',
      label: '已使用独立 5V 电源（与开发板共地）',
      kind: 'toggle',
      defaultValue: false,
      satisfies: 'external-power',
    },
  ],
};

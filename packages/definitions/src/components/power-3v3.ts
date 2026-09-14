import type { ComponentDef } from '@sim/contracts';

export const POWER_3V3: ComponentDef = {
  slug: 'power-3v3',
  displayName: '3.3V 电源模块',
  category: 'power_passive',
  icon: '3V3',
  version: '1.0.0',
  description:
    '独立 3.3V 电源（如 AMS1117 模块）：可直接连到外设的 VCC 给它供电，减轻开发板稳压器负担（舵机、超声波等大电流负载推荐这样接）；必须与开发板共地。',
  ports: [
    {
      id: 'OUT',
      name: '3V3 输出',
      role: 'power',
      direction: 'out',
      voltageDomain: '3V3',
      required: true,
      note: '直接连到外设的 VCC 端口供电（器件直连）',
    },
    {
      id: 'GND',
      name: 'GND',
      role: 'ground',
      direction: 'in',
      voltageDomain: 'GND',
      required: true,
      note: '必须与开发板 GND 相连（共地），否则没有共同参考电平',
    },
  ],
  protocols: [],
  /** 声明为独立电源来源：R-06 视其为有效来源；R-15 视该网络为「已独立供电」 */
  requirements: ['power-source'],
  portOptions: [],
};

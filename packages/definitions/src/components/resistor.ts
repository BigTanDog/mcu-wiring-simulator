import type { ComponentDef } from '@sim/contracts';

export const RESISTOR: ComponentDef = {
  slug: 'resistor',
  displayName: '电阻（1/4W）',
  category: 'power_passive',
  icon: 'RES',
  version: '1.0.0',
  description: '两端无极性元件，常用作限流、上拉/下拉。接在信号与 3V3 之间即为上拉，可满足上拉类校验要求。',
  ports: [
    // passive 端口：既可接信号也可接电源/地，规则 R-05/R-08 会跳过它
    { id: '1', name: '1', role: 'passive', direction: 'io', voltageDomain: '3V3', required: true },
    { id: '2', name: '2', role: 'passive', direction: 'io', voltageDomain: '3V3', required: true },
  ],
  protocols: [],
  requirements: [],
  portOptions: [
    {
      key: 'resistance',
      label: '阻值',
      kind: 'select',
      options: ['220Ω', '1kΩ', '4.7kΩ', '10kΩ'],
      defaultValue: '10kΩ',
    },
  ],
};

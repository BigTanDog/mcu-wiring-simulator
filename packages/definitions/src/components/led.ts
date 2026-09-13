import type { ComponentDef } from '@sim/contracts';

export const LED: ComponentDef = {
  slug: 'led',
  displayName: 'LED 发光二极管',
  category: 'actuator',
  icon: 'LED',
  version: '1.0.0',
  description: '普通直插 LED（约 2V 正向压降），必须串联限流电阻后接 GPIO，否则烧毁引脚或灯珠。',
  ports: [
    {
      id: 'A',
      name: 'A（阳极）',
      role: 'signal',
      direction: 'in',
      voltageDomain: '3V3',
      required: true,
      note: '长脚；经限流电阻接 GPIO',
    },
    {
      id: 'K',
      name: 'K（阴极）',
      role: 'ground',
      direction: 'in',
      voltageDomain: 'GND',
      required: true,
      note: '短脚；接 GND',
    },
  ],
  protocols: [],
  requirements: ['led-series-resistor'],
  portOptions: [
    {
      key: 'seriesResistor',
      label: '已串联限流电阻（220Ω–1kΩ）',
      kind: 'toggle',
      defaultValue: false,
      satisfies: 'led-series-resistor',
    },
  ],
};

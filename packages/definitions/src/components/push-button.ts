import type { ComponentDef } from '@sim/contracts';

export const PUSH_BUTTON: ComponentDef = {
  slug: 'push-button',
  displayName: '轻触按键',
  category: 'power_passive',
  icon: 'KEY',
  version: '1.0.0',
  description: '四脚轻触开关（同侧导通）。一端接 GPIO、一端接 GND，需上拉电阻或启用芯片内部上拉。',
  ports: [
    {
      id: 'P1',
      name: 'P1（信号侧）',
      role: 'signal',
      direction: 'in',
      voltageDomain: '3V3',
      required: true,
      note: '接 GPIO（低电平有效）',
    },
    {
      id: 'P2',
      name: 'P2（接地侧）',
      role: 'ground',
      direction: 'in',
      voltageDomain: 'GND',
      required: true,
      note: '接 GND',
    },
  ],
  protocols: [],
  requirements: ['input-pull'],
  portOptions: [
    {
      key: 'internalPullup',
      label: '使用芯片内部上拉（INPUT_PULLUP）',
      kind: 'toggle',
      defaultValue: false,
      satisfies: 'input-pull',
    },
  ],
};

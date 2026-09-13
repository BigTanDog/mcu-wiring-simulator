import type { ComponentDef } from '@sim/contracts';

export const SERVO_SG90: ComponentDef = {
  slug: 'servo-sg90',
  displayName: 'SG90 舵机',
  category: 'actuator',
  icon: 'SVO',
  version: '1.0.0',
  description:
    '9g 微型舵机（4.8–6V 供电，堵转电流可达 700mA+）。信号为 50Hz PWM，供电必须独立、并与开发板共地。',
  ports: [
    {
      id: 'VCC',
      name: 'VCC',
      role: 'power',
      direction: 'in',
      voltageDomain: '5V',
      required: true,
      note: '典型 4.8–6V；堵转电流大，不可由 GPIO 或板载 3V3 供电',
    },
    {
      id: 'SIG',
      name: 'SIG',
      role: 'signal',
      direction: 'in',
      voltageDomain: '3V3',
      required: true,
      protocols: ['PWM'],
      note: 'PWM 控制信号（周期 20ms，脉宽 0.5–2.5ms）',
    },
    { id: 'GND', name: 'GND', role: 'ground', direction: 'in', voltageDomain: 'GND', required: true },
  ],
  protocols: ['PWM'],
  requirements: ['external-power'],
  portOptions: [
    {
      key: 'externalSupply',
      label: '已使用独立电源（与开发板共地）',
      kind: 'toggle',
      defaultValue: false,
      satisfies: 'external-power',
    },
  ],
};

import type { ComponentDef } from '@sim/contracts';

export const BUZZER_PASSIVE: ComponentDef = {
  slug: 'buzzer-passive',
  displayName: '无源蜂鸣器',
  category: 'actuator',
  icon: 'BP',
  version: '1.0.0',
  description:
    '无源蜂鸣器（内部无振荡电路）：必须输入方波/PWM 才会发声，频率决定音调；只给高低电平只会听到"嗒"的一声。',
  ports: [
    {
      id: '+',
      name: '+',
      role: 'signal',
      direction: 'in',
      voltageDomain: '3V3',
      required: true,
      protocols: ['PWM'],
      note: '接 GPIO，由程序输出方波（PWM）驱动；频率决定音调高低',
    },
    {
      id: '-',
      name: '-',
      role: 'ground',
      direction: 'in',
      voltageDomain: 'GND',
      required: true,
      note: '接 GND',
    },
  ],
  protocols: ['PWM'],
  requirements: [],
  portOptions: [],
};

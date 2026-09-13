import type { ComponentDef } from '@sim/contracts';

export const BUZZER_ACTIVE: ComponentDef = {
  slug: 'buzzer-active',
  displayName: '有源蜂鸣器模块',
  category: 'actuator',
  icon: 'BZ',
  version: '1.0.0',
  description:
    '三线有源蜂鸣器模块（通电即发声，内部自带振荡电路）。I/O 端接 GPIO，高电平触发；电流约 20–30mA，可由开发板 3V3 供电。',
  ports: [
    {
      id: 'VCC',
      name: 'VCC',
      role: 'power',
      direction: 'in',
      voltageDomain: '3V3',
      required: true,
      note: '3.3V 供电即可；5V 型号需确认后接 5V/VIN',
    },
    {
      id: 'IO',
      name: 'I/O（控制）',
      role: 'signal',
      direction: 'in',
      voltageDomain: '3V3',
      required: true,
      protocols: ['GPIO'],
      note: '高电平发声（有源：无需 PWM，普通 GPIO 即可）',
    },
    { id: 'GND', name: 'GND', role: 'ground', direction: 'in', voltageDomain: 'GND', required: true },
  ],
  protocols: [],
  requirements: [],
  portOptions: [
    {
      key: 'triggerLevel',
      label: '触发电平',
      kind: 'select',
      options: ['高电平触发', '低电平触发'],
      defaultValue: '高电平触发',
    },
  ],
};

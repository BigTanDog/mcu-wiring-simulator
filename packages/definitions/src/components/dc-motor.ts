import type { ComponentDef } from '@sim/contracts';

export const DC_MOTOR: ComponentDef = {
  slug: 'dc-motor',
  displayName: '直流电机',
  category: 'actuator',
  icon: 'MO',
  version: '1.0.0',
  description:
    '普通直流电机（3–6V）。启动电流远超 GPIO 与板载稳压器能力，必须经电机驱动模块（如 L298N）并由独立电源供电。',
  ports: [
    {
      id: '+',
      name: '+',
      // 电机是无源负载（不是电源入口）：接驱动模块输出端（OUT1/OUT2），
      // 因此 role=passive —— 不影响 R-22/R-15 的拦截，但避免 R-06 误判"缺电源来源"
      role: 'passive',
      direction: 'in',
      voltageDomain: 'VIN',
      required: true,
      note: '接驱动模块输出端（OUT1/OUT2），不可直接接 GPIO 或板载 3V3',
    },
    {
      id: '-',
      name: '-',
      role: 'passive',
      direction: 'in',
      voltageDomain: 'VIN',
      required: true,
      note: '接驱动模块输出另一端；与 + 互换时电机反转',
    },
  ],
  protocols: [],
  requirements: ['needs-driver', 'external-power'],
  portOptions: [
    {
      key: 'externalSupply',
      label: '已使用驱动模块 / 独立电源',
      kind: 'toggle',
      defaultValue: false,
      satisfies: 'external-power',
    },
  ],
};

import type { ComponentDef } from '@sim/contracts';

export const USB_TTL: ComponentDef = {
  slug: 'usb-ttl',
  displayName: 'USB-TTL 串口模块',
  category: 'communication',
  icon: 'TTL',
  version: '1.0.0',
  description:
    'USB 转串口（CH340/CP2102 等）。TX/RX 必须与开发板交叉连接（模块 TX → 板 RX），否则无法通信。',
  ports: [
    {
      id: 'TX',
      name: 'TX',
      role: 'signal',
      direction: 'out',
      voltageDomain: '3V3',
      required: true,
      protocols: ['UART'],
      note: '模块发送端 —— 必须接开发板的 RX 引脚（如 GPIO3 / GPIO16）',
    },
    {
      id: 'RX',
      name: 'RX',
      role: 'signal',
      direction: 'in',
      voltageDomain: '3V3',
      required: true,
      protocols: ['UART'],
      note: '模块接收端 —— 接开发板的 TX 引脚（如 GPIO1 / GPIO17）',
    },
    {
      id: 'VCC',
      name: 'VCC',
      role: 'power',
      direction: 'out',
      voltageDomain: '3V3',
      required: false,
      note: '可选：模块自带 3V3/5V 输出，与开发板供电二选一（勿同时供电）',
    },
    { id: 'GND', name: 'GND', role: 'ground', direction: 'in', voltageDomain: 'GND', required: true },
  ],
  protocols: ['UART'],
  requirements: [],
  portOptions: [
    {
      key: 'voltage',
      label: '逻辑电平',
      kind: 'select',
      options: ['3V3', '5V'],
      defaultValue: '3V3',
    },
  ],
};

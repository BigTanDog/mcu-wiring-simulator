import type { ComponentDef } from '@sim/contracts';

export const DHT11: ComponentDef = {
  slug: 'dht11',
  displayName: 'DHT11 温湿度传感器',
  category: 'sensor',
  icon: 'DHT',
  version: '1.0.0',
  description: '单总线数字温湿度传感器，DATA 需外接 4.7k–10k 上拉电阻。',
  ports: [
    { id: 'VCC', name: 'VCC', role: 'power', direction: 'in', voltageDomain: '3V3', required: true },
    {
      id: 'DATA',
      name: 'DATA',
      role: 'signal',
      direction: 'io',
      voltageDomain: '3V3',
      required: true,
      protocols: ['OneWire'],
      note: '单总线数据线，需上拉电阻',
    },
    { id: 'GND', name: 'GND', role: 'ground', direction: 'in', voltageDomain: 'GND', required: true },
  ],
  protocols: ['OneWire'],
  requirements: ['onewire-pullup'],
  portOptions: [
    {
      key: 'pullup',
      label: '已接 10kΩ 上拉电阻',
      kind: 'toggle',
      defaultValue: false,
      satisfies: 'onewire-pullup',
    },
  ],
};

/**
 * ESP32-DevKitC V4（ESP32-WROOM-32 模组）引脚定义
 *
 * 数据基线：docs/产品计划文档.md §8.2。
 * 真实性要点（一致性单测覆盖）：
 *  - GPIO34/35/36/39 仅输入，无输出能力
 *  - GPIO6–11 接内部 SPI Flash，不可用
 *  - ADC1 = {32,33,34,35,36,39}；ADC2 = {0,2,4,12,13,14,15,25,26,27}
 *  - 默认 I2C：SDA=21，SCL=22
 *  - Strapping：0/2/5/12/15
 *
 * 来源：Espressif ESP32-DevKitC V4 用户指南 + ESP32 技术参考手册
 * （待人工逐项核对：docs/技术设计文档.md G-06 / T-UV4）
 */
import type { BoardDef, Capability, PinDef } from '@sim/contracts';

const LEFT = 'left' as const;
const RIGHT = 'right' as const;

let seq = 0;
const nextNumber = () => {
  seq += 1;
  return seq;
};

interface GpioSpec {
  n: number;
  side: 'left' | 'right';
  order: number;
  caps: Capability[];
  note?: string;
  inputOnly?: boolean;
  pull?: PinDef['internalPull'];
}

const gpio = (spec: GpioSpec): PinDef => ({
  id: `pin-esp32-gpio${spec.n}`,
  physicalLabel: `GPIO${spec.n}`,
  number: nextNumber(),
  side: spec.side,
  order: spec.order,
  kind: 'io',
  capabilities: spec.inputOnly ? ['INPUT_ONLY', ...spec.caps] : ['GPIO', ...spec.caps],
  voltageDomain: '3V3',
  internalPull: spec.pull ?? (spec.inputOnly ? 'none' : 'up'),
  note: spec.note,
});

seq = 0;
const leftPins: PinDef[] = [
  {
    id: 'pin-esp32-3v3',
    physicalLabel: '3V3',
    number: nextNumber(),
    side: LEFT,
    order: 1,
    kind: 'power',
    capabilities: ['POWER'],
    voltageDomain: '3V3',
    note: '3.3V 输出（板载 LDO），可小电流给外设供电',
  },
  {
    id: 'pin-esp32-en',
    physicalLabel: 'EN',
    number: nextNumber(),
    side: LEFT,
    order: 2,
    kind: 'enable',
    capabilities: ['ENABLE'],
    voltageDomain: '3V3',
    note: '芯片使能（复位），一般不接外设',
  },
  gpio({ n: 36, side: LEFT, order: 3, caps: ['ADC1', 'TOUCH'], inputOnly: true, note: 'SENSOR_VP；仅输入，ADC1_CH0' }),
  gpio({ n: 39, side: LEFT, order: 4, caps: ['ADC1'], inputOnly: true, note: 'SENSOR_VN；仅输入，ADC1_CH3' }),
  gpio({ n: 34, side: LEFT, order: 5, caps: ['ADC1'], inputOnly: true, note: '仅输入，无内部上拉，ADC1_CH6' }),
  gpio({ n: 35, side: LEFT, order: 6, caps: ['ADC1'], inputOnly: true, note: '仅输入，无内部上拉，ADC1_CH7' }),
  gpio({ n: 32, side: LEFT, order: 7, caps: ['ADC1', 'TOUCH'], note: 'ADC1_CH4 / TOUCH9' }),
  gpio({ n: 33, side: LEFT, order: 8, caps: ['ADC1', 'TOUCH'], note: 'ADC1_CH5 / TOUCH8' }),
  gpio({ n: 25, side: LEFT, order: 9, caps: ['ADC2', 'DAC'], note: 'DAC1 / ADC2_CH8' }),
  gpio({ n: 26, side: LEFT, order: 10, caps: ['ADC2', 'DAC'], note: 'DAC2 / ADC2_CH9' }),
  gpio({ n: 27, side: LEFT, order: 11, caps: ['ADC2', 'TOUCH'], note: 'ADC2_CH7 / TOUCH7' }),
  gpio({ n: 14, side: LEFT, order: 12, caps: ['ADC2', 'TOUCH', 'SPI', 'PWM'], note: 'HSPI CLK；上电瞬间有 PWM 输出' }),
  gpio({
    n: 12,
    side: LEFT,
    order: 13,
    caps: ['ADC2', 'TOUCH', 'SPI', 'STRAP'],
    note: 'Strapping：上电电平影响 Flash 电压，接外设需谨慎',
  }),
  {
    id: 'pin-esp32-gnd-1',
    physicalLabel: 'GND',
    number: nextNumber(),
    side: LEFT,
    order: 14,
    kind: 'ground',
    capabilities: ['GND'],
    voltageDomain: 'GND',
  },
  gpio({ n: 13, side: LEFT, order: 15, caps: ['ADC2', 'TOUCH', 'SPI', 'PWM'], note: 'HSPI MOSI' }),
  gpio({ n: 9, side: LEFT, order: 16, caps: ['FLASH_RESERVED'], note: '接内部 SPI Flash（SD_DATA2），不可用' }),
  gpio({ n: 10, side: LEFT, order: 17, caps: ['FLASH_RESERVED'], note: '接内部 SPI Flash（SD_DATA3），不可用' }),
  gpio({ n: 11, side: LEFT, order: 18, caps: ['FLASH_RESERVED'], note: '接内部 SPI Flash（CMD），不可用' }),
  {
    id: 'pin-esp32-5v',
    physicalLabel: '5V / VIN',
    number: nextNumber(),
    side: LEFT,
    order: 19,
    kind: 'power',
    capabilities: ['POWER'],
    voltageDomain: '5V',
    note: 'USB 5V 输入/输出；不可直接接 3.3V 逻辑引脚',
  },
];

const rightPins: PinDef[] = [
  {
    id: 'pin-esp32-gnd-2',
    physicalLabel: 'GND',
    number: nextNumber(),
    side: RIGHT,
    order: 1,
    kind: 'ground',
    capabilities: ['GND'],
    voltageDomain: 'GND',
  },
  gpio({ n: 23, side: RIGHT, order: 2, caps: ['SPI', 'PWM'], note: 'VSPI MOSI' }),
  gpio({ n: 22, side: RIGHT, order: 3, caps: ['I2C_SCL', 'PWM'], note: '默认 I2C SCL' }),
  gpio({ n: 1, side: RIGHT, order: 4, caps: ['UART0', 'UART0_TX'], note: 'UART0 TXD0，接板载 USB 串口，占用会影响日志与下载' }),
  gpio({ n: 3, side: RIGHT, order: 5, caps: ['UART0', 'UART0_RX'], note: 'UART0 RXD0，接板载 USB 串口' }),
  gpio({ n: 21, side: RIGHT, order: 6, caps: ['I2C_SDA', 'PWM'], note: '默认 I2C SDA' }),
  {
    id: 'pin-esp32-gnd-3',
    physicalLabel: 'GND',
    number: nextNumber(),
    side: RIGHT,
    order: 7,
    kind: 'ground',
    capabilities: ['GND'],
    voltageDomain: 'GND',
  },
  gpio({ n: 19, side: RIGHT, order: 8, caps: ['SPI', 'PWM'], note: 'VSPI MISO' }),
  gpio({ n: 18, side: RIGHT, order: 9, caps: ['SPI', 'PWM'], note: 'VSPI CLK' }),
  gpio({ n: 5, side: RIGHT, order: 10, caps: ['SPI', 'STRAP', 'PWM'], note: 'VSPI CS；Strapping 引脚（上电电平）' }),
  gpio({ n: 17, side: RIGHT, order: 11, caps: ['UART2', 'UART2_TX', 'PWM'], note: 'UART2 TX' }),
  gpio({ n: 16, side: RIGHT, order: 12, caps: ['UART2', 'UART2_RX', 'PWM'], note: 'UART2 RX' }),
  gpio({ n: 4, side: RIGHT, order: 13, caps: ['ADC2', 'TOUCH', 'PWM'], note: 'ADC2_CH0 / TOUCH0' }),
  gpio({
    n: 0,
    side: RIGHT,
    order: 14,
    caps: ['ADC2', 'TOUCH', 'STRAP', 'PWM'],
    note: 'Strapping / BOOT：拉低进入下载模式',
  }),
  gpio({ n: 2, side: RIGHT, order: 15, caps: ['ADC2', 'TOUCH', 'STRAP', 'PWM'], note: 'Strapping；部分板载 LED' }),
  gpio({
    n: 15,
    side: RIGHT,
    order: 16,
    caps: ['ADC2', 'TOUCH', 'SPI', 'STRAP', 'PWM'],
    note: 'Strapping：必须上电为高；HSPI CS',
  }),
  gpio({ n: 8, side: RIGHT, order: 17, caps: ['FLASH_RESERVED'], note: '接内部 SPI Flash（SD_DATA1），不可用' }),
  gpio({ n: 7, side: RIGHT, order: 18, caps: ['FLASH_RESERVED'], note: '接内部 SPI Flash（SD_DATA0），不可用' }),
  gpio({ n: 6, side: RIGHT, order: 19, caps: ['FLASH_RESERVED'], note: '接内部 SPI Flash（CLK），不可用' }),
];

export const ESP32_DEVKITC_V4: BoardDef = {
  slug: 'esp32-devkitc-v4',
  displayName: 'ESP32-DevKitC V4',
  mcuFamily: 'ESP32-WROOM-32',
  version: '1.0.0',
  logicVoltage: '3V3',
  sourceRef: 'Espressif ESP32-DevKitC V4 用户指南 / ESP32 技术参考手册',
  pins: [...leftPins, ...rightPins],
};

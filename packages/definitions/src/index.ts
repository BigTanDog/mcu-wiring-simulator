/**
 * 定义层出口：新增开发板/组件只需在本文件注册（核心引擎无需改动）。
 * 对应 docs/技术设计文档.md §5（定义层规范）与 SOP §5.3 / §5.4。
 */
import type { BoardDef, ComponentCategory, ComponentDef } from '@sim/contracts';
import { ESP32_DEVKITC_V4 } from './boards/esp32-devkitc-v4';
import { BUZZER_ACTIVE } from './components/buzzer-active';
import { BUZZER_PASSIVE } from './components/buzzer-passive';
import { DC_MOTOR } from './components/dc-motor';
import { DHT11 } from './components/dht11';
import { HC_SR04 } from './components/hc-sr04';
import { L298N } from './components/l298n';
import { LCD1602_I2C } from './components/lcd1602-i2c';
import { LED } from './components/led';
import { PUSH_BUTTON } from './components/push-button';
import { RESISTOR } from './components/resistor';
import { SERVO_SG90 } from './components/servo-sg90';
import { SSD1306_I2C } from './components/ssd1306-i2c';
import { USB_TTL } from './components/usb-ttl';

export {
  ESP32_DEVKITC_V4,
  BUZZER_ACTIVE,
  BUZZER_PASSIVE,
  DC_MOTOR,
  DHT11,
  HC_SR04,
  L298N,
  LCD1602_I2C,
  LED,
  PUSH_BUTTON,
  RESISTOR,
  SERVO_SG90,
  SSD1306_I2C,
  USB_TTL,
};

export const BOARDS: BoardDef[] = [ESP32_DEVKITC_V4];

/** 组件库清单（组件库面板按 category 分组渲染，与数组顺序无关） */
export const COMPONENTS: ComponentDef[] = [
  DHT11,
  HC_SR04,
  SSD1306_I2C,
  LCD1602_I2C,
  LED,
  BUZZER_ACTIVE,
  BUZZER_PASSIVE,
  SERVO_SG90,
  DC_MOTOR,
  L298N,
  USB_TTL,
  PUSH_BUTTON,
  RESISTOR,
];

/** 组件库分组顺序即此对象的键顺序（主控 → 传感器 → 通信 → 显示 → 执行器 → 电源/基础） */
export const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  mcu: '主控芯片',
  sensor: '传感器',
  communication: '通信模块',
  display: '显示模块',
  actuator: '执行器',
  power_passive: '电源/基础元件',
};

export const getBoard = (slug: string): BoardDef => {
  const board = BOARDS.find((item) => item.slug === slug);
  if (!board) throw new Error(`未找到开发板定义: ${slug}`);
  return board;
};

export const getComponentDef = (slug: string): ComponentDef => {
  const def = COMPONENTS.find((item) => item.slug === slug);
  if (!def) throw new Error(`未找到组件定义: ${slug}`);
  return def;
};

export const findBoard = (slug: string): BoardDef | undefined =>
  BOARDS.find((item) => item.slug === slug);

export const findComponentDef = (slug: string): ComponentDef | undefined =>
  COMPONENTS.find((item) => item.slug === slug);

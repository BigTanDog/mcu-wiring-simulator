/**
 * 定义层出口：新增开发板/组件只需在本文件注册（核心引擎无需改动）。
 * 对应 docs/技术设计文档.md §5（定义层规范）与 SOP §5.3 / §5.4。
 */
import type { BoardDef, ComponentCategory, ComponentDef } from '@sim/contracts';
import { ESP32_DEVKITC_V4 } from './boards/esp32-devkitc-v4';
import { BUZZER_ACTIVE } from './components/buzzer-active';
import { DHT11 } from './components/dht11';
import { HC_SR04 } from './components/hc-sr04';
import { LED } from './components/led';
import { PUSH_BUTTON } from './components/push-button';
import { RESISTOR } from './components/resistor';
import { SERVO_SG90 } from './components/servo-sg90';
import { SSD1306_I2C } from './components/ssd1306-i2c';
import { USB_TTL } from './components/usb-ttl';

export {
  ESP32_DEVKITC_V4,
  BUZZER_ACTIVE,
  DHT11,
  HC_SR04,
  LED,
  PUSH_BUTTON,
  RESISTOR,
  SERVO_SG90,
  SSD1306_I2C,
  USB_TTL,
};

export const BOARDS: BoardDef[] = [ESP32_DEVKITC_V4];

export const COMPONENTS: ComponentDef[] = [
  DHT11,
  HC_SR04,
  SSD1306_I2C,
  LED,
  PUSH_BUTTON,
  BUZZER_ACTIVE,
  SERVO_SG90,
  USB_TTL,
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

/**
 * 领域模型类型定义（对齐 docs/产品计划文档.md 第 8、11 章的数据模型草案）
 * Demo 阶段：仅使用其中与"画布 + 校验"直接相关的子集。
 */

export type VoltageDomain = '3V3' | '5V' | 'GND';

/** 引脚能力标签：用于 UI 色条与规则判定 */
export type Capability =
  | 'GPIO'
  | 'INPUT_ONLY'
  | 'ADC1'
  | 'ADC2'
  | 'DAC'
  | 'PWM'
  | 'TOUCH'
  | 'I2C_SDA'
  | 'I2C_SCL'
  | 'SPI'
  | 'UART0'
  | 'UART2'
  | 'STRAP'
  | 'FLASH_RESERVED'
  | 'POWER'
  | 'GND'
  | 'ENABLE';

export interface PinDef {
  /** 稳定唯一键，如 pin-esp32-gpio4 */
  id: string;
  /** 板子丝印，如 GPIO4 / 3V3 / GND */
  physicalLabel: string;
  /** 排针物理序号（1 起） */
  number: number;
  side: 'left' | 'right';
  order: number;
  kind: 'io' | 'power' | 'ground' | 'enable';
  capabilities: Capability[];
  voltageDomain: VoltageDomain;
  internalPull?: 'up' | 'down' | 'both' | 'none';
  /** 关键限制说明（展示在 tooltip） */
  note?: string;
}

export interface BoardDef {
  slug: string;
  displayName: string;
  mcuFamily: string;
  version: string;
  /** 芯片逻辑电平：决定电压域不匹配类规则的方向 */
  logicVoltage: '3V3' | '5V';
  /** 数据来源（可追溯性） */
  sourceRef: string;
  pins: PinDef[];
}

export type PortRole = 'signal' | 'power' | 'ground';
export type PortDirection = 'in' | 'out' | 'io';
export type ComponentCategory = 'mcu' | 'sensor' | 'display' | 'actuator';

export interface PortDef {
  id: string;
  name: string;
  role: PortRole;
  direction: PortDirection;
  voltageDomain: VoltageDomain;
  /** 必要连接：缺失即错误（R-01） */
  required: boolean;
  protocols?: string[];
  note?: string;
}

export type RequirementKind = 'onewire-pullup' | 'i2c-pullup';

export interface PortOptionDef {
  key: string;
  label: string;
  kind: 'select' | 'toggle';
  options?: string[];
  defaultValue: string | boolean;
  /** 该选项作用于哪条声明式需求（供规则引擎读取，避免为组件写专属规则） */
  satisfies?: RequirementKind;
}

export interface ComponentDef {
  slug: string;
  displayName: string;
  category: ComponentCategory;
  /** 画布节点上的短标识（Demo 用字符图标，避免引入图标资源） */
  icon: string;
  version: string;
  ports: PortDef[];
  protocols: string[];
  requirements: RequirementKind[];
  portOptions?: PortOptionDef[];
  description: string;
}

export interface ComponentInstance {
  id: string;
  definitionSlug: string;
  label: string;
  position: { x: number; y: number };
  /** 端口运行时可选项取值（来自 ComponentDef.portOptions） */
  portConfig: Record<string, string | boolean>;
}

export type EndpointRef =
  | { type: 'pin'; pinId: string }
  | { type: 'port'; instanceId: string; portId: string };

export type ConnectionKind = 'signal' | 'power' | 'ground' | 'bus';

export interface Connection {
  id: string;
  from: EndpointRef;
  to: EndpointRef;
  kind: ConnectionKind;
  /** 控制面板可禁用连线：禁用者不参与校验 */
  enabled: boolean;
}

export type Severity = 'error' | 'warning' | 'info';

export interface DiagnosticTarget {
  type: 'pin' | 'instance' | 'port' | 'connection';
  /** pinId / instanceId / connectionId */
  id: string;
  instanceId?: string;
  portId?: string;
}

export interface Diagnostic {
  code: string;
  severity: Severity;
  message: string;
  suggestion?: string;
  targets: DiagnosticTarget[];
}

export type ValidationStatus = 'passed' | 'warning' | 'failed';

export interface ValidationResult {
  status: ValidationStatus;
  ruleSetVersion: string;
  diagnostics: Diagnostic[];
  durationMs: number;
  /** local = 前端内置规则引擎；server = mock 后端权威校验 */
  source: 'local' | 'server';
  /** 离线降级标注（Demo 中用于演示"后端不可用"） */
  offline?: boolean;
}

export interface ProjectSnapshot {
  boardSlug: string;
  boardVersion: string;
  instances: ComponentInstance[];
  connections: Connection[];
  options: {
    wifiEnabled: boolean;
    mode: 'strict' | 'loose';
  };
}

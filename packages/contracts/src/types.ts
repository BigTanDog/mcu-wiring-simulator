/**
 * 领域模型类型定义（前后端唯一真相源）
 *
 * 来源：由 apps/web/src/definitions/types.ts 上提（W1），并追加 API 契约类型。
 * 对应文档：docs/技术设计文档.md §4.1、§9.1。
 */

/* ------------------------------ 开发板 / 引脚 ------------------------------ */

/**
 * 电压域：3V3 / 5V / GND 为板上常见电平；
 * VIN 表示"外部电源输入"（如电机驱动的 7–12V），用于表达需要独立电源的端口。
 */
export type VoltageDomain = '3V3' | '5V' | 'VIN' | 'GND';

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
  // 串口角色：用于 R-20（TX/RX 必须交叉）判定，仅靠 UART0/UART2 无法区分收发方向
  | 'UART0_TX'
  | 'UART0_RX'
  | 'UART2_TX'
  | 'UART2_RX'
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

/* -------------------------------- 组件定义 -------------------------------- */

/**
 * 端口角色：
 *  - passive 表示无源元件（电阻、电容等）的引脚——它既可接信号也可接电源，
 *    因此 R-05（信号接电源）与 R-08（仅输入引脚驱动）必须跳过 passive 端口。
 */
export type PortRole = 'signal' | 'power' | 'ground' | 'passive';
export type PortDirection = 'in' | 'out' | 'io';
export type ComponentCategory =
  | 'mcu'
  | 'sensor'
  | 'communication'
  | 'display'
  | 'actuator'
  | 'power_passive';

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

export type RequirementKind =
  | 'onewire-pullup'
  | 'i2c-pullup'
  | 'led-series-resistor'
  | 'input-pull'
  | 'signal-voltage-match'
  /** 大电流负载（舵机/电机/超声波等）：建议独立供电，板载 LDO 电流有限（R-15） */
  | 'external-power'
  /** 负载必须经驱动模块（电机等）：不可直连 GPIO（R-22） */
  | 'needs-driver'
  /** 该组件可作为独立电源来源（电源模块）：R-06 视其为有效来源，R-15 视为已独立供电 */
  | 'power-source';

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
  /** 画布节点上的短标识 */
  icon: string;
  version: string;
  ports: PortDef[];
  protocols: string[];
  requirements: RequirementKind[];
  portOptions?: PortOptionDef[];
  description: string;
  /**
   * 画布渲染形态：
   *  - `default`（缺省）：按端口列表渲染（左列电源/地，右列信号）；
   *  - `breadboard`：按孔位网格渲染（面包板这类"列即等电位组"的元件）。
   * 这是**渲染契约**，不参与规则判定（规则只看端口本身）。
   */
  renderAs?: 'default' | 'breadboard';
}

export interface ComponentInstance {
  id: string;
  definitionSlug: string;
  definitionVersion?: string;
  label: string;
  position: { x: number; y: number };
  /** 端口运行时可选项取值（来自 ComponentDef.portOptions） */
  portConfig: Record<string, string | boolean>;
}

/* --------------------------------- 连线 --------------------------------- */

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

/* ------------------------------- 校验与诊断 ------------------------------- */

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
  /** local = 前端内置规则引擎；server = 后端权威校验 */
  source: 'local' | 'server';
  /** 离线降级标注（本地结果时提示规则集可能过期） */
  offline?: boolean;
}

/* --------------------------------- 项目 --------------------------------- */

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

/** 项目（服务端形态） */
export interface ProjectOptionsSnapshot {
  wifiEnabled: boolean;
  mode: 'strict' | 'loose';
}

export interface Project {
  id: string;
  name: string;
  ownerKey: string;
  boardSlug: string;
  boardVersion: string;
  schemaVersion: number;
  revision: number;
  viewport?: { x: number; y: number; zoom: number };
  options?: ProjectOptionsSnapshot;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

export interface ProjectDetail {
  project: Project;
  board: BoardDef;
  componentDefs: ComponentDef[];
  instances: ComponentInstance[];
  connections: Connection[];
}

/** 项目列表项（M-01：项目管理面板用） */
export interface ProjectSummary {
  id: string;
  name: string;
  boardSlug: string;
  revision: number;
  componentCount: number;
  connectionCount: number;
  createdAt: string;
  updatedAt: string;
}

/* -------------------------------- API 契约 -------------------------------- */

export interface ApiEnvelope<T> {
  data: T;
  meta: { requestId: string; ruleSetVersion?: string };
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
  requestId: string;
}

export interface CreateProjectRequest {
  name: string;
  boardSlug: string;
  boardVersion?: string;
}

export interface PatchProjectRequest {
  name?: string;
  instances?: ComponentInstance[];
  connections?: Connection[];
  viewport?: { x: number; y: number; zoom: number };
  options?: ProjectOptionsSnapshot;
}

export interface RuleConfig {
  code: string;
  enabled: boolean;
  severityOverride?: Severity;
}

export interface ValidateRequest {
  snapshot: ProjectSnapshot;
  ruleSetVersion?: string;
  ruleConfigs?: RuleConfig[];
}

export interface ImportProjectRequest {
  name?: string;
  payload: ProjectSnapshot;
}

/** 规则自身声明的元数据（enabled 由 RuleConfig 在运行时决定） */
export interface RuleDescriptor {
  code: string;
  name: string;
  severity: Severity;
  scope: 'connection' | 'component' | 'board' | 'project';
  tags: string[];
}

/** 规则在当前规则集中的生效状态（供 /rule-sets/latest 返回） */
export interface RuleMeta extends RuleDescriptor {
  enabled: boolean;
}

export interface RuleSetInfo {
  version: string;
  rules: RuleMeta[];
}

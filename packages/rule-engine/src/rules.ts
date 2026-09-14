/**
 * 规则实现与注册表
 *
 * 约定（docs/技术设计文档.md §6.2）：
 *  - 每条规则是纯函数：无随机、无时间、无 IO；
 *  - 必须声明 meta（code/name/severity/scope/tags），由引擎统一编排；
 *  - 禁止判断组件 slug 写专属分支：组件差异一律走 requirements / portOptions（D-10）。
 *
 * 当前实现 20 条：R-01/03/05/06/07/08/09/10/11/12/13/14/15/16/17/18/19/20/21/22。
 * 未实现：R-02（悬空电源/地）、R-04（输出-输出冲突）—— 语义已分别被 R-06/R-07 与 R-03 覆盖（见技术设计文档 Q-T1）。
 */
import type {
  BoardDef,
  ComponentDef,
  ComponentInstance,
  Connection,
  Diagnostic,
  DiagnosticTarget,
  EndpointRef,
  PinDef,
  RequirementKind,
  RuleDescriptor,
} from '@sim/contracts';
import {
  hasPassiveComponent,
  netHasBoardPower,
  netHasIndependentPower,
  netHasPowerSource,
  netOfPort,
  type Net,
} from './nets';

export interface RuleInput {
  board: BoardDef;
  instances: ComponentInstance[];
  /** 仅启用中的连线 */
  connections: Connection[];
  nets: Net[];
  defs: Map<string, ComponentDef>;
  options: { wifiEnabled: boolean };
}

export interface Rule {
  meta: RuleDescriptor;
  run: (input: RuleInput) => Diagnostic[];
}

/* ------------------------------------------------------------------ */
/* 工具                                                                */
/* ------------------------------------------------------------------ */

const pinTarget = (pinId: string): DiagnosticTarget => ({ type: 'pin', id: pinId });

const portTarget = (instanceId: string, portId: string): DiagnosticTarget => ({
  type: 'port',
  id: `${instanceId}:${portId}`,
  instanceId,
  portId,
});

const hasCapability = (pin: PinDef, capability: PinDef['capabilities'][number]): boolean =>
  pin.capabilities.includes(capability);

const isPowerPin = (pin: PinDef): boolean => pin.kind === 'power';
const isGroundPin = (pin: PinDef): boolean => pin.kind === 'ground';

const portOf = (def: ComponentDef, portId: string) =>
  def.ports.find((port) => port.id === portId);

const portNameOf = (def: ComponentDef, portId: string): string =>
  portOf(def, portId)?.name ?? portId;

const portRoleOf = (def: ComponentDef, portId: string) => portOf(def, portId)?.role;

interface SignalPinPair {
  connection: Connection;
  pin: PinDef;
  instance: ComponentInstance;
  def: ComponentDef;
  portId: string;
}

/** 枚举"组件端口 ↔ 开发板引脚"的直接连接 */
const signalPinPairs = (input: RuleInput): SignalPinPair[] => {
  const pinById = new Map(input.board.pins.map((pin) => [pin.id, pin]));
  const instanceById = new Map(input.instances.map((item) => [item.id, item]));
  const pairs: SignalPinPair[] = [];

  for (const conn of input.connections) {
    const pair = (pinRef: EndpointRef, portRef: EndpointRef): void => {
      if (pinRef.type !== 'pin' || portRef.type !== 'port') return;
      const pin = pinById.get(pinRef.pinId);
      const instance = instanceById.get(portRef.instanceId);
      const def = instance ? input.defs.get(instance.definitionSlug) : undefined;
      if (!pin || !instance || !def) return;
      pairs.push({ connection: conn, pin, instance, def, portId: portRef.portId });
    };
    pair(conn.from, conn.to);
    pair(conn.to, conn.from);
  }

  return pairs;
};

const isPortConnected = (
  connections: Connection[],
  instanceId: string,
  portId: string,
): boolean =>
  connections.some(
    (conn) =>
      (conn.from.type === 'port' &&
        conn.from.instanceId === instanceId &&
        conn.from.portId === portId) ||
      (conn.to.type === 'port' && conn.to.instanceId === instanceId && conn.to.portId === portId),
  );

/** 该组件是否通过控制面板勾选满足了某项声明式需求 */
const satisfiedByConfig = (
  def: ComponentDef,
  instance: ComponentInstance,
  requirement: RequirementKind,
): boolean =>
  (def.portOptions ?? []).some(
    (option) => option.satisfies === requirement && instance.portConfig[option.key] === true,
  );

/** 该组件是否勾选了任何"上拉"类声明（用于判断用户是否试图依赖内部上拉） */
const usesConfiguredPull = (def: ComponentDef, instance: ComponentInstance): boolean =>
  (def.portOptions ?? []).some(
    (option) => option.satisfies && instance.portConfig[option.key] === true,
  );

/* ------------------------------------------------------------------ */
/* 规则实现                                                            */
/* ------------------------------------------------------------------ */

const R01_REQUIRED_PORT: Rule = {
  meta: {
    code: 'R-01',
    name: '必要端口未连接',
    severity: 'error',
    scope: 'component',
    tags: ['connectivity'],
  },
  run: ({ instances, connections, defs }) => {
    const out: Diagnostic[] = [];
    for (const instance of instances) {
      const def = defs.get(instance.definitionSlug);
      if (!def) continue;
      for (const port of def.ports) {
        if (!port.required) continue;
        if (isPortConnected(connections, instance.id, port.id)) continue;
        const hint = port.role === 'power' ? '3V3' : port.role === 'ground' ? 'GND' : '合适的 GPIO';
        out.push({
          code: 'R-01',
          severity: 'error',
          message: `${instance.label} 的 ${port.name} 端口未连接`,
          suggestion: `把 ${port.name} 接到开发板的${hint}。`,
          targets: [{ type: 'instance', id: instance.id }, portTarget(instance.id, port.id)],
        });
      }
    }
    return out;
  },
};

const R03_PIN_MULTIPLE_USE: Rule = {
  meta: {
    code: 'R-03',
    name: '引脚重复占用（多驱动）',
    severity: 'error',
    scope: 'connection',
    tags: ['pin-capability'],
  },
  run: ({ connections, instances, defs, board }) => {
    const out: Diagnostic[] = [];
    const pinById = new Map(board.pins.map((pin) => [pin.id, pin]));
    const pinUsage = new Map<string, Array<{ instanceId: string; portId: string }>>();
    const addUsage = (pinId: string, port: { instanceId: string; portId: string }): void => {
      const pin = pinById.get(pinId);
      // 电源/地引脚允许多器件共享（电源轨与地网络语义）；只校验 GPIO 类引脚的多驱动
      if (!pin || pin.kind !== 'io') return;
      const list = pinUsage.get(pinId) ?? [];
      if (!list.some((item) => item.instanceId === port.instanceId && item.portId === port.portId)) {
        list.push(port);
      }
      pinUsage.set(pinId, list);
    };

    for (const conn of connections) {
      if (conn.from.type === 'pin' && conn.to.type === 'port') {
        addUsage(conn.from.pinId, { instanceId: conn.to.instanceId, portId: conn.to.portId });
      } else if (conn.to.type === 'pin' && conn.from.type === 'port') {
        addUsage(conn.to.pinId, { instanceId: conn.from.instanceId, portId: conn.from.portId });
      }
    }

    for (const [pinId, users] of pinUsage) {
      if (users.length < 2) continue;

      /**
       * I2C 是多设备共享总线：同一条 SDA/SCL 上挂多个 I2C 从设备是**正确接法**
       * （地址冲突由 R-13 负责）。此处放行"参与共享的端口全部声明 I2C 协议"的情况。
       */
      const allI2cDevices = users.every((user) => {
        const instance = instances.find((item) => item.id === user.instanceId);
        const def = instance ? defs.get(instance.definitionSlug) : undefined;
        const port = def ? portOf(def, user.portId) : undefined;
        return (port?.protocols ?? []).includes('I2C');
      });
      if (allI2cDevices) continue;

      const names = users.map((user) => {
        const instance = instances.find((item) => item.id === user.instanceId);
        const def = instance ? defs.get(instance.definitionSlug) : undefined;
        const portName = def ? portNameOf(def, user.portId) : user.portId;
        return `${instance?.label ?? user.instanceId}.${portName}`;
      });
      const sameInstance = users.every((user) => user.instanceId === users[0].instanceId);
      const pinLabel = pinById.get(pinId)?.physicalLabel ?? pinId;
      out.push({
        code: 'R-03',
        severity: 'error',
        message: sameInstance
          ? `${pinLabel}：${names.join(' 与 ')} 被短接在同一个引脚上`
          : `${pinLabel} 被多个器件占用：${names.join(' / ')}`,
        suggestion:
          '一个 GPIO 通常只接一路信号（I2C 总线是例外：多个从设备可共享 SDA/SCL，本规则会自动放行）。请给每个器件分配独立引脚，或改用总线连接。',
        targets: [pinTarget(pinId), ...users.map((user) => portTarget(user.instanceId, user.portId))],
      });
    }
    return out;
  },
};

const R05_SIGNAL_TO_POWER: Rule = {
  meta: {
    code: 'R-05',
    name: '信号线接到电源/地',
    severity: 'error',
    scope: 'connection',
    tags: ['power'],
  },
  run: (input) => {
    const out: Diagnostic[] = [];
    for (const pair of signalPinPairs(input)) {
      // passive（电阻等无源元件）可接电源/地，不报错
      if (portRoleOf(pair.def, pair.portId) !== 'signal') continue;
      if (!isPowerPin(pair.pin) && !isGroundPin(pair.pin)) continue;
      const portName = portNameOf(pair.def, pair.portId);
      out.push({
        code: 'R-05',
        severity: 'error',
        message: `${pair.instance.label}.${portName} 接到了${isPowerPin(pair.pin) ? '电源' : '地'}引脚 ${pair.pin.physicalLabel}`,
        suggestion: isPowerPin(pair.pin)
          ? '信号线不可接电源引脚（5V 还会损坏 3.3V 逻辑），请改接 GPIO。'
          : '信号线应接 GPIO，而不是 GND。',
        targets: [
          pinTarget(pair.pin.id),
          portTarget(pair.instance.id, pair.portId),
          { type: 'connection', id: pair.connection.id },
        ],
      });
    }
    return out;
  },
};

const R06_POWER_SOURCE_MISSING: Rule = {
  meta: {
    code: 'R-06',
    name: '电源未接入有效来源',
    severity: 'error',
    scope: 'component',
    tags: ['power'],
  },
  run: ({ nets }) => {
    const out: Diagnostic[] = [];
    for (const net of nets) {
      const powerPorts = net.ports.filter(
        (item) => portRoleOf(item.def, item.portId) === 'power',
      );
      if (powerPorts.length === 0) continue;
      // 有效来源：开发板电源引脚，或独立电源模块（器件直连供电）
      if (netHasPowerSource(net)) continue;
      const first = powerPorts[0];
      out.push({
        code: 'R-06',
        severity: 'error',
        message: `${first.instance.label}.${portNameOf(first.def, first.portId)} 未接到有效电源（开发板引脚或独立电源模块）`,
        suggestion:
          '把 VCC 接到开发板 3V3（模块允许时可用 5V/VIN），或接到独立电源模块的输出，并确保共地。',
        targets: powerPorts.map((item) => portTarget(item.instance.id, item.portId)),
      });
    }
    return out;
  },
};

const R07_GROUND_MISSING: Rule = {
  meta: {
    code: 'R-07',
    name: '未共地',
    severity: 'error',
    scope: 'component',
    tags: ['power'],
  },
  run: ({ nets }) => {
    const out: Diagnostic[] = [];
    for (const net of nets) {
      const groundPorts = net.ports.filter(
        (item) => portRoleOf(item.def, item.portId) === 'ground',
      );
      if (groundPorts.length === 0) continue;
      if (net.pins.some(isGroundPin)) continue;
      const first = groundPorts[0];
      out.push({
        code: 'R-07',
        severity: 'error',
        message: `${first.instance.label}.${portNameOf(first.def, first.portId)} 未接入开发板 GND`,
        suggestion: '所有器件必须与开发板共地，否则信号无法被正确识别。',
        targets: groundPorts.map((item) => portTarget(item.instance.id, item.portId)),
      });
    }
    return out;
  },
};

const R08_INPUT_ONLY_MISUSE: Rule = {
  meta: {
    code: 'R-08',
    name: '仅输入引脚被用作输出',
    severity: 'error',
    scope: 'connection',
    tags: ['pin-capability'],
  },
  run: (input) => {
    const out: Diagnostic[] = [];
    for (const pair of signalPinPairs(input)) {
      if (!hasCapability(pair.pin, 'INPUT_ONLY')) continue;
      const port = portOf(pair.def, pair.portId);
      // passive 元件与纯输入端口不驱动引脚，不算"当输出用"
      if (!port || port.role === 'passive' || port.direction === 'in') continue;
      out.push({
        code: 'R-08',
        severity: 'error',
        message: `${pair.pin.physicalLabel} 仅支持输入，无法作为 ${pair.instance.label}.${port.name} 的数据线`,
        suggestion: '改用可输出的 GPIO：GPIO4/5/16–19/21–23/25–27/32/33。',
        targets: [
          pinTarget(pair.pin.id),
          portTarget(pair.instance.id, pair.portId),
          { type: 'connection', id: pair.connection.id },
        ],
      });
    }
    return out;
  },
};

const R09_INPUT_ONLY_NO_PULL: Rule = {
  meta: {
    code: 'R-09',
    name: '仅输入引脚缺少内部上拉',
    severity: 'warning',
    scope: 'connection',
    tags: ['pin-capability', 'component-requirement'],
  },
  run: (input) => {
    const out: Diagnostic[] = [];
    for (const pair of signalPinPairs(input)) {
      if (!hasCapability(pair.pin, 'INPUT_ONLY')) continue;
      const requiresPull = pair.def.requirements.some(
        (requirement) => requirement === 'onewire-pullup' || requirement === 'input-pull',
      );
      if (!requiresPull) continue;
      // 仅在用户已声明"使用上拉方案"却落在无内部上拉的引脚上时提示（未声明的情况由 R-12 报）
      if (!usesConfiguredPull(pair.def, pair.instance)) continue;
      out.push({
        code: 'R-09',
        severity: 'warning',
        message: `${pair.pin.physicalLabel} 无内部上拉/下拉，${pair.instance.label} 的上拉需外接电阻`,
        suggestion: '改用带内部上拉的 GPIO（如 GPIO4/5/16–19/21–23/25–27/32/33），或外接 10kΩ 上拉电阻。',
        targets: [pinTarget(pair.pin.id), portTarget(pair.instance.id, pair.portId)],
      });
    }
    return out;
  },
};

const R10_FLASH_RESERVED: Rule = {
  meta: {
    code: 'R-10',
    name: 'Flash 保留引脚被占用',
    severity: 'error',
    scope: 'connection',
    tags: ['pin-capability'],
  },
  run: (input) => {
    const out: Diagnostic[] = [];
    for (const pair of signalPinPairs(input)) {
      if (!hasCapability(pair.pin, 'FLASH_RESERVED')) continue;
      out.push({
        code: 'R-10',
        severity: 'error',
        message: `${pair.pin.physicalLabel} 连接模组内部 SPI Flash，不可用于外设`,
        suggestion: 'GPIO6–GPIO11 属于内部 Flash 总线，请改用其它 GPIO。',
        targets: [pinTarget(pair.pin.id), { type: 'connection', id: pair.connection.id }],
      });
    }
    return out;
  },
};

const R11_ADC2_WIFI: Rule = {
  meta: {
    code: 'R-11',
    name: 'ADC2 引脚与 WiFi 冲突',
    severity: 'warning',
    scope: 'connection',
    tags: ['pin-capability'],
  },
  run: (input) => {
    if (!input.options.wifiEnabled) return [];
    const out: Diagnostic[] = [];
    for (const pair of signalPinPairs(input)) {
      if (!hasCapability(pair.pin, 'ADC2')) continue;
      out.push({
        code: 'R-11',
        severity: 'warning',
        message: `${pair.pin.physicalLabel} 属 ADC2，启用 WiFi 时不可用于模拟采样`,
        suggestion: '如需模拟输入，请改用 ADC1 引脚（GPIO32/33/34/35/36/39）。',
        targets: [pinTarget(pair.pin.id), portTarget(pair.instance.id, pair.portId)],
      });
    }
    return out;
  },
};

const R12_PULLUP_MISSING: Rule = {
  meta: {
    code: 'R-12',
    name: '上拉电阻缺失',
    severity: 'warning',
    scope: 'component',
    tags: ['component-requirement'],
  },
  run: ({ instances, connections, defs, nets }) => {
    const out: Diagnostic[] = [];
    for (const instance of instances) {
      const def = defs.get(instance.definitionSlug);
      if (!def || def.requirements.length === 0) continue;

      const pullRequirements: RequirementKind[] = ['onewire-pullup', 'i2c-pullup', 'input-pull'];
      const activeRequirement = def.requirements.find((requirement) =>
        pullRequirements.includes(requirement),
      );
      if (!activeRequirement) continue;
      if (satisfiedByConfig(def, instance, activeRequirement)) continue;

      const relatedPorts = def.ports.filter(
        (port) => port.role === 'signal' || (port.protocols ?? []).length > 0,
      );
      const connected = relatedPorts.some((port) =>
        isPortConnected(connections, instance.id, port.id),
      );
      if (!connected) continue;

      // 线上已挂无源元件（电阻）也算满足——这是教学上最希望看到的结果
      const byPassive = relatedPorts.some((port) =>
        hasPassiveComponent(netOfPort(nets, instance.id, port.id), instance.id),
      );
      if (byPassive) continue;

      const protocol = activeRequirement === 'i2c-pullup' ? 'I2C' : activeRequirement === 'input-pull' ? '按键' : '单总线';
      out.push({
        code: 'R-12',
        severity: 'warning',
        message: `${instance.label} 的${protocol}信号线上缺少上拉电阻`,
        suggestion:
          '在信号线与 3V3 之间接 4.7k–10kΩ 上拉电阻（或勾选控制面板中的"已接上拉"）。',
        targets: [
          { type: 'instance', id: instance.id },
          ...relatedPorts.map((port) => portTarget(instance.id, port.id)),
        ],
      });
    }
    return out;
  },
};

const R13_I2C_ADDRESS_CONFLICT: Rule = {
  meta: {
    code: 'R-13',
    name: 'I2C 地址冲突',
    severity: 'error',
    scope: 'project',
    tags: ['protocol'],
  },
  run: ({ instances, connections, defs, board }) => {
    const out: Diagnostic[] = [];
    const pinIds = new Set(board.pins.map((pin) => pin.id));

    const pinOfPort = (instanceId: string, portId: string): string | undefined => {
      for (const conn of connections) {
        if (
          conn.from.type === 'port' &&
          conn.from.instanceId === instanceId &&
          conn.from.portId === portId &&
          conn.to.type === 'pin' &&
          pinIds.has(conn.to.pinId)
        ) {
          return conn.to.pinId;
        }
        if (
          conn.to.type === 'port' &&
          conn.to.instanceId === instanceId &&
          conn.to.portId === portId &&
          conn.from.type === 'pin' &&
          pinIds.has(conn.from.pinId)
        ) {
          return conn.from.pinId;
        }
      }
      return undefined;
    };

    const buses = new Map<string, Array<{ instance: ComponentInstance; address: string }>>();
    for (const instance of instances) {
      const def = defs.get(instance.definitionSlug);
      if (!def || !def.protocols.includes('I2C')) continue;
      const scl = pinOfPort(instance.id, 'SCL');
      const sda = pinOfPort(instance.id, 'SDA');
      if (!scl && !sda) continue;
      const addressOption = (def.portOptions ?? []).find((option) => option.key === 'address');
      const address = String(instance.portConfig.address ?? addressOption?.defaultValue ?? '0x3C');
      const key = `${scl ?? '-'}|${sda ?? '-'}`;
      const list = buses.get(key) ?? [];
      list.push({ instance, address });
      buses.set(key, list);
    }

    for (const list of buses.values()) {
      const byAddress = new Map<string, ComponentInstance[]>();
      for (const item of list) {
        const group = byAddress.get(item.address) ?? [];
        group.push(item.instance);
        byAddress.set(item.address, group);
      }
      for (const [address, group] of byAddress) {
        if (group.length < 2) continue;
        out.push({
          code: 'R-13',
          severity: 'error',
          message: `同一条 I2C 总线上有 ${group.length} 个器件使用地址 ${address}`,
          suggestion: '修改其中一个器件的 I2C 地址（OLED 可切 0x3C / 0x3D），或改接另一组引脚。',
          targets: group.map((item) => ({ type: 'instance', id: item.id })),
        });
      }
    }
    return out;
  },
};

const R14_I2C_NON_DEFAULT_PINS: Rule = {
  meta: {
    code: 'R-14',
    name: '使用非默认 I2C 引脚',
    severity: 'warning',
    scope: 'connection',
    tags: ['protocol'],
  },
  run: (input) => {
    const out: Diagnostic[] = [];
    const defaultPin: Record<string, string> = {
      SCL: 'pin-esp32-gpio22',
      SDA: 'pin-esp32-gpio21',
    };
    const perInstance = new Map<
      string,
      { instance: ComponentInstance; pins: Array<{ pin: PinDef; portId: string }> }
    >();

    for (const pair of signalPinPairs(input)) {
      const port = portOf(pair.def, pair.portId);
      if (!port || !(port.protocols ?? []).includes('I2C')) continue;
      if (pair.pin.id === defaultPin[pair.portId]) continue;
      const entry = perInstance.get(pair.instance.id) ?? { instance: pair.instance, pins: [] };
      entry.pins.push({ pin: pair.pin, portId: pair.portId });
      perInstance.set(pair.instance.id, entry);
    }

    for (const entry of perInstance.values()) {
      const detail = entry.pins.map((item) => `${item.portId} → ${item.pin.physicalLabel}`).join('，');
      out.push({
        code: 'R-14',
        severity: 'warning',
        message: `${entry.instance.label} 使用了非默认 I2C 引脚：${detail}`,
        suggestion: '默认 I2C 为 SDA=GPIO21、SCL=GPIO22；改用其它引脚时需在固件中显式重映射。',
        targets: [
          { type: 'instance', id: entry.instance.id },
          ...entry.pins.flatMap((item) => [
            pinTarget(item.pin.id),
            portTarget(entry.instance.id, item.portId),
          ]),
        ],
      });
    }
    return out;
  },
};

const R15_EXTERNAL_POWER: Rule = {
  meta: {
    code: 'R-15',
    name: '大电流负载需独立供电',
    severity: 'warning',
    scope: 'component',
    tags: ['power', 'component-requirement'],
  },
  run: ({ instances, connections, defs, nets }) => {
    const out: Diagnostic[] = [];
    for (const instance of instances) {
      const def = defs.get(instance.definitionSlug);
      // 组件声明式需求驱动（舵机 / 超声波等），不针对具体 slug
      if (!def || !def.requirements.includes('external-power')) continue;
      if (satisfiedByConfig(def, instance, 'external-power')) continue;

      // 供电入口（power）与负载端（passive，如电机 ±）都要检查是否由板载 LDO 供电
      const powerPorts = def.ports.filter(
        (port) => port.role === 'power' || port.role === 'passive',
      );
      const connected = powerPorts.filter((port) =>
        isPortConnected(connections, instance.id, port.id),
      );
      if (connected.length === 0) continue;

      // 已由独立电源模块供电 → 视为已处理（器件直连场景）
      if (
        connected.some((port) => netHasIndependentPower(netOfPort(nets, instance.id, port.id)))
      ) {
        continue;
      }
      // 是否由开发板板载电源引脚供电（板载 LDO 输出电流有限）
      const fromBoard = connected.some((port) => netHasBoardPower(netOfPort(nets, instance.id, port.id)));
      if (!fromBoard) continue;

      out.push({
        code: 'R-15',
        severity: 'warning',
        message: `${instance.label} 的大电流负载由开发板板载电源供电`,
        suggestion:
          '舵机/电机/超声波等负载建议使用独立电源并与开发板共地；板载 3V3 输出电流有限（约 600mA），可能导致复位或工作异常（也可在控制面板勾选"已使用独立电源"）。',
        targets: [
          { type: 'instance', id: instance.id },
          ...connected.map((port) => portTarget(instance.id, port.id)),
        ],
      });
    }
    return out;
  },
};

const R16_STRAP_PIN: Rule = {
  meta: {
    code: 'R-16',
    name: '占用启动敏感（Strapping）引脚',
    severity: 'warning',
    scope: 'connection',
    tags: ['pin-capability'],
  },
  run: (input) => {
    const out: Diagnostic[] = [];
    for (const pair of signalPinPairs(input)) {
      if (!hasCapability(pair.pin, 'STRAP')) continue;
      out.push({
        code: 'R-16',
        severity: 'warning',
        message: `${pair.pin.physicalLabel} 是启动敏感引脚（Strapping）`,
        suggestion: '该引脚上电电平会影响启动模式，外接器件可能导致下载失败或启动异常。',
        targets: [pinTarget(pair.pin.id), portTarget(pair.instance.id, pair.portId)],
      });
    }
    return out;
  },
};

const R17_UART0_PIN: Rule = {
  meta: {
    code: 'R-17',
    name: '占用 UART0 串口引脚',
    severity: 'warning',
    scope: 'connection',
    tags: ['pin-capability'],
  },
  run: (input) => {
    const out: Diagnostic[] = [];
    for (const pair of signalPinPairs(input)) {
      if (!hasCapability(pair.pin, 'UART0')) continue;
      out.push({
        code: 'R-17',
        severity: 'warning',
        message: `${pair.pin.physicalLabel} 是 UART0（板载 USB 串口）引脚`,
        suggestion: '占用后会干扰日志输出与固件下载，建议改用其它 GPIO。',
        targets: [pinTarget(pair.pin.id), portTarget(pair.instance.id, pair.portId)],
      });
    }
    return out;
  },
};

const R18_POWER_SHORT: Rule = {
  meta: {
    code: 'R-18',
    name: '电源短路',
    severity: 'error',
    scope: 'connection',
    tags: ['power'],
  },
  run: ({ nets }) => {
    const out: Diagnostic[] = [];
    for (const net of nets) {
      const powerPins = net.pins.filter(isPowerPin);
      const groundPins = net.pins.filter(isGroundPin);
      if (powerPins.length === 0 || groundPins.length === 0) continue;
      out.push({
        code: 'R-18',
        severity: 'error',
        message: `${powerPins[0].physicalLabel} 与 ${groundPins[0].physicalLabel} 被直接短接`,
        suggestion: '电源与地直接相连会短路，请断开这条连线。',
        targets: [pinTarget(powerPins[0].id), pinTarget(groundPins[0].id)],
      });
    }
    return out;
  },
};

const R19_LED_SERIES_RESISTOR: Rule = {
  meta: {
    code: 'R-19',
    name: 'LED 缺少限流电阻',
    severity: 'warning',
    scope: 'component',
    tags: ['component-requirement', 'protection'],
  },
  run: ({ instances, connections, defs, nets }) => {
    const out: Diagnostic[] = [];
    for (const instance of instances) {
      const def = defs.get(instance.definitionSlug);
      if (!def || !def.requirements.includes('led-series-resistor')) continue;
      if (satisfiedByConfig(def, instance, 'led-series-resistor')) continue;

      const signalPorts = def.ports.filter((port) => port.role === 'signal');
      const connected = signalPorts.some((port) =>
        isPortConnected(connections, instance.id, port.id),
      );
      if (!connected) continue;

      const byPassive = signalPorts.some((port) =>
        hasPassiveComponent(netOfPort(nets, instance.id, port.id), instance.id),
      );
      if (byPassive) continue;

      out.push({
        code: 'R-19',
        severity: 'warning',
        message: `${instance.label} 的信号线上缺少限流电阻`,
        suggestion:
          'LED 必须串联 220Ω–1kΩ 限流电阻，否则可能烧毁 LED 或 GPIO（也可在控制面板勾选"已串联限流电阻"）。',
        targets: [
          { type: 'instance', id: instance.id },
          ...signalPorts.map((port) => portTarget(instance.id, port.id)),
        ],
      });
    }
    return out;
  },
};

const R20_UART_CROSS: Rule = {
  meta: {
    code: 'R-20',
    name: '串口 TX/RX 未交叉',
    severity: 'error',
    scope: 'connection',
    tags: ['protocol'],
  },
  run: (input) => {
    const out: Diagnostic[] = [];
    for (const pair of signalPinPairs(input)) {
      const port = portOf(pair.def, pair.portId);
      if (!port || !(port.protocols ?? []).includes('UART')) continue;

      const label = port.name.toUpperCase();
      const portIsTx = label.includes('TX');
      const portIsRx = label.includes('RX');
      if (!portIsTx && !portIsRx) continue;

      const pinIsTx = hasCapability(pair.pin, 'UART0_TX') || hasCapability(pair.pin, 'UART2_TX');
      const pinIsRx = hasCapability(pair.pin, 'UART0_RX') || hasCapability(pair.pin, 'UART2_RX');
      // 接到非硬件串口引脚（软串口）不在本规则范围内
      if (!pinIsTx && !pinIsRx) continue;

      const sameDirection = (portIsTx && pinIsTx) || (portIsRx && pinIsRx);
      if (!sameDirection) continue;

      const directionLabel = portIsTx ? 'TX' : 'RX';
      const peer = portIsTx ? 'RX' : 'TX';
      out.push({
        code: 'R-20',
        severity: 'error',
        message: `${pair.instance.label}.${port.name} 接到了 ${pair.pin.physicalLabel}（同为 ${directionLabel}），两端方向相同无法通信`,
        suggestion: `串口必须交叉连接：模块 TX → 开发板 RX、模块 RX → 开发板 TX（本端应接 ${peer} 引脚）。`,
        targets: [
          pinTarget(pair.pin.id),
          portTarget(pair.instance.id, pair.portId),
          { type: 'connection', id: pair.connection.id },
        ],
      });
    }
    return out;
  },
};

const R21_VOLTAGE_MISMATCH: Rule = {
  meta: {
    code: 'R-21',
    name: '5V 信号直连 3.3V 引脚',
    severity: 'error',
    scope: 'connection',
    tags: ['electrical'],
  },
  run: (input) => {
    const out: Diagnostic[] = [];
    // 5V 逻辑的开发板不存在该风险
    if (input.board.logicVoltage === '5V') return out;

    for (const pair of signalPinPairs(input)) {
      const port = portOf(pair.def, pair.portId);
      if (!port || port.role !== 'signal') continue;
      if (port.voltageDomain !== '5V') continue;
      // 输入型端口不会向引脚灌电流（如 HC-SR04 的 TRIG）
      if (port.direction === 'in') continue;
      if (pair.pin.voltageDomain !== '3V3') continue;
      if (satisfiedByConfig(pair.def, pair.instance, 'signal-voltage-match')) continue;

      out.push({
        code: 'R-21',
        severity: 'error',
        message: `${pair.instance.label}.${port.name} 输出 5V 电平，直接接入 3.3V 引脚 ${pair.pin.physicalLabel}`,
        suggestion:
          '先用电阻分压（如 1kΩ + 2kΩ）或电平转换模块把 5V 降到 3.3V 再接入；长期直连可能损坏引脚（也可在控制面板勾选"已分压 / 已用电平转换模块"）。',
        targets: [
          pinTarget(pair.pin.id),
          portTarget(pair.instance.id, pair.portId),
          { type: 'connection', id: pair.connection.id },
        ],
      });
    }
    return out;
  },
};

const R22_NEEDS_DRIVER: Rule = {
  meta: {
    code: 'R-22',
    name: '负载直连 GPIO（需驱动模块）',
    severity: 'error',
    scope: 'connection',
    tags: ['electrical'],
  },
  run: (input) => {
    const out: Diagnostic[] = [];
    for (const pair of signalPinPairs(input)) {
      // 组件声明式需求驱动（直流电机等），不针对具体 slug
      if (!pair.def.requirements.includes('needs-driver')) continue;
      const port = portOf(pair.def, pair.portId);
      // 拦"用电端口"（power 供电入口 / passive 负载端），信号与地不管
      if (!port || port.role === 'ground' || port.role === 'signal') continue;
      // 只拦"接到 GPIO"：接到电源引脚的情形由 R-15（需独立供电）处理
      if (pair.pin.kind !== 'io') continue;

      out.push({
        code: 'R-22',
        severity: 'error',
        message: `${pair.instance.label}.${port.name} 直接接在 ${pair.pin.physicalLabel}（GPIO）上，电机类负载不能由 GPIO 直接驱动`,
        suggestion:
          '用电机驱动模块（如 L298N）中转：GPIO 只接控制脚（IN1–IN4 / ENA / ENB），电机接驱动模块输出端（OUT1/OUT2），驱动模块使用独立电源并与开发板共地。',
        targets: [
          pinTarget(pair.pin.id),
          portTarget(pair.instance.id, pair.portId),
          { type: 'connection', id: pair.connection.id },
        ],
      });
    }
    return out;
  },
};

export const RULES: Rule[] = [
  R01_REQUIRED_PORT,
  R03_PIN_MULTIPLE_USE,
  R05_SIGNAL_TO_POWER,
  R06_POWER_SOURCE_MISSING,
  R07_GROUND_MISSING,
  R08_INPUT_ONLY_MISUSE,
  R09_INPUT_ONLY_NO_PULL,
  R10_FLASH_RESERVED,
  R11_ADC2_WIFI,
  R12_PULLUP_MISSING,
  R13_I2C_ADDRESS_CONFLICT,
  R14_I2C_NON_DEFAULT_PINS,
  R15_EXTERNAL_POWER,
  R16_STRAP_PIN,
  R17_UART0_PIN,
  R18_POWER_SHORT,
  R19_LED_SERIES_RESISTOR,
  R20_UART_CROSS,
  R21_VOLTAGE_MISMATCH,
  R22_NEEDS_DRIVER,
];

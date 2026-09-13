/**
 * net 归并：把连线集合折叠成电气等价的"net"（并查集）
 *
 * 约定（docs/技术设计文档.md §6.3）：
 *  - 端点 key：`pin:<pinId>` / `port:<instanceId>:<portId>`
 *  - 仅归并 enabled=true 的连线（禁用等价于断开）
 *  - 电源/地引脚允许被多器件共享（电源轨语义）
 */
import type {
  BoardDef,
  ComponentDef,
  ComponentInstance,
  Connection,
  EndpointRef,
  PinDef,
} from '@sim/contracts';

export interface NetPort {
  instance: ComponentInstance;
  def: ComponentDef;
  portId: string;
}

export interface Net {
  key: string;
  pins: PinDef[];
  ports: NetPort[];
}

export const endpointKey = (ref: EndpointRef): string =>
  ref.type === 'pin' ? `pin:${ref.pinId}` : `port:${ref.instanceId}:${ref.portId}`;

class DisjointSet {
  private readonly parent = new Map<string, string>();

  find(key: string): string {
    const parent = this.parent.get(key);
    if (parent === undefined || parent === key) {
      this.parent.set(key, key);
      return key;
    }
    const root = this.find(parent);
    this.parent.set(key, root);
    return root;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent.set(rootB, rootA);
  }
}

export const buildNets = (
  board: BoardDef,
  instances: ComponentInstance[],
  connections: Connection[],
  defs: Map<string, ComponentDef>,
): Net[] => {
  const pinById = new Map(board.pins.map((pin) => [pin.id, pin]));
  const instanceById = new Map(instances.map((item) => [item.id, item]));
  const dsu = new DisjointSet();

  for (const conn of connections) {
    dsu.union(endpointKey(conn.from), endpointKey(conn.to));
  }

  const groups = new Map<string, Net>();

  const collect = (ref: EndpointRef): void => {
    if (ref.type === 'pin') {
      const pin = pinById.get(ref.pinId);
      if (!pin) return;
      const key = dsu.find(endpointKey(ref));
      const net = groups.get(key) ?? { key, pins: [], ports: [] };
      if (!net.pins.some((item) => item.id === pin.id)) net.pins.push(pin);
      groups.set(key, net);
      return;
    }
    const instance = instanceById.get(ref.instanceId);
    const def = instance ? defs.get(instance.definitionSlug) : undefined;
    if (!instance || !def) return;
    if (!def.ports.some((port) => port.id === ref.portId)) return;
    const key = dsu.find(endpointKey(ref));
    const net = groups.get(key) ?? { key, pins: [], ports: [] };
    net.ports.push({ instance, def, portId: ref.portId });
    groups.set(key, net);
  };

  for (const conn of connections) {
    collect(conn.from);
    collect(conn.to);
  }

  return [...groups.values()];
};

/** 查找某端口所在的 net（上拉/限流类规则需要知道"这根线上还挂了什么"） */
export const netOfPort = (
  nets: Net[],
  instanceId: string,
  portId: string,
): Net | undefined =>
  nets.find((net) =>
    net.ports.some((item) => item.instance.id === instanceId && item.portId === portId),
  );

/** net 中是否存在无源元件（电阻/电容等）——用于"已接上拉/限流电阻"的判定 */
export const hasPassiveComponent = (net: Net | undefined, excludeInstanceId?: string): boolean => {
  if (!net) return false;
  return net.ports.some((item) => {
    if (item.instance.id === excludeInstanceId) return false;
    return item.def.ports.some((port) => port.id === item.portId && port.role === 'passive');
  });
};

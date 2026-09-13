/**
 * 项目状态（画布 + 校验 + 保存）
 *
 * 状态分层（对齐 docs/产品计划文档.md 10.9）：
 *  - 本项目状态：画布内容与配置（Zustand + localStorage 持久化，Demo 代替后端存储）
 *  - 校验状态：本地结果（同步）+ mock 后端结果（异步，模拟权威校验）
 */
import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { mockApi, setSimulatedOffline } from '../api/mockApi';
import { COMPONENTS, getBoard, getComponentDef } from '@sim/definitions';
import type {
  ComponentInstance,
  Connection,
  ConnectionKind,
  EndpointRef,
  ProjectSnapshot,
  ValidationResult,
} from '@sim/contracts';
import { validateProject } from '@sim/rule-engine';

/* ---------------------------- Handle 编解码 ---------------------------- */

export const pinHandleId = (pinId: string): string => `pin:${pinId}`;
export const portHandleId = (instanceId: string, portId: string): string =>
  `port:${instanceId}:${portId}`;
export const handleIdOf = (ref: EndpointRef): string =>
  ref.type === 'pin' ? pinHandleId(ref.pinId) : portHandleId(ref.instanceId, ref.portId);

export const parseHandleId = (handleId: string | null | undefined): EndpointRef | null => {
  if (!handleId) return null;
  const parts = handleId.split(':');
  if (parts[0] === 'pin' && parts.length === 2) return { type: 'pin', pinId: parts[1] };
  if (parts[0] === 'port' && parts.length === 3) {
    return { type: 'port', instanceId: parts[1], portId: parts[2] };
  }
  return null;
};

/* ------------------------------ 工具函数 ------------------------------ */

const roleOfEndpoint = (
  state: { boardSlug: string; instances: ComponentInstance[] },
  ref: EndpointRef,
): 'signal' | 'power' | 'ground' => {
  if (ref.type === 'pin') {
    const pin = getBoard(state.boardSlug).pins.find((item) => item.id === ref.pinId);
    if (!pin) return 'signal';
    if (pin.kind === 'ground') return 'ground';
    if (pin.kind === 'power') return 'power';
    return 'signal';
  }
  const instance = state.instances.find((item) => item.id === ref.instanceId);
  if (!instance) return 'signal';
  const def = getComponentDef(instance.definitionSlug);
  const role = def.ports.find((port) => port.id === ref.portId)?.role ?? 'signal';
  // passive（电阻/电容等无源元件）在连线语义上按信号线处理
  return role === 'passive' ? 'signal' : role;
};

const protocolOfEndpoint = (
  state: { instances: ComponentInstance[] },
  ref: EndpointRef,
): string | undefined => {
  if (ref.type === 'pin') return undefined;
  const instance = state.instances.find((item) => item.id === ref.instanceId);
  if (!instance) return undefined;
  const def = getComponentDef(instance.definitionSlug);
  return def.ports.find((port) => port.id === ref.portId)?.protocols?.[0];
};

const kindOf = (
  state: { boardSlug: string; instances: ComponentInstance[] },
  from: EndpointRef,
  to: EndpointRef,
): ConnectionKind => {
  const roles = [roleOfEndpoint(state, from), roleOfEndpoint(state, to)];
  if (roles.includes('ground')) return 'ground';
  if (roles.includes('power')) return 'power';
  const fromProtocol = protocolOfEndpoint(state, from);
  const toProtocol = protocolOfEndpoint(state, to);
  if (fromProtocol && toProtocol && fromProtocol === toProtocol) return 'bus';
  return 'signal';
};

const sameEndpoint = (a: EndpointRef, b: EndpointRef): boolean =>
  a.type === b.type &&
  (a.type === 'pin'
    ? b.type === 'pin' && a.pinId === b.pinId
    : b.type === 'port' && a.instanceId === b.instanceId && a.portId === b.portId);

let instanceSeq = 1;
let connectionSeq = 1;

const nextInstanceId = (): string => {
  instanceSeq += 1;
  return `c${instanceSeq}`;
};

const nextConnectionId = (): string => {
  connectionSeq += 1;
  return `e${connectionSeq}`;
};

/* ------------------------------- Store ------------------------------- */

export interface ProjectOptions {
  wifiEnabled: boolean;
  mode: 'strict' | 'loose';
  backendOffline: boolean;
}

interface ProjectState {
  projectName: string;
  boardSlug: string;
  instances: ComponentInstance[];
  connections: Connection[];
  selectedInstanceId: string | null;
  selectedConnectionId: string | null;
  options: ProjectOptions;
  localResult: ValidationResult | null;
  serverResult: ValidationResult | null;
  running: boolean;
  hasRun: boolean;
  toast: { text: string; kind: 'info' | 'warn' } | null;

  addInstance: (slug: string, position: { x: number; y: number }) => void;
  moveInstance: (id: string, position: { x: number; y: number }) => void;
  removeInstance: (id: string) => void;
  addConnection: (from: EndpointRef, to: EndpointRef) => void;
  removeConnection: (id: string) => void;
  toggleConnectionEnabled: (id: string) => void;
  setPortConfig: (instanceId: string, key: string, value: string | boolean) => void;
  selectInstance: (id: string | null) => void;
  selectConnection: (id: string | null) => void;
  setOptions: (patch: Partial<ProjectOptions>) => void;
  runValidation: () => Promise<void>;
  loadSampleProject: () => void;
  clearProject: () => void;
  exportJson: () => string;
  importJson: (text: string) => boolean;
  showToast: (text: string, kind?: 'info' | 'warn') => void;
  clearToast: () => void;
}

const defaultPortConfig = (slug: string): Record<string, string | boolean> => {
  const def = COMPONENTS.find((item) => item.slug === slug);
  const config: Record<string, string | boolean> = {};
  for (const option of def?.portOptions ?? []) {
    config[option.key] = option.defaultValue;
  }
  return config;
};

const buildSnapshot = (state: ProjectState): ProjectSnapshot => ({
  boardSlug: state.boardSlug,
  boardVersion: getBoard(state.boardSlug).version,
  instances: state.instances,
  connections: state.connections,
  options: { wifiEnabled: state.options.wifiEnabled, mode: state.options.mode },
});

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projectName: '未命名接线项目',
      boardSlug: 'esp32-devkitc-v4',
      instances: [],
      connections: [],
      selectedInstanceId: null,
      selectedConnectionId: null,
      options: { wifiEnabled: false, mode: 'loose', backendOffline: false },
      localResult: null,
      serverResult: null,
      running: false,
      hasRun: false,
      toast: null,

      addInstance: (slug, position) => {
        const def = getComponentDef(slug);
        const id = nextInstanceId();
        const count = get().instances.filter((item) => item.definitionSlug === slug).length + 1;
        const instance: ComponentInstance = {
          id,
          definitionSlug: slug,
          label: `${def.displayName.split(' ')[0]}-${count}`,
          position,
          portConfig: defaultPortConfig(slug),
        };
        set((state) => ({
          instances: [...state.instances, instance],
          selectedInstanceId: id,
          hasRun: false,
        }));
        get().showToast(`已放置 ${instance.label}`);
      },

      moveInstance: (id, position) => {
        set((state) => ({
          instances: state.instances.map((item) => (item.id === id ? { ...item, position } : item)),
          hasRun: false,
        }));
      },

      removeInstance: (id) => {
        set((state) => ({
          instances: state.instances.filter((item) => item.id !== id),
          connections: state.connections.filter((conn) => {
            const refs = [conn.from, conn.to];
            return !refs.some((ref) => ref.type === 'port' && ref.instanceId === id);
          }),
          selectedInstanceId: state.selectedInstanceId === id ? null : state.selectedInstanceId,
          hasRun: false,
        }));
      },

      addConnection: (from, to) => {
        const state = get();
        const { connections, showToast } = state;
        if (sameEndpoint(from, to)) {
          showToast('不能把端口连接到自身', 'warn');
          return;
        }
        if (from.type === to.type) {
          showToast(
            from.type === 'port'
              ? '请通过开发板引脚连线：组件 → 引脚 → 组件'
              : '两根引脚之间不能直接连线',
            'warn',
          );
          return;
        }
        const duplicated = connections.some(
          (conn) =>
            (sameEndpoint(conn.from, from) && sameEndpoint(conn.to, to)) ||
            (sameEndpoint(conn.from, to) && sameEndpoint(conn.to, from)),
        );
        if (duplicated) {
          showToast('这两个端点已经连接过了', 'warn');
          return;
        }
        const connection: Connection = {
          id: nextConnectionId(),
          from,
          to,
          kind: kindOf(state, from, to),
          enabled: true,
        };
        set((state) => ({ connections: [...state.connections, connection], hasRun: false }));
      },

      removeConnection: (id) => {
        set((state) => ({
          connections: state.connections.filter((conn) => conn.id !== id),
          selectedConnectionId: state.selectedConnectionId === id ? null : state.selectedConnectionId,
          hasRun: false,
        }));
      },

      toggleConnectionEnabled: (id) => {
        set((state) => ({
          connections: state.connections.map((conn) =>
            conn.id === id ? { ...conn, enabled: !conn.enabled } : conn,
          ),
          hasRun: false,
        }));
      },

      setPortConfig: (instanceId, key, value) => {
        set((state) => ({
          instances: state.instances.map((item) =>
            item.id === instanceId ? { ...item, portConfig: { ...item.portConfig, [key]: value } } : item,
          ),
          hasRun: false,
        }));
      },

      selectInstance: (id) => set({ selectedInstanceId: id }),
      selectConnection: (id) => set({ selectedConnectionId: id }),

      setOptions: (patch) => {
        set((state) => ({ options: { ...state.options, ...patch }, hasRun: false }));
        if (patch.backendOffline !== undefined) setSimulatedOffline(patch.backendOffline);
      },

      runValidation: async () => {
        const state = get();
        if (state.instances.length === 0) {
          state.showToast('画布中还没有组件：先从左侧拖入一个组件', 'warn');
          return;
        }
        set({ running: true, hasRun: true, serverResult: null });
        const snapshot = buildSnapshot(get());
        const local = validateProject({
          board: getBoard(snapshot.boardSlug),
          instances: snapshot.instances,
          connections: snapshot.connections,
          defs: COMPONENTS,
          options: { wifiEnabled: snapshot.options.wifiEnabled, mode: snapshot.options.mode },
        });
        set({ localResult: local, running: true });

        try {
          const server = await mockApi.validate(snapshot);
          set({ serverResult: server, running: false });
        } catch {
          set({ running: false });
          get().showToast('后端不可用：已降级为本地规则集结果（规则集版本可能过期）', 'warn');
        }
      },

      loadSampleProject: () => {
        const instances: ComponentInstance[] = [
          {
            id: 'c-dht11',
            definitionSlug: 'dht11',
            label: 'DHT11-1',
            position: { x: 460, y: 120 },
            portConfig: { pullup: true },
          },
          {
            id: 'c-oled',
            definitionSlug: 'ssd1306-i2c',
            label: 'OLED-1',
            position: { x: 460, y: 340 },
            portConfig: { address: '0x3C', pullup: true },
          },
        ];
        const connections: Connection[] = [
          {
            id: 'e-s1',
            from: { type: 'pin', pinId: 'pin-esp32-3v3' },
            to: { type: 'port', instanceId: 'c-dht11', portId: 'VCC' },
            kind: 'power',
            enabled: true,
          },
          {
            id: 'e-s2',
            from: { type: 'pin', pinId: 'pin-esp32-gpio4' },
            to: { type: 'port', instanceId: 'c-dht11', portId: 'DATA' },
            kind: 'signal',
            enabled: true,
          },
          {
            id: 'e-s3',
            from: { type: 'pin', pinId: 'pin-esp32-gnd-1' },
            to: { type: 'port', instanceId: 'c-dht11', portId: 'GND' },
            kind: 'ground',
            enabled: true,
          },
          {
            id: 'e-s4',
            from: { type: 'pin', pinId: 'pin-esp32-3v3' },
            to: { type: 'port', instanceId: 'c-oled', portId: 'VCC' },
            kind: 'power',
            enabled: true,
          },
          {
            id: 'e-s5',
            from: { type: 'pin', pinId: 'pin-esp32-gpio22' },
            to: { type: 'port', instanceId: 'c-oled', portId: 'SCL' },
            kind: 'bus',
            enabled: true,
          },
          {
            id: 'e-s6',
            from: { type: 'pin', pinId: 'pin-esp32-gpio21' },
            to: { type: 'port', instanceId: 'c-oled', portId: 'SDA' },
            kind: 'bus',
            enabled: true,
          },
          {
            id: 'e-s7',
            from: { type: 'pin', pinId: 'pin-esp32-gnd-2' },
            to: { type: 'port', instanceId: 'c-oled', portId: 'GND' },
            kind: 'ground',
            enabled: true,
          },
        ];
        set({
          projectName: '示例：ESP32 + DHT11 + OLED',
          instances,
          connections,
          localResult: null,
          serverResult: null,
          hasRun: false,
          selectedInstanceId: null,
          selectedConnectionId: null,
        });
        get().showToast('已载入示例项目：点击右上角「运行」查看校验结果');
      },

      clearProject: () => {
        set({
          instances: [],
          connections: [],
          localResult: null,
          serverResult: null,
          hasRun: false,
          selectedInstanceId: null,
          selectedConnectionId: null,
        });
      },

      exportJson: () => {
        const state = get();
        return JSON.stringify(
          {
            schemaVersion: 1,
            projectName: state.projectName,
            boardSlug: state.boardSlug,
            boardVersion: getBoard(state.boardSlug).version,
            definitionVersions: Object.fromEntries(COMPONENTS.map((def) => [def.slug, def.version])),
            instances: state.instances,
            connections: state.connections,
            options: { wifiEnabled: state.options.wifiEnabled, mode: state.options.mode },
          },
          null,
          2,
        );
      },

      importJson: (text) => {
        try {
          const parsed = JSON.parse(text) as Partial<ProjectSnapshot> & { projectName?: string };
          if (!parsed.instances || !parsed.connections) {
            get().showToast('导入失败：文件缺少 instances / connections 字段', 'warn');
            return false;
          }
          const unknown = parsed.instances.find(
            (instance) => !COMPONENTS.some((def) => def.slug === instance.definitionSlug),
          );
          if (unknown) {
            get().showToast(`导入失败：存在未知组件定义 ${unknown.definitionSlug}`, 'warn');
            return false;
          }
          set({
            projectName: parsed.projectName ?? '导入的项目',
            instances: parsed.instances,
            connections: parsed.connections,
            localResult: null,
            serverResult: null,
            hasRun: false,
          });
          get().showToast('项目已导入');
          return true;
        } catch {
          get().showToast('导入失败：不是合法的 JSON 文件', 'warn');
          return false;
        }
      },

      showToast: (text, kind = 'info') => set({ toast: { text, kind } }),
      clearToast: () => set({ toast: null }),
    }),
    {
      name: 'sim-mcu-project',
      partialize: (state) => ({
        projectName: state.projectName,
        boardSlug: state.boardSlug,
        instances: state.instances,
        connections: state.connections,
        options: { ...state.options, backendOffline: false },
      }),
    },
  ),
);

/**
 * 合并校验结果：优先后端权威结果；只有本地结果时标注 offline。
 * 纯函数，供非 React 场景（测试、导出、脚本）使用。
 */
export const combineActiveResult = (
  serverResult: ValidationResult | null,
  localResult: ValidationResult | null,
): ValidationResult | null => {
  if (serverResult) return serverResult;
  if (localResult) return { ...localResult, offline: true };
  return null;
};

/**
 * React 侧读取当前生效的校验结果。
 *
 * 必须用 useMemo 缓存引用：zustand v5 直接使用 React 原生 useSyncExternalStore，
 * 其 getSnapshot 若每次返回新对象，React 会持续判定"快照已变化"并强制重渲染，
 * 最终抛 "Maximum update depth exceeded" —— 表现为点击「运行」后白屏。
 * 因此禁止在 selector 内构造新对象，务必在此处缓存。
 */
export const useActiveResult = (): ValidationResult | null => {
  const serverResult = useProjectStore((state) => state.serverResult);
  const localResult = useProjectStore((state) => state.localResult);
  return useMemo(
    () => combineActiveResult(serverResult, localResult),
    [serverResult, localResult],
  );
};

/**
 * 仅在开发/测试构建中把 store 句柄挂到 window，供 E2E 脚本构造特定场景
 * （如"把 DATA 改接到仅输入引脚"）；生产构建不包含该分支。
 */
if (import.meta.env.DEV) {
  (window as unknown as { __SIM_STORE__?: typeof useProjectStore }).__SIM_STORE__ =
    useProjectStore;
}

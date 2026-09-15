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
import { apiClient } from '../api/client';
import { ApiHttpError } from '../api/httpClient';
import { setSimulatedOffline } from '../api/mockApi';
import { SAMPLE_TEMPLATE_ID, findTemplate } from '../projectTemplates';
import { COMPONENTS, getBoard, getComponentDef } from '@sim/definitions';
import type {
  ComponentInstance,
  Connection,
  ConnectionKind,
  EndpointRef,
  PatchProjectRequest,
  ProjectSnapshot,
  ProjectSummary,
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
  /** 明暗主题（persist 保存） */
  theme: 'light' | 'dark';
  /** 操作提示是否已被用户手动关闭（persist 保存，关闭后不再出现） */
  hintDismissed: boolean;
  /** 左侧「组件库 / 检查器」侧边栏是否收起为窄条（persist 保存，收起后画布更宽） */
  sidebarCollapsed: boolean;
  /** 组件库中被折叠的分类（persist 保存，收起后下次打开仍然收起） */
  collapsedGroups: string[];
  /** 快捷键说明面板是否打开 */
  shortcutsOpen: boolean;

  /* --------------------------- 撤销 / 重做（FR-15） --------------------------- */
  /** 历史栈（仅画布文档；栈顶为最近一次操作前的快照） */
  historyPast: HistoryEntry[];
  historyFuture: HistoryEntry[];
  undo: () => void;
  redo: () => void;

  /* ------------------------- 项目管理（M-01，服务端） ------------------------- */
  /** 当前绑定的服务端项目 id（null = 尚未保存到服务端） */
  currentProjectId: string | null;
  /** 服务端乐观锁版本号（If-Match） */
  currentRevision: number;
  saveState: 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict';
  projectList: ProjectSummary[];
  projectListLoading: boolean;
  projectPanelOpen: boolean;

  setTheme: (theme: 'light' | 'dark') => void;
  dismissHint: () => void;
  /** 收起 / 展开左侧边栏（组件库与检查器） */
  toggleSidebar: () => void;
  toggleGroup: (key: string) => void;
  setShortcutsOpen: (open: boolean) => void;
  setProjectPanelOpen: (open: boolean) => void;
  refreshProjectList: () => Promise<void>;
  createProjectOnServer: (name: string) => Promise<void>;
  openProjectById: (id: string) => Promise<void>;
  saveProjectToServer: (options?: { force?: boolean }) => Promise<void>;
  deleteProjectById: (id: string) => Promise<void>;
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
  /** 载入示例项目模板（见 src/projectTemplates.ts） */
  loadTemplate: (templateId: string) => void;
  /** 载入默认示例模板（顶栏按钮） */
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

/* --------------------------- 撤销 / 重做（FR-15） --------------------------- */

/**
 * 历史快照：只覆盖「画布文档」（画布内容 + 名称 + 板型）。
 * 不记录选中项、校验结果、保存状态等 UI/派生状态 —— 撤销不应改变它们。
 *
 * 依赖 store 的不可变更新约定（每次编辑都新建 instances/connections 数组），
 * 因此这里只保存引用即可；若将来出现原地修改，必须改为深拷贝。
 */
export interface HistoryEntry {
  projectName: string;
  boardSlug: string;
  instances: ComponentInstance[];
  connections: Connection[];
}

const HISTORY_LIMIT = 30;

const snapshotOf = (state: {
  projectName: string;
  boardSlug: string;
  instances: ComponentInstance[];
  connections: Connection[];
}): HistoryEntry => ({
  projectName: state.projectName,
  boardSlug: state.boardSlug,
  instances: state.instances,
  connections: state.connections,
});

const sameEntry = (a: HistoryEntry, b: HistoryEntry): boolean =>
  a.boardSlug === b.boardSlug &&
  a.instances === b.instances &&
  a.connections === b.connections;

/** 事务中（如拖动组件）：暂停逐次记录，把「起点快照」作为单独一步 */
let inTransaction = false;
let transactionStart: HistoryEntry | null = null;
/** 抑制记录：undo/redo 与整体替换由内部触发，不能再被记为新历史 */
let suppressRecord = false;

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
      theme: 'light',
      hintDismissed: false,
      sidebarCollapsed: false,
      collapsedGroups: [],
      shortcutsOpen: false,
      historyPast: [],
      historyFuture: [],

      currentProjectId: null,
      currentRevision: 0,
      saveState: 'idle',
      projectList: [],
      projectListLoading: false,
      projectPanelOpen: false,

      setTheme: (theme) => set({ theme }),
      dismissHint: () => set({ hintDismissed: true }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
      toggleGroup: (key) =>
        set((state) => ({
          collapsedGroups: state.collapsedGroups.includes(key)
            ? state.collapsedGroups.filter((item) => item !== key)
            : [...state.collapsedGroups, key],
        })),

      setProjectPanelOpen: (open) => {
        set({ projectPanelOpen: open });
        if (open) void get().refreshProjectList();
      },

      refreshProjectList: async () => {
        set({ projectListLoading: true });
        try {
          const list = await apiClient.listProjects();
          set({ projectList: list, projectListLoading: false });
        } catch {
          set({ projectListLoading: false });
          get().showToast('无法获取项目列表：后端不可用', 'warn');
        }
      },

      createProjectOnServer: async (name) => {
        const state = get();
        try {
          const project = await apiClient.createProject({ name, boardSlug: state.boardSlug });
          // 新建后立即把当前画布内容写入服务端，避免"建了空项目但画布有内容"
          const saved = await apiClient.saveProject(project.id, project.revision, {
            instances: state.instances,
            connections: state.connections,
            options: { wifiEnabled: state.options.wifiEnabled, mode: state.options.mode },
          });
          // 新建后保持面板打开：便于用户看到新项目出现在列表中并继续操作
          set({
            currentProjectId: project.id,
            currentRevision: saved.revision,
            projectName: project.name,
            saveState: 'saved',
          });
          get().showToast(`已新建服务端项目：${project.name}`);
          void get().refreshProjectList();
        } catch (error) {
          set({ saveState: 'error' });
          get().showToast(
            `新建项目失败：${error instanceof Error ? error.message : '未知错误'}`,
            'warn',
          );
        }
      },

      openProjectById: async (id) => {
        set({ projectListLoading: true });
        try {
          const detail = await apiClient.getProject(id);
          // 打开项目 = 以服务端为准，不应被标记为"有未保存改动"
          skipNextDirtyMarkOnce();
          set({
            currentProjectId: detail.project.id,
            currentRevision: detail.project.revision,
            projectName: detail.project.name,
            boardSlug: detail.project.boardSlug,
            instances: detail.instances,
            connections: detail.connections,
            options: {
              ...get().options,
              wifiEnabled: detail.project.options?.wifiEnabled ?? false,
              mode: detail.project.options?.mode ?? 'loose',
            },
            localResult: null,
            serverResult: null,
            hasRun: false,
            saveState: 'saved',
            selectedInstanceId: null,
            selectedConnectionId: null,
            projectPanelOpen: false,
            projectListLoading: false,
          });
          // 打开项目属于「切换文档」：旧画布的历史不再适用于新内容
          resetHistory();
          get().showToast(`已打开项目：${detail.project.name}`);
        } catch (error) {
          set({ projectListLoading: false });
          get().showToast(
            `打开失败：${error instanceof Error ? error.message : '未知错误'}`,
            'warn',
          );
        }
      },

      saveProjectToServer: async (options) => {
        const state = get();
        if (!state.currentProjectId) {
          get().showToast('当前画布尚未绑定服务端项目：请先「新建服务端项目」或「导入」', 'warn');
          return;
        }
        const projectId = state.currentProjectId;
        const patch: PatchProjectRequest = {
          name: state.projectName,
          instances: state.instances,
          connections: state.connections,
          options: { wifiEnabled: state.options.wifiEnabled, mode: state.options.mode },
        };

        set({ saveState: 'saving' });
        try {
          const result = await apiClient.saveProject(projectId, state.currentRevision, patch);
          set({ currentRevision: result.revision, saveState: 'saved' });
          get().showToast(`已保存到服务端（revision ${result.revision}）`);
          void get().refreshProjectList();
          return;
        } catch (error) {
          const conflict = error instanceof ApiHttpError && error.status === 409;

          if (conflict && options?.force) {
            // 覆盖保存：拉取最新 revision 后重试一次
            try {
              const latest = await apiClient.getProject(projectId);
              const retry = await apiClient.saveProject(
                projectId,
                latest.project.revision,
                patch,
              );
              set({ currentRevision: retry.revision, saveState: 'saved' });
              get().showToast(`已覆盖服务端版本（revision ${retry.revision}）`);
              void get().refreshProjectList();
              return;
            } catch (retryError) {
              set({ saveState: 'error' });
              get().showToast(
                `覆盖保存失败：${retryError instanceof Error ? retryError.message : '未知错误'}`,
                'warn',
              );
              return;
            }
          }

          set({ saveState: conflict ? 'conflict' : 'error' });
          get().showToast(
            conflict
              ? '服务端项目已在别处更新：可「重新加载」或「覆盖保存」'
              : `保存失败：${error instanceof Error ? error.message : '未知错误'}`,
            'warn',
          );
        }
      },

      deleteProjectById: async (id) => {
        try {
          await apiClient.deleteProject(id);
          const isCurrent = get().currentProjectId === id;
          if (isCurrent) {
            set({ currentProjectId: null, currentRevision: 0, saveState: 'idle' });
          }
          get().showToast('已删除服务端项目');
          void get().refreshProjectList();
        } catch (error) {
          get().showToast(
            `删除失败：${error instanceof Error ? error.message : '未知错误'}`,
            'warn',
          );
        }
      },


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
        // 器件直连（端口 ↔ 端口）是允许的：电机接驱动模块输出、外设接独立电源都会用到；
        // 仅禁止「引脚 ↔ 引脚」——两个引脚直接相连属于焊接/跳线，不是接线图语义
        if (from.type === 'pin' && to.type === 'pin') {
          showToast('两根引脚之间不能直接连线：请从组件端口开始接线', 'warn');
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

      undo: () => {
        const state = get();
        const previous = state.historyPast[state.historyPast.length - 1];
        if (!previous) return;
        suppressRecord = true;
        set({
          historyPast: state.historyPast.slice(0, -1),
          historyFuture: [...state.historyFuture, snapshotOf(state)].slice(0, HISTORY_LIMIT),
          ...previous,
          hasRun: false,
          selectedInstanceId: null,
          selectedConnectionId: null,
        });
        suppressRecord = false;
        get().showToast('已撤销上一步操作');
      },

      redo: () => {
        const state = get();
        const next = state.historyFuture[state.historyFuture.length - 1];
        if (!next) return;
        suppressRecord = true;
        set({
          historyFuture: state.historyFuture.slice(0, -1),
          historyPast: [...state.historyPast, snapshotOf(state)].slice(-HISTORY_LIMIT),
          ...next,
          hasRun: false,
          selectedInstanceId: null,
          selectedConnectionId: null,
        });
        suppressRecord = false;
        get().showToast('已重做');
      },

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
          const server = await apiClient.validate(snapshot);
          set({ serverResult: server, running: false });
        } catch {
          set({ running: false });
          get().showToast('后端不可用：已降级为本地规则集结果（规则集版本可能过期）', 'warn');
        }
      },

      loadTemplate: (templateId) => {
        const template = findTemplate(templateId);
        if (!template) {
          get().showToast(`未找到示例模板：${templateId}`, 'warn');
          return;
        }
        // 深拷贝模板数据：用户随后编辑画布不会污染模板本身
        set({
          projectName: template.projectName,
          instances: template.instances.map((item) => ({
            ...item,
            position: { ...item.position },
            portConfig: { ...item.portConfig },
          })),
          connections: template.connections.map((conn) => ({ ...conn })),
          options: {
            ...get().options,
            wifiEnabled: template.options.wifiEnabled,
            mode: template.options.mode,
          },
          localResult: null,
          serverResult: null,
          hasRun: false,
          selectedInstanceId: null,
          selectedConnectionId: null,
        });
        get().showToast(`已载入「${template.name}」模板：点击右上角「运行」查看校验结果`);
      },

      loadSampleProject: () => {
        get().loadTemplate(SAMPLE_TEMPLATE_ID);
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
        theme: state.theme,
        hintDismissed: state.hintDismissed,
        sidebarCollapsed: state.sidebarCollapsed,
        collapsedGroups: state.collapsedGroups,
        currentProjectId: state.currentProjectId,
        currentRevision: state.currentRevision,
      }),
    },
  ),
);

/* --------------------- 撤销 / 重做：运行时逻辑（store 之后） --------------------- */

const pushHistoryEntry = (entry: HistoryEntry): void => {
  useProjectStore.setState((state) => ({
    historyPast: [...state.historyPast, entry].slice(-HISTORY_LIMIT),
    historyFuture: [],
  }));
};

/** 开始一次连续操作（拖动）：期间的状态变化合并为一步 */
export const beginHistoryTransaction = (): void => {
  if (inTransaction) return;
  inTransaction = true;
  transactionStart = snapshotOf(useProjectStore.getState());
};

/** 结束连续操作：若确实发生了变化，把起点快照压入历史 */
export const endHistoryTransaction = (): void => {
  if (!inTransaction) return;
  inTransaction = false;
  const start = transactionStart;
  transactionStart = null;
  if (!start) return;
  if (sameEntry(start, snapshotOf(useProjectStore.getState()))) return;
  pushHistoryEntry(start);
};

/** 清空历史（打开服务端项目等「切换文档」操作） */
export const resetHistory = (): void => {
  suppressRecord = true;
  useProjectStore.setState({ historyPast: [], historyFuture: [] });
  suppressRecord = false;
};

/**
 * 用订阅统一记录历史，而不是在每个 action 里插入调用 ——
 * 这样后续新增编辑入口不会漏记（与 saveState 的 dirty 标记同一策略）。
 */
useProjectStore.subscribe((state, prev) => {
  if (suppressRecord || inTransaction) return;
  const changed =
    state.instances !== prev.instances ||
    state.connections !== prev.connections ||
    state.boardSlug !== prev.boardSlug;
  if (!changed) return;
  pushHistoryEntry(snapshotOf(prev));
});

/**
 * 「以服务端为准」的整屏替换（打开项目）调用一次，避免被误标为未保存。
 * 一次性标志：只跳过一次 dirty 标记。
 */
let skipNextDirtyMark = false;

export const skipNextDirtyMarkOnce = (): void => {
  skipNextDirtyMark = true;
};

/**
 * 画布内容变化 → 标记未保存（dirty）。仅当已绑定服务端项目时生效；保存过程中不打断。
 * 用订阅而不是在每个 action 里写，避免遗漏新的编辑入口。
 *
 * 注意：只跟踪 instances / connections ——
 *  - 项目改名不算内容变更（保存时总会带上最新名称）；
 *  - 新建/打开项目会整体替换画布，调用方需先 skipNextDirtyMarkOnce()。
 */
useProjectStore.subscribe((state, prev) => {
  const contentChanged =
    state.instances !== prev.instances || state.connections !== prev.connections;

  // 只有「画布内容变化」才消耗 skip 标志：否则无关的 setState（历史栈更新、
  // 选中项变化等）会把标志吃掉，导致整体替换后仍被标记为未保存。
  if (!contentChanged) return;

  if (skipNextDirtyMark) {
    skipNextDirtyMark = false;
    return;
  }

  if (!state.currentProjectId) return;
  if (state.saveState === 'saving' || state.saveState === 'dirty') return;

  useProjectStore.setState({ saveState: 'dirty' });
});

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
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __SIM_STORE__?: typeof useProjectStore }).__SIM_STORE__ =
    useProjectStore;
} 
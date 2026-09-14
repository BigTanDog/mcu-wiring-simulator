/**
 * 画布区：React Flow 画布 + 组件拖拽放置 + 端口连线 + 诊断高亮。
 *
 * 连线语义：所有连接都应当是「组件端口 ↔ 开发板引脚」（平台以引脚定义校验为核心）；
 * 端口之间不能直连，引擎规则也基于该约束设计。
 */
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type Edge,
  type IsValidConnection,
  type Node,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
} from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ComponentInstance, EndpointRef } from '@sim/contracts';
import { useDiagnosticIndex } from '../store/useDiagnostics';
import {
  beginHistoryTransaction,
  endHistoryTransaction,
  handleIdOf,
  parseHandleId,
  useProjectStore,
} from '../store/useProjectStore';
import { BoardNode } from './nodes/BoardNode';
import { ComponentNode } from './nodes/ComponentNode';
import { ValidationPanel } from './ValidationPanel';

const nodeTypes = { board: BoardNode, component: ComponentNode };

const nodeIdOf = (ref: EndpointRef): string => (ref.type === 'pin' ? 'board' : ref.instanceId);

export const CanvasArea = () => {
  const instances = useProjectStore((state) => state.instances);
  const connections = useProjectStore((state) => state.connections);
  const moveInstance = useProjectStore((state) => state.moveInstance);
  const removeInstance = useProjectStore((state) => state.removeInstance);
  const addConnection = useProjectStore((state) => state.addConnection);
  const removeConnection = useProjectStore((state) => state.removeConnection);
  const addInstance = useProjectStore((state) => state.addInstance);
  const selectInstance = useProjectStore((state) => state.selectInstance);
  const selectConnection = useProjectStore((state) => state.selectConnection);
  const selectedInstanceId = useProjectStore((state) => state.selectedInstanceId);
  const selectedConnectionId = useProjectStore((state) => state.selectedConnectionId);
  const hasRun = useProjectStore((state) => state.hasRun);
  const instanceCount = useProjectStore((state) => state.instances.length);
  const hintDismissed = useProjectStore((state) => state.hintDismissed);
  const dismissHint = useProjectStore((state) => state.dismissHint);
  const theme = useProjectStore((state) => state.theme);
  const index = useDiagnosticIndex();
  const { screenToFlowPosition, fitView } = useReactFlow();

  // F：适配视图（需要 React Flow 上下文，故放在这里而不是全局快捷键 hook）
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const editing =
        !!target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (editing) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.toLowerCase() !== 'f') return;
      void fitView({ padding: 0.15, maxZoom: 1, duration: 250 });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fitView]);

  /**
   * 节点 data 引用稳定化（M-04 基准优化）：
   * 拖动时每帧都会重建 nodes 数组，若 data 每次都是新对象，节点组件的 memo 会失效、
   * 全体节点跟着重渲染。这里按「内容是否变化」复用 data 对象，让 memo 真正生效。
   */
  const dataCacheRef = useRef(new Map<string, { slug: string; label: string }>());
  const stableData = useCallback((instance: ComponentInstance) => {
    const cached = dataCacheRef.current.get(instance.id);
    if (cached && cached.slug === instance.definitionSlug && cached.label === instance.label) {
      return cached;
    }
    const next = { slug: instance.definitionSlug, label: instance.label };
    dataCacheRef.current.set(instance.id, next);
    return next;
  }, []);

  const nodes: Node[] = useMemo(
    () => [
      {
        id: 'board',
        type: 'board',
        position: { x: 40, y: 24 },
        data: {},
        draggable: true,
        selected: false,
      },
      ...instances.map((instance) => ({
        id: instance.id,
        type: 'component',
        position: instance.position,
        data: stableData(instance),
        // 必须把选中状态写回受控节点：React Flow 的 deleteKeyCode 只会删除
        // 「内部认为已选中」的元素，否则按 Backspace/Delete 毫无反应
        selected: instance.id === selectedInstanceId,
      })),
    ],
    [instances, selectedInstanceId, stableData],
  );

  const edges: Edge[] = useMemo(
    () =>
      connections.map((conn) => {
        const severity = index.connection.get(conn.id);
        const classes = ['wire', `wire-${conn.kind}`];
        if (!conn.enabled) classes.push('wire-disabled');
        if (severity === 'error') classes.push('wire-error');
        if (severity === 'warning') classes.push('wire-warning');
        return {
          id: conn.id,
          source: nodeIdOf(conn.from),
          target: nodeIdOf(conn.to),
          sourceHandle: handleIdOf(conn.from),
          targetHandle: handleIdOf(conn.to),
          className: classes.join(' '),
          animated: conn.kind === 'bus' && conn.enabled,
          data: { kind: conn.kind },
          selected: conn.id === selectedConnectionId,
        } satisfies Edge;
      }),
    [connections, index, selectedConnectionId],
  );

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          moveInstance(change.id, change.position);
        }
        if (change.type === 'remove') {
          removeInstance(change.id);
        }
        if (change.type === 'select' && change.selected) {
          selectInstance(change.id);
        }
      }
    },
    [moveInstance, removeInstance, selectInstance],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      for (const change of changes) {
        if (change.type === 'remove') removeConnection(change.id);
        if (change.type === 'select') selectConnection(change.selected ? change.id : null);
      }
    },
    [removeConnection, selectConnection],
  );

  const onConnect: OnConnect = useCallback(
    (params) => {
      const from = parseHandleId(params.sourceHandle);
      const to = parseHandleId(params.targetHandle);
      if (!from || !to) return;
      addConnection(from, to);
    },
    [addConnection],
  );

  const isValidConnection: IsValidConnection = useCallback(
    (connection) => connection.source !== connection.target,
    [],
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const slug = event.dataTransfer.getData('application/sim-component');
      if (!slug) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addInstance(slug, { x: position.x - 70, y: position.y - 50 });
    },
    [addInstance, screenToFlowPosition],
  );

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  return (
    <div className="stage" onDrop={onDrop} onDragOver={onDragOver}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        connectionMode={ConnectionMode.Loose}
        onNodeClick={(_, node) => selectInstance(node.id === 'board' ? null : node.id)}
        onEdgeClick={(_, edge) => selectConnection(edge.id)}
        onPaneClick={() => {
          selectInstance(null);
          selectConnection(null);
        }}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
        minZoom={0.25}
        maxZoom={2}
        snapToGrid
        snapGrid={[8, 8]}
        deleteKeyCode={['Delete', 'Backspace']}
        defaultEdgeOptions={{ type: 'bezier' }}
        /* 拖动组件属于连续操作：整体合并为一步历史，撤销时回到拖动前的位置 */
        onNodeDragStart={() => beginHistoryTransaction()}
        onNodeDragStop={() => endHistoryTransaction()}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color={theme === 'dark' ? '#33404f' : '#b9c4d4'}
        />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeStrokeWidth={2}
          nodeColor={(node) =>
            node.type === 'board' ? '#94a3b8' : theme === 'dark' ? '#33507a' : '#bfdbfe'
          }
          maskColor={theme === 'dark' ? 'rgba(16,21,29,.78)' : 'rgba(231,236,243,.75)'}
        />
      </ReactFlow>
      <ValidationPanel />
      {/*
        操作提示：仅当「画布为空 + 未运行过 + 用户未手动关闭」时出现。
        之前只要编辑画布（hasRun 被重置）就反复弹出，改为按"画布是否为空"判断，
        位置也从左下角（会压住结果面板）移到右上角运行按钮下方。
      */}
      {!hintDismissed && !hasRun && instanceCount === 0 ? (
        <div className="canvas-hint">
          <span>
            操作提示：从左栏拖入组件 → 从端口拖到开发板引脚（或另一个组件的端口）连线 → 右上角「运行」校验
          </span>
          <button
            type="button"
            className="hint-close"
            onClick={dismissHint}
            title="不再显示该提示"
            aria-label="关闭操作提示"
          >
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
};

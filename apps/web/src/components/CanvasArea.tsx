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
import { useCallback, useMemo } from 'react';
import type { EndpointRef } from '@sim/contracts';
import { useDiagnosticIndex } from '../store/useDiagnostics';
import { handleIdOf, parseHandleId, useProjectStore } from '../store/useProjectStore';
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
  const hasRun = useProjectStore((state) => state.hasRun);
  const theme = useProjectStore((state) => state.theme);
  const index = useDiagnosticIndex();
  const { screenToFlowPosition } = useReactFlow();

  const nodes: Node[] = useMemo(
    () => [
      {
        id: 'board',
        type: 'board',
        position: { x: 40, y: 24 },
        data: {},
        draggable: true,
      },
      ...instances.map((instance) => ({
        id: instance.id,
        type: 'component',
        position: instance.position,
        data: { slug: instance.definitionSlug, label: instance.label },
      })),
    ],
    [instances],
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
        } satisfies Edge;
      }),
    [connections, index],
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
      {/* 操作提示仅在校验前显示，避免遮挡结果面板 */}
      {!hasRun ? (
        <div className="canvas-hint">
          操作提示：从左栏拖入组件 → 从端口拖到开发板引脚连线 → 右上角「运行」校验
        </div>
      ) : null}
    </div>
  );
};

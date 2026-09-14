import { beforeEach, describe, expect, it } from 'vitest';
import {
  beginHistoryTransaction,
  endHistoryTransaction,
  resetHistory,
  useProjectStore,
} from '../useProjectStore';

const state = () => useProjectStore.getState();

const reset = () => {
  useProjectStore.setState({
    instances: [],
    connections: [],
    historyPast: [],
    historyFuture: [],
    localResult: null,
    serverResult: null,
    hasRun: false,
    running: false,
    toast: null,
    selectedInstanceId: null,
    selectedConnectionId: null,
    options: { wifiEnabled: false, mode: 'loose', backendOffline: false },
  });
  // 上面的 setState 属于「内容变化」，会被历史订阅记为一条 —— 测试内清空它
  resetHistory();
};

describe('撤销 / 重做（FR-15）', () => {
  beforeEach(reset);

  it('放置组件后撤销 → 组件消失；重做 → 恢复', () => {
    state().addInstance('led', { x: 0, y: 0 });
    expect(state().instances).toHaveLength(1);
    expect(state().historyPast).toHaveLength(1);

    state().undo();
    expect(state().instances).toHaveLength(0);
    expect(state().historyFuture).toHaveLength(1);

    state().redo();
    expect(state().instances).toHaveLength(1);
    expect(state().historyFuture).toHaveLength(0);
  });

  it('删除组件会同时移除其连线；撤销后组件与连线都恢复', () => {
    state().loadSampleProject();
    const connectionsBefore = state().connections.length;
    expect(connectionsBefore).toBeGreaterThan(0);

    state().removeInstance('t1-dht11');
    expect(state().instances.some((item) => item.id === 't1-dht11')).toBe(false);
    expect(state().connections.length).toBeLessThan(connectionsBefore);

    state().undo();
    expect(state().instances.some((item) => item.id === 't1-dht11')).toBe(true);
    expect(state().connections).toHaveLength(connectionsBefore);
  });

  it('连线启用开关可撤销', () => {
    state().loadSampleProject();
    const target = state().connections[0].id;

    state().toggleConnectionEnabled(target);
    expect(state().connections.find((conn) => conn.id === target)?.enabled).toBe(false);

    state().undo();
    expect(state().connections.find((conn) => conn.id === target)?.enabled).toBe(true);
  });

  it('端口配置修改可撤销', () => {
    state().loadSampleProject();
    state().setPortConfig('t1-oled', 'address', '0x3D');
    expect(state().instances.find((item) => item.id === 't1-oled')?.portConfig.address).toBe('0x3D');

    state().undo();
    expect(state().instances.find((item) => item.id === 't1-oled')?.portConfig.address).toBe('0x3C');
  });

  it('拖动（事务）期间的多次位置更新只记为一步', () => {
    state().addInstance('led', { x: 0, y: 0 });
    const id = state().instances[0].id;
    const depthBefore = state().historyPast.length;

    beginHistoryTransaction();
    state().moveInstance(id, { x: 10, y: 0 });
    state().moveInstance(id, { x: 20, y: 0 });
    state().moveInstance(id, { x: 30, y: 0 });
    endHistoryTransaction();

    expect(state().historyPast).toHaveLength(depthBefore + 1);
    expect(state().instances[0].position).toEqual({ x: 30, y: 0 });

    state().undo();
    expect(state().instances[0].position).toEqual({ x: 0, y: 0 });
  });

  it('事务中未发生实际变化时不记录历史', () => {
    state().addInstance('led', { x: 0, y: 0 });
    const depthBefore = state().historyPast.length;
    beginHistoryTransaction();
    endHistoryTransaction();
    expect(state().historyPast).toHaveLength(depthBefore);
  });

  it('历史上限 30 步：超出后丢弃最旧记录', () => {
    for (let i = 0; i < 35; i += 1) state().addInstance('led', { x: i, y: 0 });
    expect(state().historyPast).toHaveLength(30);

    for (let i = 0; i < 30; i += 1) state().undo();
    expect(state().historyPast).toHaveLength(0);
    // 最早的 5 次操作已超出上限，无法再撤销
    expect(state().instances).toHaveLength(5);
  });

  it('撤销后执行新操作会清空重做栈', () => {
    state().addInstance('led', { x: 0, y: 0 });
    state().undo();
    expect(state().historyFuture).toHaveLength(1);

    state().addInstance('resistor', { x: 0, y: 0 });
    expect(state().historyFuture).toHaveLength(0);
    expect(state().instances[0].definitionSlug).toBe('resistor');
  });

  it('撤销会清空选中项并把校验标记为过期', () => {
    state().loadSampleProject();
    state().addInstance('led', { x: 0, y: 0 });
    const lastId = state().instances[state().instances.length - 1].id;
    state().selectInstance(lastId);
    useProjectStore.setState({ hasRun: true });

    state().undo();
    expect(state().selectedInstanceId).toBeNull();
    expect(state().hasRun).toBe(false);
  });

  it('无历史时撤销/重做为无操作（不抛异常）', () => {
    expect(() => {
      state().undo();
      state().redo();
    }).not.toThrow();
    expect(state().instances).toHaveLength(0);
  });

  it('resetHistory 清空两个栈（切换文档语义）', () => {
    state().addInstance('led', { x: 0, y: 0 });
    state().undo();
    expect(state().historyFuture).toHaveLength(1);

    resetHistory();
    expect(state().historyPast).toHaveLength(0);
    expect(state().historyFuture).toHaveLength(0);
  });

  it('清空画布可一键撤销恢复', () => {
    state().loadSampleProject();
    const instancesBefore = state().instances.length;
    const connectionsBefore = state().connections.length;

    state().clearProject();
    expect(state().instances).toHaveLength(0);

    state().undo();
    expect(state().instances).toHaveLength(instancesBefore);
    expect(state().connections).toHaveLength(connectionsBefore);
  });
});

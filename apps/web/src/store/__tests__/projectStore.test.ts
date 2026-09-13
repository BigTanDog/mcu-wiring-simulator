// @vitest-environment jsdom
/**
 * 项目流程集成测试（store 层，真实调用路径）
 *
 * 覆盖：示例项目端到端校验、离线降级、连线约束、导出导入往返一致性（AC-07）、级联删除。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { setSimulatedOffline } from '../../api/mockApi';
import { combineActiveResult, useProjectStore } from '../useProjectStore';

const activeResult = () => {
  const state = useProjectStore.getState();
  return combineActiveResult(state.serverResult, state.localResult);
};

const reset = () => {
  // mock 数据源的离线开关是模块级状态，测试间必须重置，
  // 否则前一个用例打开"模拟后端离线"会让后续用例全部拿到"后端不可用"
  setSimulatedOffline(false);
  useProjectStore.setState({
    instances: [],
    connections: [],
    localResult: null,
    serverResult: null,
    hasRun: false,
    running: false,
    toast: null,
    options: { wifiEnabled: false, mode: 'loose', backendOffline: false },
  });
};

describe('项目流程（store 集成）', () => {
  beforeEach(reset);

  it('载入示例项目 → 运行校验：后端权威结果全绿通过', async () => {
    useProjectStore.getState().loadSampleProject();
    expect(useProjectStore.getState().instances).toHaveLength(2);
    expect(useProjectStore.getState().connections).toHaveLength(7);

    await useProjectStore.getState().runValidation();

    const result = activeResult();
    expect(result?.status).toBe('passed');
    expect(result?.diagnostics).toHaveLength(0);
    expect(result?.source).toBe('server');
  });

  it('取消 OLED 上拉：出现 R-12 警告，状态为 warning', async () => {
    useProjectStore.getState().loadSampleProject();
    useProjectStore.getState().setPortConfig('c-oled', 'pullup', false);

    await useProjectStore.getState().runValidation();

    const result = activeResult();
    expect(result?.status).toBe('warning');
    expect(result?.diagnostics.map((item) => item.code)).toContain('R-12');
  });

  it('模拟后端离线：降级为本地结果并标记 offline（含规则集版本）', async () => {
    useProjectStore.getState().loadSampleProject();
    useProjectStore.getState().setOptions({ backendOffline: true });

    await useProjectStore.getState().runValidation();

    const result = activeResult();
    expect(result?.source).toBe('local');
    expect(result?.offline).toBe(true);
    expect(result?.ruleSetVersion).toMatch(/^rules-/);
  });

  it('连线约束：端口不能直连端口，也不能自连；重复连线被拒绝', () => {
    useProjectStore.getState().addInstance('dht11', { x: 0, y: 0 });
    useProjectStore.getState().addInstance('ssd1306-i2c', { x: 0, y: 200 });
    const [dht, oled] = useProjectStore.getState().instances;

    // 组件端口之间直连 → 拒绝
    useProjectStore.getState().addConnection(
      { type: 'port', instanceId: dht.id, portId: 'DATA' },
      { type: 'port', instanceId: oled.id, portId: 'SDA' },
    );
    expect(useProjectStore.getState().connections).toHaveLength(0);
    expect(useProjectStore.getState().toast?.kind).toBe('warn');

    // 自连 → 拒绝
    useProjectStore.getState().addConnection(
      { type: 'port', instanceId: dht.id, portId: 'DATA' },
      { type: 'port', instanceId: dht.id, portId: 'DATA' },
    );
    expect(useProjectStore.getState().connections).toHaveLength(0);

    // 正常连线 → 成功，且类型被推导为 signal
    useProjectStore.getState().addConnection(
      { type: 'pin', pinId: 'pin-esp32-gpio4' },
      { type: 'port', instanceId: dht.id, portId: 'DATA' },
    );
    expect(useProjectStore.getState().connections).toHaveLength(1);
    expect(useProjectStore.getState().connections[0].kind).toBe('signal');

    // 重复连线 → 拒绝
    useProjectStore.getState().addConnection(
      { type: 'pin', pinId: 'pin-esp32-gpio4' },
      { type: 'port', instanceId: dht.id, portId: 'DATA' },
    );
    expect(useProjectStore.getState().connections).toHaveLength(1);
  });

  it('导出 → 清空 → 导入：往返一致（AC-07）', () => {
    useProjectStore.getState().loadSampleProject();
    const before = {
      instances: useProjectStore.getState().instances,
      connections: useProjectStore.getState().connections,
    };
    const json = useProjectStore.getState().exportJson();

    useProjectStore.getState().clearProject();
    expect(useProjectStore.getState().instances).toHaveLength(0);

    const ok = useProjectStore.getState().importJson(json);
    expect(ok).toBe(true);
    expect(useProjectStore.getState().instances).toEqual(before.instances);
    expect(useProjectStore.getState().connections).toEqual(before.connections);
  });

  it('导入非法 JSON：被拒绝并保留原画布内容', () => {
    useProjectStore.getState().loadSampleProject();
    const ok = useProjectStore.getState().importJson('{ not-json');
    expect(ok).toBe(false);
    expect(useProjectStore.getState().instances).toHaveLength(2);
    expect(useProjectStore.getState().toast?.kind).toBe('warn');
  });

  it('删除组件时级联删除其连线', () => {
    useProjectStore.getState().loadSampleProject();
    const before = useProjectStore.getState().connections.length;
    useProjectStore.getState().removeInstance('c-oled');
    const after = useProjectStore.getState().connections;
    expect(after.length).toBeLessThan(before);
    expect(
      after.some(
        (conn) => conn.from.type === 'port' && conn.from.instanceId === 'c-oled',
      ),
    ).toBe(false);
  });

  it('画布为空时运行校验：给出提示且不产生结果', async () => {
    await useProjectStore.getState().runValidation();
    expect(useProjectStore.getState().toast?.text).toContain('还没有组件');
    expect(activeResult()).toBeNull();
  });
});

describe('项目管理（M-01，mock 数据源）', () => {
  beforeEach(() => {
    reset();
    window.localStorage.clear();
    useProjectStore.setState({
      currentProjectId: null,
      currentRevision: 0,
      saveState: 'idle',
      projectList: [],
      projectPanelOpen: false,
    });
  });

  it('新建云端项目：绑定 id 并一并保存当前画布内容', async () => {
    useProjectStore.getState().loadSampleProject();
    await useProjectStore.getState().createProjectOnServer('测试项目 A');

    const state = useProjectStore.getState();
    const toastText = state.toast?.text ?? '';
    expect(state.currentProjectId, `createProjectOnServer 失败：${toastText}`).toBeTruthy();
    // create 时为 revision 1，随后把画布内容写入 → 变为 2
    expect(state.currentRevision).toBe(2);
    expect(state.saveState).toBe('saved');
    expect(state.projectName).toBe('测试项目 A');

    await useProjectStore.getState().refreshProjectList();
    const list = useProjectStore.getState().projectList;
    expect(list).toHaveLength(1);
    expect(list[0].componentCount).toBe(2);
    expect(list[0].connectionCount).toBe(7);
  });

  it('修改画布 → dirty；保存 → saved 且 revision 递增', async () => {
    useProjectStore.getState().loadSampleProject();
    await useProjectStore.getState().createProjectOnServer('测试项目 B');
    const before = useProjectStore.getState().currentRevision;

    useProjectStore.getState().addInstance('led', { x: 0, y: 0 });
    expect(useProjectStore.getState().saveState).toBe('dirty');

    await useProjectStore.getState().saveProjectToServer();
    expect(useProjectStore.getState().saveState).toBe('saved');
    expect(useProjectStore.getState().currentRevision).toBe(before + 1);
  });

  it('打开项目：还原实例与连线', async () => {
    useProjectStore.getState().loadSampleProject();
    await useProjectStore.getState().createProjectOnServer('测试项目 C');
    const id = useProjectStore.getState().currentProjectId;
    expect(id).toBeTruthy();

    useProjectStore.getState().clearProject();
    expect(useProjectStore.getState().instances).toHaveLength(0);

    await useProjectStore.getState().openProjectById(id as string);
    expect(useProjectStore.getState().instances).toHaveLength(2);
    expect(useProjectStore.getState().connections).toHaveLength(7);
    expect(useProjectStore.getState().saveState).toBe('saved');
  });

  it('删除项目：解绑并从列表移除', async () => {
    useProjectStore.getState().loadSampleProject();
    await useProjectStore.getState().createProjectOnServer('测试项目 D');
    const id = useProjectStore.getState().currentProjectId as string;

    await useProjectStore.getState().deleteProjectById(id);
    expect(useProjectStore.getState().currentProjectId).toBeNull();

    await useProjectStore.getState().refreshProjectList();
    expect(useProjectStore.getState().projectList.find((item) => item.id === id)).toBeUndefined();
  });

  it('未绑定云端项目时保存：给出提示且不进入 saving', async () => {
    useProjectStore.getState().loadSampleProject();
    await useProjectStore.getState().saveProjectToServer();
    expect(useProjectStore.getState().toast?.kind).toBe('warn');
    expect(useProjectStore.getState().saveState).toBe('idle');
  });

  it('revision 不匹配 → conflict；强制保存可覆盖成功', async () => {
    useProjectStore.getState().loadSampleProject();
    await useProjectStore.getState().createProjectOnServer('测试项目 E');
    const id = useProjectStore.getState().currentProjectId as string;

    // 模拟"别处更新"：直接用 API 再存一次，使云端 revision 前进
    const { apiClient } = await import('../../api/client');
    await apiClient.saveProject(id, useProjectStore.getState().currentRevision, {
      name: '别处改名',
    });

    useProjectStore.setState({ saveState: 'dirty' });
    await useProjectStore.getState().saveProjectToServer();
    expect(useProjectStore.getState().saveState).toBe('conflict');

    await useProjectStore.getState().saveProjectToServer({ force: true });
    expect(useProjectStore.getState().saveState).toBe('saved');
  });
});

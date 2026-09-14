import { beforeEach, describe, expect, it } from 'vitest';
import { resetHistory, useProjectStore } from '../useProjectStore';

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
  resetHistory();
};

describe('器件直连（Q-T2 决策：允许端口 ↔ 端口）', () => {
  beforeEach(reset);

  it('允许组件端口之间直接连线（电机 → 驱动模块输出）', () => {
    state().addInstance('l298n', { x: 0, y: 0 });
    state().addInstance('dc-motor', { x: 220, y: 0 });
    const driver = state().instances.find((item) => item.definitionSlug === 'l298n');
    const motor = state().instances.find((item) => item.definitionSlug === 'dc-motor');
    expect(driver).toBeTruthy();
    expect(motor).toBeTruthy();

    state().addConnection(
      { type: 'port', instanceId: driver!.id, portId: 'OUT1' },
      { type: 'port', instanceId: motor!.id, portId: '+' },
    );

    expect(state().connections).toHaveLength(1);
    expect(state().toast?.kind).not.toBe('warn');
  });

  it('独立电源模块可直接给外设供电（端口 ↔ 端口）', () => {
    state().addInstance('power-3v3', { x: 0, y: 0 });
    state().addInstance('dht11', { x: 220, y: 0 });
    const power = state().instances[0];
    const sensor = state().instances[1];

    state().addConnection(
      { type: 'port', instanceId: power.id, portId: 'OUT' },
      { type: 'port', instanceId: sensor.id, portId: 'VCC' },
    );

    expect(state().connections).toHaveLength(1);
  });

  it('仍然禁止「引脚 ↔ 引脚」直接连线', () => {
    state().addConnection(
      { type: 'pin', pinId: 'pin-esp32-gpio4' },
      { type: 'pin', pinId: 'pin-esp32-gpio5' },
    );
    expect(state().connections).toHaveLength(0);
    expect(state().toast?.kind).toBe('warn');
  });

  it('器件直连同样进历史记录（可撤销）', () => {
    state().addInstance('power-3v3', { x: 0, y: 0 });
    state().addInstance('dht11', { x: 220, y: 0 });
    const power = state().instances[0];
    const sensor = state().instances[1];
    state().addConnection(
      { type: 'port', instanceId: power.id, portId: 'OUT' },
      { type: 'port', instanceId: sensor.id, portId: 'VCC' },
    );
    expect(state().connections).toHaveLength(1);

    state().undo();
    expect(state().connections).toHaveLength(0);
  });
});

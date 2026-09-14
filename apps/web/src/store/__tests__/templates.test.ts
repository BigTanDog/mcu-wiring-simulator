import { beforeEach, describe, expect, it } from 'vitest';
import { COMPONENTS, ESP32_DEVKITC_V4 } from '@sim/definitions';
import { validateProject } from '@sim/rule-engine';
import { PROJECT_TEMPLATES } from '../../projectTemplates';
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
    toast: null,
    selectedInstanceId: null,
    selectedConnectionId: null,
  });
  resetHistory();
};

describe('示例项目模板', () => {
  beforeEach(reset);

  it('每个模板都必须通过校验（允许 warning，不允许 error）', () => {
    for (const template of PROJECT_TEMPLATES) {
      const result = validateProject({
        board: ESP32_DEVKITC_V4,
        instances: template.instances,
        connections: template.connections,
        defs: COMPONENTS,
        options: { wifiEnabled: template.options.wifiEnabled, mode: template.options.mode },
      });
      const errors = result.diagnostics.filter((item) => item.severity === 'error');
      expect(
        errors.map((item) => `${item.code}:${item.message}`),
        `模板「${template.name}」存在 error`,
      ).toEqual([]);
    }
  });

  it('跨模板的实例/连线 id 不重复（避免载入历史混淆）', () => {
    const templateIds = PROJECT_TEMPLATES.map((item) => item.id);
    expect(new Set(templateIds).size).toBe(templateIds.length);

    const instanceIds = PROJECT_TEMPLATES.flatMap((item) => item.instances.map((inst) => inst.id));
    expect(new Set(instanceIds).size).toBe(instanceIds.length);

    const connectionIds = PROJECT_TEMPLATES.flatMap((item) =>
      item.connections.map((conn) => conn.id),
    );
    expect(new Set(connectionIds).size).toBe(connectionIds.length);
  });

  it('载入模板：画布内容与模板一致，并且可以撤销', () => {
    const template = PROJECT_TEMPLATES[1];
    state().loadTemplate(template.id);

    expect(state().projectName).toBe(template.projectName);
    expect(state().instances).toHaveLength(template.instances.length);
    expect(state().connections).toHaveLength(template.connections.length);

    state().undo();
    expect(state().instances).toHaveLength(0);
  });

  it('载入模板做深拷贝：编辑画布不污染模板数据', () => {
    const template = PROJECT_TEMPLATES[0];
    const targetId = template.instances[0].id;
    const before = template.instances[0].portConfig.pullup;

    state().loadTemplate(template.id);
    state().setPortConfig(targetId, 'pullup', !before);

    expect(template.instances[0].portConfig.pullup).toBe(before);
  });

  it('未知模板 id：提示且不改变画布', () => {
    state().addInstance('led', { x: 0, y: 0 });
    state().loadTemplate('not-exist');
    expect(state().instances).toHaveLength(1);
    expect(state().toast?.kind).toBe('warn');
  });

  it('默认示例（loadSampleProject）等同于温湿度模板', () => {
    state().loadSampleProject();
    const defaultTemplate = PROJECT_TEMPLATES[0];
    expect(state().instances).toHaveLength(defaultTemplate.instances.length);
    expect(state().connections).toHaveLength(defaultTemplate.connections.length);
  });
});

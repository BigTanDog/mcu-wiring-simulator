// @vitest-environment jsdom
/**
 * UI 冒烟测试：验证三栏骨架、组件库、运行按钮与结果面板在真实 DOM 中可渲染。
 * 说明：这是 DOM 级验证（jsdom），不是真实浏览器驱动；真实浏览器交互验证需人工在预览页完成。
 */
import '../test/domPolyfills';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '../App';
import { useProjectStore } from '../store/useProjectStore';

afterEach(() => cleanup());

describe('App 界面骨架', () => {
  beforeEach(() => {
    useProjectStore.setState({
      instances: [],
      connections: [],
      localResult: null,
      serverResult: null,
      hasRun: false,
      running: false,
      toast: null,
    });
  });

  it('渲染顶部栏、组件库与运行按钮', () => {
    render(<App />);
    expect(screen.getByText('单片机接线仿真与校验平台')).toBeTruthy();
    expect(screen.getByText('组件库')).toBeTruthy();
    // 顶栏 chip 与组件库卡片都会显示开发板名称，故使用 getAllByText
    expect(screen.getAllByText('ESP32-DevKitC V4').length).toBeGreaterThan(0);
    expect(screen.getByText('▶ 运行')).toBeTruthy();
  });

  it('渲染开发板节点与引脚（含仅输入/Flash 保留引脚）', () => {
    render(<App />);
    expect(screen.getByText('ESP32-WROOM-32 · 逻辑电平 3V3')).toBeTruthy();
    // GPIO34 为仅输入引脚，应出现在开发板节点上
    expect(screen.getByTestId('pin-GPIO34')).toBeTruthy();
    expect(screen.getByTestId('pin-GPIO6')).toBeTruthy();
  });

  it('未校验时结果面板给出引导文案；控制面板提示需先连线', () => {
    render(<App />);
    expect(screen.getByText(/尚未校验/)).toBeTruthy();
    expect(screen.getByText(/放置组件并连线后/)).toBeTruthy();
  });

  it('回归（白屏缺陷）：载入示例并运行校验后页面不崩溃，结果面板显示通过', async () => {
    render(<App />);

    await act(async () => {
      useProjectStore.getState().loadSampleProject();
    });
    await act(async () => {
      await useProjectStore.getState().runValidation();
    });

    // 运行后面板必须仍可渲染（此前因 selector 返回新对象导致无限渲染 → 白屏）
    expect(screen.getByText('校验通过')).toBeTruthy();
    expect(screen.getByText(/后端权威校验/)).toBeTruthy();
    expect(screen.getByText('▶ 运行')).toBeTruthy();
  });
});

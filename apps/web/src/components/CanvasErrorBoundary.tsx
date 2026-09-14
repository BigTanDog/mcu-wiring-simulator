/**
 * 画布区错误边界。
 *
 * 背景：画布依赖 React Flow（内部含 d3-zoom 等），在极端时序下（容器卸载瞬间的
 * 残留事件、开发环境热重载）可能抛出 `getBoundingClientRect of null` 这类异常。
 * 这类异常来自第三方库而非业务逻辑，但会让整页白屏。
 *
 * 边界的作用：把异常限制在画布区内 —— 顶栏/侧栏仍可用，用户能导出 JSON 备份、
 * 一键重试渲染或刷新，不至于丢失工作内容。
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class CanvasErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 不静默吞掉：保留完整信息便于排查（E2E 冒烟会把 console.error 视为失败，因此只在真异常时出现）
    console.error('[CanvasErrorBoundary] 画布渲染异常：', error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="stage-fallback">
        <strong>画布渲染出现异常</strong>
        <span className="stage-fallback-msg">{error.message}</span>
        <div className="stage-fallback-actions">
          <button type="button" className="btn" onClick={() => this.setState({ error: null })}>
            重试渲染
          </button>
          <button type="button" className="btn" onClick={() => window.location.reload()}>
            刷新页面
          </button>
        </div>
        <span className="stage-fallback-hint">
          项目内容会自动保存在本地（以及服务端，若已绑定），刷新不会丢失。也可以先用顶栏「导出 JSON」备份。
        </span>
      </div>
    );
  }
}

/**
 * jsdom 缺失 API 的最小 polyfill（仅测试环境使用）
 * React Flow 在渲染时依赖 ResizeObserver / DOMMatrixReadOnly。
 */

class ResizeObserverPolyfill {
  observe(): void {
    /* 测试环境不需要真实尺寸观察 */
  }

  unobserve(): void {
    /* noop */
  }

  disconnect(): void {
    /* noop */
  }
}

class DOMMatrixReadOnlyPolyfill {
  m22 = 1;

  constructor(_transform?: string) {
    void _transform;
  }
}

if (!('ResizeObserver' in globalThis)) {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverPolyfill;
}

if (!('DOMMatrixReadOnly' in globalThis)) {
  (globalThis as unknown as { DOMMatrixReadOnly: unknown }).DOMMatrixReadOnly =
    DOMMatrixReadOnlyPolyfill;
}

if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

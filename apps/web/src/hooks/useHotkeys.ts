/**
 * 全局快捷键（对齐 docs/产品计划文档.md §6.6）：
 *  - Ctrl/Cmd + Z                     撤销
 *  - Ctrl/Cmd + Shift + Z 或 Ctrl + Y 重做
 *  - Ctrl/Cmd + Enter                 运行校验
 *  - Esc                              取消选中
 *
 * 输入框/可编辑区域内不拦截按键（让浏览器处理文本编辑的撤销）。
 * F（适配视图）在画布组件内处理 —— 它需要 React Flow 的 fitView 上下文。
 */
import { useEffect } from 'react';
import { useProjectStore } from '../store/useProjectStore';

export const useHotkeys = (): void => {
  const undo = useProjectStore((state) => state.undo);
  const redo = useProjectStore((state) => state.redo);
  const runValidation = useProjectStore((state) => state.runValidation);
  const selectInstance = useProjectStore((state) => state.selectInstance);
  const selectConnection = useProjectStore((state) => state.selectConnection);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const editing =
        !!target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (mod && key === 'z') {
        if (editing) return;
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }

      if (mod && key === 'y') {
        if (editing) return;
        event.preventDefault();
        redo();
        return;
      }

      if (mod && event.key === 'Enter') {
        event.preventDefault();
        void runValidation();
        return;
      }

      if (event.key === 'Escape') {
        selectInstance(null);
        selectConnection(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo, runValidation, selectInstance, selectConnection]);
};

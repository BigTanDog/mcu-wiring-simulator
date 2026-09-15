/**
 * 侧边栏收起态（窄条）：整条可点击展开，风格参考 IDE 的活动栏。
 *
 * 收起后画布能多出约 290px 宽度 —— 组件较多的大项目（如「综合实验项目」）
 * 能一眼看到更多内容。
 */
import { useProjectStore } from '../store/useProjectStore';

export const SidebarRail = () => {
  const toggleSidebar = useProjectStore((state) => state.toggleSidebar);
  const instanceCount = useProjectStore((state) => state.instances.length);

  return (
    <button
      type="button"
      className="sidebar-rail"
      onClick={toggleSidebar}
      title="展开组件库与检查器"
      aria-label="展开侧边栏"
      aria-expanded={false}
    >
      <span className="rail-icon">»</span>
      <span className="rail-text">组件库 · 检查器</span>
      {instanceCount > 0 ? <span className="rail-badge">{instanceCount}</span> : null}
    </button>
  );
};

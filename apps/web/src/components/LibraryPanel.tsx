/**
 * 左侧组件库：按分类展示可用组件，支持搜索、拖拽到画布（或双击放置）。
 * 数据来自 definitions（声明式），新增组件无需改动本组件代码。
 */
import { useMemo, useState } from 'react';
import { CATEGORY_LABELS, COMPONENTS, ESP32_DEVKITC_V4 } from '@sim/definitions';
import type { ComponentCategory } from '@sim/contracts';
import { useProjectStore } from '../store/useProjectStore';

export const LibraryPanel = () => {
  const addInstance = useProjectStore((state) => state.addInstance);
  const instances = useProjectStore((state) => state.instances);
  const collapsedGroups = useProjectStore((state) => state.collapsedGroups);
  const toggleGroup = useProjectStore((state) => state.toggleGroup);
  const [query, setQuery] = useState('');

  /** 搜索时强制展开所有分类 —— 否则会出现"搜到了组件却看不到" */
  const isCollapsed = (key: string): boolean => !query.trim() && collapsedGroups.includes(key);

  const groupTitle = (key: string, label: string, count?: number) => (
    <button
      type="button"
      className="lib-group-title"
      onClick={() => toggleGroup(key)}
      aria-expanded={!isCollapsed(key)}
      title={isCollapsed(key) ? '展开该分类' : '收起该分类'}
    >
      <span className={`lib-caret${isCollapsed(key) ? ' lib-caret-collapsed' : ''}`}>▾</span>
      <span>{label}</span>
      {typeof count === 'number' ? <span className="lib-group-count">{count}</span> : null}
    </button>
  );

  const grouped = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const filtered = COMPONENTS.filter(
      (def) =>
        !keyword ||
        def.displayName.toLowerCase().includes(keyword) ||
        def.slug.toLowerCase().includes(keyword) ||
        def.description.toLowerCase().includes(keyword),
    );
    // 按 CATEGORY_LABELS 的键顺序分组，保证菜单顺序稳定（与定义注册顺序无关）
    return (Object.keys(CATEGORY_LABELS) as ComponentCategory[])
      .map((category) => [category, filtered.filter((def) => def.category === category)] as const)
      .filter(([, items]) => items.length > 0);
  }, [query]);

  const onDragStart = (event: React.DragEvent<HTMLDivElement>, slug: string) => {
    event.dataTransfer.setData('application/sim-component', slug);
    event.dataTransfer.effectAllowed = 'move';
  };

  const place = (slug: string) => {
    const offset = instances.length * 40;
    addInstance(slug, { x: 520 + (offset % 160), y: 140 + offset });
  };

  return (
    <section className="panel">
      <h2 className="panel-title">组件库</h2>
      <input
        className="search-input"
        placeholder="搜索组件（如 OLED / DHT）"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className="lib-group">
        {groupTitle('mcu', '主控芯片', 1)}
        {!isCollapsed('mcu') ? (
          <div className="lib-card lib-card-static" title="开发板已默认放置在画布中">
            <span className="lib-icon">MCU</span>
            <span className="lib-main">
              <span className="lib-name">{ESP32_DEVKITC_V4.displayName}</span>
              <span className="lib-desc">
                {ESP32_DEVKITC_V4.pins.length} 引脚 · 引脚定义与真实开发板一致
              </span>
            </span>
            <span className="lib-tag">已放置</span>
          </div>
        ) : null}
      </div>

      {grouped.map(([category, items]) => (
        <div className="lib-group" key={category}>
          {groupTitle(category, CATEGORY_LABELS[category], items.length)}
          {!isCollapsed(category)
            ? items.map((def) => (
                <div
                  className="lib-card"
                  key={def.slug}
                  draggable
                  onDragStart={(event) => onDragStart(event, def.slug)}
                  onDoubleClick={() => place(def.slug)}
                  title="拖拽到画布放置（或双击快速放置）"
                >
                  <span className="lib-icon">{def.icon}</span>
                  <span className="lib-main">
                    <span className="lib-name">{def.displayName}</span>
                    <span className="lib-desc">{def.description}</span>
                  </span>
                  <span className="lib-tag">{def.ports.length} 端口</span>
                </div>
              ))
            : null}
        </div>
      ))}

      {grouped.length === 0 ? <p className="lib-empty">没有匹配的组件</p> : null}
      <p className="lib-hint">
        当前组件库：ESP32 主控 + DHT11 / HC-SR04 传感器 + OLED 显示 + LED / 蜂鸣器 / 舵机执行器 +
        USB-TTL 通信模块 + 按键 / 电阻基础元件（其余组件按产品文档迭代加入）。
      </p>
    </section>
  );
};

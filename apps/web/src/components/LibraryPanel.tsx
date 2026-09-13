/**
 * 左侧组件库：按分类展示可用组件，支持搜索、拖拽到画布（或双击放置）。
 * 数据来自 definitions（声明式），新增组件无需改动本组件代码。
 */
import { useMemo, useState } from 'react';
import { CATEGORY_LABELS, COMPONENTS } from '../definitions/components';
import { ESP32_DEVKITC_V4 } from '../definitions/esp32';
import type { ComponentCategory } from '../definitions/types';
import { useProjectStore } from '../store/useProjectStore';

export const LibraryPanel = () => {
  const addInstance = useProjectStore((state) => state.addInstance);
  const instances = useProjectStore((state) => state.instances);
  const [query, setQuery] = useState('');

  const grouped = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const filtered = COMPONENTS.filter(
      (def) =>
        !keyword ||
        def.displayName.toLowerCase().includes(keyword) ||
        def.slug.toLowerCase().includes(keyword) ||
        def.description.toLowerCase().includes(keyword),
    );
    const map = new Map<ComponentCategory, typeof COMPONENTS>();
    for (const def of filtered) {
      const list = map.get(def.category) ?? [];
      list.push(def);
      map.set(def.category, list);
    }
    return [...map.entries()];
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
        <div className="lib-group-title">主控芯片</div>
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
      </div>

      {grouped.map(([category, items]) => (
        <div className="lib-group" key={category}>
          <div className="lib-group-title">{CATEGORY_LABELS[category]}</div>
          {items.map((def) => (
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
          ))}
        </div>
      ))}

      {grouped.length === 0 ? <p className="lib-empty">没有匹配的组件</p> : null}
      <p className="lib-hint">
        Demo 组件库：ESP32 主控 + DHT11 传感器 + SSD1306 OLED 显示模块（其余组件按产品文档迭代加入）。
      </p>
    </section>
  );
};

/**
 * 快捷键与操作技巧面板（顶栏「⌨ 快捷键」入口；Esc 或点击遮罩关闭）。
 * 这里列出的都必须是**实际生效**的快捷键 —— 新增/调整快捷键时同步本文件。
 */
import { useProjectStore } from '../store/useProjectStore';

interface ShortcutRow {
  keys: string[];
  desc: string;
}

interface ShortcutGroup {
  title: string;
  rows: ShortcutRow[];
}

const GROUPS: ShortcutGroup[] = [
  {
    title: '编辑',
    rows: [
      { keys: ['Ctrl/Cmd', 'Z'], desc: '撤销上一步（最多 30 步，拖动也只算一步）' },
      { keys: ['Ctrl/Cmd', 'Shift', 'Z'], desc: '重做（Ctrl + Y 同样有效）' },
      { keys: ['Backspace', 'Delete'], desc: '删除选中的组件或连线（先单击选中，选中会有蓝色描边）' },
      { keys: ['Esc'], desc: '取消选中 / 关闭打开的弹窗' },
    ],
  },
  {
    title: '运行与视图',
    rows: [
      { keys: ['Ctrl/Cmd', 'Enter'], desc: '运行校验' },
      { keys: ['F'], desc: '适配视图（缩放到全部内容可见）' },
      { keys: ['滚轮'], desc: '缩放画布（以指针位置为锚点）' },
      { keys: ['拖拽空白处'], desc: '平移画布' },
    ],
  },
  {
    title: '操作技巧',
    rows: [
      { keys: ['双击组件卡片'], desc: '快速放置到画布（也可以直接拖拽）' },
      { keys: ['单击节点 / 连线'], desc: '选中；左栏控制面板会聚焦到该组件' },
      { keys: ['从端口拖到引脚'], desc: '创建连线（仅允许「组件端口 ↔ 开发板引脚」）' },
      { keys: ['悬停诊断条目'], desc: '在结果面板查看该规则的原理与正确做法' },
      { keys: ['点击诊断里的标签'], desc: '在画布中定位并高亮对应的组件 / 引脚 / 连线' },
    ],
  },
];

export const ShortcutsPanel = () => {
  const open = useProjectStore((state) => state.shortcutsOpen);
  const setOpen = useProjectStore((state) => state.setShortcutsOpen);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={() => setOpen(false)}>
      <div
        className="project-modal shortcuts-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="快捷键说明"
      >
        <div className="modal-head">
          <h2 className="modal-title">快捷键与操作技巧</h2>
          <button type="button" className="btn" onClick={() => setOpen(false)}>
            关闭
          </button>
        </div>

        {GROUPS.map((group) => (
          <section className="shortcut-group" key={group.title}>
            <h3 className="shortcut-group-title">{group.title}</h3>
            <ul className="shortcut-list">
              {group.rows.map((row) => (
                <li className="shortcut-row" key={row.desc}>
                  <span className="shortcut-keys">
                    {row.keys.map((key) => (
                      <kbd key={key}>{key}</kbd>
                    ))}
                  </span>
                  <span className="shortcut-desc">{row.desc}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <p className="shortcut-note">
          提示：Mac 上把 Ctrl 换成 Cmd；在输入框内不拦截快捷键（编辑项目名时 Ctrl+Z 仍是文本撤销）。
        </p>
      </div>
    </div>
  );
};

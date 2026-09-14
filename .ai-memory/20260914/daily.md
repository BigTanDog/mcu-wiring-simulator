# 2026-09-14 · 会话记录

## [00:5x] 动作: 规则说明「为什么」+ 组件库分类折叠（提交 45615d8，已推送）

- 需求来源：用户反馈（① 组件库分类做可折叠；② 结果面板诊断后加"为什么"，鼠标悬停即显示）
- 规则说明：`packages/rule-engine/src/ruleDocs.ts`（19 条：title/why/howTo，与规则实现同源）；`ValidationPanel` 固定高度说明区（悬停 `diag-head` 显示，未悬停显示引导文案）；rule-engine +2 例（每条规则必须有说明、无孤儿文案、title 与 meta.name 一致）
- 组件库折叠：`LibraryPanel` 分类标题改按钮（caret + 数量徽章）；store 加 `collapsedGroups` + `toggleGroup`（persist）；搜索时强制展开
- 渲染问题排查（重要经验）：
  1. 浮层方案失败——绝对定位浮在结果面板上方的说明条，DOM/样式均正常但**被画布 react-flow pane 覆盖**（`document.elementFromPoint` 返回 pane + 元素单独截图显示画布内容，两证据定性）
  2. 内联展开方案失败——展开推挤列表导致 hover 抖动（playwright `element is not stable` 超时 30s）
  3. **最终方案**：结果面板内固定高度区块（108px）→ 布局恒定，零抖动零遮挡；结果面板同时显式 `z-index: 20`
- 其他修复：`useProjectStore.ts` 曾被截断（`window.__SIM_STORE__` 处语法错误）→ 补全；R-10 文案替换曾未生效 → 重做并核对 19 条 title 与 meta.name 全一致
- 验证：89 例全绿（rule-engine 41 / api 15 / web 33）、冒烟 25 项（+4）、typecheck 0 error、构建成功
- 推送：**GitHub 恢复，积压提交全部推送成功**（`04206af..45615d8`）
- 阻塞：无

## [01:1x] 动作: 快捷键面板 + 删除失效修复（提交 984ef7f，已推送）

- 需求：① 顶栏加快捷键说明；② Esc 好像没反应；③ 删除改到 Backspace
- 根因（②③ 同源，真缺陷）：受控 `nodes`/`edges` 没有写回 `selected` → React Flow 的 `deleteKeyCode` 认为"无选中元素"，所以 Backspace/Delete 无效；Esc 本身有效（取消选中）但用户未选中任何元素时看不出效果
- 修复：`nodes` 写回 `selected: instance.id === selectedInstanceId`、`edges` 同理；补选中态样式（`.react-flow__node.selected .board-node` outline + `.react-flow__edge.selected .react-flow__edge-path` 加粗）；Esc 改为逐层退出（关快捷键面板 → 关项目面板 → 取消选中）
- 新增：`ShortcutsPanel.tsx`（顶栏「⌨ 快捷键」，三组快捷键与操作技巧，Esc/遮罩关闭）+ store `shortcutsOpen`
- 验证：冒烟 31 项全绿（新增 6 项：面板内容、Esc 关面板、选中反馈 selected=1、Backspace 删除 3→2、撤销恢复、Esc 取消选中）；89 例单测；typecheck 0 error；构建成功
- 文档：README（核心能力 + 测试表）、TDD §7.4/§18 同步；MEMORY.md 新增「React Flow 受控模式约定」

## [01:4x] 动作: 产出 AI 编程流程文档（本地留存，提交 78d3459）

- 需求：把「最初对话 → 正式开发」的全过程总结为可复用的 AI 编程流程文档，**不推送**、放工作空间根目录
- 文件：`AI编程流程文档.md`（314 行 / 20.6 KB）；已加入 `.gitignore`（`/AI编程流程文档.md`）确保不进远程，`git check-ignore` 校验通过
- 结构：结论先行 → 全景时间线（8 阶段 / 25 提交）→ 逐阶段拆解（7 节）→ 可复用流程模型（六阶段门禁表 / 文档三件套 / 证据优先）→ 人机分工边界 → 8 条踩坑→规则化沉淀 → 产出度量 → 可复制 Checklist → 适用边界 → 提交时间线附录
- 数据来源：`git log --reverse` 时间线、源码/文档行数统计（77 文件 8511 行 / 4226 行文档 / 89 例测试 / 31 项冒烟）
- 注意：本轮推送因网络抖动失败（仅 .gitignore 一条改动待推送，不影响文档本地留存）

## [02:0x] 动作: 器件直连（Q-T2）+ 画布错误边界（提交 3701c62）

- 决策：放开「组件端口 ↔ 组件端口」直连（电机→驱动模块输出、外设→独立电源模块），仍禁止「引脚 ↔ 引脚」
- 引擎：contracts 加 `power-source`；nets.ts 加 `netHasBoardPower/netHasIndependentPower/netHasPowerSource`；R-06 识别独立电源、R-15 区分板载/独立供电
- 语义修正：dc-motor 端口 role `power → passive`（无源负载）；R-22 拦 power+passive；R-15 同口径
- 组件：3.3V 电源模块（14 个组件）
- 健壮性：`CanvasErrorBoundary`（第三方库异常不再白屏）+ 诊断定位前校验目标存在（对已卸载节点 fitView 会抛 `getBoundingClientRect of null` —— 预览 WebView 报的就是这类）
- **环境坑（重要）**：改 packages 后必须 `build:packages` + 重启 api + 重启 web（或清 `.vite`）；本次因后端进程持旧模块，冒烟一度报出旧的 R-06 文案，靠文案比对定位
- 验证：103 例全绿（51/15/37）、冒烟 33 项（含真实拖拽创建直连）、typecheck 0 error、构建成功、后端 14 组件/20 规则
- 预览：按要求用 IDE 内置浏览器打开

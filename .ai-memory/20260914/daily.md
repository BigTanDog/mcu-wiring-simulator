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

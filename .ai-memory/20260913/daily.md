session-id: 20260913-1704

# 2026-09-13

## [17:04] 动作: 输出产品计划文档（PRD + 技术方案初稿）

- 文件：`docs/产品计划文档.md`（951 行，17 章 + 附录）
- 决策：前后端分离；前端 React + TS + React Flow；后端 NestJS + Prisma（生产 PostgreSQL / 本地 SQLite）；契约 Zod + OpenAPI `/api/v1`；校验引擎放共享包 `packages/rule-engine` 双端复用；MVP 不做账号体系（匿名项目 + 导出 JSON）
- 决策：ESP32 引脚以 ESP32-DevKitC V4 / WROOM-32 为基线；20 条规则 R-01~R-20；组件约束走声明式 `requirements[]`
- 验证：Markdown 占位符扫描 0 命中（无 TODO/待补充/SECTION-BREAK 残留）；文件行数与体积核对（951 行 / 89599 字节）
- 提交：`97b3793 docs(FR-01~FR-16): 新增产品计划文档（PRD + 技术方案初稿）`
- 未完成：无代码产出（按用户要求）；UV-01~UV-07 待 M0/M1/M2 实测；A-01/A-02/A-05 待产品方确认
- 阻塞：无

## [17:04] 动作: 项目初始化

- 文件：`AGENTS.md`、`.git/`
- 决策：Git 仓库默认分支 `master`；约定「每次改动必须 commit + 每次改动必须写/更新测试且交付前全通过」
- 验证：`git init` 输出与 `git log` 核对
- 提交：`9ee5f5d chore: 新增 AGENTS.md 开发约定文档`

## [18:11] 动作: 实现前端 Demo（apps/web）

- 文件：`apps/web/**`（28 个文件；definitions / rules / store / components / api / test）
- 决策：Demo 采用纯前端 + mock 数据层（接口签名对齐 REST 草案，后续替换实现即可接真实后端）；连线仅允许「组件端口 ↔ 开发板引脚」；电源/地引脚允许多器件共享；组件约束声明式化（`requirements[]` + `portOptions.satisfies`）；组件库先给 DHT11 + SSD1306 两个经典外设
- 决策：规则集版本 `rules-2026.09.13-demo.1`，实现 14 条规则；Demo 未实现的 6 条（R-02/04/09/15/19/20）依赖尚未引入的组件类型
- 验证：`npm test` 33 passed（引擎 22 / store 8 / UI 冒烟 3）；`npx tsc --noEmit` 0 error；`npm run build` 成功（210 modules，gzip 121.52 kB）；dev server 已启动于 http://127.0.0.1:5180
- 未完成：真实浏览器交互未做自动化驱动（无 chrome-devtools MCP）；性能基准（帧率 / validate P95）未测
- 提交：`f51149d feat(FR-01~FR-16): 新增前端 Demo（画布/组件库/控制面板/校验引擎/结果面板）`
- 阻塞：无

## [18:2x] 动作: 修复点击运行后白屏（Bug）

- 现象：预览页点击「运行」后整页空白；webview 上报 `The result of getSnapshot should be cached to avoid an infinite loop` 与 `Maximum update depth exceeded`（栈指向 CanvasArea / React Flow StoreUpdater / MarkerDefinitions）
- 根因（已确认）：zustand v5 直接使用 React 原生 `useSyncExternalStore`，getSnapshot 必须返回稳定引用；原 `selectActiveResult` 在「localResult 已写入、serverResult 未返回」的中间态返回 `{ ...localResult, offline: true }` 新对象 → React 判定快照持续变化 → 强制重渲染循环 → 崩溃
- 修复：拆为纯函数 `combineActiveResult(serverResult, localResult)` + 用 `useMemo` 缓存引用的 `useActiveResult()` hook；`useDiagnostics` / `ValidationPanel` 改用该 hook
- 约定（新增，写入长期记忆）：禁止在 zustand selector 内构造对象/数组，凡派生新对象必须在 hook 内用 useMemo 缓存
- 验证：新增回归测试 `src/store/__tests__/activeResult.test.tsx`（同 state 多次渲染返回同一引用等 3 例）；全量 37 passed；`tsc --noEmit` OK；`vite build` 成功；dev server HTTP 200
- 未完成：真实浏览器点击验证仍需人工在预览页确认（无浏览器自动化 MCP）
- 提交：`fix(FR-09,FR-10): 修复点击运行后白屏`（见 git log）

## [18:4x] 动作: 打通真实浏览器验证能力（E2E 冒烟）

- 文件：`apps/web/scripts/smoke.mjs`、`apps/web/package.json`（`npm run smoke`）、`index.html`（补 favicon 消除 404）、`tsconfig.json`（types: vite/client）、`store`（dev-only 暴露 window.__SIM_STORE__）
- 决策：用 `playwright-core` + 系统 Chrome（`channel: 'chrome'`）做真实浏览器验证，避免下载 Chromium；替代方案（Chrome DevTools MCP 需用户配置 MCP server；agent-browser 需下载 ~500MB）记录在长期记忆
- 验证（真实 Chrome，headless）：10/10 通过、0 控制台错误、0 HTTP 4xx/5xx；覆盖首屏 38 引脚渲染、示例 7 条连线、运行后不白屏且"校验通过"、错误接线 R-08 诊断、点击诊断定位（GPIO34 高亮）、离线降级标注；截图 6 张存 `.smoke/`
- 验证：`npm test` 37 passed；`tsc --noEmit` OK；`vite build` OK
- 提交：`a694637 test(FR-09): 新增真实浏览器 E2E 冒烟脚本`

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

## [19:0x] 动作: 产出技术设计文档（TDD）

- 文件：`docs/技术设计文档.md`（906 行 / 71 KB，17 章 + 附录 A–F）
- 决策：以 Demo 实测修正 PRD 推测部分；固化 13 条已验证技术决策 D-01~D-13（含 D-09 zustand selector 引用稳定性白屏坑、D-02 ConnectionMode.Loose、D-03 Handle 编码、D-06 电源/地共享语义、D-10 声明式组件约束）
- 决策：给出 GAP 清单（G-01~G-07）与偏差处理建议（如 R-02/R-04 建议合并进 R-06/R-07/R-03，规则总数改为 18 条并回改 PRD）
- 决策：迁移方案采用"复制 → 双跑比对 → 删除"三段式，W1 验收标准为"零行为变化（诊断输出逐字节一致）"
- 验证：占位符扫描 0 命中；行数/字节核对（906 行 / 71452 字节）；关键结论标注来源（文件:行 / PRD 章节 / 实测）
- 提交：`ee1f293 docs(W1-W7): 新增技术设计文档（TDD，含现状基线/架构/规范/契约/Wave 计划）`
- 未完成：W1 起的具体代码改造尚未开始（文档明确 W1 为后续前置）
- 阻塞：无

## [22:1x] 动作: 实现 MVP（W1–W6：monorepo + 后端 + 前后端联通）

- 文件：`packages/{contracts,definitions,rule-engine}`、`apps/api/**`（NestJS + Prisma）、`apps/web/src/api/**`、`apps/web/src/hooks/useBackendStatus.ts`、`docs/技术设计文档.md §18`
- 决策：用 **npm workspaces** 替代 pnpm（规模小、零额外安装，缓存/全局目录已在 D 盘）；前端用 vite alias 直连 packages 源码（HMR），后端消费 dist；`VITE_API_MODE=http|mock` 切换数据源（测试固定 mock）
- 决策：组件从 2 个扩到 5 个（+LED/按键/电阻，电阻用 `passive` 端口角色）；规则从 14 条扩到 16 条（+R-19 LED 限流电阻、R-09 仅输入引脚无内部上拉）；R-12 支持"线上挂真实电阻"判定
- 踩坑（已修复并写入技术文档 E-14~E-18）：
  1. SQLite `file:./dev.db` 在 CLI（相对 schema 目录）与运行时（相对进程目录）基准不一致 → PrismaService 统一解析为绝对路径
  2. **tsx/esbuild 不支持 emitDecoratorMetadata** → NestJS DI 失效（所有访问 this 的接口 500）→ dev 改用 ts-node，测试用 SWC
  3. 实例/连线库内主键直接用前端局部 id（`c-led`）→ 跨项目主键冲突 → 改为 `scopedId/localIdOf`
  4. 测试与 dev 共用 SQLite → `database is locked` → 测试独立 `prisma/test.db` + 每次清表
- 验证：59 例测试全绿（rule-engine 30 / api 14 / web 15）；typecheck 5 个包 0 error；全量构建成功；真实浏览器冒烟 12 项通过且"后端权威校验 · 规则集 rules-112849b"与后端 /version 一致；seed 幂等（6 → 0）
- 环境：无需额外安装；npm 缓存 `D:\nodejs\node_cache`、全局目录 `D:\nodejs\node_global`（均在 D 盘）；依赖与 SQLite 数据均在项目内（D 盘）
- 未完成（技术文档 §18.4 登记）：M-01 前端项目 CRUD UI 未接后端（接口已就绪）、M-02 组件仅 5/17、M-03 R-15/R-20 未实现、M-04 性能基准未测、M-05 引脚未人工核对、M-06 撤销重做未实现
- 阻塞：无

## [00:3x] 动作: 撤销/重做与快捷键（FR-15，已完成，待推送）

- 提交：`2bec6a2`（累计 **7 个提交待推送**：aa20e29 / 5c74f5c / f9da308 / 0c2244c / e7f7173 / 04206af / 2bec6a2）
- 实现决策（重要）：历史用**订阅式记录**（不逐个 action 插桩 → 未来新增编辑入口不会漏记，与 saveState 的 dirty 标记同策略）；连续操作（拖动）用 `beginHistoryTransaction()/endHistoryTransaction()` 合并为一步；上限 30 步；`undo/redo` 为 store action，撤销后清空选中项并置 `hasRun=false`；打开服务端项目时 `resetHistory()`（切换文档语义）
- UI：顶栏 ↶/↷ 按钮（disabled 态）；快捷键 `Ctrl/Cmd+Z`、`Ctrl/Cmd+Shift+Z`、`Ctrl+Y`、`Ctrl/Cmd+Enter`、`Esc`（`hooks/useHotkeys.ts`）、`F` 适配视图（画布内注册，需 React Flow 上下文）；输入框内一律不拦截
- 过程中修掉两个既存缺陷：① `skipNextDirtyMark` 原为「任意一次 setState 就消耗」→ 历史栈的内部 setState 会吃掉标志导致打开项目被误标 dirty，改为「仅画布内容变化时消耗」；② dev-only `window.__SIM_STORE__` 加 `typeof window !== 'undefined'` 保护（Node 环境跑测试直接崩）
- 后端重启：packages 重建后旧 api 进程仍报 5 组件/16 规则 → 重启后为 **9 组件 / 19 规则**，规则集版本 `rules-1cglo6`（与前端一致）
- 验证：**87 例全绿**（rule-engine 39 / api 15 / web 33，本轮 web +12）、冒烟 **21 项**（含清空→撤销→重做→按钮状态）、typecheck 0 error、全量构建成功
- 文档：TDD §7.4（撤销/重做与快捷键标为已实现）、§18 进展/门禁、README 核心能力与操作流程同步

## [00:0x] 动作: UI 修复（提示/深色黑字）+ M-02 组件补齐（已完成，待推送）

- 提交：`0c2244c`（UI 修复）、`e7f7173`（M-02）——**仍未推送**（GitHub `Failed to connect`，累计 5 个提交待推：aa20e29 / 5c74f5c / f9da308 / 0c2244c / e7f7173）
- UI 修复三件事：① 操作提示移到画布右上角（运行按钮下方），显示条件由 `hasRun` 改为「画布为空 + 未运行 + 未手动关闭」，新增 × 按钮（persist）—— 根因是 `hasRun` 在任何编辑后被重置，导致提示反复出现；② 深色黑字根因：**button 默认不继承 color**，`.inst-head` 是 button 故深色下为纯黑 → 全局 `button { color: inherit }` + 显式声明；另修 `.result-source` / `.pin-number` / React Flow attribution / 深色 `.run-btn` 底色；③ 文案「云端」→「服务端」（后端为本机 SQLite，非真云）
- 新增工具：`apps/web/scripts/check-contrast.mjs` —— 按 WCAG 对比度公式扫描两种主题，输出低对比度元素与祖先路径（当前均 0 项）
- M-02：契约加 `UART0_TX/RX`、`UART2_TX/RX` 能力（R-20 依据）、`external-power` 需求、`communication` 分类（按 E-06 同步三处）；板定义 GPIO1/3/17/16 标注收发角色
- M-02 组件（+4，共 9）：HC-SR04（5V ECHO + 独立供电）、SG90（大电流）、有源蜂鸣器、USB-TTL（TX/RX 交叉）
- M-02 规则（+3，共 19）：R-15 大电流负载需独立供电、R-20 串口未交叉、R-21 5V 直连 3.3V —— 全部走 requirements + portOptions 声明式豁免
- 验证：rule-engine 39 / api 15 / web 21 = **75 例全绿**；冒烟 17 项 0 控制台错误；seed 幂等（10 条定义，二次新增 0）；双主题可读性 0 项；typecheck 0 error；全量构建成功
- 文档：技术文档 §6.5 改为「19 已实现 / 2 待实现」、§18 进展与门禁同步；README 规则表 + 组件清单 + 测试数字更新
- 待办：网络恢复后 `git push origin master`（本地领先 5 个提交）

## [23:5x] 动作: UI 微调 + M-01 项目管理（已完成，待推送）

- 提交：`aa20e29`（UI 微调）、`5c74f5c`（M-01）——**均未推送**（GitHub 网络 `Connection was reset`，重试 3 次失败）
- UI 微调：运行后隐藏操作提示；亮色主题整体降亮度（`--bg: #e7ecf3`）；新增深色主题（顶栏切换 + persist）并适配 React Flow 控件；硬编码颜色全部改为 CSS 变量
- M-01：后端 `GET /projects`（ownerKey 隔离 + 计数摘要）；前端 `ProjectPanel`（新建/列表/打开/删除/保存 + 409 冲突"覆盖保存"）；store 增加 currentProjectId/currentRevision/saveState/projectList + 6 个 action；mock 用 localStorage 模拟服务端并返回 409
- 踩坑（已写入技术文档 E-19~E-21）：① mock 离线开关是模块级状态，测试 reset 未重置导致后续用例"后端不可用"；② dirty 标记误把改名/打开项目算作内容变更 → 只跟踪 instances/connections + `skipNextDirtyMarkOnce`；③ 新建项目后自动关面板与预期不符 → 保持打开
- 验证：66 例测试全绿（rule-engine 30 / api 15 / web 21）；冒烟 16 项（+4 面板断言）0 控制台错误；typecheck 0 error；全量构建成功；新增主题配图（ui-08/09/10）
- 待办：网络恢复后 `git push origin master`（本地领先 2 个提交）

## [推送准备] 动作: 文档配图 + 英文更名 + 推送准备（阻塞于远程认证）

- 文件：`README.md`（新建）、`docs/images/ui-01~07*.png`（7 张真实浏览器截图）、`apps/web/scripts/capture-docs.mjs`（截图脚本）、docs 两份文档插图、根 `package.json` 更名 `mcu-wiring-simulator`
- 决策：项目英文名 **mcu-wiring-simulator**（README 标题 `MCU Wiring Simulator`）；截图用 playwright-core + 系统 Chrome（deviceScaleFactor 2，1500×940）
- 验证：截图脚本执行成功（7 张）；提交 `938bb74`（13 files）；本地共 10 次提交待推送
- 环境事实：git 身份 `BigTanDog <1397354317@qq.com>`；`credential.helper=manager`（Windows 凭据管理器，位于 D:\Git）
- ~~阻塞~~ **已解决（推送成功）**：用户在 IDE 内用"发布/推送"完成首次推送——
  - 远程：`https://github.com/BigTanDog/2D----------------.git`（GitHub，**Public**，11 次提交，分支 master）
  - 本地 HEAD = 远程 HEAD = `c59b90c`；`git fetch` 无错 → **Windows 凭据管理器已缓存 GitHub 凭据**，命令行 `git push` 返回 `Everything up-to-date` → **命令行推送通道已打通，后续可由 Agent 直接推送**
  - README 配图在 GitHub 可访问（raw 图片 HTTP 200）
  - ✅ **仓库已改名**（用户操作）：`https://github.com/BigTanDog/mcu-wiring-simulator.git` —— 本地 remote 已同步（`git remote set-url`），`git ls-remote` / `git fetch` / `git push` 均在新地址下验证通过
  - CNB 通道仍不可用（MCP 的 API_TOKEN 是占位符，401）；sourceless 时可用 GitHub 通道

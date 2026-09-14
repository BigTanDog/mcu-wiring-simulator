# 2026-09-15 · 会话记录

## [01:0x] 动作: 顶栏响应式 + 示例项目模板（提交 1f2e1fb，已推送）

- 需求：① 页面缩小时顶栏不美观（按钮文字被压成竖排）；② 用现有组件做几份经典项目实例并在项目管理里展示
- 顶栏：`.topbar` flex-wrap:nowrap + overflow-x:auto（隐藏滚动条）；`.btn/.chip/.run-btn { white-space: nowrap; flex-shrink: 0 }`；双文本按钮 + 三级媒体查询（1460/1240/1024px）；按钮补 aria-label（窄屏下 E2E 定位稳定）
- 模板：`apps/web/src/projectTemplates.ts` 4 个（温湿度显示 / 超声波测距 / 电机调速 / 串口调试），覆盖单总线、I2C、5V 分压、器件直连、TX-RX 交叉、UART0 占用等教学点
- store：`loadTemplate`（深拷贝载入，防污染模板；可撤销）；`loadSampleProject` 改为委托默认模板（去掉 80 行硬编码示例数据）
- UI：`ProjectPanel` 顶部模板区（`.template-card` 网格：名称/说明/要点标签）
- 测试：`templates.test.ts` 6 例（**强制每个模板无 error**、id 不重复、深拷贝、未知 id 提示、默认示例等同、可撤销）；冒烟 +4 项（模板 4 个、载入后 4 节点、电机模板运行无 error、1100px 顶栏 58px 不换行）
- 顺带：示例实例 id `c-*` → `t1-*`，用 node 脚本批量修正 7 个文件引用
- 验证：109 例全绿（51/15/43）、冒烟 37 项 0 控制台错误、typecheck 0 error、构建成功
- 坑：PowerShell 下 git commit message 含全角引号/破折号会被截断（pathspec 错误）→ 改简洁消息后成功
- 阻塞：无

## [02:0x] 动作: M-04 性能基准 + 综合实验大项目模板（提交 dd22948，已推送）

- 基准脚本 `apps/web/scripts/bench.mjs`（四项：首屏 / 端到端校验 / 画布帧率 / 后端 P95）+ 报告 `docs/性能基准.md`
- 实测（生产构建）：帧率 5.6ms/帧 ≈178 FPS（27 节点/58 连线，拖动中同值，长任务 0）；P95 16.6ms（100/150，200 次）；首屏 542ms（4G 节流）；端到端 63ms → **NFR-01/02 全达标**
- 方法学（3 个坑）：dev server 数据是假象（React 开发模式开销，V8 剖析证实）；逐次 mouse.move 的 CDP 往返污染 longtask；headless rAF 不节流（判读用帧间隔中位数）
- 大项目模板：综合实验项目（26 组件 / 59 连线）—— LED 串联支路 ×6、器件直连、I2C 双设备、独立供电
- 修 R-03 真缺陷：I2C 多设备共享 SDA/SCL 被误报 → 放行全 I2C 端口共享（R-13 管地址冲突），+2 例单测
- 渲染优化：节点 memo + data 引用稳定化（未观测到显著差异，保留作保险）
- 验证：111 例（53/15/43）、冒烟 38 项、typecheck 0 error、构建成功
- 文档：TDD §12.1 待验证 → 实测、T-UV1~3 与 M-04 标记完成、§18.5 补性能行；README 加性能基准行与模板说明

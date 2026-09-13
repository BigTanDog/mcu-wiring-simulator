/**
 * 真实浏览器冒烟验证（E2E）
 *
 * 与单元测试的区别：本脚本驱动真实 Chrome，验证"点击 → 渲染 → 交互"链路，
 * 可捕获仅在真实浏览器暴露的问题（例如白屏类无限渲染缺陷）。
 *
 * 运行前提：dev server 已启动（默认 http://127.0.0.1:5180）
 * 运行：node scripts/smoke.mjs
 * 输出：控制台 JSON 结果 + .smoke/*.png 截图；退出码 0 = 通过
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const BASE_URL = process.env.SMOKE_URL ?? 'http://127.0.0.1:5180';
const OUT_DIR = '.smoke';

mkdirSync(OUT_DIR, { recursive: true });

const checks = [];
const errors = [];

const check = (name, ok, detail = '') => {
  checks.push({ name, ok, detail });
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console.error: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`);
  });

  // 0. 前置：后端可用性（W5 起前端默认走真实后端）
  const backendOk = await fetch('http://127.0.0.1:3000/api/v1/health')
    .then((response) => response.ok)
    .catch(() => false);
  check(
    '后端服务可访问（http://127.0.0.1:3000）',
    backendOk,
    backendOk ? '' : '需先启动后端：npm run dev -w @sim/api',
  );

  // 1. 首屏加载
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.board-node', { timeout: 15000 });
  await page.screenshot({ path: `${OUT_DIR}/01-initial.png` });

  check('顶部栏标题渲染', (await page.getByText('单片机接线仿真与校验平台').count()) > 0);

  // 顶栏后端连通状态提示（前端接真实后端）
  await page.waitForTimeout(1500);
  const chips = await page.locator('.chip').allInnerTexts();
  check(
    '顶栏显示后端连接状态',
    chips.some((text) => /后端已连接|后端离线|Mock 模式/.test(text)),
    chips.join(' | '),
  );
  check('组件库出现', (await page.getByText('组件库').count()) > 0);
  check('开发板节点渲染（38 引脚）', (await page.locator('.pin-row').count()) === 38);

  // 2. 载入示例项目
  await page.getByRole('button', { name: /载入示例/ }).click();
  await page.waitForSelector('[data-testid="component-c-oled"]', { timeout: 5000 });
  await page.waitForSelector('[data-testid="component-c-dht11"]');
  const edgeCount = await page.locator('.react-flow__edge').count();
  check('示例项目生成 7 条连线', edgeCount === 7, `实际 ${edgeCount}`);
  await page.screenshot({ path: `${OUT_DIR}/02-sample.png` });

  // 3. 点击运行 → 校验通过（回归：此前会白屏）
  await page.getByRole('button', { name: /运行/ }).click();
  await page.getByText('校验通过').waitFor({ timeout: 8000 });
  const rootText = await page.locator('#root').innerText();
  check('运行后页面未白屏且结果面板可见', rootText.includes('校验通过'));
  // 本地结果先出现（离线标注），后端结果返回后应切换为"后端权威校验"
  await page.getByText(/后端权威校验/).waitFor({ timeout: 8000 });
  check('结果来源最终切换为后端权威校验', true);
  await page.screenshot({ path: `${OUT_DIR}/03-passed.png` });

  // 4. 制造错误接线：DHT11 DATA 改接 GPIO34（仅输入引脚）
  //    直接用 store API 驱动（画布拖拽在 headless 下的坐标命中不稳定，交由单元测试覆盖）
  await page.evaluate(() => {
    const store = window.__SIM_STORE__;
    store.getState().removeConnection('e-s2');
    store.getState().addConnection(
      { type: 'pin', pinId: 'pin-esp32-gpio34' },
      { type: 'port', instanceId: 'c-dht11', portId: 'DATA' },
    );
  });
  await page.getByRole('button', { name: /运行/ }).click();
  await page.getByText('存在错误').waitFor({ timeout: 8000 });
  const errorPanelText = await page.locator('.result-list').innerText();
  check('错误诊断包含 R-08（仅输入引脚）', errorPanelText.includes('R-08'));
  check('诊断给出修复建议', errorPanelText.includes('建议'));
  await page.screenshot({ path: `${OUT_DIR}/04-error.png` });

  // 5. 点击诊断定位：画布应出现对应引脚高亮
  await page.locator('.target-chip').first().click();
  await page.waitForTimeout(600);
  const highlighted = await page.locator('.pin-error').count();
  check('点击诊断后引脚高亮', highlighted > 0, `高亮引脚数 ${highlighted}`);
  await page.screenshot({ path: `${OUT_DIR}/05-locate.png` });

  // 6. 结果来源断言：
  //    - http 模式（默认，接真实后端）→ 必须标注"后端权威校验"
  //    - mock 模式 → 用"模拟后端离线"验证离线降级标注
  const isHttpMode = !chips.some((text) => /Mock 模式/.test(text));
  if (isHttpMode) {
    const sourceText = await page.locator('.result-source').innerText();
    check('校验结论来自后端权威结果', /后端权威校验/.test(sourceText), sourceText);
    await page.screenshot({ path: `${OUT_DIR}/06-backend-source.png` });
  } else {
    await page.getByText('模拟后端离线').click();
    await page.getByRole('button', { name: /运行/ }).click();
    await page.getByText(/离线模式/).waitFor({ timeout: 8000 });
    check('后端离线时降级并标注离线', (await page.locator('#root').innerText()).includes('离线模式'));
    await page.screenshot({ path: `${OUT_DIR}/06-offline.png` });
  }

  // 7. 项目管理（M-01）：打开面板 → 新建 → 列表出现 → 删除（顺带清理数据）
  await page.getByTitle('新建 / 打开 / 保存服务端项目').click();
  await page.waitForSelector('.project-modal', { timeout: 5000 });
  check('项目管理面板可打开', true);

  const draftName = `冒烟项目-${Date.now()}`;
  await page.getByPlaceholder(/新项目名称/).fill(draftName);
  await page.getByRole('button', { name: '新建服务端项目' }).click();

  let rowsReady = true;
  try {
    await page.waitForSelector('.project-row', { timeout: 10000 });
  } catch {
    rowsReady = false;
  }

  const panelText = await page.locator('.project-modal').innerText();
  const toastText = await page
    .locator('.toast')
    .innerText()
    .catch(() => '(无 toast)');
  const rowCount = await page.locator('.project-row').count();
  check(
    '新建后项目出现在列表',
    rowsReady && rowCount > 0 && panelText.includes(draftName),
    rowsReady ? `共 ${rowCount} 条` : `超时；toast=${toastText}；panel=${panelText.replace(/\n/g, ' | ')}`,
  );
  check('当前项目显示已绑定服务端', /已绑定服务端/.test(panelText), panelText.replace(/\n/g, ' | '));
  await page.screenshot({ path: `${OUT_DIR}/07-project-panel.png` });

  // 删除刚创建的项目（同时验证删除能力，避免污染服务端数据）
  const targetRow = page.locator('.project-row', { hasText: draftName }).first();
  await targetRow.getByRole('button', { name: '删除' }).click();
  await page.waitForTimeout(1200);
  const afterDelete = await page.locator('.project-row', { hasText: draftName }).count();
  check('删除项目后从列表消失', afterDelete === 0, `剩余 ${afterDelete} 条`);

  await page.getByRole('button', { name: '关闭' }).click();
  await page.waitForTimeout(500);

  // 8. 组件库覆盖 M-02 新增组件与「通信模块」分组
  const libText = await page.locator('.sidebar').innerText();
  const expectedLib = [
    '通信模块',
    'HC-SR04 超声波测距',
    'SG90 舵机',
    '有源蜂鸣器模块',
    'USB-TTL 串口模块',
    'LED 发光二极管',
    '轻触按键',
    '电阻（1/4W）',
  ];
  const missingLib = expectedLib.filter((name) => !libText.includes(name));
  check(
    '组件库包含 M-02 新增组件与通信模块分组',
    missingLib.length === 0,
    missingLib.length > 0 ? `缺少: ${missingLib.join('、')}` : `已校验 ${expectedLib.length} 项`,
  );
  await page.screenshot({ path: `${OUT_DIR}/08-library.png` });

  // 9. 撤销 / 重做（FR-15）：清空画布 → Ctrl+Z 恢复 → Ctrl+Shift+Z 重做
  await page.getByRole('button', { name: /载入示例/ }).click();
  await page.waitForTimeout(500);
  const nodesWithSample = await page.locator('.react-flow__node').count();

  await page.getByRole('button', { name: /清空画布/ }).click();
  await page.waitForTimeout(400);
  const nodesAfterClear = await page.locator('.react-flow__node').count();
  check(
    '清空画布后仅剩开发板',
    nodesAfterClear < nodesWithSample,
    `${nodesWithSample} → ${nodesAfterClear}`,
  );

  await page.keyboard.press('Control+z');
  await page.waitForTimeout(500);
  const nodesAfterUndo = await page.locator('.react-flow__node').count();
  check('Ctrl+Z 撤销生效（清空可恢复）', nodesAfterUndo === nodesWithSample, `${nodesAfterClear} → ${nodesAfterUndo}`);

  await page.keyboard.press('Control+Shift+z');
  await page.waitForTimeout(500);
  const nodesAfterRedo = await page.locator('.react-flow__node').count();
  check('Ctrl+Shift+Z 重做生效', nodesAfterRedo === nodesAfterClear, `${nodesAfterUndo} → ${nodesAfterRedo}`);

  await page.keyboard.press('Control+z');
  await page.waitForTimeout(500);
  check(
    '顶栏撤销按钮在有历史时可用',
    !(await page.getByRole('button', { name: '撤销' }).isDisabled()),
  );
  await page.screenshot({ path: `${OUT_DIR}/09-history.png` });
} catch (error) {
  check('执行过程无异常', false, error instanceof Error ? error.message : String(error));
} finally {
  await browser.close();
}

const failed = checks.filter((item) => !item.ok);
const summary = {
  passed: checks.length - failed.length,
  failed: failed.length,
  consoleErrors: errors,
  details: checks,
};

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0 || errors.length > 0) {
  process.exitCode = 1;
}

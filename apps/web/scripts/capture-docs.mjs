/**
 * 文档配图截取：驱动真实 Chrome 截取界面关键状态，输出到 docs/images/
 *
 * 运行前提：后端（:3000）与前端 dev server（:5180）均已启动
 * 运行：node apps/web/scripts/capture-docs.mjs
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(here, '../../../docs/images');
const BASE_URL = process.env.SMOKE_URL ?? 'http://127.0.0.1:5180';

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 940 }, deviceScaleFactor: 2 });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.board-node', { timeout: 20000 });
  await page.waitForTimeout(1200);

  // 1. 首屏：三栏布局（组件库 / 画布 / 结果面板）
  await page.screenshot({ path: `${OUT_DIR}/ui-01-overview.png` });

  // 2. 载入示例项目
  await page.getByRole('button', { name: /载入示例/ }).click();
  await page.waitForSelector('[data-testid="component-t1-oled"]', { timeout: 8000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT_DIR}/ui-02-sample-project.png` });

  // 3. 运行校验：通过
  await page.getByRole('button', { name: /运行/ }).click();
  await page.getByText('校验通过').waitFor({ timeout: 10000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT_DIR}/ui-03-validation-passed.png` });

  // 4. 错误接线：DATA → GPIO34（仅输入引脚）
  await page.evaluate(() => {
    const store = window.__SIM_STORE__;
    store.getState().removeConnection('e-s2');
    store.getState().addConnection(
      { type: 'pin', pinId: 'pin-esp32-gpio34' },
      { type: 'port', instanceId: 't1-dht11', portId: 'DATA' },
    );
  });
  await page.getByRole('button', { name: /运行/ }).click();
  await page.getByText('存在错误').waitFor({ timeout: 10000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT_DIR}/ui-04-validation-error.png` });

  // 5. 错误诊断局部：规则码 + 结论 + 建议 + 定位按钮
  const panel = page.locator('.result-panel');
  await panel.screenshot({ path: `${OUT_DIR}/ui-05-diagnostic-detail.png` });

  // 6. 点击诊断定位 → 引脚高亮
  await page.locator('.target-chip').first().click();
  await page.waitForTimeout(900);
  await page.locator('.board-node').screenshot({ path: `${OUT_DIR}/ui-06-pin-locate.png` });

  // 7. 控制面板局部：端口配置与连接开关
  const inspector = page.locator('.panel').last();
  await inspector.screenshot({ path: `${OUT_DIR}/ui-07-control-panel.png` });

  console.log(
    JSON.stringify(
      {
        outDir: OUT_DIR,
        files: [
          'ui-01-overview.png',
          'ui-02-sample-project.png',
          'ui-03-validation-passed.png',
          'ui-04-validation-error.png',
          'ui-05-diagnostic-detail.png',
          'ui-06-pin-locate.png',
          'ui-07-control-panel.png',
        ],
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error('截图失败:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await browser.close();
}

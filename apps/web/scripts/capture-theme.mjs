/**
 * 主题配图截取：分别截取亮色 / 深色首屏，用于文档展示主题切换
 *
 * 运行前提：前后端已启动；运行：node apps/web/scripts/capture-theme.mjs
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

  // 载入示例项目，让图上内容更完整
  await page.getByRole('button', { name: /载入示例/ }).click();
  await page.waitForSelector('[data-testid="component-c-oled"]', { timeout: 8000 });
  await page.waitForTimeout(800);

  // 默认（亮色，已降亮度）
  await page.screenshot({ path: `${OUT_DIR}/ui-08-theme-light.png` });

  // 切换到深色
  await page.getByRole('button', { name: '深色' }).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT_DIR}/ui-09-theme-dark.png` });

  // 深色下运行一次校验，验证结果面板在深色下的可读性
  await page.getByRole('button', { name: /运行/ }).click();
  await page.getByText('校验通过').waitFor({ timeout: 10000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT_DIR}/ui-10-theme-dark-validation.png` });

  console.log(
    JSON.stringify(
      {
        files: ['ui-08-theme-light.png', 'ui-09-theme-dark.png', 'ui-10-theme-dark-validation.png'],
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

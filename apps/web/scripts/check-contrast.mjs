/**
 * 深色主题可读性扫描：列出「前景色与背景色对比度过低」的文本元素。
 *
 * 用途：深色模式下若某处仍写死深色文字（或漏用 CSS 变量），肉眼容易漏检；
 * 本脚本按 WCAG 对比度公式扫描全部可见文本，输出待修清单。
 *
 * 运行前提：前端 dev server 已启动（:5180）
 * 运行：node apps/web/scripts/check-contrast.mjs [theme]
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(here, '../.smoke');
const BASE_URL = process.env.SMOKE_URL ?? 'http://127.0.0.1:5180';
const THEME = (process.argv[2] ?? 'dark') === 'light' ? 'light' : 'dark';
const MIN_RATIO = 3; // 正文类文本的最低可接受对比度（WCAG AA 大字标准）

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 940 } });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.board-node', { timeout: 20000 });

  // 空画布状态（此时操作提示可见）——同时用于人工核对提示位置
  if (THEME === 'dark') {
    await page.getByRole('button', { name: '深色' }).click();
    await page.waitForTimeout(600);
  }
  await page.screenshot({ path: `${OUT_DIR}/hint-${THEME}-empty.png` });

  // 覆盖尽量多的界面状态，避免漏检
  await page.getByRole('button', { name: /载入示例/ }).click();
  await page.waitForSelector('[data-testid="component-c-oled"]', { timeout: 8000 });
  await page.getByRole('button', { name: /运行/ }).click();
  await page.getByText('校验通过').waitFor({ timeout: 10000 });
  await page.waitForTimeout(800);

  await page.screenshot({ path: `${OUT_DIR}/contrast-${THEME}-main.png` });

  const scan = async (label) =>
    page.evaluate(
      ({ minRatio, label }) => {
        const parse = (value) => {
          const match = value.match(/rgba?\(([^)]+)\)/);
          if (!match) return null;
          const parts = match[1].split(',').map((item) => Number(item.trim()));
          return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
        };
        const luminance = ({ r, g, b }) => {
          const channel = (v) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
          };
          return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
        };
        const contrast = (a, b) => {
          const l1 = luminance(a);
          const l2 = luminance(b);
          const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
          return (hi + 0.05) / (lo + 0.05);
        };
        const backgroundOf = (el) => {
          let node = el;
          while (node) {
            const style = getComputedStyle(node);
            // 渐变/图片背景无法用 backgroundColor 计算对比度，直接跳过（避免误报）
            if (style.backgroundImage && style.backgroundImage !== 'none') return null;
            const color = parse(style.backgroundColor);
            if (color && color.a > 0.5) return color;
            node = node.parentElement;
          }
          return { r: 255, g: 255, b: 255, a: 1 };
        };

        const findings = [];
        for (const el of Array.from(document.querySelectorAll('*'))) {
          const hasOwnText = Array.from(el.childNodes).some(
            (node) => node.nodeType === 3 && node.textContent.trim().length > 1,
          );
          if (!hasOwnText) continue;

          const style = getComputedStyle(el);
          if (style.visibility === 'hidden' || style.display === 'none') continue;
          if (Number(style.opacity) < 0.2) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width < 4 || rect.height < 4) continue;

          const fg = parse(style.color);
          if (!fg || fg.a < 0.3) continue;
          const bg = backgroundOf(el);
          if (!bg) continue;
          const ratio = contrast(fg, bg);
          if (ratio >= minRatio) continue;

          // 祖先链（最多 3 层）便于精确定位是哪个组件/样式漏了主题变量
          const path = [];
          let cursor = el.parentElement;
          for (let depth = 0; depth < 3 && cursor; depth += 1) {
            path.push(
              `${cursor.tagName.toLowerCase()}${cursor.getAttribute('class') ? `.${cursor.getAttribute('class').split(/\s+/).join('.')}` : ''}`,
            );
            cursor = cursor.parentElement;
          }

          findings.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.getAttribute('class') ?? '').slice(0, 48),
            text: el.textContent.trim().slice(0, 30),
            color: style.color,
            bg: `rgb(${bg.r}, ${bg.g}, ${bg.b})`,
            ratio: Number(ratio.toFixed(2)),
            path: path.join(' < '),
          });
        }

        // 去重（同一样式多处出现只报一次）
        const seen = new Set();
        return findings.filter((item) => {
          const key = `${item.tag}|${item.cls}|${item.color}|${item.bg}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).map((item) => ({ ...item, view: label }));
      },
      { minRatio: MIN_RATIO, label },
    );

  const mainFindings = await scan('主界面');

  // 打开项目面板再扫一次（弹层容易漏检）
  await page.getByTitle('新建 / 打开 / 保存服务端项目').click();
  await page.waitForSelector('.project-modal', { timeout: 5000 });
  await page.waitForTimeout(500);
  const modalFindings = await scan('项目面板');
  await page.screenshot({ path: `${OUT_DIR}/contrast-${THEME}-modal.png` });

  const all = [...mainFindings, ...modalFindings];
  console.log(
    JSON.stringify(
      {
        theme: THEME,
        minRatio: MIN_RATIO,
        lowContrastCount: all.length,
        findings: all,
      },
      null,
      2,
    ),
  );
  process.exitCode = all.length === 0 ? 0 : 1;
} catch (error) {
  console.error('扫描失败:', error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
} finally {
  await browser.close();
}

/**
 * M-04 性能基准（NFR-01 / NFR-02）—— 把技术文档 §12.1 的"待验证"换成实测数字。
 *
 * 四项测量（全部可在**生产构建**上跑，不依赖 dev 专用句柄）：
 *   1. 首屏可交互时间（4G 网络节流）
 *   2. 端到端校验耗时（点击「运行」→ 结果呈现，含后端往返）
 *   3. 画布帧率（载入「综合实验项目」模板：26 组件 / 59 连线；静态与拖动中）
 *   4. POST /validate P95（100 组件 / 150 连线，200 次请求，Node 侧直打接口）
 *
 * 用法：
 *   npm run build -w @sim/web
 *   npx vite preview --port 4174            # 在 apps/web 下执行
 *   node scripts/bench.mjs --web http://127.0.0.1:4174
 *
 * 方法学备注（踩过的坑）：
 *   - 不要用 `page.mouse.move` 逐次拖动来测"单帧成本"：CDP 事件派发的往返开销会
 *     被算进页面主线程，longtask 数被放大（实测 42 次移动 ≈ 42 个长任务，纯属假象）；
 *     改用「一次性移动 + steps 插值」较少往返。
 *   - 不要在 dev server 上测性能：React 开发模式会带来大量 jsxDEV / DOM 属性校验
 *     开销（V8 剖析显示可占可观比例），务必用生产构建。
 *   - headless Chrome 的 requestAnimationFrame 不被 vsync 限制，静态场景会跑出
 *     100+ 的"帧率"；因此以 **帧间隔中位数 ≤ 20ms** 作为「≥50 FPS」的判读口径。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(here, '../.smoke');
mkdirSync(OUT_DIR, { recursive: true });

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const WEB_BASE = argOf('--web', 'http://127.0.0.1:4174');
const API_BASE = argOf('--api', 'http://127.0.0.1:3000');
const FPS_SECONDS = Number(argOf('--fps-seconds', '6'));
/** all | preview | app */
const ONLY = argOf('--only', 'all');

/* ---------------------------- 采样工具 ---------------------------- */

const startFrameSampling = (page) =>
  page.evaluate(() => {
    window.__benchFrames = [];
    window.__benchLongTasks = 0;
    try {
      if (!window.__benchObserver) {
        window.__benchObserver = new PerformanceObserver((list) => {
          window.__benchLongTasks += list.getEntries().length;
        });
        window.__benchObserver.observe({ entryTypes: ['longtask'] });
      }
    } catch {
      /* 环境不支持 longtask 时忽略 */
    }
    let last = performance.now();
    const tick = (now) => {
      window.__benchFrames.push(now - last);
      last = now;
      window.__benchRaf = requestAnimationFrame(tick);
    };
    window.__benchRaf = requestAnimationFrame(tick);
  });

const stopFrameSampling = (page) =>
  page.evaluate(() => {
    cancelAnimationFrame(window.__benchRaf);
    const deltas = window.__benchFrames.slice(3, -2);
    if (deltas.length === 0) {
      return { frames: 0, medianFrameMs: 0, medianFps: 0, avgFps: 0, worstFrame: 0, longTasks: 0 };
    }
    const sorted = [...deltas].sort((a, b) => a - b);
    const total = deltas.reduce((sum, item) => sum + item, 0);
    const medianFrame = sorted[Math.floor(sorted.length / 2)];
    return {
      frames: deltas.length,
      /** 中位帧间隔（ms）——判读主指标：≤20ms 即满足「≥50 FPS」 */
      medianFrameMs: Number(medianFrame.toFixed(2)),
      medianFps: Number((1000 / medianFrame).toFixed(1)),
      avgFps: Number((deltas.length / (total / 1000)).toFixed(1)),
      worstFrame: Number(sorted[sorted.length - 1].toFixed(1)),
      longTasks: window.__benchLongTasks ?? 0,
    };
  });

/** 载入「综合实验项目」模板（26 组件 / 59 连线） */
const loadBigProject = async (page) => {
  await page.getByRole('button', { name: '项目管理' }).click();
  await page.waitForSelector('.template-card', { timeout: 10000 });
  await page.locator('.template-card', { hasText: '综合实验项目' }).click();
  await page.waitForTimeout(900);
};

/** 拖动负载：按住一个节点，用 steps 插值一次移动多步（减少 CDP 往返） */
const runMouseDragLoad = async (page, seconds) => {
  const nodes = page.locator('.react-flow__node');
  const count = await nodes.count();
  if (count < 2) return 0;
  const target = nodes.nth(Math.min(1, count - 1));
  const box = await target.boundingBox();
  if (!box) return 0;

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  const stepsPerRound = 12;
  const rounds = Math.max(3, Math.round(seconds * 6));
  let moves = 0;
  for (let i = 0; i < rounds; i += 1) {
    await page.mouse.move(cx + Math.sin(i / 2) * 70, cy + Math.cos(i / 3) * 45, {
      steps: stepsPerRound,
    });
    moves += stepsPerRound;
  }
  await page.mouse.up();
  return moves;
};

const measureCanvasFps = async (page, { label, drag }) => {
  await page.keyboard.press('f');
  await page.waitForTimeout(500);

  await startFrameSampling(page);
  let moves = 0;
  if (drag) {
    moves = await runMouseDragLoad(page, FPS_SECONDS);
  } else {
    await page.waitForTimeout(FPS_SECONDS * 1000);
  }
  const stats = await stopFrameSampling(page);
  return { label, drag, moves, ...stats };
};

/** 端到端校验耗时：点击「运行」→ 结果状态呈现（含后端往返与渲染） */
const measureValidationRoundTrip = async (page, rounds = 5) => {
  const samples = [];
  for (let i = 0; i < rounds; i += 1) {
    const started = Date.now();
    await page.getByRole('button', { name: /运行/ }).click();
    await page.waitForFunction(
      () => !document.querySelector('.result-running') && !!document.querySelector('.result-status'),
      undefined,
      { timeout: 15000 },
    );
    samples.push(Date.now() - started);
  }
  const sorted = [...samples].sort((a, b) => a - b);
  return { samples, median: sorted[Math.floor(sorted.length / 2)], max: sorted[sorted.length - 1] };
};

/** 首屏可交互（4G 节流） */
const measureFirstPaint = async (browser) => {
  const context = await browser.newContext({ viewport: { width: 1500, height: 940 } });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 100,
    downloadThroughput: (8 * 1024 * 1024) / 8,
    uploadThroughput: (3 * 1024 * 1024) / 8,
  });

  const started = Date.now();
  await page.goto(WEB_BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.board-node', { timeout: 90000 });
  const interactive = Date.now() - started;
  const timing = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paint = performance.getEntriesByType('paint').find((item) => item.name === 'first-contentful-paint');
    return {
      ttfb: Math.round(nav.responseStart),
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
      firstContentfulPaint: paint ? Math.round(paint.startTime) : null,
    };
  });
  await context.close();
  return { interactiveMs: interactive, ...timing };
};

/* -------------------- 后端 /validate P95（Node 侧） -------------------- */

const GPIO_POOL = [4, 5, 13, 14, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33];

/** 程序化生成压力负载（引脚会复用，只用于度量引擎规模表现，不追求通过校验） */
const buildScenario = (branches, buttons = 0) => {
  const instances = [];
  const connections = [];
  let seq = 0;
  let slot = 0;
  const add = (id, slug, label, portConfig = {}) => {
    instances.push({
      id,
      definitionSlug: slug,
      label,
      position: { x: 620 + (slot % 8) * 190, y: 40 + Math.floor(slot / 8) * 130 },
      portConfig,
    });
    slot += 1;
  };
  const wire = (from, to, kind = 'signal') => {
    seq += 1;
    connections.push({ id: `b-e${seq}`, from, to, kind, enabled: true });
  };
  for (let i = 0; i < branches; i += 1) {
    const gpio = GPIO_POOL[i % GPIO_POOL.length];
    add(`b-r${i}`, 'resistor', `R-${i}`, { resistance: '220Ω' });
    add(`b-led${i}`, 'led', `LED-${i}`, { seriesResistor: false });
    wire({ type: 'pin', pinId: `pin-esp32-gpio${gpio}` }, { type: 'port', instanceId: `b-r${i}`, portId: '1' });
    wire({ type: 'port', instanceId: `b-r${i}`, portId: '2' }, { type: 'port', instanceId: `b-led${i}`, portId: 'A' });
    wire({ type: 'pin', pinId: 'pin-esp32-gnd-1' }, { type: 'port', instanceId: `b-led${i}`, portId: 'K' }, 'ground');
  }
  for (let i = 0; i < buttons; i += 1) {
    const gpio = GPIO_POOL[i % GPIO_POOL.length];
    add(`b-key${i}`, 'push-button', `KEY-${i}`, { internalPullup: true });
    wire({ type: 'pin', pinId: `pin-esp32-gpio${gpio}` }, { type: 'port', instanceId: `b-key${i}`, portId: 'P1' });
    wire({ type: 'pin', pinId: 'pin-esp32-gnd-2' }, { type: 'port', instanceId: `b-key${i}`, portId: 'P2' }, 'ground');
  }
  return { instances, connections };
};

const percentileOf = (sorted, p) =>
  Number(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))].toFixed(1));

const measureApiP95 = async (scenario, rounds) => {
  const body = JSON.stringify({
    snapshot: {
      boardSlug: 'esp32-devkitc-v4',
      instances: scenario.instances,
      connections: scenario.connections,
      options: { wifiEnabled: false, mode: 'loose' },
    },
  });
  const call = async () => {
    const started = performance.now();
    const response = await fetch(`${API_BASE}/api/v1/validate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });
    await response.json();
    return performance.now() - started;
  };

  await call(); // 预热
  const times = [];
  for (let i = 0; i < rounds; i += 1) times.push(await call());
  const sorted = [...times].sort((a, b) => a - b);
  return {
    rounds,
    components: scenario.instances.length,
    connections: scenario.connections.length,
    p50: percentileOf(sorted, 50),
    p95: percentileOf(sorted, 95),
    max: Number(sorted[sorted.length - 1].toFixed(1)),
  };
};

/* ------------------------------ 主流程 ------------------------------ */

const main = async () => {
  const report = {
    env: { web: WEB_BASE, api: API_BASE, fpsSeconds: FPS_SECONDS, only: ONLY, at: new Date().toISOString() },
    targets: {
      fps: '30 组件 / 50 连线 ≥ 50 FPS（判读口径：帧间隔中位数 ≤ 20ms）',
      firstPaint: '生产构建 + 4G 节流 < 2 s',
      apiP95: '100 组件 / 150 连线 < 300 ms',
    },
  };

  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  if (ONLY !== 'preview') {
    const context = await browser.newContext({ viewport: { width: 1500, height: 940 } });
    const page = await context.newPage();
    await page.goto(WEB_BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.board-node', { timeout: 60000 });

    report.renderer = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl');
      const debug = gl?.getExtension('WEBGL_debug_renderer_info');
      return { webgl: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unavailable' };
    });

    console.log('=== 载入「综合实验项目」模板（26 组件 / 59 连线）===');
    await loadBigProject(page);
    const nodeCount = await page.locator('.react-flow__node').count();
    const edgeCount = await page.locator('.react-flow__edge').count();
    report.scenario = { nodes: nodeCount, edges: edgeCount };
    console.log(`  画布就绪：${nodeCount} 节点 / ${edgeCount} 连线`);

    console.log('=== 端到端校验耗时（点击运行 → 结果呈现）===');
    const roundTrip = await measureValidationRoundTrip(page);
    report.validationRoundTrip = roundTrip;
    console.log(`  中位 ${roundTrip.median} ms · 最差 ${roundTrip.max} ms（样本 ${roundTrip.samples.join(', ')}）`);

    console.log('=== 画布帧率 ===');
    const fpsStatic = await measureCanvasFps(page, { label: '静态（26 组件 / 59 连线）', drag: false });
    const fpsDrag = await measureCanvasFps(page, { label: '拖动中（26 组件 / 59 连线）', drag: true });
    report.fps = [fpsStatic, fpsDrag];
    for (const item of report.fps) {
      console.log(
        `  ${item.label}：帧间隔中位 ${item.medianFrameMs}ms（≈${item.medianFps} FPS）· 最差帧 ${item.worstFrame}ms · 长任务 ${item.longTasks}${
          item.drag ? ` · 拖动步数 ${item.moves}` : ''
        }`,
      );
    }

    await context.close();

    console.log('=== 后端 /validate P95 ===');
    const api = await measureApiP95(buildScenario(50), 200);
    report.api = api;
    console.log(
      `  ${api.components} 组件 / ${api.connections} 连线 · ${api.rounds} 次：p50 ${api.p50} ms · p95 ${api.p95} ms · max ${api.max} ms`,
    );
  }

  if (ONLY !== 'app') {
    console.log('=== 首屏可交互（4G 节流）===');
    const firstPaint = await measureFirstPaint(browser);
    report.firstPaint = firstPaint;
    console.log(
      `  可交互 ${firstPaint.interactiveMs} ms（TTFB ${firstPaint.ttfb} ms · FCP ${firstPaint.firstContentfulPaint ?? '-'} ms · DCL ${firstPaint.domContentLoaded} ms）`,
    );
  }

  await browser.close();

  const resultPath = `${OUT_DIR}/bench-result.json`;
  writeFileSync(resultPath, JSON.stringify(report, null, 2));
  console.log(`\n结果已写入 ${resultPath}`);
};

await main();

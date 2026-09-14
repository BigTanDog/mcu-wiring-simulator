import type { ComponentDef, PortDef } from '@sim/contracts';

/**
 * 面包板（半尺寸）—— 采用技术文档 §4.4 与 Q-T4 决策的**简化模型**：
 *
 *  - 每一「列」是一个**等电位组**：把线接到同一列的不同孔位，电气上等价。
 *    落到引擎里不需要任何新语义 —— 同一端口被多条连线连接时，并查集天然会把它们
 *    合并成一个 net（`buildNets` 的端点 key 就是 `port:<instanceId>:<portId>`）。
 *  - 上下两条**电源轨**（+ / −）各是一个独立等电位组，整条轨互通。
 *  - 列端口使用 `passive` 角色：既可能接信号也可能接电源/地，方向与电压规则（R-05/R-08）
 *    会主动跳过它 —— 与"电阻"采用同一策略，避免误报。
 *  - 所有端口 `required: false`：面包板不必每个孔都接线。
 *
 * 教学价值：演示"一个 GPIO 通过一列分接到多个器件"（一拖多）与"电源轨供电"。
 * 已知边界：不做插孔级（真实面包板中间凹槽把上下半区分断）——见 T-UV6/T-R8。
 */
const COLUMNS = 12;

const columnPorts: PortDef[] = Array.from({ length: COLUMNS }, (_, index) => ({
  id: `c${index + 1}`,
  name: `第 ${index + 1} 列`,
  role: 'passive',
  direction: 'io',
  voltageDomain: '3V3',
  required: false,
  note: '列内等电位：可接 1 路信号 / 电源，再从同列分接到多个器件',
}));

export const BREADBOARD: ComponentDef = {
  slug: 'breadboard',
  displayName: '面包板（半尺寸 12 列）',
  category: 'power_passive',
  icon: 'BB',
  version: '1.0.0',
  renderAs: 'breadboard',
  ports: [
    {
      id: 'vcc',
      name: '+（正电源轨）',
      role: 'power',
      direction: 'io',
      voltageDomain: '3V3',
      required: false,
      note: '整条正轨互通，通常接开发板 3V3 或 5V',
    },
    {
      id: 'gnd',
      name: '−（负电源轨）',
      role: 'ground',
      direction: 'io',
      voltageDomain: 'GND',
      required: false,
      note: '整条负轨互通，通常接开发板 GND',
    },
    ...columnPorts,
  ],
  protocols: [],
  requirements: [],
  description: `面包板（简化模型）：${COLUMNS} 列独立等电位组 + 正负两条电源轨。把开发板引脚引到某一列，即可从该列分接到多个器件（一个 GPIO 驱动多路）；电源轨用于给多组器件统一供 3V3 / GND。列内孔位互通、列与列之间绝缘。`,
};

/**
 * 控制面板（左栏下半部）：
 *  - 运行设置：WiFi 场景 / 校验模式（严格·宽松）/ 模拟后端离线（演示降级）
 *  - 连接管理：逐条启用或禁用（禁用者不参与校验）
 *  - 组件端口配置：选择端口用途 / 是否已接上拉等（驱动组件声明式需求）
 * 出现条件：画布中已有组件且已存在连线（对齐产品文档 6.1 的交互约定）。
 */
import { getComponentDef } from '../definitions/components';
import { ESP32_DEVKITC_V4 } from '../definitions/esp32';
import type { Connection, EndpointRef } from '../definitions/types';
import { useProjectStore } from '../store/useProjectStore';

export const InspectorPanel = () => {
  const instances = useProjectStore((state) => state.instances);
  const connections = useProjectStore((state) => state.connections);
  const selectedInstanceId = useProjectStore((state) => state.selectedInstanceId);
  const options = useProjectStore((state) => state.options);
  const setOptions = useProjectStore((state) => state.setOptions);
  const setPortConfig = useProjectStore((state) => state.setPortConfig);
  const toggleConnectionEnabled = useProjectStore((state) => state.toggleConnectionEnabled);
  const removeConnection = useProjectStore((state) => state.removeConnection);
  const selectInstance = useProjectStore((state) => state.selectInstance);

  const instanceLabel = (id: string): string =>
    instances.find((item) => item.id === id)?.label ?? id;

  const labelOf = (ref: EndpointRef): string => {
    if (ref.type === 'pin') {
      const pin = ESP32_DEVKITC_V4.pins.find((item) => item.id === ref.pinId);
      return pin ? `开发板 ${pin.physicalLabel}` : ref.pinId;
    }
    return `${instanceLabel(ref.instanceId)}.${ref.portId}`;
  };

  const visible = instances.length > 0 && connections.length > 0;

  return (
    <section className="panel">
      <h2 className="panel-title">控制面板</h2>

      {!visible ? (
        <p className="panel-placeholder">
          放置组件并连线后，此处可配置端口用途与连接开关。
        </p>
      ) : (
        <>
          <div className="panel-block">
            <div className="panel-block-title">运行设置</div>
            <label className="switch-row">
              <input
                type="checkbox"
                checked={options.wifiEnabled}
                onChange={(event) => setOptions({ wifiEnabled: event.target.checked })}
              />
              <span>启用 WiFi 场景（影响 ADC2 引脚可用性）</span>
            </label>
            <label className="switch-row">
              <span>校验模式</span>
              <select
                value={options.mode}
                onChange={(event) =>
                  setOptions({ mode: event.target.value === 'strict' ? 'strict' : 'loose' })
                }
              >
                <option value="loose">宽松：仅错误阻断</option>
                <option value="strict">严格：警告也算未通过</option>
              </select>
            </label>
            <label className="switch-row">
              <input
                type="checkbox"
                checked={options.backendOffline}
                onChange={(event) => setOptions({ backendOffline: event.target.checked })}
              />
              <span>模拟后端离线（验证离线降级）</span>
            </label>
          </div>

          <div className="panel-block">
            <div className="panel-block-title">连接开关（{connections.length}）</div>
            {connections.map((conn: Connection) => (
              <div className={`conn-row${conn.enabled ? '' : ' conn-off'}`} key={conn.id}>
                <input
                  type="checkbox"
                  checked={conn.enabled}
                  onChange={() => toggleConnectionEnabled(conn.id)}
                  title="取消勾选表示该连线不参与校验"
                />
                <span className="conn-text">
                  {labelOf(conn.from)} <span className="conn-arrow">↔</span> {labelOf(conn.to)}
                </span>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => removeConnection(conn.id)}
                  title="删除这条连线"
                >
                  删除
                </button>
              </div>
            ))}
          </div>

          <div className="panel-block">
            <div className="panel-block-title">组件配置</div>
            {instances.map((instance) => {
              const def = getComponentDef(instance.definitionSlug);
              const isActive = selectedInstanceId === instance.id;
              return (
                <div className={`inst-row${isActive ? ' inst-active' : ''}`} key={instance.id}>
                  <button type="button" className="inst-head" onClick={() => selectInstance(instance.id)}>
                    <span className="inst-icon">{def.icon}</span>
                    <span>{instance.label}</span>
                    <span className="inst-count">
                      {
                        connections.filter((conn) => {
                          const refs = [conn.from, conn.to];
                          return refs.some(
                            (ref) => ref.type === 'port' && ref.instanceId === instance.id,
                          );
                        }).length
                      }
                      /{def.ports.length} 已接
                    </span>
                  </button>
                  {(def.portOptions ?? []).length > 0 ? (
                    <div className="inst-options">
                      {(def.portOptions ?? []).map((option) => (
                        <label className="option-row" key={option.key}>
                          <span>{option.label}</span>
                          {option.kind === 'toggle' ? (
                            <input
                              type="checkbox"
                              checked={instance.portConfig[option.key] === true}
                              onChange={(event) =>
                                setPortConfig(instance.id, option.key, event.target.checked)
                              }
                            />
                          ) : (
                            <select
                              value={String(instance.portConfig[option.key] ?? option.defaultValue)}
                              onChange={(event) =>
                                setPortConfig(instance.id, option.key, event.target.value)
                              }
                            >
                              {(option.options ?? []).map((value) => (
                                <option key={value} value={value}>
                                  {value}
                                </option>
                              ))}
                            </select>
                          )}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="inst-options inst-options-empty">该组件无可配置项</div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
};

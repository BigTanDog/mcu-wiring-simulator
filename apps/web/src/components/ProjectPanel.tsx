/**
 * 项目管理面板（M-01）
 *
 * 能力：新建云端项目 / 列出并打开 / 删除 / 保存当前画布到云端；
 * 冲突处理：后端返回 409（revision 不匹配）时提示"覆盖保存"或重新打开。
 * 说明：本地草稿仍由 localStorage 自动保存，未绑定云端时不影响使用。
 */
import { useState } from 'react';
import { useProjectStore } from '../store/useProjectStore';

const SAVE_LABEL: Record<string, string> = {
  idle: '未绑定云端',
  dirty: '有未保存改动',
  saving: '保存中…',
  saved: '已保存',
  error: '保存失败',
  conflict: '云端已更新',
};

export const ProjectPanel = () => {
  const open = useProjectStore((state) => state.projectPanelOpen);
  const setOpen = useProjectStore((state) => state.setProjectPanelOpen);
  const list = useProjectStore((state) => state.projectList);
  const loading = useProjectStore((state) => state.projectListLoading);
  const currentProjectId = useProjectStore((state) => state.currentProjectId);
  const currentRevision = useProjectStore((state) => state.currentRevision);
  const saveState = useProjectStore((state) => state.saveState);
  const projectName = useProjectStore((state) => state.projectName);
  const createProjectOnServer = useProjectStore((state) => state.createProjectOnServer);
  const openProjectById = useProjectStore((state) => state.openProjectById);
  const saveProjectToServer = useProjectStore((state) => state.saveProjectToServer);
  const deleteProjectById = useProjectStore((state) => state.deleteProjectById);
  const [newName, setNewName] = useState('');

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={() => setOpen(false)}>
      <div className="project-modal" onClick={(event) => event.stopPropagation()}>
        <header className="modal-head">
          <h2>项目管理</h2>
          <button type="button" className="link-btn" onClick={() => setOpen(false)}>
            关闭
          </button>
        </header>

        <section className="project-current">
          <div>
            <div className="project-current-name">{projectName}</div>
            <div className="project-current-meta">
              {currentProjectId ? `已绑定云端 · revision ${currentRevision}` : '尚未绑定云端项目'}
              <span className={`save-badge save-${saveState}`}>{SAVE_LABEL[saveState]}</span>
            </div>
          </div>
          <div className="project-actions">
            <button
              type="button"
              className="btn"
              onClick={() => void saveProjectToServer()}
              disabled={!currentProjectId || saveState === 'saving'}
            >
              保存到云端
            </button>
            {saveState === 'conflict' ? (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => void saveProjectToServer({ force: true })}
                title="用本地画布覆盖云端版本（拉取最新 revision 后重试）"
              >
                覆盖保存
              </button>
            ) : null}
          </div>
        </section>

        <section className="project-create">
          <input
            className="search-input"
            placeholder="新项目名称（如：超声波测距实验）"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
          <button
            type="button"
            className="btn"
            disabled={newName.trim().length === 0}
            onClick={() => {
              void createProjectOnServer(newName.trim());
              setNewName('');
            }}
          >
            新建云端项目
          </button>
        </section>

        <section className="project-list">
          <div className="panel-block-title">云端项目（{list.length}）</div>
          {loading ? <p className="lib-hint">加载中…</p> : null}
          {!loading && list.length === 0 ? (
            <p className="lib-hint">
              还没有云端项目：可新建一个（会把当前画布内容一并保存），或用「导入 JSON」上传本地草稿。
            </p>
          ) : null}
          {list.map((item) => (
            <div
              className={`project-row${item.id === currentProjectId ? ' project-row-active' : ''}`}
              key={item.id}
            >
              <div className="project-row-main">
                <div className="project-row-name">{item.name}</div>
                <div className="project-row-meta">
                  {item.componentCount} 组件 · {item.connectionCount} 连线 · 更新于{' '}
                  {new Date(item.updatedAt).toLocaleString('zh-CN')}
                </div>
              </div>
              <button
                type="button"
                className="target-chip"
                onClick={() => void openProjectById(item.id)}
              >
                打开
              </button>
              <button
                type="button"
                className="link-btn"
                onClick={() => void deleteProjectById(item.id)}
                title="删除云端项目"
              >
                删除
              </button>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
};

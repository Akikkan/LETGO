const projectSidebarMedia = window.matchMedia('(max-width: 959px)');
let projectSidebarInitialized = false;

function projectSidebarExpandedPreference() {
  try { return window.localStorage.getItem('shiguang.projectSidebarExpanded') !== 'false'; }
  catch { return true; }
}

function setProjectSidebarExpandedPreference(expanded) {
  try { window.localStorage.setItem('shiguang.projectSidebarExpanded', String(expanded)); }
  catch { /* The sidebar still works when storage is unavailable. */ }
}

function syncProjectSidebarButton() {
  const root = document.querySelector('#shiguang');
  const button = document.querySelector('#sidebar-toggle');
  if (!root || !button) return;
  const expanded = projectSidebarMedia.matches
    ? root.classList.contains('sidebar-open')
    : !root.classList.contains('sidebar-collapsed');
  button.setAttribute('aria-expanded', String(expanded));
  button.setAttribute('aria-label', expanded ? '收起项目栏' : '展开项目栏');
  button.title = expanded ? '收起项目栏' : '展开项目栏';
  const sidebar=document.querySelector('#project-sidebar');
  if(sidebar)sidebar.inert=!expanded;
}

function initializeProjectSidebar() {
  if (projectSidebarInitialized) return;
  projectSidebarInitialized = true;
  const root = document.querySelector('#shiguang');
  if (!root) return;
  root.classList.toggle('sidebar-collapsed', !projectSidebarExpandedPreference());
  root.classList.remove('sidebar-open');
  syncProjectSidebarButton();
}

function toggleProjectSidebar(force) {
  initializeProjectSidebar();
  const root = document.querySelector('#shiguang');
  if (!root) return;
  if (projectSidebarMedia.matches) {
    const open = typeof force === 'boolean' ? force : !root.classList.contains('sidebar-open');
    root.classList.toggle('sidebar-open', open);
  } else {
    const expanded = typeof force === 'boolean' ? force : root.classList.contains('sidebar-collapsed');
    root.classList.toggle('sidebar-collapsed', !expanded);
    root.classList.remove('sidebar-open');
    setProjectSidebarExpandedPreference(expanded);
  }
  syncProjectSidebarButton();
}

function renderProjectSidebar({ recent = [], activeId = null, busy = false } = {}) {
  initializeProjectSidebar();
  const list = document.querySelector('#project-list');
  if (!list) return;
  const projects = Array.isArray(recent) ? recent : [];
  list.innerHTML = projects.map((project) => {
    const id = escapeProjectSidebar(project.id);
    const name = escapeProjectSidebar(project.name || '未命名工作区');
    const total = Math.max(0, Number(project.total) || 0);
    const processed = Math.max(0, Number(project.processed) || 0);
    const complete = total > 0 && processed >= total;
    const current = String(project.id) === String(activeId);
    const percent = total ? Math.min(100, Math.round((processed / total) * 100)) : 0;
    return `<div class="project-row${current ? ' is-active' : ''}">
      <button class="project-open" type="button" data-workspace="${id}" ${busy ? 'disabled' : ''} ${current ? 'aria-current="page"' : ''} title="${name}">
        <span class="project-name">${name}</span>
        <span class="project-progress"><span>${processed} / ${total}</span>${complete ? '<span class="project-trophy" aria-label="已完成">🏆</span>' : ''}</span>
        <span class="project-progress-track" aria-hidden="true"><span style="width:${percent}%"></span></span>
      </button>
      <button class="project-settings" type="button" data-project-settings="${id}" aria-label="设置 ${name}" title="项目设置" ${busy ? 'disabled' : ''}>⚙</button>
    </div>`;
  }).join('') || '<p class="project-empty">还没有项目</p>';
  syncProjectSidebarButton();
}

function escapeProjectSidebar(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

projectSidebarMedia.addEventListener('change', () => {
  const root = document.querySelector('#shiguang');
  if (!root) return;
  if (projectSidebarMedia.matches) root.classList.remove('sidebar-open');
  else {
    root.classList.remove('sidebar-open');
    root.classList.toggle('sidebar-collapsed', !projectSidebarExpandedPreference());
  }
  syncProjectSidebarButton();
});

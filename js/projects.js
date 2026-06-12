const ProjectsScreen = {
  currentView: 'active',

  filteredProjects(data, view) {
    const projects = data.projects || [];
    if (view === 'active') return projects.filter(p => p.status === 'ACTIVE' || p.status === 'PLANNING');
    if (view === 'all') return projects;
    // by category
    return projects.filter(p => p.category === view);
  },

  categories: ['PROPERTY','VEHICLE','FAMILY','LAND','OTHER'],
  statuses: ['PLANNING','ACTIVE','ON HOLD','DONE'],

  progressColor(pct) {
    if (pct >= 100) return 'green';
    if (pct >= 50)  return 'yellow';
    return 'orange';
  },

  projectCardHTML(project) {
    const milestones = project.milestones || [];
    const done = milestones.filter(m => m.done).length;
    const pct = milestones.length > 0
      ? Math.round((done / milestones.length) * 100)
      : Number(project.manualPct || 0);
    const color = this.progressColor(pct);

    const budgetSpent = Number(project.budgetSpent || 0);
    const budgetTarget = Number(project.budgetTarget || 0);

    return `
      <div class="card" data-id="${project.id}">
        <div class="flex-between mb-8">
          <div class="card-title">${Utils.escape(project.name)}</div>
          <span class="status status-${project.status.toLowerCase().replace(' ','-')}">${project.status}</span>
        </div>
        <div class="card-meta mb-8">
          <span class="text-muted">${project.category}</span>
          ${project.targetDate ? `<span>${Utils.formatDate(project.targetDate)}</span>` : ''}
          ${budgetTarget > 0 ? `<span>${Utils.formatCurrency(budgetSpent)} / ${Utils.formatCurrency(budgetTarget)}</span>` : ''}
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${color}" style="width:${pct}%"></div>
        </div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;">
          ${milestones.length > 0 ? `${done}/${milestones.length} MILESTONES` : `${pct}%`}
        </div>
      </div>
    `;
  },

  render() {
    const data = Storage.get();
    const filtered = this.filteredProjects(data, this.currentView);

    let listHTML = filtered.length === 0
      ? `<div class="empty-state">
           <div class="empty-state-title">NO PROJECTS</div>
           <div class="empty-state-text">Add a project — building a shed, buying a block, fencing a paddock.</div>
         </div>`
      : filtered.map(p => this.projectCardHTML(p)).join('');

    const cats = this.categories;
    return `
      <div class="screen" id="screen-projects" data-glyph="▦">
        <div class="screen-header">
          <div class="screen-title">PROJECTS</div>
        </div>
        <div class="view-tabs">
          <button class="view-tab ${this.currentView==='active'?'active':''}" data-view="active">ACTIVE</button>
          <button class="view-tab ${this.currentView==='all'?'active':''}" data-view="all">ALL</button>
          ${cats.map(c => `
            <button class="view-tab ${this.currentView===c?'active':''}" data-view="${c}">${c}</button>
          `).join('')}
        </div>
        <div id="projects-list">${listHTML}</div>
      </div>
    `;
  },

  bind() {
    document.querySelectorAll('#screen-projects .view-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentView = btn.dataset.view;
        App.renderCurrent();
      });
    });

    document.querySelectorAll('#projects-list .card').forEach(card => {
      card.addEventListener('click', () => {
        const data = Storage.get();
        const project = data.projects.find(p => p.id === card.dataset.id);
        if (project) this.openEditModal(project);
      });
    });
  },

  openAddModal() {
    Modal.open('ADD PROJECT', this.formHTML());
    Modal.content.querySelector('[data-save]').addEventListener('click', () => this.saveFromModal(null));
    this.bindMilestones({});
  },

  openEditModal(project) {
    Modal.open('EDIT PROJECT', this.formHTML(project));
    Modal.content.querySelector('[data-save]').addEventListener('click', () => this.saveFromModal(project.id));
    const delBtn = Modal.content.querySelector('[data-delete]');
    if (delBtn) delBtn.addEventListener('click', () => {
      Modal.confirm(`Delete project "${project.name}"?`, () => {
        Storage.update(d => { d.projects = d.projects.filter(p => p.id !== project.id); });
        App.renderCurrent();
      });
    });
    this.bindMilestones(project);
  },

  formHTML(project = {}) {
    const milestones = project.milestones || [];
    return `
      <div class="form-group">
        <label class="form-label">PROJECT NAME *</label>
        <input class="form-input" id="f-name" type="text" maxlength="80"
          value="${Utils.escape(project.name||'')}" placeholder="e.g. Build new shed">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">CATEGORY</label>
          <select class="form-select" id="f-category">
            ${this.categories.map(c => `<option ${project.category===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">STATUS</label>
          <select class="form-select" id="f-status">
            ${this.statuses.map(s => `<option value="${s}" ${project.status===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">BUDGET TARGET ($)</label>
          <input class="form-input" id="f-budget-target" type="number" min="0"
            value="${project.budgetTarget||''}" placeholder="0">
        </div>
        <div class="form-group">
          <label class="form-label">SPENT SO FAR ($)</label>
          <input class="form-input" id="f-budget-spent" type="number" min="0"
            value="${project.budgetSpent||''}" placeholder="0">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">TARGET DATE</label>
          <input class="form-input" id="f-target-date" type="date" value="${project.targetDate||''}">
        </div>
        <div class="form-group">
          <label class="form-label">PROGRESS % (if no milestones)</label>
          <input class="form-input" id="f-pct" type="number" min="0" max="100"
            value="${project.manualPct||0}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">MILESTONES</label>
        <ul class="milestone-list" id="milestone-list">
          ${milestones.map((m, i) => this.milestoneItemHTML(m, i)).join('')}
        </ul>
        <button type="button" class="btn btn-secondary btn-sm mt-8" id="add-milestone" style="margin-top:8px;">+ ADD MILESTONE</button>
      </div>
      <div class="form-group">
        <label class="form-label">NOTES</label>
        <textarea class="form-textarea" id="f-notes"
          placeholder="Notes...">${Utils.escape(project.notes||'')}</textarea>
      </div>
      <div class="form-actions">
        ${project.id ? `<button class="btn btn-danger" data-delete>DELETE</button>` : ''}
        <button class="btn btn-primary" data-save>SAVE PROJECT</button>
      </div>
    `;
  },

  milestoneItemHTML(m, i) {
    return `
      <li class="milestone-item" data-mi="${i}">
        <button type="button" class="milestone-check ${m.done?'checked':''}" data-check="${i}">
          ${m.done ? '✓' : ''}
        </button>
        <input type="text" class="form-input" style="flex:1;padding:6px 8px;"
          value="${Utils.escape(m.text||'')}" placeholder="Milestone..." data-mtext="${i}" maxlength="80">
        <button type="button" class="btn btn-danger btn-sm" data-mremove="${i}" style="padding:6px 8px;">✕</button>
      </li>
    `;
  },

  bindMilestones(project) {
    const list = document.getElementById('milestone-list');
    if (!list) return;

    document.getElementById('add-milestone').addEventListener('click', () => {
      if (list.children.length >= 10) return;
      const i = list.children.length;
      list.insertAdjacentHTML('beforeend', this.milestoneItemHTML({ text: '', done: false }, i));
      list.lastElementChild.querySelector('input').focus();
    });

    list.addEventListener('click', (e) => {
      const checkBtn = e.target.closest('[data-check]');
      const removeBtn = e.target.closest('[data-mremove]');
      if (checkBtn) {
        checkBtn.classList.toggle('checked');
        checkBtn.textContent = checkBtn.classList.contains('checked') ? '✓' : '';
      }
      if (removeBtn) {
        removeBtn.closest('.milestone-item').remove();
      }
    });
  },

  getMilestones() {
    const list = document.getElementById('milestone-list');
    if (!list) return [];
    const items = [];
    list.querySelectorAll('.milestone-item').forEach(li => {
      const text = li.querySelector('[data-mtext]')?.value?.trim() || li.querySelector('input')?.value?.trim() || '';
      const done = li.querySelector('[data-check]')?.classList.contains('checked') || false;
      if (text) items.push({ text, done });
    });
    return items;
  },

  saveFromModal(existingId) {
    const name = document.getElementById('f-name').value.trim();
    if (!name) { alert('Project name is required.'); return; }

    const project = {
      id: existingId || Utils.id(),
      name,
      category:     document.getElementById('f-category').value,
      status:       document.getElementById('f-status').value,
      budgetTarget: Number(document.getElementById('f-budget-target').value) || 0,
      budgetSpent:  Number(document.getElementById('f-budget-spent').value) || 0,
      targetDate:   document.getElementById('f-target-date').value,
      manualPct:    Number(document.getElementById('f-pct').value) || 0,
      notes:        document.getElementById('f-notes').value.trim(),
      milestones:   this.getMilestones(),
    };

    Storage.update(d => {
      if (existingId) {
        const idx = d.projects.findIndex(p => p.id === existingId);
        if (idx >= 0) d.projects[idx] = project;
      } else {
        d.projects.unshift(project);
      }
    });
    Modal.close();
    App.renderCurrent();
  }
};

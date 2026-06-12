const JobsScreen = {
  currentView: 'active',

  statusClass(s) {
    return 'status-' + s.toLowerCase().replace(' ', '-');
  },

  filteredJobs(data, view) {
    const jobs = data.jobs || [];
    if (view === 'active')   return jobs.filter(j => j.status === 'ACTIVE' || j.status === 'INVOICED');
    if (view === 'pipeline') return jobs.filter(j => j.status === 'QUOTED');
    if (view === 'archive')  return jobs.filter(j => j.status === 'PAID' || j.status === 'CANCELLED');
    return jobs;
  },

  totalKm(job) {
    return (job.trips || []).reduce((s, t) => {
      const km = (Number(t.odomEnd) || 0) - (Number(t.odomStart) || 0);
      return s + Math.max(0, km);
    }, 0);
  },

  totalCosts(job) {
    return (job.costs || []).reduce((s, c) => s + Number(c.amount || 0), 0);
  },

  grossMargin(job) {
    return Number(job.value || 0) - this.totalCosts(job);
  },

  statsBar(data) {
    const jobs = data.jobs || [];
    const activeCount = jobs.filter(j => j.status === 'ACTIVE').length;
    const quotedVal   = jobs.filter(j => j.status === 'QUOTED').reduce((s,j) => s + Number(j.value||0), 0);
    const unpaidVal   = jobs.filter(j => j.status === 'INVOICED').reduce((s,j) => s + Number(j.value||0), 0);
    return `
      <div class="stats-bar">
        <div class="stat-item">
          <div class="stat-label">ACTIVE</div>
          <div class="stat-value yellow">${activeCount}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">QUOTED</div>
          <div class="stat-value">${Utils.formatCurrency(quotedVal)}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">UNPAID</div>
          <div class="stat-value orange">${Utils.formatCurrency(unpaidVal)}</div>
        </div>
      </div>`;
  },

  jobCardHTML(job) {
    const daysLeft = job.deadline ? Utils.daysUntil(job.deadline) : null;
    const overdue = daysLeft !== null && daysLeft < 0;
    const costs = this.totalCosts(job);
    const km = this.totalKm(job);
    const margin = this.grossMargin(job);
    const hasFinancials = Number(job.value) > 0 || costs > 0;

    return `
      <div class="card" data-id="${job.id}">
        <div class="flex-between mb-8">
          <div class="card-title">${Utils.escape(job.name)}</div>
          <span class="status ${this.statusClass(job.status)}">${job.status}</span>
        </div>
        <div class="card-meta">
          ${job.client   ? `<span>${Utils.escape(job.client)}</span>` : ''}
          ${job.value    ? `<span class="text-yellow">${Utils.formatCurrency(job.value)}</span>` : ''}
          ${job.deadline ? `<span class="${overdue ? 'text-red' : ''}">${overdue ? 'OVERDUE' : Utils.formatDate(job.deadline)}</span>` : ''}
          ${job.location ? `<span class="text-muted">${Utils.escape(job.location)}</span>` : ''}
        </div>
        ${hasFinancials ? `
          <div class="job-financials">
            ${costs > 0 ? `<span>COSTS ${Utils.formatCurrency(costs)}</span>` : ''}
            ${Number(job.value) > 0 && costs > 0 ? `<span class="${margin >= 0 ? 'text-green' : 'text-red'}">MARGIN ${Utils.formatCurrency(margin)}</span>` : ''}
            ${km > 0 ? `<span class="text-muted">${km} km</span>` : ''}
          </div>` : ''}
      </div>`;
  },

  render() {
    const data = Storage.get();
    const filtered = this.filteredJobs(data, this.currentView);
    let listHTML = filtered.length === 0
      ? `<div class="empty-state"><div class="empty-state-title">NO JOBS HERE</div><div class="empty-state-text">Tap + to add a job.</div></div>`
      : filtered.map(j => this.jobCardHTML(j)).join('');

    return `
      <div class="screen" id="screen-jobs" data-glyph="◧">
        <div class="screen-header">
          <div class="screen-title">JOBS</div>
        </div>
        ${this.statsBar(data)}
        <div class="view-tabs">
          <button class="view-tab ${this.currentView==='active'?'active':''}" data-view="active">ACTIVE</button>
          <button class="view-tab ${this.currentView==='pipeline'?'active':''}" data-view="pipeline">PIPELINE</button>
          <button class="view-tab ${this.currentView==='archive'?'active':''}" data-view="archive">ARCHIVE</button>
        </div>
        <div id="jobs-list">${listHTML}</div>
      </div>`;
  },

  bind() {
    document.querySelectorAll('#screen-jobs .view-tab').forEach(btn => {
      btn.addEventListener('click', () => { this.currentView = btn.dataset.view; App.renderCurrent(); });
    });
    document.querySelectorAll('#jobs-list .card').forEach(card => {
      card.addEventListener('click', () => {
        const data = Storage.get();
        const job = data.jobs.find(j => j.id === card.dataset.id);
        if (job) this.openEditModal(job);
      });
    });
  },

  openAddModal() {
    Modal.open('ADD JOB', this.formHTML());
    this.bindForm(null);
  },

  openEditModal(job) {
    Modal.open('EDIT JOB', this.formHTML(job));
    this.bindForm(job.id, job);
  },

  bindForm(existingId, job = {}) {
    // Render existing costs/trips into the form so editing doesn't wipe them
    (job.costs || []).forEach(c => this.addCostRow(c));
    (job.trips || []).forEach(t => this.addTripRow(t));

    Modal.content.querySelector('[data-save]')?.addEventListener('click', () => this.saveFromModal(existingId));
    Modal.content.querySelector('[data-delete]')?.addEventListener('click', () => {
      Modal.confirm(`Delete job "${job.name}"?`, () => {
        Storage.update(d => { d.jobs = d.jobs.filter(j => j.id !== existingId); });
        App.renderCurrent();
      });
    });
    Modal.content.querySelector('#add-cost-btn')?.addEventListener('click', () => this.addCostRow());
    Modal.content.querySelector('#add-trip-btn')?.addEventListener('click', () => this.addTripRow());

    // Remove row buttons
    Modal.content.addEventListener('click', e => {
      if (e.target.closest('[data-remove-cost]')) e.target.closest('.cost-row').remove();
      if (e.target.closest('[data-remove-trip]')) e.target.closest('.trip-row').remove();
    });
  },

  addCostRow(cost = {}) {
    const list = document.getElementById('costs-list');
    if (!list) return;
    const cats = ['MATERIALS','FUEL','EQUIPMENT','SUBCONTRACTORS','OTHER'];
    const row = document.createElement('div');
    row.className = 'cost-row';
    row.innerHTML = `
      <div class="form-row" style="align-items:center;gap:8px;margin-bottom:8px;">
        <select class="form-select cost-cat" style="flex:1.2;">
          ${cats.map(c => `<option ${cost.category===c?'selected':''}>${c}</option>`).join('')}
        </select>
        <input class="form-input cost-amount" type="number" min="0" placeholder="$0" style="flex:0.8;" value="${cost.amount||''}">
        <input class="form-input cost-note" type="text" maxlength="40" placeholder="Note" style="flex:1.5;" value="${Utils.escape(cost.note||'')}">
        <button type="button" class="btn btn-danger btn-sm" data-remove-cost style="flex-shrink:0;">✕</button>
      </div>`;
    list.appendChild(row);
  },

  addTripRow(trip = {}) {
    const list = document.getElementById('trips-list');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'trip-row';
    row.innerHTML = `
      <div class="form-row" style="align-items:center;gap:8px;margin-bottom:8px;">
        <input class="form-input trip-date" type="date" style="flex:1;" value="${trip.date||Utils.today()}">
        <input class="form-input trip-start" type="number" min="0" placeholder="Start km" style="flex:1;" value="${trip.odomStart||''}">
        <input class="form-input trip-end" type="number" min="0" placeholder="End km" style="flex:1;" value="${trip.odomEnd||''}">
        <button type="button" class="btn btn-danger btn-sm" data-remove-trip style="flex-shrink:0;">✕</button>
      </div>`;
    list.appendChild(row);
  },

  formHTML(job = {}) {
    const statuses = ['QUOTED','ACTIVE','INVOICED','PAID','CANCELLED'];
    const costs = job.costs || [];
    const trips = job.trips || [];

    return `
      <div class="form-group">
        <label class="form-label">JOB NAME *</label>
        <input class="form-input" id="f-name" type="text" maxlength="80"
          value="${Utils.escape(job.name||'')}" placeholder="e.g. Smith bathroom reno">
      </div>
      <div class="form-group">
        <label class="form-label">CLIENT</label>
        <input class="form-input" id="f-client" type="text" maxlength="60"
          value="${Utils.escape(job.client||'')}" placeholder="Client name">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">STATUS</label>
          <select class="form-select" id="f-status">
            ${statuses.map(s => `<option value="${s}" ${job.status===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">INVOICED ($)</label>
          <input class="form-input" id="f-value" type="number" min="0"
            value="${job.value||''}" placeholder="0">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">START DATE</label>
          <input class="form-input" id="f-start" type="date" value="${job.startDate||''}">
        </div>
        <div class="form-group">
          <label class="form-label">DEADLINE</label>
          <input class="form-input" id="f-deadline" type="date" value="${job.deadline||''}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">LOCATION</label>
        <input class="form-input" id="f-location" type="text" maxlength="100"
          value="${Utils.escape(job.location||'')}" placeholder="Address or property name">
      </div>
      <div class="form-group">
        <label class="form-label">NOTES</label>
        <textarea class="form-textarea" id="f-notes" maxlength="500"
          placeholder="Free notes...">${Utils.escape(job.notes||'')}</textarea>
      </div>

      <div class="section-label" style="padding:16px 0 8px;">JOB COSTS</div>
      <div id="costs-list"></div>
      <button type="button" class="btn btn-secondary btn-sm" id="add-cost-btn">+ ADD COST</button>

      <div class="section-label" style="padding:16px 0 8px;">MILEAGE / KM LOG</div>
      <div class="card-meta text-muted" style="font-size:11px;margin-bottom:8px;">ATO logbook — start &amp; end odometer per trip</div>
      <div id="trips-list"></div>
      <button type="button" class="btn btn-secondary btn-sm" id="add-trip-btn">+ ADD TRIP</button>

      <div class="form-actions" style="margin-top:24px;">
        ${job.id ? `<button class="btn btn-danger" data-delete>DELETE</button>` : ''}
        <button class="btn btn-primary" data-save>SAVE JOB</button>
      </div>`;
  },

  getCosts() {
    return [...document.querySelectorAll('.cost-row')].map(row => ({
      id: Utils.id(),
      category: row.querySelector('.cost-cat')?.value || 'OTHER',
      amount:   Number(row.querySelector('.cost-amount')?.value) || 0,
      note:     row.querySelector('.cost-note')?.value?.trim() || '',
    })).filter(c => c.amount > 0);
  },

  getTrips() {
    return [...document.querySelectorAll('.trip-row')].map(row => ({
      id:        Utils.id(),
      date:      row.querySelector('.trip-date')?.value || Utils.today(),
      odomStart: Number(row.querySelector('.trip-start')?.value) || 0,
      odomEnd:   Number(row.querySelector('.trip-end')?.value) || 0,
    })).filter(t => t.odomEnd > t.odomStart);
  },

  saveFromModal(existingId) {
    const name = document.getElementById('f-name').value.trim();
    if (!name) { alert('Job name is required.'); return; }

    const job = {
      id:        existingId || Utils.id(),
      name,
      client:    document.getElementById('f-client').value.trim(),
      status:    document.getElementById('f-status').value,
      value:     Number(document.getElementById('f-value').value) || 0,
      startDate: document.getElementById('f-start').value,
      deadline:  document.getElementById('f-deadline').value,
      location:  document.getElementById('f-location').value.trim(),
      notes:     document.getElementById('f-notes').value.trim(),
      costs:     this.getCosts(),
      trips:     this.getTrips(),
    };

    // Detect QUOTED/ACTIVE/INVOICED → PAID transition
    const prev = existingId ? Storage.get().jobs.find(j => j.id === existingId) : null;
    const justPaid = job.status === 'PAID' && (!prev || prev.status !== 'PAID') && job.value > 0;

    Storage.update(d => {
      if (existingId) {
        const idx = d.jobs.findIndex(j => j.id === existingId);
        if (idx >= 0) d.jobs[idx] = job;
      } else {
        d.jobs.unshift(job);
      }
    });
    Modal.close();

    if (justPaid && confirm(`Log ${Utils.formatCurrency(job.value)} from "${job.name}" as income?`)) {
      Storage.update(d => {
        d.money.income.push({
          id: Utils.id(),
          amount: job.value,
          source: job.name + (job.client ? ' — ' + job.client : ''),
          date: Utils.today(),
        });
      });
    }
    App.renderCurrent();
  }
};

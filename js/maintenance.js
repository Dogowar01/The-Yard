const MaintenanceScreen = {
  assetTypes: ['VEHICLE','EQUIPMENT','PROPERTY','OTHER'],

  computeStatus(asset) {
    if (!asset.nextServiceDate) return 'OK';
    const days = Utils.daysUntil(asset.nextServiceDate);
    if (days < 0) return 'OVERDUE';
    if (days <= 30) return 'DUE SOON';
    return 'OK';
  },

  assetCardHTML(asset) {
    const status = this.computeStatus(asset);
    const statusClass = status === 'OVERDUE' ? 'status-overdue' : status === 'DUE SOON' ? 'status-due-soon' : 'status-ok';
    const days = asset.nextServiceDate ? Utils.daysUntil(asset.nextServiceDate) : null;
    let dueStr = asset.nextServiceDate ? Utils.formatDate(asset.nextServiceDate) : '—';
    if (days !== null && days < 0) dueStr = `OVERDUE by ${Math.abs(days)} days`;
    else if (days !== null && days <= 30) dueStr = `DUE IN ${days} days`;

    return `
      <div class="card" data-id="${asset.id}">
        <div class="flex-between mb-8">
          <div class="card-title">${Utils.escape(asset.name)}</div>
          <span class="status ${statusClass}">${status}</span>
        </div>
        <div class="flex-between">
          <div class="card-meta">
            <span class="text-muted">${asset.type}</span>
            ${asset.lastServiceDate ? `<span>LAST: ${Utils.formatDate(asset.lastServiceDate)}</span>` : ''}
            ${asset.nextServiceDate ? `<span class="${status !== 'OK' ? (status === 'OVERDUE' ? 'text-red' : 'text-orange') : ''}">${dueStr}</span>` : ''}
          </div>
          ${status !== 'OK' ? `<button class="btn btn-primary btn-sm" data-serviced="${asset.id}">SERVICED ✓</button>` : ''}
        </div>
        ${asset.notes ? `<div class="card-meta mt-8" style="font-style:italic;">${Utils.escape(asset.notes.slice(0,80))}</div>` : ''}
      </div>
    `;
  },

  markServiced(id) {
    const data = Storage.get();
    const asset = (data.assets || []).find(a => a.id === id);
    if (!asset) return;

    const months = Number(asset.intervalMonths) || 0;
    Storage.update(d => {
      const idx = d.assets.findIndex(a => a.id === id);
      if (idx < 0) return;
      d.assets[idx].lastServiceDate = Utils.today();
      if (months > 0) {
        const next = new Date();
        next.setMonth(next.getMonth() + months);
        d.assets[idx].nextServiceDate = Utils.toISO(next);
      } else {
        d.assets[idx].nextServiceDate = '';
      }
    });
    App.renderCurrent();
    this.updateBadge(Storage.get());
    // No interval set — they'll want to pick the next date themselves
    if (months === 0) {
      const updated = Storage.get().assets.find(a => a.id === id);
      if (updated) this.openEditModal(updated);
    }
  },

  updateBadge(data) {
    const badge = document.getElementById('maint-badge');
    if (!badge) return;
    const assets = data.assets || [];
    const hasOverdue = assets.some(a => this.computeStatus(a) === 'OVERDUE');
    if (hasOverdue) {
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  },

  render() {
    const data = Storage.get();
    const assets = (data.assets || []).map(a => ({ ...a, _status: this.computeStatus(a) }));
    const sorted = [...assets].sort((a, b) => {
      const order = { 'OVERDUE': 0, 'DUE SOON': 1, 'OK': 2 };
      return (order[a._status] || 2) - (order[b._status] || 2);
    });

    this.updateBadge(data);

    let listHTML = sorted.length === 0
      ? `<div class="empty-state">
           <div class="empty-state-title">NO ASSETS</div>
           <div class="empty-state-text">Add your ute, tractor, generator — anything that needs regular service. The Yard will remind you when it's due.</div>
         </div>`
      : sorted.map(a => this.assetCardHTML(a)).join('');

    const overdueCount = assets.filter(a => a._status === 'OVERDUE').length;
    const dueSoonCount = assets.filter(a => a._status === 'DUE SOON').length;

    return `
      <div class="screen" id="screen-maintenance" data-glyph="⚙">
        <div class="screen-header">
          <div class="screen-title">MAINTENANCE</div>
        </div>
        <div class="stats-bar">
          <div class="stat-item">
            <div class="stat-label">ASSETS</div>
            <div class="stat-value">${assets.length}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">OVERDUE</div>
            <div class="stat-value ${overdueCount > 0 ? 'red' : ''}">${overdueCount}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">DUE SOON</div>
            <div class="stat-value ${dueSoonCount > 0 ? 'orange' : ''}">${dueSoonCount}</div>
          </div>
        </div>
        <div id="assets-list">${listHTML}</div>
      </div>
    `;
  },

  bind() {
    document.querySelectorAll('[data-serviced]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.markServiced(btn.dataset.serviced);
      });
    });

    document.querySelectorAll('#assets-list .card').forEach(card => {
      card.addEventListener('click', () => {
        const data = Storage.get();
        const asset = data.assets.find(a => a.id === card.dataset.id);
        if (asset) this.openEditModal(asset);
      });
    });
  },

  openAddModal() {
    Modal.open('ADD ASSET', this.formHTML());
    Modal.content.querySelector('[data-save]').addEventListener('click', () => this.saveFromModal(null));
  },

  openEditModal(asset) {
    Modal.open('EDIT ASSET', this.formHTML(asset));
    Modal.content.querySelector('[data-save]').addEventListener('click', () => this.saveFromModal(asset.id));
    const delBtn = Modal.content.querySelector('[data-delete]');
    if (delBtn) delBtn.addEventListener('click', () => {
      Modal.confirm(`Delete "${asset.name}"?`, () => {
        Storage.update(d => { d.assets = d.assets.filter(a => a.id !== asset.id); });
        App.renderCurrent();
        this.updateBadge(Storage.get());
      });
    });
  },

  formHTML(asset = {}) {
    return `
      <div class="form-group">
        <label class="form-label">ASSET NAME *</label>
        <input class="form-input" id="f-name" type="text" maxlength="60"
          value="${Utils.escape(asset.name||'')}" placeholder="e.g. 2019 Ford Ranger">
      </div>
      <div class="form-group">
        <label class="form-label">TYPE</label>
        <select class="form-select" id="f-type">
          ${this.assetTypes.map(t => `<option ${asset.type===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">LAST SERVICE</label>
          <input class="form-input" id="f-last" type="date" value="${asset.lastServiceDate||''}">
        </div>
        <div class="form-group">
          <label class="form-label">NEXT SERVICE DUE</label>
          <input class="form-input" id="f-next" type="date" value="${asset.nextServiceDate||''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">REPEATS EVERY (MONTHS)</label>
          <input class="form-input" id="f-interval-months" type="number" min="0" max="60"
            value="${asset.intervalMonths||''}" placeholder="e.g. 6">
        </div>
        <div class="form-group">
          <label class="form-label">INTERVAL NOTE</label>
          <input class="form-input" id="f-interval" type="text" maxlength="40"
            value="${Utils.escape(asset.serviceInterval||'')}" placeholder="e.g. or 10,000km">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">NOTES / SERVICE HISTORY</label>
        <textarea class="form-textarea" id="f-notes" maxlength="500"
          placeholder="Service history, fluid specs, parts...">${Utils.escape(asset.notes||'')}</textarea>
      </div>
      <div class="form-actions">
        ${asset.id ? `<button class="btn btn-danger" data-delete>DELETE</button>` : ''}
        <button class="btn btn-primary" data-save>SAVE ASSET</button>
      </div>
    `;
  },

  saveFromModal(existingId) {
    const name = document.getElementById('f-name').value.trim();
    if (!name) { alert('Asset name is required.'); return; }

    const asset = {
      id: existingId || Utils.id(),
      name,
      type:            document.getElementById('f-type').value,
      lastServiceDate: document.getElementById('f-last').value,
      nextServiceDate: document.getElementById('f-next').value,
      intervalMonths:  Number(document.getElementById('f-interval-months').value) || 0,
      serviceInterval: document.getElementById('f-interval').value.trim(),
      notes:           document.getElementById('f-notes').value.trim(),
    };
    asset.status = this.computeStatus(asset);

    Storage.update(d => {
      if (existingId) {
        const idx = d.assets.findIndex(a => a.id === existingId);
        if (idx >= 0) d.assets[idx] = asset;
      } else {
        d.assets.push(asset);
      }
    });
    Modal.close();
    App.renderCurrent();
    this.updateBadge(Storage.get());
  }
};

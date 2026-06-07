const FitnessScreen = {
  activityTypes: ['GYM','RUN','WALK','SWIM','MANUAL WORK','OTHER'],

  render() {
    const data = Storage.get();
    const targets = data.user.fitnessTargets || {};
    const fitness = data.fitness || [];

    // Build this week's log
    const weekStart = Utils.weekStart();
    const weekLogs = fitness.filter(e => e.date >= weekStart);

    // 7-day strip
    const dayLabels = ['M','T','W','T','F','S','S'];
    const today = new Date();
    const todayStr = Utils.today();
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      weekDays.push(d.toISOString().slice(0, 10));
    }

    const weekStripHTML = `
      <div class="week-strip">
        ${weekDays.map((day, i) => {
          const hasLog = weekLogs.some(e => e.date === day);
          const isToday = day === todayStr;
          return `
            <div class="day-cell">
              <div class="day-label">${dayLabels[i]}</div>
              <div class="day-dot ${hasLog ? 'active' : ''} ${isToday && !hasLog ? 'today-marker' : ''}">
                ${hasLog ? '✓' : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    const weekSessions = weekLogs.length;
    const weekMins = weekLogs.reduce((s,e) => s + Number(e.duration||0), 0);
    const targetSessions = Number(targets.sessions || 3);

    const sortedLogs = [...fitness].sort((a,b) => b.date.localeCompare(a.date));

    return `
      <div class="screen" id="screen-fitness" data-glyph="◑">
        <div class="screen-header">
          <div class="screen-title">FITNESS</div>
          <div class="screen-subtitle">WEEK ${Utils.weekNumber()}</div>
        </div>
        ${weekStripHTML}
        <div class="stats-bar">
          <div class="stat-item">
            <div class="stat-label">SESSIONS</div>
            <div class="stat-value ${weekSessions >= targetSessions ? 'green' : ''}">${weekSessions} / ${targetSessions}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">MINUTES</div>
            <div class="stat-value">${weekMins}</div>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" style="margin:12px 16px;" id="fitness-targets-btn">SET TARGETS</button>
        <div class="section-label">RECENT ACTIVITY</div>
        ${sortedLogs.length === 0
          ? `<div class="empty-state"><div class="empty-state-text">No activity logged yet.</div></div>`
          : sortedLogs.slice(0, 20).map(e => `
              <div class="card" data-fitness-id="${e.id}">
                <div class="flex-between">
                  <div class="card-title">${Utils.escape(e.type)}</div>
                  <span class="text-muted" style="font-size:12px;">${Utils.formatDate(e.date)}</span>
                </div>
                <div class="card-meta">
                  <span>${e.duration} min</span>
                  ${e.notes ? `<span>${Utils.escape(e.notes)}</span>` : ''}
                </div>
              </div>
            `).join('')
        }
      </div>
    `;
  },

  bind() {
    document.getElementById('fitness-targets-btn')?.addEventListener('click', () => this.openTargetsModal());

    document.querySelectorAll('[data-fitness-id]').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.fitnessId;
        Modal.confirm('Delete this entry?', () => {
          Storage.update(d => { d.fitness = d.fitness.filter(e => e.id !== id); });
          App.renderCurrent();
        });
      });
    });
  },

  openAddModal() {
    Modal.open('LOG ACTIVITY', `
      <div class="form-group">
        <label class="form-label">TYPE</label>
        <select class="form-select" id="f-type">
          ${this.activityTypes.map(t => `<option>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">DURATION (MINUTES)</label>
        <input class="form-input" id="f-duration" type="number" min="1" placeholder="60">
      </div>
      <div class="form-group">
        <label class="form-label">DATE</label>
        <input class="form-input" id="f-date" type="date" value="${Utils.today()}">
      </div>
      <div class="form-group">
        <label class="form-label">NOTES</label>
        <input class="form-input" id="f-notes" type="text" maxlength="80" placeholder="Optional">
      </div>
      <div class="form-actions">
        <button class="btn btn-primary btn-block" data-save>LOG IT</button>
      </div>
    `);
    Modal.content.querySelector('[data-save]').addEventListener('click', () => {
      const duration = Number(document.getElementById('f-duration').value);
      if (!duration) { alert('Enter duration.'); return; }
      Storage.update(d => {
        d.fitness.push({
          id: Utils.id(),
          type: document.getElementById('f-type').value,
          duration,
          date: document.getElementById('f-date').value || Utils.today(),
          notes: document.getElementById('f-notes').value.trim(),
        });
      });
      Modal.close(); App.renderCurrent();
    });
  },

  openTargetsModal() {
    const data = Storage.get();
    const t = data.user.fitnessTargets || {};
    Modal.open('FITNESS TARGETS', `
      <div class="form-group">
        <label class="form-label">SESSIONS PER WEEK</label>
        <input class="form-input" id="f-sessions" type="number" min="0" max="14"
          value="${t.sessions||3}">
      </div>
      <div class="form-actions">
        <button class="btn btn-primary btn-block" data-save>SAVE</button>
      </div>
    `);
    Modal.content.querySelector('[data-save]').addEventListener('click', () => {
      Storage.update(d => {
        d.user.fitnessTargets = { sessions: Number(document.getElementById('f-sessions').value) || 3 };
      });
      Modal.close(); App.renderCurrent();
    });
  }
};

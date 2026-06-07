const TodayScreen = {
  render() {
    const data = Storage.get();
    const now = new Date();
    const days = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const dayName = days[now.getDay()];
    const dateStr = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
    const weekNum = Utils.weekNumber();

    // Weekly income
    const weekStart = Utils.weekStart();
    const weekIncome = (data.money.income || [])
      .filter(e => e.date >= weekStart)
      .reduce((s, e) => s + Number(e.amount), 0);
    const target = Number(data.user.weeklyIncomeTarget) || 0;
    const pct = target > 0 ? Utils.clamp((weekIncome / target) * 100, 0, 100) : 0;
    const barColor = pct >= 100 ? 'green' : pct >= 60 ? 'yellow' : 'orange';

    // Jobs due today
    const todayStr = Utils.today();
    const jobsDue = (data.jobs || []).filter(j =>
      j.deadline === todayStr && j.status !== 'PAID' && j.status !== 'CANCELLED'
    );

    // Maintenance alerts — detailed
    const overdueAssets = (data.assets || []).filter(a => MaintenanceScreen.computeStatus(a) === 'OVERDUE');
    const dueSoonAssets = (data.assets || []).filter(a => MaintenanceScreen.computeStatus(a) === 'DUE SOON');

    // Upcoming bills (next 14 days)
    const bills = data.money.bills || [];
    const upcomingBills = bills.filter(b => {
      const days = Utils.daysUntil(b.nextDue);
      return days !== null && days >= 0 && days <= 14;
    }).sort((a, b) => a.nextDue.localeCompare(b.nextDue));

    // FIFO roster
    const fifo = data.user.fifo || {};
    const fifoHTML = this.fifoHTML(fifo);

    // Build alerts
    let alertsHTML = '';
    if (overdueAssets.length > 0) {
      alertsHTML += `
        <div class="today-alert red" id="alert-maint-overdue">
          <div class="today-alert-label">⚠ MAINTENANCE OVERDUE</div>
          ${overdueAssets.map(a => {
            const daysOver = Math.abs(Utils.daysUntil(a.nextServiceDate));
            return `<div style="margin-top:4px;">${Utils.escape(a.name)} — overdue by ${daysOver} day${daysOver !== 1 ? 's' : ''}</div>`;
          }).join('')}
        </div>`;
    }
    if (dueSoonAssets.length > 0) {
      alertsHTML += `
        <div class="today-alert" id="alert-maint-soon">
          <div class="today-alert-label">SERVICE DUE SOON</div>
          ${dueSoonAssets.map(a => {
            const d = Utils.daysUntil(a.nextServiceDate);
            return `<div style="margin-top:4px;">${Utils.escape(a.name)} — due in ${d} day${d !== 1 ? 's' : ''}</div>`;
          }).join('')}
        </div>`;
    }
    if (upcomingBills.length > 0) {
      alertsHTML += `
        <div class="today-alert" id="alert-bills">
          <div class="today-alert-label">BILLS DUE SOON</div>
          ${upcomingBills.map(b => {
            const d = Utils.daysUntil(b.nextDue);
            const label = d === 0 ? 'TODAY' : d === 1 ? 'TOMORROW' : `in ${d} days`;
            return `<div style="margin-top:4px;">${Utils.escape(b.name)} ${Utils.formatCurrency(b.amount)} — ${label}</div>`;
          }).join('')}
        </div>`;
    }

    let jobsDueHTML = '';
    if (jobsDue.length > 0) {
      jobsDueHTML = `
        <div class="section-label">JOBS DUE TODAY</div>
        ${jobsDue.map(j => `
          <div class="card" data-job-id="${j.id}">
            <div class="flex-between">
              <div class="card-title">${Utils.escape(j.name)}</div>
              <span class="status status-${j.status.toLowerCase()}">${j.status}</span>
            </div>
            <div class="card-meta">
              <span>${Utils.escape(j.client || '')}</span>
              ${j.value ? `<span>${Utils.formatCurrency(j.value)}</span>` : ''}
            </div>
          </div>
        `).join('')}`;
    }

    return `
      <div class="screen" id="screen-today" data-glyph="◈">
        <div class="today-date-header">
          ${data.user.name ? `<div class="today-greeting">G'DAY ${Utils.escape(data.user.name.toUpperCase())}</div>` : ''}
          <div class="today-day">${dayName}</div>
          <div class="today-date">${dateStr}</div>
          <div class="today-week">WEEK ${weekNum}</div>
        </div>

        ${fifoHTML}

        <div id="weather-container">
          ${Weather.renderStrip(null)}
        </div>

        <div class="section-label">TOP 3 FOR TODAY</div>
        <ul class="top-three-list" id="top-three-list">
          ${[0,1,2].map(i => `
            <li class="top-three-item">
              <span class="top-three-num">${i+1}</span>
              <input
                class="top-three-input"
                type="text"
                maxlength="80"
                placeholder="What needs doing..."
                data-index="${i}"
                value="${Utils.escape(data.today.topThree[i] || '')}"
              >
            </li>
          `).join('')}
        </ul>

        ${alertsHTML ? `<div style="padding:8px 16px 4px;">${alertsHTML}</div>` : ''}
        ${jobsDueHTML}

        <div class="section-label">WEEK INCOME</div>
        <div class="financial-position">
          <div class="fin-pos-row">
            <div class="fin-pos-amount ${weekIncome >= target && target > 0 ? 'text-green' : ''}">
              ${Utils.formatCurrency(weekIncome)}
            </div>
            <div class="fin-pos-target">TARGET ${Utils.formatCurrency(target)}</div>
          </div>
          <div class="progress-bar" style="height:6px;">
            <div class="progress-fill ${barColor}" style="width:${pct}%"></div>
          </div>
          ${target > 0
            ? `<div class="card-meta mt-8">${pct >= 100 ? '✓ TARGET HIT' : `${Utils.formatCurrency(target - weekIncome)} to go`}</div>`
            : `<div class="card-meta mt-8"><button id="today-set-target" style="background:none;border:none;color:var(--accent-yellow);font-family:var(--font-body);font-size:13px;font-weight:700;letter-spacing:0.08em;cursor:pointer;padding:0;text-decoration:underline;">SET WEEKLY TARGET →</button></div>`
          }
        </div>

        <div style="height:24px;"></div>
      </div>
    `;
  },

  fifoHTML(fifo) {
    if (!fifo.enabled || !fifo.cycleStart) return '';

    // Parse pattern
    let onDays, offDays;
    if (fifo.pattern === 'custom') {
      onDays = Number(fifo.customOn) || 14;
      offDays = Number(fifo.customOff) || 7;
    } else {
      const parts = fifo.pattern.split('/').map(Number);
      onDays = parts[0] || 14;
      offDays = parts[1] || 7;
    }

    const cycleLen = onDays + offDays;
    const cycleStart = new Date(fifo.cycleStart + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysSinceStart = Math.floor((today - cycleStart) / 86400000);
    const posInCycle = ((daysSinceStart % cycleLen) + cycleLen) % cycleLen;

    const isOn = posInCycle < onDays;
    const dayNum = posInCycle + 1;
    const daysLeft = isOn ? (onDays - posInCycle) : (cycleLen - posInCycle);
    const phase = isOn ? 'ON SITE' : 'R&R';
    const phaseOf = isOn ? onDays : offDays;
    const phaseDay = isOn ? posInCycle + 1 : posInCycle - onDays + 1;
    const nextPhase = isOn ? 'R&R' : 'ON SITE';

    return `
      <div class="fifo-strip">
        <div class="fifo-phase ${isOn ? 'on' : 'off'}">${phase}</div>
        <div class="fifo-info">
          <div class="fifo-day">DAY ${phaseDay} OF ${phaseOf}</div>
          <div class="fifo-countdown">${daysLeft} DAY${daysLeft !== 1 ? 'S' : ''} UNTIL ${nextPhase}</div>
        </div>
        <div class="fifo-bar-wrap">
          <div class="fifo-bar">
            <div class="fifo-bar-fill ${isOn ? 'on' : 'off'}" style="width:${Math.round((phaseDay/phaseOf)*100)}%"></div>
          </div>
        </div>
      </div>`;
  },

  async loadWeather() {
    const w = await Weather.load();
    const container = document.getElementById('weather-container');
    if (!container) return;
    container.innerHTML = Weather.renderStrip(w);
    const enableBtn = document.getElementById('weather-enable-btn');
    if (enableBtn) {
      enableBtn.addEventListener('click', async () => {
        container.innerHTML = `<div class="weather-strip"><div style="color:var(--text-secondary);font-size:13px;font-family:var(--font-body);">GETTING LOCATION...</div></div>`;
        const result = await Weather.load();
        container.innerHTML = Weather.renderStrip(result);
      });
    }
  },

  bind() {
    // Top 3 inputs
    document.querySelectorAll('.top-three-input').forEach(input => {
      input.addEventListener('input', () => {
        const idx = Number(input.dataset.index);
        Storage.update(d => { d.today.topThree[idx] = input.value; });
      });
    });

    // Set target shortcut
    document.getElementById('today-set-target')?.addEventListener('click', () => {
      App.switchTab('money');
      setTimeout(() => MoneyScreen.openSetTargetModal(), 50);
    });

    // Job card taps
    document.querySelectorAll('[data-job-id]').forEach(card => {
      card.addEventListener('click', () => App.switchTab('jobs'));
    });

    // Alert taps → maintenance tab
    document.getElementById('alert-maint-overdue')?.addEventListener('click', () => App.switchTab('maintenance'));
    document.getElementById('alert-maint-soon')?.addEventListener('click', () => App.switchTab('maintenance'));
    document.getElementById('alert-bills')?.addEventListener('click', () => {
      App.switchTab('money');
      MoneyScreen.currentView = 'bills';
      App.renderCurrent();
    });

    // Load weather async
    this.loadWeather();
  }
};

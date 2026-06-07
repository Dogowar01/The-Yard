const MoneyScreen = {
  currentView: 'income',
  repeatOptions: ['ONE-OFF','WEEKLY','FORTNIGHTLY','MONTHLY','QUARTERLY','YEARLY'],

  expenseCategories: ['MATERIALS','FUEL','EQUIPMENT','SUBCONTRACTORS','FOOD','OTHER'],

  render() {
    const data = Storage.get();
    const view = this.currentView;
    let content = '';

    if (view === 'income')   content = this.incomeHTML(data);
    if (view === 'expenses') content = this.expensesHTML(data);
    if (view === 'goals')    content = this.goalsHTML(data);
    if (view === 'bills')    content = this.billsHTML(data);

    return `
      <div class="screen" id="screen-money" data-glyph="≡">
        <div class="screen-header">
          <div class="screen-title">MONEY</div>
        </div>
        <div class="view-tabs">
          <button class="view-tab ${view==='income'?'active':''}" data-view="income">INCOME</button>
          <button class="view-tab ${view==='expenses'?'active':''}" data-view="expenses">EXPENSES</button>
          <button class="view-tab ${view==='goals'?'active':''}" data-view="goals">GOALS</button>
          <button class="view-tab ${view==='bills'?'active':''}" data-view="bills">BILLS</button>
        </div>
        <div id="money-content">${content}</div>
      </div>
    `;
  },

  incomeHTML(data) {
    const target = Number(data.user.weeklyIncomeTarget) || 0;
    const weekStart = Utils.weekStart();
    const income = data.money.income || [];
    const weekIncome = income.filter(e => e.date >= weekStart).reduce((s,e) => s + Number(e.amount), 0);
    const monthStart = Utils.today().slice(0,7) + '-01';
    const monthIncome = income.filter(e => e.date >= monthStart).reduce((s,e) => s + Number(e.amount), 0);
    const pct = target > 0 ? Utils.clamp((weekIncome/target)*100, 0, 100) : 0;
    const barColor = pct >= 100 ? 'green' : pct >= 60 ? 'yellow' : 'orange';

    const sorted = [...income].sort((a,b) => b.date.localeCompare(a.date));

    return `
      <div class="financial-position" style="border-bottom:2px solid var(--border);">
        <div class="fin-pos-label">THIS WEEK</div>
        <div class="fin-pos-row">
          <div class="fin-pos-amount">${Utils.formatCurrency(weekIncome)}</div>
          <div class="fin-pos-target">TARGET ${Utils.formatCurrency(target)}</div>
        </div>
        <div class="progress-bar" style="height:6px;">
          <div class="progress-fill ${barColor}" style="width:${pct}%"></div>
        </div>
        <div class="card-meta mt-8">
          <span>THIS MONTH: <strong style="color:var(--text-primary)">${Utils.formatCurrency(monthIncome)}</strong></span>
        </div>
        <button class="btn btn-secondary btn-sm mt-8" id="set-target-btn">SET WEEKLY TARGET</button>
      </div>
      <button class="btn btn-primary" style="margin:16px;width:calc(100% - 32px);" id="add-income-btn">+ LOG INCOME</button>
      <div class="section-label">INCOME LOG</div>
      ${sorted.length === 0 ? '<div class="empty-state"><div class="empty-state-text">No income logged yet.</div></div>' :
        sorted.map(e => `
          <div class="card" data-income-id="${e.id}">
            <div class="flex-between">
              <div class="card-title text-green">${Utils.formatCurrency(e.amount)}</div>
              <span class="text-muted" style="font-size:12px;">${Utils.formatDate(e.date)}</span>
            </div>
            <div class="card-meta">${Utils.escape(e.source||'')}</div>
          </div>
        `).join('')
      }
    `;
  },

  expensesHTML(data) {
    const expenses = data.money.expenses || [];
    const monthStart = Utils.today().slice(0,7) + '-01';
    const monthExp = expenses.filter(e => e.date >= monthStart);
    const total = monthExp.reduce((s,e) => s + Number(e.amount), 0);

    // Group by category
    const byCat = {};
    this.expenseCategories.forEach(c => byCat[c] = 0);
    monthExp.forEach(e => { if (byCat[e.category] !== undefined) byCat[e.category] += Number(e.amount); });

    const sorted = [...expenses].sort((a,b) => b.date.localeCompare(a.date));

    return `
      <div class="financial-position" style="border-bottom:2px solid var(--border);">
        <div class="fin-pos-label">THIS MONTH — EXPENSES</div>
        <div class="fin-pos-amount text-orange">${Utils.formatCurrency(total)}</div>
        <div style="margin-top:12px;">
          ${this.expenseCategories.filter(c => byCat[c] > 0).map(c => `
            <div class="flex-between" style="margin-bottom:6px;font-size:13px;">
              <span class="text-muted">${c}</span>
              <span>${Utils.formatCurrency(byCat[c])}</span>
            </div>
          `).join('') || '<div class="text-muted" style="font-size:13px;">No expenses this month.</div>'}
        </div>
      </div>
      <button class="btn btn-primary" style="margin:16px;width:calc(100% - 32px);" id="add-expense-btn">+ LOG EXPENSE</button>
      <div class="section-label">RECENT EXPENSES</div>
      ${sorted.length === 0 ? '<div class="empty-state"><div class="empty-state-text">No expenses logged.</div></div>' :
        sorted.slice(0, 30).map(e => `
          <div class="card" data-expense-id="${e.id}">
            <div class="flex-between">
              <div class="card-title text-orange">${Utils.formatCurrency(e.amount)}</div>
              <span class="text-muted" style="font-size:12px;">${Utils.formatDate(e.date)}</span>
            </div>
            <div class="card-meta">
              <span class="status status-quoted" style="font-size:9px;">${e.category}</span>
              <span>${Utils.escape(e.note||'')}</span>
            </div>
          </div>
        `).join('')
      }
    `;
  },

  goalsHTML(data) {
    const goals = data.money.goals || [];
    return `
      <button class="btn btn-primary" style="margin:16px;width:calc(100% - 32px);" id="add-goal-btn">+ ADD GOAL</button>
      ${goals.length === 0
        ? `<div class="empty-state">
             <div class="empty-state-title">NO GOALS SET</div>
             <div class="empty-state-text">Add a financial goal — pay off the ute, save for a block, build the equipment fund.</div>
           </div>`
        : goals.map(g => this.goalCardHTML(g)).join('')
      }
    `;
  },

  goalCardHTML(g) {
    const current = Number(g.current || 0);
    const target = Number(g.target || 0);
    const pct = target > 0 ? Utils.clamp((current/target)*100, 0, 100) : 0;
    const remaining = target - current;
    const color = pct >= 100 ? 'green' : pct >= 60 ? 'yellow' : 'orange';
    const daysLeft = g.targetDate ? Utils.daysUntil(g.targetDate) : null;

    return `
      <div class="goal-card" data-goal-id="${g.id}">
        <div class="goal-header">
          <div>
            <div class="goal-name">${Utils.escape(g.name)}</div>
            <div class="goal-amounts">
              <strong>${Utils.formatCurrency(current)}</strong> of <strong>${Utils.formatCurrency(target)}</strong>
              ${remaining > 0 ? ` — <span class="text-orange">${Utils.formatCurrency(remaining)} to go</span>` : ' — <span class="text-green">DONE</span>'}
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:20px;font-weight:600;color:var(--text-primary);">${Math.round(pct)}%</div>
            ${daysLeft !== null ? `<div style="font-size:11px;color:var(--text-secondary);">${daysLeft > 0 ? daysLeft + ' days' : 'OVERDUE'}</div>` : ''}
          </div>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${color}" style="width:${pct}%"></div>
        </div>
      </div>
    `;
  },

  bind() {
    document.querySelectorAll('#screen-money .view-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentView = btn.dataset.view;
        App.renderCurrent();
      });
    });

    const addIncomeBtn = document.getElementById('add-income-btn');
    if (addIncomeBtn) addIncomeBtn.addEventListener('click', () => this.openAddIncomeModal());

    const addExpenseBtn = document.getElementById('add-expense-btn');
    if (addExpenseBtn) addExpenseBtn.addEventListener('click', () => this.openAddExpenseModal());

    const addGoalBtn = document.getElementById('add-goal-btn');
    if (addGoalBtn) addGoalBtn.addEventListener('click', () => this.openAddGoalModal());

    const addBillBtn = document.getElementById('add-bill-btn');
    if (addBillBtn) addBillBtn.addEventListener('click', () => this.openAddBillModal());

    document.querySelectorAll('[data-bill-id]').forEach(card => {
      card.addEventListener('click', () => {
        const data = Storage.get();
        const bill = (data.money.bills || []).find(b => b.id === card.dataset.billId);
        if (bill) this.openEditBillModal(bill);
      });
    });

    const setTargetBtn = document.getElementById('set-target-btn');
    if (setTargetBtn) setTargetBtn.addEventListener('click', () => this.openSetTargetModal());

    document.querySelectorAll('[data-income-id]').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.incomeId;
        Modal.confirm('Delete this income entry?', () => {
          Storage.update(d => { d.money.income = d.money.income.filter(e => e.id !== id); });
          App.renderCurrent();
        });
      });
    });

    document.querySelectorAll('[data-expense-id]').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.expenseId;
        Modal.confirm('Delete this expense?', () => {
          Storage.update(d => { d.money.expenses = d.money.expenses.filter(e => e.id !== id); });
          App.renderCurrent();
        });
      });
    });

    document.querySelectorAll('[data-goal-id]').forEach(card => {
      card.addEventListener('click', () => {
        const data = Storage.get();
        const goal = data.money.goals.find(g => g.id === card.dataset.goalId);
        if (goal) this.openEditGoalModal(goal);
      });
    });
  },

  openAddIncomeModal() {
    Modal.open('LOG INCOME', `
      <div class="form-group">
        <label class="form-label">AMOUNT ($) *</label>
        <input class="form-input" id="f-amount" type="number" min="0" placeholder="0">
      </div>
      <div class="form-group">
        <label class="form-label">SOURCE</label>
        <input class="form-input" id="f-source" type="text" maxlength="60" placeholder="e.g. Jones Electrical invoice">
      </div>
      <div class="form-group">
        <label class="form-label">DATE</label>
        <input class="form-input" id="f-date" type="date" value="${Utils.today()}">
      </div>
      <div class="form-actions">
        <button class="btn btn-primary btn-block" data-save>SAVE</button>
      </div>
    `);
    Modal.content.querySelector('[data-save]').addEventListener('click', () => {
      const amount = Number(document.getElementById('f-amount').value);
      if (!amount) { alert('Enter an amount.'); return; }
      Storage.update(d => {
        d.money.income.push({
          id: Utils.id(),
          amount,
          source: document.getElementById('f-source').value.trim(),
          date: document.getElementById('f-date').value || Utils.today(),
        });
      });
      Modal.close(); App.renderCurrent();
    });
  },

  openAddExpenseModal() {
    Modal.open('LOG EXPENSE', `
      <div class="form-group">
        <label class="form-label">AMOUNT ($) *</label>
        <input class="form-input" id="f-amount" type="number" min="0" placeholder="0">
      </div>
      <div class="form-group">
        <label class="form-label">CATEGORY</label>
        <select class="form-select" id="f-cat">
          ${this.expenseCategories.map(c => `<option>${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">NOTE</label>
        <input class="form-input" id="f-note" type="text" maxlength="80" placeholder="What was it for?">
      </div>
      <div class="form-group">
        <label class="form-label">DATE</label>
        <input class="form-input" id="f-date" type="date" value="${Utils.today()}">
      </div>
      <div class="form-actions">
        <button class="btn btn-primary btn-block" data-save>SAVE</button>
      </div>
    `);
    Modal.content.querySelector('[data-save]').addEventListener('click', () => {
      const amount = Number(document.getElementById('f-amount').value);
      if (!amount) { alert('Enter an amount.'); return; }
      Storage.update(d => {
        d.money.expenses.push({
          id: Utils.id(),
          amount,
          category: document.getElementById('f-cat').value,
          note: document.getElementById('f-note').value.trim(),
          date: document.getElementById('f-date').value || Utils.today(),
        });
      });
      Modal.close(); App.renderCurrent();
    });
  },

  openSetTargetModal() {
    const data = Storage.get();
    Modal.open('WEEKLY INCOME TARGET', `
      <div class="form-group">
        <label class="form-label">TARGET AMOUNT ($)</label>
        <input class="form-input" id="f-target" type="number" min="0"
          value="${data.user.weeklyIncomeTarget||''}" placeholder="e.g. 3000">
      </div>
      <div class="form-actions">
        <button class="btn btn-primary btn-block" data-save>SAVE</button>
      </div>
    `);
    Modal.content.querySelector('[data-save]').addEventListener('click', () => {
      const val = Number(document.getElementById('f-target').value) || 0;
      Storage.update(d => { d.user.weeklyIncomeTarget = val; });
      Modal.close(); App.renderCurrent();
    });
  },

  openAddGoalModal() {
    Modal.open('ADD GOAL', this.goalFormHTML());
    Modal.content.querySelector('[data-save]').addEventListener('click', () => this.saveGoal(null));
  },

  openEditGoalModal(goal) {
    Modal.open('EDIT GOAL', this.goalFormHTML(goal));
    Modal.content.querySelector('[data-save]').addEventListener('click', () => this.saveGoal(goal.id));
    Modal.content.querySelector('[data-delete]').addEventListener('click', () => {
      Modal.confirm(`Delete goal "${goal.name}"?`, () => {
        Storage.update(d => { d.money.goals = d.money.goals.filter(g => g.id !== goal.id); });
        App.renderCurrent();
      });
    });
  },

  goalFormHTML(g = {}) {
    return `
      <div class="form-group">
        <label class="form-label">GOAL NAME *</label>
        <input class="form-input" id="f-name" type="text" maxlength="80"
          value="${Utils.escape(g.name||'')}" placeholder="e.g. Pay off ute loan">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">TARGET ($)</label>
          <input class="form-input" id="f-target" type="number" min="0" value="${g.target||''}">
        </div>
        <div class="form-group">
          <label class="form-label">CURRENT ($)</label>
          <input class="form-input" id="f-current" type="number" min="0" value="${g.current||0}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">TARGET DATE</label>
        <input class="form-input" id="f-date" type="date" value="${g.targetDate||''}">
      </div>
      <div class="form-actions">
        ${g.id ? `<button class="btn btn-danger" data-delete>DELETE</button>` : ''}
        <button class="btn btn-primary" data-save>SAVE GOAL</button>
      </div>
    `;
  },

  billsHTML(data) {
    const bills = data.money.bills || [];
    const sorted = [...bills].sort((a, b) => (a.nextDue || '').localeCompare(b.nextDue || ''));
    const upcoming = sorted.filter(b => {
      const d = Utils.daysUntil(b.nextDue);
      return d !== null && d <= 30;
    });
    const totalMonthly = bills.reduce((s, b) => {
      const a = Number(b.amount) || 0;
      if (b.repeat === 'WEEKLY')       return s + a * 4.33;
      if (b.repeat === 'FORTNIGHTLY')  return s + a * 2.17;
      if (b.repeat === 'MONTHLY')      return s + a;
      if (b.repeat === 'QUARTERLY')    return s + a / 3;
      if (b.repeat === 'YEARLY')       return s + a / 12;
      return s;
    }, 0);

    return `
      ${totalMonthly > 0 ? `
        <div class="financial-position" style="border-bottom:2px solid var(--border);">
          <div class="fin-pos-label">EST. MONTHLY OUTGOINGS</div>
          <div class="fin-pos-amount text-orange">${Utils.formatCurrency(Math.round(totalMonthly))}</div>
        </div>` : ''}
      <button class="btn btn-primary" style="margin:16px;width:calc(100% - 32px);" id="add-bill-btn">+ ADD BILL</button>
      ${upcoming.length > 0 ? `<div class="section-label">DUE WITHIN 30 DAYS</div>` : ''}
      ${sorted.length === 0
        ? `<div class="empty-state">
             <div class="empty-state-title">NO BILLS ADDED</div>
             <div class="empty-state-text">Track rego, insurance, BAS, subscriptions — The Yard will flag them on your TODAY screen before they're due.</div>
           </div>`
        : sorted.map(b => {
            const d = Utils.daysUntil(b.nextDue);
            const overdue = d !== null && d < 0;
            const soon = d !== null && d >= 0 && d <= 7;
            return `
              <div class="card" data-bill-id="${b.id}">
                <div class="flex-between mb-8">
                  <div class="card-title">${Utils.escape(b.name)}</div>
                  <div class="card-value ${overdue ? 'text-red' : soon ? 'text-orange' : ''}">${Utils.formatCurrency(b.amount)}</div>
                </div>
                <div class="card-meta">
                  <span class="text-muted">${b.repeat}</span>
                  ${b.nextDue ? `<span class="${overdue ? 'text-red' : soon ? 'text-orange' : ''}">
                    ${overdue ? 'OVERDUE' : d === 0 ? 'DUE TODAY' : d === 1 ? 'DUE TOMORROW' : 'DUE ' + Utils.formatDate(b.nextDue)}
                  </span>` : ''}
                </div>
              </div>`;
          }).join('')
      }`;
  },

  billFormHTML(bill = {}) {
    return `
      <div class="form-group">
        <label class="form-label">BILL NAME *</label>
        <input class="form-input" id="f-name" type="text" maxlength="60"
          value="${Utils.escape(bill.name||'')}" placeholder="e.g. Ute rego, Insurance, BAS">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">AMOUNT ($)</label>
          <input class="form-input" id="f-amount" type="number" min="0" value="${bill.amount||''}">
        </div>
        <div class="form-group">
          <label class="form-label">REPEATS</label>
          <select class="form-select" id="f-repeat">
            ${this.repeatOptions.map(r => `<option ${bill.repeat===r?'selected':''}>${r}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">NEXT DUE DATE</label>
        <input class="form-input" id="f-due" type="date" value="${bill.nextDue||''}">
      </div>
      <div class="form-actions">
        ${bill.id ? `<button class="btn btn-danger" data-delete>DELETE</button>` : ''}
        <button class="btn btn-primary" data-save>SAVE</button>
      </div>`;
  },

  openAddBillModal() {
    Modal.open('ADD BILL', this.billFormHTML());
    Modal.content.querySelector('[data-save]').addEventListener('click', () => this.saveBill(null));
  },

  openEditBillModal(bill) {
    Modal.open('EDIT BILL', this.billFormHTML(bill));
    Modal.content.querySelector('[data-save]').addEventListener('click', () => this.saveBill(bill.id));
    Modal.content.querySelector('[data-delete]').addEventListener('click', () => {
      Modal.confirm(`Delete "${bill.name}"?`, () => {
        Storage.update(d => { d.money.bills = (d.money.bills||[]).filter(b => b.id !== bill.id); });
        App.renderCurrent();
      });
    });
  },

  saveBill(existingId) {
    const name = document.getElementById('f-name').value.trim();
    if (!name) { alert('Bill name required.'); return; }
    const bill = {
      id:      existingId || Utils.id(),
      name,
      amount:  Number(document.getElementById('f-amount').value) || 0,
      repeat:  document.getElementById('f-repeat').value,
      nextDue: document.getElementById('f-due').value,
    };
    Storage.update(d => {
      if (!d.money.bills) d.money.bills = [];
      if (existingId) {
        const idx = d.money.bills.findIndex(b => b.id === existingId);
        if (idx >= 0) d.money.bills[idx] = bill;
      } else {
        d.money.bills.push(bill);
      }
    });
    Modal.close(); App.renderCurrent();
  },

  saveGoal(existingId) {
    const name = document.getElementById('f-name').value.trim();
    if (!name) { alert('Goal name required.'); return; }
    const goal = {
      id: existingId || Utils.id(),
      name,
      target: Number(document.getElementById('f-target').value) || 0,
      current: Number(document.getElementById('f-current').value) || 0,
      targetDate: document.getElementById('f-date').value,
    };
    Storage.update(d => {
      if (existingId) {
        const idx = d.money.goals.findIndex(g => g.id === existingId);
        if (idx >= 0) d.money.goals[idx] = goal;
      } else {
        if (d.money.goals.length >= 5) { alert('Maximum 5 goals.'); return; }
        d.money.goals.push(goal);
      }
    });
    Modal.close(); App.renderCurrent();
  }
};

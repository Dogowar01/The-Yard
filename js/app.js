const App = {
  currentTab: 'today',
  tabs: ['today', 'jobs', 'projects', 'money', 'maintenance', 'fitness'],

  screens: {
    today:       TodayScreen,
    jobs:        JobsScreen,
    projects:    ProjectsScreen,
    money:       MoneyScreen,
    maintenance: MaintenanceScreen,
    fitness:     FitnessScreen,
  },

  init() {
    Modal.init();
    Settings.init();
    this.renderCurrent();
    this.bindNav();
    this.bindFAB();
    this.initPWA();
    this.updateMaintenanceBadge();
    this.updateWatermark(this.currentTab);
  },

  renderCurrent() {
    const screen = this.screens[this.currentTab];
    if (!screen) return;
    const container = document.getElementById('screen-container');
    container.innerHTML = screen.render();
    screen.bind?.();
    this.updateMaintenanceBadge();
  },

  glyphs: {
    today:       '◈',
    jobs:        '◧',
    projects:    '◫',
    money:       '◉',
    maintenance: '◎',
    fitness:     '◐',
  },

  updateWatermark(tabId) {
    const el = document.getElementById('watermark');
    if (el) el.textContent = this.glyphs[tabId] || '';
  },

  switchTab(tabId) {
    if (!this.tabs.includes(tabId)) return;
    this.currentTab = tabId;

    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    this.renderCurrent();
    this.updateWatermark(tabId);
    document.getElementById('screen-container').scrollTop = 0;
  },

  bindNav() {
    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });
  },

  bindFAB() {
    document.getElementById('fab').addEventListener('click', () => this.quickAdd());
  },

  quickAdd() {
    const tab = this.currentTab;
    if (tab === 'jobs')        return JobsScreen.openAddModal();
    if (tab === 'projects')    return ProjectsScreen.openAddModal();
    if (tab === 'maintenance') return MaintenanceScreen.openAddModal();
    if (tab === 'fitness')     return FitnessScreen.openAddModal();
    if (tab === 'money') {
      const view = MoneyScreen.currentView;
      if (view === 'income')   return MoneyScreen.openAddIncomeModal();
      if (view === 'expenses') return MoneyScreen.openAddExpenseModal();
      if (view === 'goals')    return MoneyScreen.openAddGoalModal();
    }
    // Default: quick-add menu
    this.showQuickAddMenu();
  },

  showQuickAddMenu() {
    Modal.open('QUICK ADD', `
      <div style="display:flex;flex-direction:column;gap:10px;">
        <button class="btn btn-primary" data-qa="jobs">+ JOB</button>
        <button class="btn btn-secondary" data-qa="projects">+ PROJECT</button>
        <button class="btn btn-secondary" data-qa="income">+ INCOME</button>
        <button class="btn btn-secondary" data-qa="expense">+ EXPENSE</button>
        <button class="btn btn-secondary" data-qa="asset">+ ASSET</button>
        <button class="btn btn-secondary" data-qa="fitness">+ ACTIVITY</button>
      </div>
    `);
    document.querySelectorAll('[data-qa]').forEach(btn => {
      btn.addEventListener('click', () => {
        Modal.close();
        const action = btn.dataset.qa;
        if (action === 'jobs')    { this.switchTab('jobs'); setTimeout(() => JobsScreen.openAddModal(), 50); }
        if (action === 'projects') { this.switchTab('projects'); setTimeout(() => ProjectsScreen.openAddModal(), 50); }
        if (action === 'income')  { this.switchTab('money'); setTimeout(() => MoneyScreen.openAddIncomeModal(), 50); }
        if (action === 'expense') { this.switchTab('money'); setTimeout(() => MoneyScreen.openAddExpenseModal(), 50); }
        if (action === 'asset')   { this.switchTab('maintenance'); setTimeout(() => MaintenanceScreen.openAddModal(), 50); }
        if (action === 'fitness') { this.switchTab('fitness'); setTimeout(() => FitnessScreen.openAddModal(), 50); }
      });
    });
  },

  updateMaintenanceBadge() {
    const data = Storage.get();
    const assets = data.assets || [];
    const hasOverdue = assets.some(a => MaintenanceScreen.computeStatus(a) === 'OVERDUE');
    const badge = document.getElementById('maint-badge');
    if (badge) badge.classList.toggle('hidden', !hasOverdue);
  },

  initPWA() {
    // Service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }

    // Install prompt
    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      const banner = document.getElementById('install-banner');
      if (banner) banner.classList.remove('hidden');
    });

    document.getElementById('install-btn')?.addEventListener('click', () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => {
        deferredPrompt = null;
        document.getElementById('install-banner')?.classList.add('hidden');
      });
    });

    document.getElementById('install-dismiss')?.addEventListener('click', () => {
      document.getElementById('install-banner')?.classList.add('hidden');
    });
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());

const Settings = {
  THEMES: {
    yellow: {
      label: 'DEWALT',
      accent: '#f5c400',
      desc: 'Hazard Yellow'
    },
    red: {
      label: 'MILWKEE',
      accent: '#e01c1c',
      desc: 'Milwaukee Red'
    },
    blue: {
      label: 'MAKITA',
      accent: '#0077cc',
      desc: 'Makita Blue'
    },
    orange: {
      label: 'STIHL',
      accent: '#e05a00',
      desc: 'Stihl Orange'
    },
    green: {
      label: 'JOHN D.',
      accent: '#3a8f45',
      desc: 'Deere Green'
    },
    white: {
      label: 'HILTI',
      accent: '#e8e8e0',
      desc: 'Hilti White'
    },
  },

  currentTheme: 'yellow',

  init() {
    const saved = localStorage.getItem('theyard_theme') || 'yellow';
    this.apply(saved);
    document.getElementById('settings-btn').addEventListener('click', () => this.openModal());
  },

  apply(themeKey) {
    const theme = this.THEMES[themeKey];
    if (!theme) return;
    this.currentTheme = themeKey;
    document.documentElement.style.setProperty('--accent-yellow', theme.accent);
    localStorage.setItem('theyard_theme', themeKey);
  },

  openModal() {
    const current = this.currentTheme;
    const data = Storage.get();

    const swatchHTML = Object.entries(this.THEMES).map(([key, t]) => `
      <button class="theme-swatch ${key === current ? 'active' : ''}" data-theme="${key}">
        <div class="swatch-dot" style="background:${t.accent};"></div>
        <span>${t.label}</span>
      </button>
    `).join('');

    const fifo = data.user.fifo || {};
    const fifoPatterns = ['14/7','8/6','28/28','21/7','20/10','CUSTOM'];

    Modal.open('SETTINGS', `
      <div class="section-label" style="padding:0 0 12px;">ACCENT COLOUR</div>
      <div class="theme-grid">${swatchHTML}</div>

      <div class="divider" style="margin:20px 0;"></div>

      <div class="section-label" style="padding:0 0 12px;">YOUR NAME</div>
      <div class="form-group">
        <input class="form-input" id="s-name" type="text" maxlength="40"
          value="${Utils.escape(data.user.name || '')}" placeholder="e.g. Dave">
      </div>

      <div class="section-label" style="padding:0 0 12px;">WEEKLY INCOME TARGET</div>
      <div class="form-group">
        <input class="form-input" id="s-target" type="number" min="0"
          value="${data.user.weeklyIncomeTarget || ''}" placeholder="e.g. 3000">
      </div>

      <div class="divider" style="margin:20px 0;"></div>

      <div class="section-label" style="padding:0 0 12px;">FIFO ROSTER</div>
      <div class="form-group">
        <label class="form-label">ENABLE FIFO TRACKER</label>
        <div style="display:flex;gap:10px;">
          <button type="button" class="btn btn-sm ${fifo.enabled ? 'btn-primary' : 'btn-secondary'}" id="fifo-on">ON</button>
          <button type="button" class="btn btn-sm ${!fifo.enabled ? 'btn-primary' : 'btn-secondary'}" id="fifo-off">OFF</button>
        </div>
      </div>
      <div id="fifo-settings" style="${!fifo.enabled ? 'display:none;' : ''}">
        <div class="form-group">
          <label class="form-label">ROSTER PATTERN</label>
          <select class="form-select" id="s-fifo-pattern">
            ${fifoPatterns.map(p => `<option value="${p}" ${fifo.pattern===p?'selected':''}>${p}</option>`).join('')}
          </select>
        </div>
        <div id="fifo-custom" style="${fifo.pattern !== 'CUSTOM' ? 'display:none;' : ''}">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">DAYS ON</label>
              <input class="form-input" id="s-fifo-on" type="number" min="1" max="60" value="${fifo.customOn||14}">
            </div>
            <div class="form-group">
              <label class="form-label">DAYS OFF</label>
              <input class="form-input" id="s-fifo-off" type="number" min="1" max="60" value="${fifo.customOff||7}">
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">CURRENT SWING START DATE</label>
          <input class="form-input" id="s-fifo-start" type="date" value="${fifo.cycleStart||''}">
        </div>
      </div>

      <div class="form-actions">
        <button class="btn btn-primary btn-block" data-save>SAVE</button>
      </div>
    `);

    // Theme swatches — live preview on tap
    Modal.content.querySelectorAll('.theme-swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        Modal.content.querySelectorAll('.theme-swatch').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.apply(btn.dataset.theme);
      });
    });

    // FIFO toggle
    let fifoEnabled = fifo.enabled || false;
    Modal.content.querySelector('#fifo-on')?.addEventListener('click', () => {
      fifoEnabled = true;
      Modal.content.querySelector('#fifo-on').classList.replace('btn-secondary','btn-primary');
      Modal.content.querySelector('#fifo-off').classList.replace('btn-primary','btn-secondary');
      Modal.content.querySelector('#fifo-settings').style.display = '';
    });
    Modal.content.querySelector('#fifo-off')?.addEventListener('click', () => {
      fifoEnabled = false;
      Modal.content.querySelector('#fifo-off').classList.replace('btn-secondary','btn-primary');
      Modal.content.querySelector('#fifo-on').classList.replace('btn-primary','btn-secondary');
      Modal.content.querySelector('#fifo-settings').style.display = 'none';
    });

    // Show/hide custom pattern fields
    Modal.content.querySelector('#s-fifo-pattern')?.addEventListener('change', e => {
      const custom = Modal.content.querySelector('#fifo-custom');
      if (custom) custom.style.display = e.target.value === 'CUSTOM' ? '' : 'none';
    });

    // Save user settings
    Modal.content.querySelector('[data-save]').addEventListener('click', () => {
      const pattern = document.getElementById('s-fifo-pattern')?.value || '14/7';
      Storage.update(d => {
        d.user.name = document.getElementById('s-name').value.trim();
        d.user.weeklyIncomeTarget = Number(document.getElementById('s-target').value) || 0;
        if (!d.user.fifo) d.user.fifo = {};
        d.user.fifo.enabled    = fifoEnabled;
        d.user.fifo.pattern    = pattern;
        d.user.fifo.cycleStart = document.getElementById('s-fifo-start')?.value || '';
        d.user.fifo.customOn   = Number(document.getElementById('s-fifo-on')?.value) || 14;
        d.user.fifo.customOff  = Number(document.getElementById('s-fifo-off')?.value) || 7;
      });
      Modal.close();
      App.renderCurrent();
    });
  }
};

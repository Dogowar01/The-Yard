/* ============================================
   THE YARD — VAULT
   AES-256-GCM encryption, PBKDF2 key derivation.
   Biometric via WebAuthn platform authenticator.
   Nothing leaves the device.
   ============================================ */

const Vault = {
  STORE_KEY:   'theyard_vault',
  BIO_KEY:     'theyard_bio',
  LOCK_AFTER:  5 * 60 * 1000, // 5 minutes

  _key:       null,   // CryptoKey in memory — cleared on lock
  _timer:     null,
  _bioCredId: null,

  TYPES: ['PASSWORD', 'PIN / CODE', 'WIFI', 'ACCOUNT', 'NOTE'],

  // ─── State ───────────────────────────────
  isUnlocked()  { return this._key !== null; },
  isSetup()     {
    try { return !!JSON.parse(localStorage.getItem(this.STORE_KEY) || '{}').verifier; }
    catch { return false; }
  },
  isBioEnrolled() {
    try { return !!JSON.parse(localStorage.getItem(this.BIO_KEY) || '{}').credId; }
    catch { return false; }
  },

  // ─── Setup PIN ───────────────────────────
  async setupPin(pin) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key  = await this._deriveKey(pin, salt);
    const verifier = await this._encrypt('THEYARD_VAULT_OK', key);
    const entries  = await this._encrypt([], key);
    this._save({ salt: [...salt], verifier, entries, bioEnabled: false });
    this._key = key;
    this._resetTimer();
    return true;
  },

  // ─── Unlock with PIN ─────────────────────
  async unlockPin(pin) {
    const store = this._load();
    if (!store) return false;
    try {
      const key = await this._deriveKey(pin, new Uint8Array(store.salt));
      const ok  = await this._decrypt(store.verifier, key);
      if (ok !== 'THEYARD_VAULT_OK') return false;
      this._key = key;
      this._resetTimer();
      return true;
    } catch { return false; }
  },

  // ─── Lock ────────────────────────────────
  lock() {
    this._key = null;
    clearTimeout(this._timer);
    if (App.currentTab === 'vault') App.renderCurrent();
  },

  _resetTimer() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.lock(), this.LOCK_AFTER);
  },

  // ─── Biometrics ──────────────────────────
  async bioAvailable() {
    if (!window.PublicKeyCredential) return false;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') return false;
    try { return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); }
    catch { return false; }
  },

  // Enroll: register a platform credential; store bio_secret in user.id
  // so it comes back in userHandle on assertion. Use bio_secret to wrap the PIN.
  async enrollBio(pin) {
    try {
      const bioSecret = crypto.getRandomValues(new Uint8Array(32));
      const challenge = crypto.getRandomValues(new Uint8Array(32));

      const cred = await navigator.credentials.create({ publicKey: {
        challenge,
        rp: { name: 'The Yard', id: location.hostname },
        user: { id: bioSecret, name: 'vault', displayName: 'The Yard Vault' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'required',
          requireResidentKey: true,
        },
        timeout: 60000,
      }});

      if (!cred) return false;

      const credId = [...new Uint8Array(cred.rawId)];
      // Wrap PIN with bioSecret as key material
      const wrappedPin = await this._wrapPin(pin, bioSecret);

      localStorage.setItem(this.BIO_KEY, JSON.stringify({ credId, wrappedPin }));
      return true;
    } catch (e) {
      console.error('Bio enrol:', e);
      return false;
    }
  },

  async unlockBio() {
    try {
      const bioData = JSON.parse(localStorage.getItem(this.BIO_KEY) || '{}');
      if (!bioData.credId) return false;

      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const assertion = await navigator.credentials.get({ publicKey: {
        challenge,
        rpId: location.hostname,
        allowCredentials: [{ type: 'public-key', id: new Uint8Array(bioData.credId) }],
        userVerification: 'required',
        timeout: 60000,
      }});

      if (!assertion) return false;

      // userHandle contains the bioSecret we set during registration
      const bioSecret = new Uint8Array(assertion.response.userHandle);
      const pin = await this._unwrapPin(bioData.wrappedPin, bioSecret);
      return await this.unlockPin(pin);
    } catch (e) {
      console.error('Bio unlock:', e);
      return false;
    }
  },

  async removeBio() {
    localStorage.removeItem(this.BIO_KEY);
  },

  // Wrap/unwrap PIN using bioSecret
  async _wrapPin(pin, bioSecret) {
    const keyMat = await crypto.subtle.importKey('raw', bioSecret, 'HKDF', false, ['deriveKey']);
    const wrapKey = await crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(16), info: new TextEncoder().encode('pin-wrap') },
      keyMat, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
    return this._encrypt(pin, wrapKey);
  },

  async _unwrapPin(wrapped, bioSecret) {
    const keyMat = await crypto.subtle.importKey('raw', bioSecret, 'HKDF', false, ['deriveKey']);
    const wrapKey = await crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(16), info: new TextEncoder().encode('pin-wrap') },
      keyMat, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
    return this._decrypt(wrapped, wrapKey);
  },

  // ─── Entries ─────────────────────────────
  async getEntries() {
    if (!this._key) return [];
    try {
      return await this._decrypt(this._load().entries, this._key);
    } catch { return []; }
  },

  async saveEntries(entries) {
    if (!this._key) return;
    const store = this._load();
    store.entries = await this._encrypt(entries, this._key);
    this._save(store);
  },

  async addEntry(entry) {
    const entries = await this.getEntries();
    entries.unshift({ ...entry, id: Utils.id(), created: Utils.today() });
    await this.saveEntries(entries);
  },

  async updateEntry(id, updated) {
    const entries = await this.getEntries();
    const idx = entries.findIndex(e => e.id === id);
    if (idx >= 0) { entries[idx] = { ...entries[idx], ...updated }; await this.saveEntries(entries); }
  },

  async deleteEntry(id) {
    const entries = await this.getEntries();
    await this.saveEntries(entries.filter(e => e.id !== id));
  },

  // ─── Crypto ──────────────────────────────
  async _deriveKey(pin, salt) {
    const raw = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
      raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
  },

  async _encrypt(data, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(data)));
    return { iv: [...iv], ct: [...new Uint8Array(ct)] };
  },

  async _decrypt(enc, key) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(enc.iv) }, key, new Uint8Array(enc.ct));
    return JSON.parse(new TextDecoder().decode(pt));
  },

  _load()       { try { return JSON.parse(localStorage.getItem(this.STORE_KEY)); } catch { return null; } },
  _save(data)   { localStorage.setItem(this.STORE_KEY, JSON.stringify(data)); },

  // ─── Render ──────────────────────────────
  render() {
    if (!this.isSetup())   return this._renderSetup();
    if (!this.isUnlocked()) return this._renderLock();
    return this._renderVault();
  },

  _renderSetup() {
    return `
      <div class="screen" id="screen-vault" data-glyph="◩">
        <div class="screen-header">
          <div class="screen-title">VAULT</div>
          <div class="screen-subtitle">FIRST TIME SETUP</div>
        </div>
        <div class="vault-lock-wrap">
          <div class="vault-lock-icon">◩</div>
          <div class="vault-lock-title">SET YOUR VAULT PIN</div>
          <div class="vault-lock-sub">Choose a 4–6 digit PIN. This encrypts all vault entries with AES-256. There is no recovery — don't forget it.</div>
          <div class="pin-display" id="pin-display">——————</div>
          <div class="pin-pad" id="pin-pad">
            ${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k => `
              <button class="pin-key ${k===''?'pin-key-blank':''}" data-key="${k}">${k}</button>
            `).join('')}
          </div>
          <div class="vault-lock-sub" id="pin-step-label">Enter new PIN</div>
        </div>
      </div>`;
  },

  _renderLock() {
    const bioEnrolled = this.isBioEnrolled();
    return `
      <div class="screen" id="screen-vault" data-glyph="◩">
        <div class="screen-header">
          <div class="screen-title">VAULT</div>
        </div>
        <div class="vault-lock-wrap">
          <div class="vault-lock-icon">◩</div>
          <div class="vault-lock-title">VAULT LOCKED</div>
          <div class="vault-lock-sub">Enter your PIN to unlock</div>
          <div class="pin-display" id="pin-display">——————</div>
          <div class="pin-error hidden" id="pin-error">Incorrect PIN — try again</div>
          <div class="pin-pad" id="pin-pad">
            ${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k => `
              <button class="pin-key ${k===''?'pin-key-blank':''}" data-key="${k}">${k}</button>
            `).join('')}
          </div>
          ${bioEnrolled ? `
            <button class="btn btn-secondary" style="margin-top:16px;width:200px;" id="bio-unlock-btn">
              USE FACE / FINGERPRINT
            </button>` : ''}
        </div>
      </div>`;
  },

  _renderVault() {
    // Rendered async — placeholder first, entries injected after
    return `
      <div class="screen" id="screen-vault" data-glyph="◩">
        <div class="screen-header">
          <div class="screen-title">VAULT</div>
          <div class="screen-subtitle">UNLOCKED — LOCKS IN 5 MIN</div>
        </div>
        <div class="stats-bar">
          <div class="stat-item">
            <div class="stat-label">STATUS</div>
            <div class="stat-value green" style="font-size:13px;">OPEN</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">ENTRIES</div>
            <div class="stat-value" id="vault-count">—</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">ENCRYPTION</div>
            <div class="stat-value" style="font-size:11px;letter-spacing:0;">AES-256</div>
          </div>
        </div>
        <div id="vault-entries-list">
          <div class="empty-state"><div class="empty-state-text">Loading...</div></div>
        </div>
      </div>`;
  },

  async bindVault() {
    const entries = await this.getEntries();
    const list = document.getElementById('vault-entries-list');
    const count = document.getElementById('vault-count');
    if (!list) return;
    if (count) count.textContent = entries.length;

    if (entries.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title">VAULT IS EMPTY</div>
          <div class="empty-state-text">Tap + to add a password, PIN, gate code, WIFI password, or account detail.</div>
        </div>`;
    } else {
      list.innerHTML = entries.map(e => this._entryCardHTML(e)).join('');
      list.querySelectorAll('.vault-card').forEach(card => {
        card.querySelector('.vault-reveal-btn')?.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const sec = card.querySelector('.vault-secret');
          const btn = card.querySelector('.vault-reveal-btn');
          if (sec.dataset.revealed === '1') {
            sec.textContent = '••••••••';
            sec.dataset.revealed = '0';
            btn.textContent = 'SHOW';
          } else {
            sec.textContent = sec.dataset.value;
            sec.dataset.revealed = '1';
            btn.textContent = 'HIDE';
          }
        });
        card.querySelector('.vault-copy-btn')?.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const val = card.querySelector('.vault-secret').dataset.value;
          navigator.clipboard.writeText(val).then(() => {
            const btn = card.querySelector('.vault-copy-btn');
            const orig = btn.textContent;
            btn.textContent = 'COPIED!';
            setTimeout(() => btn.textContent = orig, 1500);
          });
        });
        card.addEventListener('click', () => {
          const entry = entries.find(e => e.id === card.dataset.id);
          if (entry) this.openEditModal(entry);
        });
      });
    }
  },

  _entryCardHTML(e) {
    return `
      <div class="card vault-card" data-id="${e.id}">
        <div class="flex-between mb-8">
          <div class="card-title">${Utils.escape(e.label)}</div>
          <span class="status status-quoted" style="font-size:9px;">${e.type}</span>
        </div>
        ${e.username ? `<div class="card-meta text-muted" style="margin-bottom:6px;">${Utils.escape(e.username)}</div>` : ''}
        <div class="flex-between">
          <div class="vault-secret" data-value="${Utils.escape(e.secret)}" data-revealed="0">••••••••</div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-secondary btn-sm vault-reveal-btn">SHOW</button>
            <button class="btn btn-secondary btn-sm vault-copy-btn">COPY</button>
          </div>
        </div>
        ${e.notes ? `<div class="card-meta text-muted" style="margin-top:6px;font-size:12px;">${Utils.escape(e.notes)}</div>` : ''}
      </div>`;
  },

  // ─── PIN pad logic ────────────────────────
  bindPinPad(mode) {
    let pinA = '';
    let pinB = '';
    let step = mode === 'setup' ? 'first' : 'unlock';
    const display = document.getElementById('pin-display');
    const label   = document.getElementById('pin-step-label');
    const error   = document.getElementById('pin-error');

    const updateDisplay = (val) => {
      const dots = val.split('').map(() => '●').join('');
      if (display) display.textContent = dots.padEnd(6, '—');
    };

    document.getElementById('pin-pad')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-key]');
      if (!btn) return;
      const k = btn.dataset.key;

      let current = step === 'first' ? pinA : (step === 'confirm' ? pinB : pinA);

      if (k === '⌫') {
        current = current.slice(0, -1);
      } else if (k !== '' && current.length < 6) {
        current += k;
      }

      if (step === 'first')   pinA = current;
      else if (step === 'confirm') pinB = current;
      else pinA = current;

      updateDisplay(current);

      if (mode === 'setup') {
        if (step === 'first' && pinA.length >= 4) {
          await new Promise(r => setTimeout(r, 180));
          step = 'confirm';
          pinA = pinA; // keep it
          updateDisplay('');
          if (label) label.textContent = 'Confirm PIN';
        } else if (step === 'confirm' && pinB.length >= 4) {
          if (pinA === pinB) {
            await this.setupPin(pinA);
            App.renderCurrent();
            setTimeout(() => this.bindVault(), 50);
          } else {
            pinB = '';
            updateDisplay('');
            if (label) { label.textContent = 'PINs did not match — try again'; label.style.color = 'var(--accent-red)'; }
            setTimeout(() => { if (label) { label.textContent = 'Enter new PIN'; label.style.color = ''; } step = 'first'; pinA = ''; updateDisplay(''); }, 1500);
          }
        }
      } else {
        // Unlock
        if (pinA.length >= 4 && pinA.length <= 6) {
          if (pinA.length === 6 || (pinA.length >= 4)) {
            // try after slight delay for visual feedback
            if (pinA.length >= 4) {
              await new Promise(r => setTimeout(r, 180));
              const ok = await this.unlockPin(pinA);
              if (ok) {
                App.renderCurrent();
                setTimeout(() => this.bindVault(), 50);
              } else {
                pinA = '';
                updateDisplay('');
                if (error) error.classList.remove('hidden');
                setTimeout(() => { if (error) error.classList.add('hidden'); }, 2000);
              }
            }
          }
        }
      }
    });
  },

  // ─── Bio unlock bind ─────────────────────
  bindBioBtn() {
    document.getElementById('bio-unlock-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('bio-unlock-btn');
      if (btn) btn.textContent = 'VERIFYING...';
      const ok = await this.unlockBio();
      if (ok) {
        App.renderCurrent();
        setTimeout(() => this.bindVault(), 50);
      } else {
        if (btn) { btn.textContent = 'FAILED — USE PIN'; btn.disabled = true; }
      }
    });
  },

  bind() {
    if (!this.isSetup())    return this.bindPinPad('setup');
    if (!this.isUnlocked()) {
      this.bindPinPad('unlock');
      this.bindBioBtn();
      return;
    }
    this.bindVault();
  },

  // ─── Add / Edit modals ───────────────────
  openAddModal() {
    if (!this.isUnlocked()) return;
    Modal.open('ADD TO VAULT', this._entryFormHTML());
    Modal.content.querySelector('[data-save]').addEventListener('click', () => this._saveEntryFromModal(null));
    this.bindEntryForm();
  },

  openEditModal(entry) {
    Modal.open('EDIT ENTRY', this._entryFormHTML(entry));
    Modal.content.querySelector('[data-save]').addEventListener('click', () => this._saveEntryFromModal(entry.id));
    this.bindEntryForm();
    Modal.content.querySelector('[data-delete]').addEventListener('click', () => {
      Modal.confirm(`Delete "${entry.label}"?`, async () => {
        await this.deleteEntry(entry.id);
        App.renderCurrent();
        setTimeout(() => this.bindVault(), 50);
      });
    });
  },

  _entryFormHTML(e = {}) {
    return `
      <div class="form-group">
        <label class="form-label">LABEL *</label>
        <input class="form-input" id="v-label" type="text" maxlength="60"
          value="${Utils.escape(e.label||'')}" placeholder="e.g. Site gate code, Council login">
      </div>
      <div class="form-group">
        <label class="form-label">TYPE</label>
        <select class="form-select" id="v-type">
          ${this.TYPES.map(t => `<option ${e.type===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">USERNAME / EMAIL</label>
        <input class="form-input" id="v-user" type="text" maxlength="80"
          value="${Utils.escape(e.username||'')}" placeholder="Optional">
      </div>
      <div class="form-group">
        <label class="form-label">PASSWORD / PIN / CODE *</label>
        <div style="display:flex;gap:8px;">
          <input class="form-input" id="v-secret" type="password" maxlength="200"
            value="${Utils.escape(e.secret||'')}" placeholder="The thing you're storing" style="flex:1;">
          <button type="button" class="btn btn-secondary btn-sm" id="v-toggle-secret">SHOW</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">NOTES</label>
        <textarea class="form-textarea" id="v-notes" maxlength="300"
          placeholder="URL, hints, anything else...">${Utils.escape(e.notes||'')}</textarea>
      </div>
      <div class="form-actions">
        ${e.id ? `<button class="btn btn-danger" data-delete>DELETE</button>` : ''}
        <button class="btn btn-primary" data-save>SAVE</button>
      </div>`;
  },

  bindEntryForm() {
    document.getElementById('v-toggle-secret')?.addEventListener('click', () => {
      const input = document.getElementById('v-secret');
      const btn   = document.getElementById('v-toggle-secret');
      if (input.type === 'password') { input.type = 'text'; btn.textContent = 'HIDE'; }
      else { input.type = 'password'; btn.textContent = 'SHOW'; }
    });
  },

  async _saveEntryFromModal(existingId) {
    const label  = document.getElementById('v-label').value.trim();
    const secret = document.getElementById('v-secret').value.trim();
    if (!label || !secret) { alert('Label and secret are required.'); return; }
    const entry = {
      label,
      type:     document.getElementById('v-type').value,
      username: document.getElementById('v-user').value.trim(),
      secret,
      notes:    document.getElementById('v-notes').value.trim(),
    };
    if (existingId) {
      await this.updateEntry(existingId, entry);
    } else {
      await this.addEntry(entry);
    }
    Modal.close();
    App.renderCurrent();
    setTimeout(() => this.bindVault(), 50);
  },
};

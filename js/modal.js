const Modal = {
  overlay: null,
  content: null,

  init() {
    this.overlay = document.getElementById('modal-overlay');
    this.content = document.getElementById('modal-content');
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
  },

  open(title, bodyHTML, onSave) {
    this.content.innerHTML = `
      <div class="modal-header">
        <span class="modal-title">${Utils.escape(title)}</span>
        <button class="modal-close" aria-label="Close">✕</button>
      </div>
      <div class="modal-body">${bodyHTML}</div>
    `;
    this.overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    this.content.querySelector('.modal-close').addEventListener('click', () => this.close());

    if (onSave) {
      const saveBtn = this.content.querySelector('[data-save]');
      if (saveBtn) saveBtn.addEventListener('click', () => onSave());
    }

    // focus first input
    setTimeout(() => {
      const first = this.content.querySelector('input, select, textarea');
      if (first) first.focus();
    }, 50);
  },

  close() {
    this.overlay.classList.add('hidden');
    document.body.style.overflow = '';
    this.content.innerHTML = '';
  },

  confirm(message, onConfirm) {
    this.open('CONFIRM', `
      <p style="color:var(--text-primary);font-size:15px;margin-bottom:24px;">${Utils.escape(message)}</p>
      <div class="form-actions">
        <button class="btn btn-secondary" id="confirm-cancel">CANCEL</button>
        <button class="btn btn-danger" id="confirm-ok">DELETE</button>
      </div>
    `);
    this.content.querySelector('#confirm-cancel').addEventListener('click', () => this.close());
    this.content.querySelector('#confirm-ok').addEventListener('click', () => {
      this.close();
      onConfirm();
    });
  }
};

const Utils = {
  id() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  },

  formatCurrency(n) {
    const num = Number(n) || 0;
    return '$' + num.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  },

  formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  },

  today() {
    return new Date().toISOString().slice(0, 10);
  },

  weekNumber(date) {
    const d = date ? new Date(date) : new Date();
    const onejan = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  },

  weekStart() {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().slice(0, 10);
  },

  daysUntil(isoDate) {
    if (!isoDate) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(isoDate + 'T00:00:00');
    return Math.round((target - now) / 86400000);
  },

  clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
  },

  escape(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
};

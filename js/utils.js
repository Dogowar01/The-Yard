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

  // Local-time ISO date — toISOString() is UTC and gives the wrong
  // day for most of the Australian evening
  toISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  today() {
    return this.toISO(new Date());
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
    return this.toISO(monday);
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

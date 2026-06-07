const Storage = {
  KEY: 'theyard_v1',

  get() {
    try {
      const raw = localStorage.getItem(this.KEY);
      return raw ? JSON.parse(raw) : this.defaults();
    } catch {
      return this.defaults();
    }
  },

  save(data) {
    localStorage.setItem(this.KEY, JSON.stringify(data));
  },

  defaults() {
    return {
      user: {
        name: '',
        weeklyIncomeTarget: 0,
        fitnessEnabled: false,
        fitnessTargets: { sessions: 3, kmRun: 0, manualHours: 0 },
        fifo: {
          enabled: false,
          pattern: '14/7',
          cycleStart: '',   // ISO date — first day of current ON swing
          customOn: 14,
          customOff: 7
        },
        location: { lat: null, lon: null }
      },
      today: { topThree: ['', '', ''] },
      jobs: [],
      projects: [],
      money: { income: [], expenses: [], goals: [], bills: [] },
      assets: [],
      fitness: [],
      weatherCache: { ts: 0, data: null }
    };
  },

  update(fn) {
    const data = this.get();
    fn(data);
    this.save(data);
    return data;
  }
};

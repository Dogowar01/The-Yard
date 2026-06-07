const Weather = {
  CACHE_TTL: 30 * 60 * 1000, // 30 minutes

  WMO_CODES: {
    0:  { label: 'Clear',          icon: '☀' },
    1:  { label: 'Mostly Clear',   icon: '🌤' },
    2:  { label: 'Partly Cloudy',  icon: '⛅' },
    3:  { label: 'Overcast',       icon: '☁' },
    45: { label: 'Fog',            icon: '🌫' },
    48: { label: 'Fog',            icon: '🌫' },
    51: { label: 'Light Drizzle',  icon: '🌦' },
    53: { label: 'Drizzle',        icon: '🌦' },
    55: { label: 'Heavy Drizzle',  icon: '🌧' },
    61: { label: 'Light Rain',     icon: '🌧' },
    63: { label: 'Rain',           icon: '🌧' },
    65: { label: 'Heavy Rain',     icon: '🌧' },
    71: { label: 'Light Snow',     icon: '🌨' },
    73: { label: 'Snow',           icon: '❄' },
    75: { label: 'Heavy Snow',     icon: '❄' },
    80: { label: 'Showers',        icon: '🌦' },
    81: { label: 'Showers',        icon: '🌧' },
    82: { label: 'Heavy Showers',  icon: '⛈' },
    95: { label: 'Thunderstorm',   icon: '⛈' },
    96: { label: 'Thunderstorm',   icon: '⛈' },
    99: { label: 'Thunderstorm',   icon: '⛈' },
  },

  getCondition(code) {
    return this.WMO_CODES[code] || { label: 'Unknown', icon: '—' };
  },

  async fetch(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,weathercode,windspeed_10m,apparent_temperature` +
      `&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max` +
      `&timezone=auto&forecast_days=3`;
    const res = await globalThis.fetch(url);
    return res.json();
  },

  async getCoords() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject('no-geo');
      navigator.geolocation.getCurrentPosition(
        p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
        () => reject('denied'),
        { timeout: 8000 }
      );
    });
  },

  async load() {
    const data = Storage.get();
    const cache = data.weatherCache || { ts: 0, data: null };
    const now = Date.now();

    // Return cache if fresh
    if (cache.data && (now - cache.ts) < this.CACHE_TTL) {
      return cache.data;
    }

    // Get coords
    let lat = data.user.location?.lat;
    let lon = data.user.location?.lon;

    if (!lat || !lon) {
      try {
        const coords = await this.getCoords();
        lat = coords.lat;
        lon = coords.lon;
        Storage.update(d => {
          if (!d.user.location) d.user.location = {};
          d.user.location.lat = lat;
          d.user.location.lon = lon;
        });
      } catch {
        return null;
      }
    }

    try {
      const raw = await this.fetch(lat, lon);
      const result = this.parse(raw);
      Storage.update(d => { d.weatherCache = { ts: now, data: result }; });
      return result;
    } catch {
      return cache.data || null;
    }
  },

  parse(raw) {
    const c = raw.current;
    const d = raw.daily;
    return {
      temp:       Math.round(c.temperature_2m),
      feelsLike:  Math.round(c.apparent_temperature),
      wind:       Math.round(c.windspeed_10m),
      code:       c.weathercode,
      days: [0, 1, 2].map(i => ({
        maxTemp:  Math.round(d.temperature_2m_max[i]),
        minTemp:  Math.round(d.temperature_2m_min[i]),
        rain:     d.precipitation_probability_max[i],
        code:     d.weathercode[i],
      }))
    };
  },

  renderStrip(w) {
    if (!w) return `
      <div class="weather-strip" id="weather-strip">
        <div style="color:var(--text-secondary);font-size:13px;">
          <button id="weather-enable-btn" style="background:none;border:none;color:var(--accent-yellow);font-family:var(--font-body);font-size:13px;font-weight:700;cursor:pointer;letter-spacing:0.05em;">
            ENABLE WEATHER →
          </button>
        </div>
      </div>`;

    const cond = this.getCondition(w.code);
    const dayNames = ['TODAY', 'TMW', 'D+2'];

    return `
      <div class="weather-strip" id="weather-strip">
        <div class="weather-main">
          <div class="weather-icon">${cond.icon}</div>
          <div>
            <div class="weather-temp">${w.temp}°</div>
            <div class="weather-condition">${cond.label}</div>
          </div>
        </div>
        <div class="weather-meta">
          <div class="weather-detail">FEELS ${w.feelsLike}°</div>
          <div class="weather-detail">WIND ${w.wind} km/h</div>
        </div>
        <div class="weather-forecast">
          ${w.days.map((day, i) => {
            const dc = this.getCondition(day.code);
            return `
              <div class="forecast-day">
                <div class="forecast-label">${dayNames[i]}</div>
                <div class="forecast-icon">${dc.icon}</div>
                <div class="forecast-temp">${day.maxTemp}°<span class="forecast-min">/${day.minTemp}°</span></div>
                ${day.rain > 20 ? `<div class="forecast-rain">${day.rain}%💧</div>` : ''}
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }
};

const revealEls = document.querySelectorAll('.reveal');
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.14 });
revealEls.forEach((el) => revealObs.observe(el));

const progress = document.querySelector('.scroll-progress span');
const glow = document.querySelector('.cursor-glow');

function updateScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
  progress.style.width = pct + '%';
}
window.addEventListener('scroll', updateScroll, { passive: true });
updateScroll();

window.addEventListener('pointermove', (e) => {
  if (!glow) return;
  glow.style.left = e.clientX + 'px';
  glow.style.top = e.clientY + 'px';
});

if (matchMedia('(pointer:fine)').matches) {
  document.querySelectorAll('.magnetic').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      el.style.transform = `translate(${x * .08}px, ${y * .12}px)`;
    });
    el.addEventListener('pointerleave', () => {
      el.style.transform = '';
    });
  });
}

const navLinks = [...document.querySelectorAll('.nav a')];
const sectionMap = navLinks
  .map((a) => [a, document.querySelector(a.getAttribute('href'))])
  .filter(([, s]) => s);

const sectionObs = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    navLinks.forEach((a) => a.style.color = '');
    const match = sectionMap.find(([, s]) => s === entry.target);
    if (match) match[0].style.color = '#f2f2ee';
  });
}, { rootMargin: '-40% 0px -50% 0px' });
sectionMap.forEach(([, s]) => sectionObs.observe(s));

// Results switcher
const resultTabs = [...document.querySelectorAll('.result-tab')];
const resultViews = [...document.querySelectorAll('.result-view')];
resultTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.resultView;
    resultTabs.forEach((t) => {
      const active = t === tab;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    resultViews.forEach((view) => view.classList.toggle('active', view.dataset.view === target));
  });
});

let siteResults = null;
let weekGroups = [];
let currentWeekIndex = -1;

const fmtR = (value) => `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}R`;
const fmtPct = (value) => `${(value * 100).toFixed(2)}%`;

function polylinePoints(values, width = 600, height = 180, pad = 8) {
  if (!values.length) return '';
  const series = [0, ...values.reduce((acc, v) => {
    acc.push((acc.length ? acc[acc.length - 1] : 0) + v);
    return acc;
  }, [])];
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = Math.max(max - min, 0.25);
  return series.map((v, i) => {
    const x = pad + (i / Math.max(series.length - 1, 1)) * (width - pad * 2);
    const y = pad + ((max - v) / span) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function setPolyline(id, values, width = 600, height = 180) {
  const line = document.getElementById(id);
  if (line) line.setAttribute('points', polylinePoints(values, width, height));
}

function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatCzDate(date) {
  return new Intl.DateTimeFormat('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

function buildWeekGroups(trades) {
  const groups = new Map();
  trades.forEach((trade) => {
    const dt = new Date(trade.entry_ts.replace(' ', 'T'));
    const monday = startOfWeek(dt);
    const key = isoDate(monday);
    if (!groups.has(key)) groups.set(key, { start: monday, trades: [] });
    groups.get(key).trades.push(trade);
  });

  return [...groups.values()]
    .filter((g) => g.trades.length > 0)
    .sort((a, b) => a.start - b.start);
}

function renderYearResults(data) {
  const s = data.year_stats;
  document.getElementById('result-year').textContent = data.year;
  document.getElementById('year-net').textContent = fmtR(s.net_r);
  document.getElementById('year-trades').textContent = s.trades;
  document.getElementById('year-pf').textContent = s.pf.toFixed(2);
  document.getElementById('year-dd').textContent = `${s.max_dd_r.toFixed(2)}R`;
  document.getElementById('year-positive').textContent = fmtPct(s.positive_rate);

  setPolyline('year-equity-line', data.trades.map((t) => t.portfolio_r));

  document.querySelectorAll('.pair-result').forEach((card) => {
    const symbol = card.dataset.symbol;
    const ps = data.pair_stats[symbol];
    const trades = data.trades.filter((t) => t.symbol === symbol);
    if (!ps) return;

    card.querySelector('.pair-net').textContent = fmtR(ps.net_r);
    card.querySelector('.pair-trades').textContent = `${ps.trades} obchodů`;
    card.querySelector('.pair-pf').textContent = `PF ${ps.pf.toFixed(2)}`;

    const line = card.querySelector('.pair-line');
    if (line) line.setAttribute('points', polylinePoints(trades.map((t) => t.portfolio_r), 180, 52, 3));
  });
}

function renderWeek(group) {
  if (!group) return;

  const trades = group.trades.slice().sort((a, b) => a.entry_ts.localeCompare(b.entry_ts));
  const sunday = new Date(group.start);
  sunday.setDate(sunday.getDate() + 6);
  const net = trades.reduce((sum, t) => sum + t.portfolio_r, 0);
  const positive = trades.filter((t) => t.portfolio_r > 0).length;
  const negative = trades.filter((t) => t.portfolio_r < 0).length;

  document.getElementById('week-range').textContent = `${formatCzDate(group.start)} — ${formatCzDate(sunday)}`;
  document.getElementById('week-net').textContent = fmtR(net);
  document.getElementById('week-trades-count').textContent = trades.length;
  document.getElementById('week-positive-count').textContent = positive;
  document.getElementById('week-negative-count').textContent = negative;

  setPolyline('week-equity-line', trades.map((t) => t.portfolio_r));

  // Show each calendar day only once. If more trades arrived that day,
  // keep them inside the same day block instead of repeating the date.
  const days = new Map();
  trades.forEach((trade) => {
    const dt = new Date(trade.entry_ts.replace(' ', 'T'));
    const key = isoDate(dt);
    if (!days.has(key)) days.set(key, { date: dt, trades: [] });
    days.get(key).trades.push(trade);
  });

  const host = document.getElementById('week-trades');
  host.innerHTML = [...days.values()].map((day) => {
    const date = new Intl.DateTimeFormat('cs-CZ', { weekday: 'short', day: '2-digit', month: '2-digit' })
      .format(day.date)
      .replace('.', '')
      .toUpperCase();
    const count = day.trades.length;
    const dailyNet = day.trades.reduce((sum, t) => sum + t.portfolio_r, 0);

    const details = day.trades.map((trade) => {
      const positiveTrade = trade.portfolio_r >= 0;
      return `<div class="day-trade">
        <span class="day-symbol">${trade.symbol}</span>
        <span class="day-side">${trade.side}</span>
        <b class="${positiveTrade ? '' : 'red'}">${fmtR(trade.portfolio_r)}</b>
      </div>`;
    }).join('');

    return `<div class="day-group">
      <div class="day-head">
        <span class="day-date">${date}</span>
        <span class="day-count">${count} ${count === 1 ? 'OBCHOD' : count < 5 ? 'OBCHODY' : 'OBCHODŮ'}</span>
        <b class="day-total ${dailyNet < 0 ? 'red' : ''}">${fmtR(dailyNet)}</b>
      </div>
      <div class="day-details">${details}</div>
    </div>`;
  }).join('');
}

function chooseRandomWeek() {
  if (!weekGroups.length) return;
  let next = Math.floor(Math.random() * weekGroups.length);
  if (weekGroups.length > 1 && next === currentWeekIndex) {
    next = (next + 1) % weekGroups.length;
  }
  currentWeekIndex = next;
  renderWeek(weekGroups[next]);
}

async function loadResults() {
  try {
    const response = await fetch('data/site_results.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    siteResults = await response.json();
    renderYearResults(siteResults);
    weekGroups = buildWeekGroups(siteResults.trades);
    chooseRandomWeek();
  } catch (error) {
    console.error('Results data load failed:', error);
  }
}
loadResults();

const shuffleWeek = document.getElementById('shuffle-week');
if (shuffleWeek) shuffleWeek.addEventListener('click', chooseRandomWeek);

// Contact form uses a native POST to FormSubmit for maximum GitHub Pages compatibility.

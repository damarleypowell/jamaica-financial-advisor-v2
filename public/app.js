// ══════════════════════════════════════════════════════════════════════════════
// Gotham Financial — Complete Frontend Application (Debug Pass)
// ══════════════════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────────
  const state = {
    stocks: [],
    selectedSymbol: 'NCBFG',
    currentView: 'dashboard',
    user: null,
    token: localStorage.getItem('jse_token'),
    portfolio: [],
    chatHistory: [],
    analysisLevel: 'Intermediate',
    panelMode: 'top',
    sortCol: 'symbol',
    sortDir: 1,
    sectorChartInstance: null,
    mainChart: null,
    mainSeries: null,
    technicalChart: null,
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);
  const fmt = (n) => n?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '--';
  const fmtInt = (n) => n?.toLocaleString('en-US') ?? '--';
  const API = '';
  const escHtml = (s) => (s == null ? '' : String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  async function apiFetch(url, opts = {}) {
    if (state.token) {
      opts.headers = { ...opts.headers, Authorization: `Bearer ${state.token}` };
    }
    const res = await fetch(API + url, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
    return res.json();
  }

  function getStockName(symbol) {
    const s = fullStockData.find(x => x.symbol === symbol);
    return s?.name || symbol;
  }

  // ── Clock ──────────────────────────────────────────────────────────────────
  function updateClock() {
    const now = new Date();
    const t = now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const el1 = $('#headerClock');
    const el2 = $('#sidebarClock');
    if (el1) el1.textContent = t;
    if (el2) el2.textContent = t;
  }
  setInterval(updateClock, 1000);
  updateClock();

  // ── Particles ──────────────────────────────────────────────────────────────
  function initParticles() {
    const canvas = $('#particles');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h, particles = [];

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.5 + 0.5, o: Math.random() * 0.3 + 0.1,
      });
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,200,83,${p.o})`;
        ctx.fill();
      });

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(0,200,83,${0.06 * (1 - dist / 120)})`;
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(draw);
    }
    draw();
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  const viewTitles = {
    dashboard: ['Dashboard', 'Real-time JSE market overview'],
    portfolio: ['Portfolio', 'Manage your investments'],
    chat: ['AI Chat', 'Ask anything about JSE and investing'],
    analysis: ['AI Analysis', 'Deep AI-powered stock analysis'],
    planner: ['Financial Planner', 'AI-generated investment plans'],
    screener: ['Stock Screener', 'Filter and find stocks'],
    news: ['News Feed', 'Market news with sentiment analysis'],
    compare: ['Stock Comparison', 'Compare stocks side by side'],
    sectors: ['Sector Performance', 'Market performance by sector'],
    settings: ['Settings', 'Account settings and security'],
    subscription: ['Subscription', 'Manage your plan'],
    admin: ['Admin Dashboard', 'Platform management'],
  };

  function navigateTo(view) {
    state.currentView = view;
    $$('.view').forEach(v => v.classList.remove('active'));
    const target = $(`#view-${view}`);
    if (target) target.classList.add('active');

    $$('.nav-item').forEach(n => n.classList.remove('active'));
    const navItem = $(`.nav-item[data-view="${view}"]`);
    if (navItem) navItem.classList.add('active');

    const [title, subtitle] = viewTitles[view] || ['Gotham Financial', ''];
    $('#headerTitle').textContent = title;
    $('#headerSubtitle').textContent = subtitle;

    // Load view data on navigate
    if (view === 'news') loadNews();
    if (view === 'sectors') loadSectors();
    if (view === 'portfolio') renderPortfolio();
    if (view === 'screener') populateScreenerSectors();
    if (view === 'dashboard') {
      updateDashboard();
      if (fullStockData.length) enrichStockTable();
    }
    if (view === 'settings') loadSettingsView();
    if (view === 'subscription') loadSubscriptionView();
    if (view === 'admin') loadAdminDashboard();

    // Close mobile sidebar
    $('#sidebar').classList.remove('open');
  }

  $$('.nav-item').forEach(item => {
    item.addEventListener('click', () => navigateTo(item.dataset.view));
  });

  $('#sidebarToggle')?.addEventListener('click', () => {
    $('#sidebar').classList.toggle('open');
  });

  // ── Auth ───────────────────────────────────────────────────────────────────
  function showAuthModal(form = 'login') {
    $('#authModal').classList.add('show');
    if (form === 'login') {
      $('#loginForm').style.display = 'block';
      $('#signupForm').style.display = 'none';
    } else {
      $('#loginForm').style.display = 'none';
      $('#signupForm').style.display = 'block';
    }
  }

  function hideAuthModal() {
    $('#authModal').classList.remove('show');
    $('#loginError').classList.remove('show');
    $('#signupError').classList.remove('show');
  }

  function updateUserArea() {
    const area = $('#userArea');
    if (state.user) {
      const initials = state.user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
      area.innerHTML = `
        <div class="user-menu" id="userMenu">
          <div class="user-avatar">${escHtml(initials)}</div>
          <span class="user-name">${escHtml(state.user.name)}</span>
        </div>`;
      $('#userMenu').addEventListener('click', () => {
        if (confirm('Sign out?')) {
          state.user = null;
          state.token = null;
          state.portfolio = [];
          localStorage.removeItem('jse_token');
          updateUserArea();
          renderPortfolio();
        }
      });
    } else {
      area.innerHTML = '<button class="auth-btn" id="signInBtn">Sign In</button>';
      $('#signInBtn').addEventListener('click', () => showAuthModal('login'));
    }
  }

  $('#signInBtn')?.addEventListener('click', () => showAuthModal('login'));
  $('#authClose')?.addEventListener('click', hideAuthModal);
  $('#showSignup')?.addEventListener('click', () => showAuthModal('signup'));
  $('#showLogin')?.addEventListener('click', () => showAuthModal('login'));

  // Close modals on overlay click
  $('#authModal')?.addEventListener('click', (e) => {
    if (e.target === $('#authModal')) hideAuthModal();
  });
  $('#addPortfolioModal')?.addEventListener('click', (e) => {
    if (e.target === $('#addPortfolioModal')) $('#addPortfolioModal').classList.remove('show');
  });

  $('#loginSubmit')?.addEventListener('click', async () => {
    const email = $('#loginEmail').value.trim();
    const password = $('#loginPassword').value;
    if (!email || !password) { showFormError('loginError', 'Fill in all fields'); return; }
    try {
      $('#loginSubmit').disabled = true;
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      state.token = data.token;
      state.user = data.user;
      localStorage.setItem('jse_token', data.token);
      hideAuthModal();
      updateUserArea();
      loadUserData();
    } catch (e) {
      showFormError('loginError', e.message);
    } finally {
      $('#loginSubmit').disabled = false;
    }
  });

  // Enter key on login fields
  $('#loginEmail')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#loginSubmit').click(); });
  $('#loginPassword')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#loginSubmit').click(); });

  $('#signupSubmit')?.addEventListener('click', async () => {
    const name = $('#signupName').value.trim();
    const email = $('#signupEmail').value.trim();
    const password = $('#signupPassword').value;
    if (!name || !email || !password) { showFormError('signupError', 'Fill in all fields'); return; }
    try {
      $('#signupSubmit').disabled = true;
      const data = await apiFetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      state.token = data.token;
      state.user = data.user;
      localStorage.setItem('jse_token', data.token);
      hideAuthModal();
      updateUserArea();
    } catch (e) {
      showFormError('signupError', e.message);
    } finally {
      $('#signupSubmit').disabled = false;
    }
  });

  // Enter key on signup fields
  $('#signupPassword')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#signupSubmit').click(); });

  function showFormError(id, msg) {
    const el = $(`#${id}`);
    el.textContent = msg;
    el.classList.add('show');
  }

  async function loadUserData() {
    if (!state.token) return;
    try {
      const data = await apiFetch('/api/auth/me');
      state.user = data;
      state.portfolio = data.portfolio || [];
      updateUserArea();
      renderPortfolio();
    } catch (e) {
      state.token = null;
      localStorage.removeItem('jse_token');
      updateUserArea();
    }
  }

  // ── SSE Real-time Prices ───────────────────────────────────────────────────
  function connectSSE() {
    const evtSource = new EventSource(API + '/api/stream/prices');
    evtSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        state.stocks = data;
        // Always update ticker regardless of view
        updateTicker();
        // Update dashboard elements if on dashboard
        if (state.currentView === 'dashboard') {
          updateStats();
          updateStockPanel();
          updateHeatmap();
          if (fullStockData.length) enrichStockTable();
        }
        updateChartPrice();
        // Generate notifications for big movers
        generateNotifications();
      } catch (_) {}
    };
    evtSource.onerror = () => {
      evtSource.close();
      setTimeout(connectSSE, 3000);
    };
  }

  // ── Ticker ─────────────────────────────────────────────────────────────────
  function buildTicker() {
    const track = $('#tickerTrack');
    if (!track || !state.stocks.length) return;
    const items = state.stocks.map(s => {
      const cls = s.change >= 0 ? 'up' : 'down';
      const arrow = s.change >= 0 ? '▲' : '▼';
      return `<div class="ticker-item">
        <span class="symbol">${s.symbol}</span>
        <span class="price">$${fmt(s.price)}</span>
        <span class="change ${cls}">${arrow} ${Math.abs(s.change).toFixed(2)}%</span>
      </div>`;
    }).join('');
    track.innerHTML = items + items;
  }

  function updateTicker() {
    const items = $$('.ticker-item');
    if (!items.length && state.stocks.length) { buildTicker(); return; }
    items.forEach(item => {
      const symEl = item.querySelector('.symbol');
      if (!symEl) return;
      const sym = symEl.textContent;
      const stock = state.stocks.find(s => s.symbol === sym);
      if (!stock) return;
      const priceEl = item.querySelector('.price');
      const changeEl = item.querySelector('.change');
      if (priceEl) priceEl.textContent = `$${fmt(stock.price)}`;
      if (changeEl) {
        const cls = stock.change >= 0 ? 'up' : 'down';
        const arrow = stock.change >= 0 ? '▲' : '▼';
        changeEl.className = `change ${cls}`;
        changeEl.textContent = `${arrow} ${Math.abs(stock.change).toFixed(2)}%`;
      }
    });
  }

  // ── Dashboard Stats ────────────────────────────────────────────────────────
  function updateStats() {
    if (!state.stocks.length) return;
    const totalVol = state.stocks.reduce((s, x) => s + x.volume, 0);
    const advancers = state.stocks.filter(s => s.change > 0).length;
    const decliners = state.stocks.filter(s => s.change < 0).length;
    const avgChange = state.stocks.reduce((s, x) => s + x.change, 0) / state.stocks.length;
    const idxBase = 412856;
    const idxVal = idxBase * (1 + avgChange / 100);

    $('#statIndex').textContent = fmtInt(Math.round(idxVal));
    $('#statIndexChange').textContent = `${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(2)}%`;
    $('#statIndexChange').className = `stat-change ${avgChange >= 0 ? 'up' : 'down'}`;
    $('#statVolume').textContent = fmtInt(totalVol);
    $('#statAdvancers').textContent = advancers;
    $('#statAdvLabel').textContent = `of ${state.stocks.length} stocks`;
    $('#statDecliners').textContent = decliners;
    $('#statDecLabel').textContent = `of ${state.stocks.length} stocks`;
  }

  function updateDashboard() {
    updateStats();
    updateStockPanel();
    updateHeatmap();
    if (fullStockData.length) enrichStockTable();
  }

  // ── Stock Panel ────────────────────────────────────────────────────────────
  function updateStockPanel() {
    const list = $('#stockPanelList');
    if (!list || !state.stocks.length) return;
    let sorted = [...state.stocks];
    if (state.panelMode === 'top') sorted.sort((a, b) => b.change - a.change);
    else if (state.panelMode === 'bottom') sorted.sort((a, b) => a.change - b.change);
    else sorted.sort((a, b) => b.volume - a.volume);

    list.innerHTML = sorted.slice(0, 12).map(s => {
      const cls = s.change >= 0 ? 'up' : 'down';
      const name = getStockName(s.symbol);
      return `<div class="stock-row" data-symbol="${s.symbol}">
        <div class="sr-left">
          <div class="sr-icon">${s.symbol.slice(0, 2)}</div>
          <div><div class="sr-sym">${s.symbol}</div><div class="sr-name">${name}</div></div>
        </div>
        <div class="sr-right">
          <div class="sr-price">$${fmt(s.price)}</div>
          <div class="sr-chg ${cls}">${s.change >= 0 ? '+' : ''}${s.change.toFixed(2)}%</div>
        </div>
      </div>`;
    }).join('');

    list.querySelectorAll('.stock-row').forEach(row => {
      row.addEventListener('click', () => selectStock(row.dataset.symbol));
    });
  }

  $$('.panel-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.panel-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.panelMode = tab.dataset.panel;
      updateStockPanel();
    });
  });

  // ── Heatmap ────────────────────────────────────────────────────────────────
  function updateHeatmap() {
    const grid = $('#heatmapGrid');
    if (!grid || !state.stocks.length) return;
    grid.innerHTML = state.stocks.map(s => {
      const c = s.change;
      let bg;
      if (c > 3) bg = 'rgba(0,200,83,0.4)';
      else if (c > 1) bg = 'rgba(0,200,83,0.25)';
      else if (c > 0) bg = 'rgba(0,200,83,0.12)';
      else if (c > -1) bg = 'rgba(255,23,68,0.12)';
      else if (c > -3) bg = 'rgba(255,23,68,0.25)';
      else bg = 'rgba(255,23,68,0.4)';
      const textCol = c >= 0 ? '#00c853' : '#ff1744';
      return `<div class="heatmap-cell" style="background:${bg};" data-symbol="${s.symbol}">
        <div class="hm-sym" style="color:${textCol}">${s.symbol}</div>
        <div class="hm-chg" style="color:${textCol}">${c >= 0 ? '+' : ''}${c.toFixed(2)}%</div>
      </div>`;
    }).join('');

    grid.querySelectorAll('.heatmap-cell').forEach(cell => {
      cell.addEventListener('click', () => selectStock(cell.dataset.symbol));
    });
  }

  // ── Stock Table ────────────────────────────────────────────────────────────
  let fullStockData = [];

  async function loadFullStocks() {
    try {
      const data = await apiFetch('/api/stocks');
      fullStockData = data;
      populateSectorFilters();
      enrichStockTable();
    } catch (_) {}
  }

  function populateSectorFilters() {
    const sectors = [...new Set(fullStockData.map(s => s.sector).filter(Boolean))].sort();
    const html = '<option value="">All Sectors</option>' + sectors.map(s => `<option value="${s}">${s}</option>`).join('');
    const sf = $('#sectorFilter');
    if (sf) sf.innerHTML = html;
  }

  function populateScreenerSectors() {
    const sectors = [...new Set(fullStockData.map(s => s.sector).filter(Boolean))].sort();
    const html = '<option value="">All</option>' + sectors.map(s => `<option value="${s}">${s}</option>`).join('');
    const sf = $('#screenerSector');
    if (sf) sf.innerHTML = html;
  }

  function enrichStockTable() {
    if (!fullStockData.length) return;
    const tbody = $('#stockTableBody');
    if (!tbody) return;

    const filterText = ($('#tableFilter')?.value || '').toLowerCase();
    const filterSector = $('#sectorFilter')?.value || '';

    let stocks = fullStockData.map(fs => {
      const live = state.stocks.find(s => s.symbol === fs.symbol);
      return { ...fs, price: live?.price ?? fs.price, change: live?.change ?? fs.change };
    });

    if (filterText) stocks = stocks.filter(s =>
      s.symbol.toLowerCase().includes(filterText) || (s.name || '').toLowerCase().includes(filterText)
    );
    if (filterSector) stocks = stocks.filter(s => s.sector === filterSector);

    stocks.sort((a, b) => {
      const va = a[state.sortCol] ?? '';
      const vb = b[state.sortCol] ?? '';
      if (typeof va === 'number') return (va - vb) * state.sortDir;
      return String(va).localeCompare(String(vb)) * state.sortDir;
    });

    tbody.innerHTML = stocks.map(s => {
      const cls = (s.change || 0) >= 0 ? 'up' : 'down';
      return `<tr data-symbol="${s.symbol}">
        <td class="sym-cell">${s.symbol}</td>
        <td>${s.name || s.symbol}</td>
        <td class="price-cell">$${fmt(s.price)}</td>
        <td class="change-cell ${cls}">${(s.change || 0) >= 0 ? '+' : ''}${(s.change || 0).toFixed(2)}%</td>
        <td class="vol-cell">${fmtInt(s.volume)}</td>
        <td>${s.sector || '--'}</td>
        <td>${s.pe || '--'}</td>
        <td>
          <button class="table-action-btn" onclick="event.stopPropagation(); window.jseApp.addToPortfolioModal('${s.symbol}')">
            <i class="fas fa-plus"></i> Add
          </button>
        </td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('tr').forEach(row => {
      row.addEventListener('click', () => selectStock(row.dataset.symbol));
    });
  }

  // Table sorting
  $$('#stockTable th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (state.sortCol === col) state.sortDir *= -1;
      else { state.sortCol = col; state.sortDir = 1; }
      enrichStockTable();
    });
  });

  $('#tableFilter')?.addEventListener('input', () => enrichStockTable());
  $('#sectorFilter')?.addEventListener('change', () => enrichStockTable());

  // ── Chart ──────────────────────────────────────────────────────────────────
  function initChart() {
    const container = $('#mainChart');
    if (!container || state.mainChart) return;

    state.mainChart = LightweightCharts.createChart(container, {
      width: container.clientWidth,
      height: 400,
      layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#6b7a8d', fontSize: 12, fontFamily: 'Inter' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
      crosshair: { mode: 0, vertLine: { color: 'rgba(0,200,83,0.3)' }, horzLine: { color: 'rgba(0,200,83,0.3)' } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.06)', timeVisible: true },
    });

    state.mainSeries = state.mainChart.addAreaSeries({
      topColor: 'rgba(0,200,83,0.3)',
      bottomColor: 'rgba(0,200,83,0.02)',
      lineColor: '#00c853',
      lineWidth: 2,
    });

    new ResizeObserver(() => {
      if (state.mainChart) state.mainChart.applyOptions({ width: container.clientWidth });
    }).observe(container);

    loadChartData();
  }

  async function loadChartData() {
    try {
      const res = await apiFetch(`/api/history/${state.selectedSymbol}`);
      let data = res.history || res;

      // If we have very few data points, generate synthetic intraday variation
      // so the chart doesn't look flat on fresh start
      if (data && data.length > 0 && data.length < 10) {
        const basePrice = data[data.length - 1];
        const synthetic = [];
        for (let i = 60; i > 0; i--) {
          // Random walk around base price (±1.5% max)
          const noise = (Math.random() - 0.48) * basePrice * 0.015;
          const drift = (60 - i) / 60 * (data[data.length - 1] - (data[0] || basePrice));
          synthetic.push(basePrice + noise + drift - (basePrice * 0.005));
        }
        // Append real data at the end
        data = [...synthetic, ...data];
      }

      if (data && data.length) {
        const now = Math.floor(Date.now() / 1000);
        const chartData = data.map((price, i) => ({
          time: now - (data.length - i) * 120,
          value: typeof price === 'number' ? price : price.price || price,
        }));
        state.mainSeries.setData(chartData);
        state.mainChart.timeScale().fitContent();
      }
    } catch (_) {}
  }

  function updateChartPrice() {
    const stock = state.stocks.find(s => s.symbol === state.selectedSymbol);
    if (!stock) return;

    $('#chartSymbol').textContent = state.selectedSymbol;
    $('#chartPrice').textContent = `$${fmt(stock.price)}`;
    const changeEl = $('#chartChange');
    const cls = stock.change >= 0 ? 'up' : 'down';
    changeEl.className = `chart-change-live ${cls}`;
    changeEl.textContent = `${stock.change >= 0 ? '+' : ''}${stock.change.toFixed(2)}%`;

    if (state.mainSeries) {
      const now = Math.floor(Date.now() / 1000);
      state.mainSeries.update({ time: now, value: stock.price });
    }
  }

  $$('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadChartData();
    });
  });

  // ── Search ─────────────────────────────────────────────────────────────────
  const searchInput = $('#searchInput');
  const searchDropdown = $('#searchDropdown');

  searchInput?.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) { searchDropdown.classList.remove('show'); return; }

    const results = fullStockData.filter(s =>
      s.symbol.toLowerCase().includes(q) || (s.name || '').toLowerCase().includes(q)
    ).slice(0, 8);

    if (!results.length) { searchDropdown.classList.remove('show'); return; }

    searchDropdown.innerHTML = results.map(s => {
      const live = state.stocks.find(x => x.symbol === s.symbol);
      const price = live?.price ?? s.price;
      return `<div class="search-result" data-symbol="${s.symbol}">
        <div><div class="sr-symbol">${s.symbol}</div><div class="sr-name">${s.name}</div></div>
        <div class="sr-price">$${fmt(price)}</div>
      </div>`;
    }).join('');

    searchDropdown.classList.add('show');

    searchDropdown.querySelectorAll('.search-result').forEach(r => {
      r.addEventListener('click', () => {
        selectStock(r.dataset.symbol);
        searchInput.value = '';
        searchDropdown.classList.remove('show');
        navigateTo('dashboard');
      });
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.header-search')) searchDropdown?.classList.remove('show');
  });

  // ── AI Chat ────────────────────────────────────────────────────────────────
  // SERVER expects: { messages: [{role, content}, ...] }
  // SERVER returns: { reply: "..." }
  const chatMessages = $('#chatMessages');
  const chatInput = $('#chatInput');
  const chatSend = $('#chatSend');

  function addChatMessage(role, content) {
    const welcome = chatMessages?.querySelector('.chat-welcome');
    if (welcome) welcome.remove();

    const div = document.createElement('div');
    div.className = `chat-msg ${role} fade-in`;
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `<div class="msg-content">${formatMarkdown(content)}</div><div class="msg-time">${time}</div>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
  }

  function formatMarkdown(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/^### (.*$)/gm, '<h4 style="margin:12px 0 6px;color:var(--gold);">$1</h4>')
      .replace(/^## (.*$)/gm, '<h3 style="margin:14px 0 8px;color:var(--gold);">$1</h3>')
      .replace(/^# (.*$)/gm, '<h2 style="margin:16px 0 8px;color:var(--gold);">$1</h2>')
      .replace(/^- (.*$)/gm, '<div style="padding-left:16px;">• $1</div>')
      .replace(/^\d+\. (.*$)/gm, '<div style="padding-left:16px;">$&</div>')
      .replace(/\n/g, '<br>');
  }

  async function sendChatMessage() {
    const msg = chatInput.value.trim();
    if (!msg) return;

    chatInput.value = '';
    chatInput.style.height = 'auto';
    addChatMessage('user', msg);

    // Add to history
    state.chatHistory.push({ role: 'user', content: msg });

    const loading = addChatMessage('assistant', 'Thinking...');
    chatSend.disabled = true;

    try {
      // SERVER expects: { messages: [{role, content}] }
      const data = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: state.chatHistory.slice(-20) }),
      });

      const reply = data.reply || data.response || 'No response received.';
      state.chatHistory.push({ role: 'assistant', content: reply });
      loading.querySelector('.msg-content').innerHTML = formatMarkdown(reply);
      addChatListenBtn(loading, reply);
    } catch (e) {
      loading.querySelector('.msg-content').innerHTML = `<span style="color:var(--red);">Error: ${escHtml(e.message)}</span>`;
    } finally {
      chatSend.disabled = false;
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  chatSend?.addEventListener('click', sendChatMessage);
  chatInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
  });
  chatInput?.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  });

  // ── AI Analysis ────────────────────────────────────────────────────────────
  // SERVER expects: { user_input, experience_level }
  // SERVER returns: { analysis: object|string, structured: bool, symbol, level }
  $$('.level-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.level-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.analysisLevel = btn.dataset.level;
    });
  });

  $('#analyzeBtn')?.addEventListener('click', async () => {
    const symbol = ($('#analysisSymbol')?.value || '').trim().toUpperCase();
    if (!symbol) { alert('Enter a stock symbol'); return; }

    const resultEl = $('#analysisResult');
    const btn = $('#analyzeBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';

    resultEl.innerHTML = `
      <div class="loading-shimmer" style="width:60%;height:24px;margin-bottom:16px;"></div>
      <div class="loading-shimmer" style="width:100%;height:16px;"></div>
      <div class="loading-shimmer" style="width:90%;height:16px;"></div>
      <div class="loading-shimmer" style="width:95%;height:16px;"></div>
      <div class="loading-shimmer" style="width:80%;height:16px;"></div>
    `;

    try {
      // SERVER expects user_input and experience_level
      const data = await apiFetch('/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_input: `Analyze ${symbol}`,
          experience_level: state.analysisLevel,
        }),
      });

      let analysisText = '';
      if (data.structured && data.analysis && typeof data.analysis === 'object') {
        const a = data.analysis;
        resultEl.innerHTML = renderStructuredAnalysis(a, state.analysisLevel);
        analysisText = `${a.company}. Recommendation: ${a.recommendation}. ${a.overview || ''} ${a.verdict || ''}`;
      } else if (data.analysis) {
        const text = typeof data.analysis === 'string' ? data.analysis : JSON.stringify(data.analysis, null, 2);
        resultEl.innerHTML = `<div style="white-space:pre-wrap;line-height:1.7;font-size:14px;">${formatMarkdown(text)}</div>`;
        analysisText = text;
      } else {
        resultEl.innerHTML = '<p class="text-muted">No analysis returned.</p>';
      }

      // Show listen button and wire it
      const listenBtn = $('#listenAnalysisBtn');
      if (listenBtn && analysisText) {
        listenBtn.style.display = 'inline-flex';
        listenBtn.onclick = () => speakText(analysisText, listenBtn);
      }

      // Load Yahoo research chart (candlestick) if available, else price history
      try {
        const researchRes = await apiFetch(`/api/research/${symbol}`);
        if (researchRes.candles && researchRes.candles.length > 1) {
          renderResearchChart(researchRes.candles, researchRes.fundamentals);
        } else {
          const histRes = await apiFetch(`/api/history/${symbol}`);
          const hist = histRes.history || histRes;
          if (hist && hist.length) renderTechnicalChart(hist);
        }
      } catch (_) {
        try {
          const histRes = await apiFetch(`/api/history/${symbol}`);
          const hist = histRes.history || histRes;
          if (hist && hist.length) renderTechnicalChart(hist);
        } catch (__) {}
      }

      // For Intermediate/Advanced: fetch real indicators and render visual charts
      if (state.analysisLevel !== 'Beginner') {
        try {
          const analyticsData = await apiFetch(`/api/analytics/technical/${symbol}`);
          if (analyticsData && analyticsData.indicators) {
            renderIndicatorCharts(analyticsData, symbol, resultEl);
          }
        } catch (_) {}
      }

    } catch (e) {
      resultEl.innerHTML = `<p style="color:var(--red);padding:20px;">Error: ${e.message}</p>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-bolt"></i> Analyze';
    }
  });

  function renderStructuredAnalysis(a, level) {
    const rec = escHtml(a.recommendation || 'N/A');
    const recColor = rec === 'BUY' ? 'var(--green)' : rec === 'SELL' ? 'var(--red)' : 'var(--blue)';
    const riskWidth = ((a.riskScore || 5) / 10 * 100);
    const riskColor = a.riskScore <= 3 ? 'var(--green)' : a.riskScore <= 6 ? 'var(--gold)' : 'var(--red)';

    let html = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
        <div>
          <h3 style="font-size:20px;font-weight:700;">${escHtml(a.company)}</h3>
          <p style="color:var(--muted);font-size:13px;margin-top:4px;">${escHtml(level)} Analysis</p>
        </div>
        <div style="padding:8px 20px;border-radius:8px;font-size:18px;font-weight:800;color:${recColor};border:2px solid ${recColor};background:${recColor}15;">
          ${rec}
        </div>
      </div>

      <p style="font-size:14px;line-height:1.7;margin-bottom:20px;color:var(--text2);">${escHtml(a.overview)}</p>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
        <div style="background:var(--glass);border:1px solid var(--border);border-radius:10px;padding:16px;">
          <h4 style="font-size:12px;color:var(--muted);text-transform:uppercase;margin-bottom:10px;">Key Points</h4>
          ${(a.keyPoints || []).map(p => `<div style="padding:4px 0;font-size:13px;display:flex;gap:8px;"><span style="color:var(--green);">•</span> ${escHtml(p)}</div>`).join('')}
        </div>
        <div style="background:var(--glass);border:1px solid var(--border);border-radius:10px;padding:16px;">
          <h4 style="font-size:12px;color:var(--muted);text-transform:uppercase;margin-bottom:10px;">Risks</h4>
          ${(a.risks || []).map(r => `<div style="padding:4px 0;font-size:13px;display:flex;gap:8px;"><span style="color:var(--red);">⚠</span> ${escHtml(r)}</div>`).join('')}
        </div>
      </div>

      <div style="background:var(--glass);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:12px;color:var(--muted);text-transform:uppercase;">Risk Score</span>
          <span style="font-weight:700;color:${riskColor};">${a.riskScore || '?'}/10</span>
        </div>
        <div style="height:8px;background:var(--glass2);border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${riskWidth}%;background:${riskColor};border-radius:4px;transition:width 0.5s;"></div>
        </div>
      </div>

      <div style="background:var(--glass);border:1px solid var(--border);border-radius:10px;padding:16px;">
        <h4 style="font-size:12px;color:var(--muted);text-transform:uppercase;margin-bottom:8px;">Verdict</h4>
        <p style="font-size:14px;line-height:1.6;font-weight:500;">${escHtml(a.verdict)}</p>
      </div>`;

    // Intermediate extras
    if (a.technicalSummary) {
      const ts = a.technicalSummary;
      html += `
        <div style="margin-top:16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;">
          ${ts.trend ? `<div style="background:var(--glass);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center;"><div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Trend</div><div style="font-weight:700;margin-top:4px;color:${ts.trend === 'bullish' ? 'var(--green)' : ts.trend === 'bearish' ? 'var(--red)' : 'var(--blue)'};">${ts.trend}</div></div>` : ''}
          ${ts.volumeTrend ? `<div style="background:var(--glass);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center;"><div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Volume</div><div style="font-weight:700;margin-top:4px;">${ts.volumeTrend}</div></div>` : ''}
          ${ts.relativeStrength ? `<div style="background:var(--glass);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center;"><div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Strength</div><div style="font-weight:700;margin-top:4px;">${ts.relativeStrength}</div></div>` : ''}
          ${ts.priceTarget ? `<div style="background:var(--glass);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center;"><div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Target</div><div style="font-weight:700;margin-top:4px;color:var(--gold);">$${fmt(ts.priceTarget)}</div></div>` : ''}
        </div>`;
    }

    // Advanced extras
    if (a.technicalIndicators) {
      const ti = a.technicalIndicators;
      html += `
        <div style="margin-top:16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;">
          ${ti.rsiEstimate ? `<div style="background:var(--glass);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center;"><div style="font-size:10px;color:var(--muted);">RSI</div><div style="font-weight:700;margin-top:4px;">${ti.rsiEstimate}</div></div>` : ''}
          ${ti.support ? `<div style="background:var(--glass);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center;"><div style="font-size:10px;color:var(--muted);">Support</div><div style="font-weight:700;margin-top:4px;color:var(--green);">$${ti.support}</div></div>` : ''}
          ${ti.resistance ? `<div style="background:var(--glass);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center;"><div style="font-size:10px;color:var(--muted);">Resistance</div><div style="font-weight:700;margin-top:4px;color:var(--red);">$${ti.resistance}</div></div>` : ''}
          ${ti.macdSignal ? `<div style="background:var(--glass);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center;"><div style="font-size:10px;color:var(--muted);">MACD</div><div style="font-weight:700;margin-top:4px;">${ti.macdSignal}</div></div>` : ''}
        </div>`;
    }

    if (a.catalysts) {
      html += `
        <div style="margin-top:16px;background:var(--glass);border:1px solid var(--border);border-radius:10px;padding:16px;">
          <h4 style="font-size:12px;color:var(--muted);text-transform:uppercase;margin-bottom:8px;">Catalysts</h4>
          ${a.catalysts.map(c => `<div style="padding:4px 0;font-size:13px;">🔥 ${escHtml(c)}</div>`).join('')}
        </div>`;
    }

    return html;
  }

  /**
   * Render visual indicator charts for Intermediate/Advanced analysis
   * RSI gauge, MACD histogram, Bollinger Bands, Stochastic, signal meter, S/R levels
   */
  function renderIndicatorCharts(analyticsData, symbol, container) {
    const ind = analyticsData.indicators;
    const summary = analyticsData.summary;
    const sr = analyticsData.supportResistance;

    let chartsHtml = `
      <div style="margin-top:24px;border-top:1px solid var(--border);padding-top:20px;">
        <h3 style="font-size:16px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
          <i class="fas fa-chart-bar" style="color:var(--blue);"></i> Technical Indicators — ${escHtml(symbol)}
          <span style="font-size:11px;color:var(--muted);font-weight:400;">(real-time computed)</span>
        </h3>`;

    // Signal Summary Meter
    if (summary) {
      const total = summary.total || 1;
      const bullPct = Math.round((summary.bullish / total) * 100);
      const bearPct = Math.round((summary.bearish / total) * 100);
      const neutPct = 100 - bullPct - bearPct;
      const recColor = (summary.recommendation||'').includes('BUY') ? 'var(--green)' : (summary.recommendation||'').includes('SELL') ? 'var(--red)' : 'var(--blue)';

      chartsHtml += `
        <div style="background:var(--glass);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <span style="font-size:13px;color:var(--muted);text-transform:uppercase;font-weight:600;">Signal Summary (${total} indicators)</span>
            <span style="font-size:18px;font-weight:800;color:${recColor};letter-spacing:1px;">${summary.recommendation}</span>
          </div>
          <div style="display:flex;height:12px;border-radius:6px;overflow:hidden;margin-bottom:10px;">
            <div style="width:${bullPct}%;background:var(--green);transition:width 0.5s;"></div>
            <div style="width:${neutPct}%;background:#555;transition:width 0.5s;"></div>
            <div style="width:${bearPct}%;background:var(--red);transition:width 0.5s;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:11px;">
            <span style="color:var(--green);">Bullish: ${summary.bullish}</span>
            <span style="color:#888;">Neutral: ${summary.neutral}</span>
            <span style="color:var(--red);">Bearish: ${summary.bearish}</span>
          </div>
        </div>`;
    }

    // RSI Gauge + MACD side by side
    const rsi = ind.momentum?.rsi;
    const macd = ind.trend?.macd;

    if (rsi || macd) {
      chartsHtml += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">`;

      if (rsi && rsi.value != null) {
        const rsiVal = typeof rsi.value === 'number' ? rsi.value : parseFloat(rsi.value) || 50;
        const rsiColor = rsiVal > 70 ? 'var(--red)' : rsiVal < 30 ? 'var(--green)' : 'var(--blue)';
        const rsiZone = rsiVal > 70 ? 'OVERBOUGHT' : rsiVal < 30 ? 'OVERSOLD' : 'NEUTRAL';

        chartsHtml += `
          <div style="background:var(--glass);border:1px solid var(--border);border-radius:12px;padding:20px;">
            <div style="font-size:11px;color:var(--muted);text-transform:uppercase;font-weight:600;margin-bottom:12px;">RSI (14)</div>
            <div style="display:flex;align-items:center;justify-content:center;height:110px;">
              <svg viewBox="0 0 120 70" style="width:100%;max-width:180px;">
                <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="8" stroke-linecap="round"/>
                <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" stroke="url(#rsiGrad${symbol})" stroke-width="8" stroke-linecap="round"
                  stroke-dasharray="${rsiVal * 1.57} 157" style="transition:stroke-dasharray 1s;"/>
                <defs><linearGradient id="rsiGrad${symbol}"><stop offset="0%" stop-color="#00c853"/><stop offset="50%" stop-color="#2196f3"/><stop offset="100%" stop-color="#f44336"/></linearGradient></defs>
                <text x="60" y="50" text-anchor="middle" fill="${rsiColor}" font-size="20" font-weight="800">${rsiVal.toFixed(1)}</text>
                <text x="60" y="64" text-anchor="middle" fill="#6b7a8d" font-size="7" font-weight="600">${rsiZone}</text>
              </svg>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-top:4px;"><span>Oversold &lt;30</span><span>Overbought &gt;70</span></div>
          </div>`;
      }

      if (macd && macd.value) {
        const mv = macd.value;
        const macdLine = mv.MACD || mv.macd || 0;
        const sigLine = mv.signal || 0;
        const histogram = mv.histogram || (macdLine - sigLine) || 0;
        const macdSig = macd.signal || 'neutral';
        const macdColor = macdSig === 'bullish' ? 'var(--green)' : macdSig === 'bearish' ? 'var(--red)' : 'var(--blue)';

        // Build mini histogram from series data
        const series = macd.series || [];
        const histBars = series.slice(-25).map(m => {
          const h = m ? (m.histogram || 0) : 0;
          const maxH = Math.max(...series.slice(-25).map(x => Math.abs(x?.histogram || 0)), 0.01);
          const height = Math.min(Math.abs(h) / maxH * 30, 30);
          return `<div style="width:5px;height:${Math.max(height,2)}px;background:${h >= 0 ? 'var(--green)' : 'var(--red)'};border-radius:1px;opacity:0.8;"></div>`;
        }).join('');

        chartsHtml += `
          <div style="background:var(--glass);border:1px solid var(--border);border-radius:12px;padding:20px;">
            <div style="font-size:11px;color:var(--muted);text-transform:uppercase;font-weight:600;margin-bottom:12px;">MACD (12,26,9)</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">
              <div style="text-align:center;"><div style="font-size:9px;color:var(--muted);">MACD</div><div style="font-weight:700;font-size:13px;color:${macdColor};">${macdLine.toFixed(2)}</div></div>
              <div style="text-align:center;"><div style="font-size:9px;color:var(--muted);">Signal</div><div style="font-weight:700;font-size:13px;">${sigLine.toFixed(2)}</div></div>
            </div>
            <div style="text-align:center;margin-bottom:8px;"><span style="font-size:9px;color:var(--muted);">Histogram: </span><span style="font-weight:700;color:${histogram >= 0 ? 'var(--green)' : 'var(--red)'};">${histogram.toFixed(2)}</span></div>
            ${histBars ? `<div style="display:flex;align-items:end;justify-content:center;gap:1px;height:35px;">${histBars}</div>` : ''}
            <div style="font-size:11px;text-align:center;color:${macdColor};font-weight:700;text-transform:uppercase;margin-top:6px;">${macdSig}</div>
          </div>`;
      }

      chartsHtml += `</div>`;
    }

    // Bollinger Bands + Stochastic
    const bb = ind.volatility?.bollingerBands;
    const stoch = ind.momentum?.stochastic;

    if (bb || stoch) {
      chartsHtml += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">`;

      if (bb && bb.value) {
        const price = analyticsData.currentPrice || 0;
        const upper = bb.value.upper || 0;
        const lower = bb.value.lower || 0;
        const middle = bb.value.middle || 0;
        const range = upper - lower || 1;
        const pricePct = Math.max(5, Math.min(95, ((price - lower) / range) * 100));

        chartsHtml += `
          <div style="background:var(--glass);border:1px solid var(--border);border-radius:12px;padding:20px;">
            <div style="font-size:11px;color:var(--muted);text-transform:uppercase;font-weight:600;margin-bottom:12px;">Bollinger Bands (20,2)</div>
            <div style="position:relative;height:90px;margin:8px 0;">
              <div style="position:absolute;top:0;left:0;right:0;height:100%;border:1px dashed rgba(255,255,255,0.12);border-radius:8px;display:flex;flex-direction:column;justify-content:space-between;padding:6px 10px;">
                <span style="font-size:10px;color:var(--red);">Upper: $${upper.toFixed(2)}</span>
                <span style="font-size:10px;color:var(--blue);">Mid: $${middle.toFixed(2)}</span>
                <span style="font-size:10px;color:var(--green);">Lower: $${lower.toFixed(2)}</span>
              </div>
              <div style="position:absolute;left:55%;bottom:${pricePct}%;transform:translate(-50%,50%);width:10px;height:10px;background:var(--gold);border-radius:50%;box-shadow:0 0 8px var(--gold);z-index:1;"></div>
              <div style="position:absolute;left:55%;bottom:${pricePct}%;transform:translate(8px,50%);font-size:10px;font-weight:700;color:var(--gold);white-space:nowrap;">$${price.toFixed(2)}</div>
            </div>
            <div style="font-size:11px;text-align:center;color:${bb.signal === 'bullish' ? 'var(--green)' : bb.signal === 'bearish' ? 'var(--red)' : 'var(--muted)'};font-weight:700;text-transform:uppercase;">${bb.signal || 'neutral'}</div>
          </div>`;
      }

      if (stoch && stoch.value) {
        const k = stoch.value.k || 0;
        const d = stoch.value.d || 0;

        chartsHtml += `
          <div style="background:var(--glass);border:1px solid var(--border);border-radius:12px;padding:20px;">
            <div style="font-size:11px;color:var(--muted);text-transform:uppercase;font-weight:600;margin-bottom:16px;">Stochastic (14,3)</div>
            <div style="margin-bottom:10px;">
              <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;"><span style="color:var(--blue);">%K</span><span style="font-weight:700;">${k.toFixed(1)}</span></div>
              <div style="height:8px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden;">
                <div style="height:100%;width:${Math.min(k,100)}%;background:var(--blue);border-radius:4px;transition:width 0.5s;"></div>
              </div>
            </div>
            <div style="margin-bottom:10px;">
              <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;"><span style="color:var(--gold);">%D</span><span style="font-weight:700;">${d.toFixed(1)}</span></div>
              <div style="height:8px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden;">
                <div style="height:100%;width:${Math.min(d,100)}%;background:var(--gold);border-radius:4px;transition:width 0.5s;"></div>
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);"><span>Oversold &lt;20</span><span>Overbought &gt;80</span></div>
            <div style="font-size:11px;text-align:center;color:${k > 80 ? 'var(--red)' : k < 20 ? 'var(--green)' : 'var(--blue)'};font-weight:700;text-transform:uppercase;margin-top:8px;">${stoch.signal || 'neutral'}</div>
          </div>`;
      }

      chartsHtml += `</div>`;
    }

    // All Indicators Grid
    chartsHtml += `
      <div style="background:var(--glass);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:16px;">
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;font-weight:600;margin-bottom:12px;">All Indicator Signals</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;">`;

    for (const cat of ['trend','momentum','volatility','volume']) {
      const group = ind[cat];
      if (!group) continue;
      for (const [name, data] of Object.entries(group)) {
        if (!data || typeof data !== 'object') continue;
        const sig = data.signal || 'neutral';
        const sigColor = sig === 'bullish' ? 'var(--green)' : sig === 'bearish' ? 'var(--red)' : '#666';
        const sigIcon = sig === 'bullish' ? '▲' : sig === 'bearish' ? '▼' : '●';
        let val = '';
        if (typeof data.value === 'number') val = data.value.toFixed(2);

        chartsHtml += `
          <div style="background:rgba(255,255,255,0.02);border:1px solid ${sigColor}30;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;">${escHtml(name)}</div>
            <div style="font-size:13px;font-weight:700;margin:4px 0;color:${sigColor};">${sigIcon} ${sig.toUpperCase()}</div>
            ${val ? `<div style="font-size:10px;color:var(--text2);">${val}</div>` : ''}
          </div>`;
      }
    }

    chartsHtml += `</div></div>`;

    // Support & Resistance
    if (sr && ((sr.support && sr.support.length) || (sr.resistance && sr.resistance.length))) {
      chartsHtml += `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
          <div style="background:var(--glass);border:1px solid var(--border);border-radius:12px;padding:16px;">
            <div style="font-size:11px;color:var(--green);text-transform:uppercase;font-weight:600;margin-bottom:8px;">Support Levels</div>
            ${(sr.support || []).map(s => { const v = typeof s === 'number' ? s : (s.level || 0); return `<div style="padding:3px 0;font-size:13px;font-weight:600;color:var(--green);">$${Number(v).toFixed(2)}</div>`; }).join('') || '<div style="color:var(--muted);font-size:12px;">N/A</div>'}
          </div>
          <div style="background:var(--glass);border:1px solid var(--border);border-radius:12px;padding:16px;">
            <div style="font-size:11px;color:var(--red);text-transform:uppercase;font-weight:600;margin-bottom:8px;">Resistance Levels</div>
            ${(sr.resistance || []).map(r => { const v = typeof r === 'number' ? r : (r.level || 0); return `<div style="padding:3px 0;font-size:13px;font-weight:600;color:var(--red);">$${Number(v).toFixed(2)}</div>`; }).join('') || '<div style="color:var(--muted);font-size:12px;">N/A</div>'}
          </div>
        </div>`;
    }

    chartsHtml += `</div>`;

    // ML Prediction button (Advanced only)
    chartsHtml += `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px;">
        <button id="btn-ml-predict-${symbol}" onclick="window.__fetchMLPrediction('${symbol}', this)" style="background:linear-gradient(135deg,#6c63ff,#3f51b5);border:none;color:#fff;padding:14px;border-radius:12px;cursor:pointer;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;">
          <i class="fas fa-brain"></i> ML Price Prediction
        </button>
        <button id="btn-backtest-${symbol}" onclick="window.__fetchBacktest('${symbol}', this)" style="background:linear-gradient(135deg,#00c853,#009624);border:none;color:#fff;padding:14px;border-radius:12px;cursor:pointer;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;">
          <i class="fas fa-flask"></i> Backtest Strategy
        </button>
      </div>
      <div id="ml-results-${symbol}" style="margin-top:12px;"></div>
    `;

    container.innerHTML += chartsHtml;
  }

  // ML Prediction fetch handler
  window.__fetchMLPrediction = async function(symbol, btn) {
    const resultsEl = document.getElementById('ml-results-' + symbol);
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Predicting...';
    try {
      const data = await apiFetch('/api/analytics/predict/' + symbol);
      if (data.error || data.fallback) {
        resultsEl.innerHTML = `<div style="background:var(--glass);border:1px solid var(--border);border-radius:12px;padding:20px;"><p style="color:var(--gold);">ML service unavailable — start the Python analytics server for predictions.</p></div>`;
        return;
      }
      const p = data.prediction || data;
      const current = p.currentPrice || p.current_price || 0;
      const predicted = p.predictedPrice || p.predicted_price || 0;
      const change = current > 0 ? ((predicted - current) / current * 100) : 0;
      const direction = change >= 0 ? 'up' : 'down';
      const color = change >= 0 ? 'var(--green)' : 'var(--red)';
      const confidence = p.confidence || p.r2_score || 0;
      const models = p.models || p.model_predictions || {};

      let html = `
        <div style="background:var(--glass);border:1px solid var(--border);border-radius:12px;padding:20px;">
          <h4 style="font-size:13px;color:var(--muted);text-transform:uppercase;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
            <i class="fas fa-brain" style="color:#6c63ff;"></i> ML Prediction — ${symbol}
          </h4>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;">
            <div style="text-align:center;padding:12px;background:rgba(255,255,255,0.03);border-radius:8px;">
              <div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Current</div>
              <div style="font-size:18px;font-weight:800;margin-top:4px;">$${Number(current).toFixed(2)}</div>
            </div>
            <div style="text-align:center;padding:12px;background:rgba(255,255,255,0.03);border-radius:8px;">
              <div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Predicted</div>
              <div style="font-size:18px;font-weight:800;margin-top:4px;color:${color};">$${Number(predicted).toFixed(2)}</div>
            </div>
            <div style="text-align:center;padding:12px;background:rgba(255,255,255,0.03);border-radius:8px;">
              <div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Change</div>
              <div style="font-size:18px;font-weight:800;margin-top:4px;color:${color};">${change >= 0 ? '+' : ''}${change.toFixed(2)}%</div>
            </div>
          </div>
          <div style="margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;">
              <span style="color:var(--muted);">Confidence</span>
              <span style="font-weight:700;">${(confidence * 100).toFixed(1)}%</span>
            </div>
            <div style="height:8px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden;">
              <div style="height:100%;width:${Math.min(confidence * 100, 100)}%;background:linear-gradient(90deg,#6c63ff,#3f51b5);border-radius:4px;"></div>
            </div>
          </div>`;

      // Individual model predictions
      if (Object.keys(models).length > 0) {
        html += `<div style="font-size:11px;color:var(--muted);margin-bottom:8px;text-transform:uppercase;">Model Breakdown</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;">`;
        for (const [name, val] of Object.entries(models)) {
          const v = typeof val === 'object' ? (val.price || val.predicted || 0) : val;
          html += `<div style="background:rgba(255,255,255,0.02);border:1px solid rgba(108,99,255,0.2);border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:9px;color:var(--muted);">${name}</div>
            <div style="font-size:13px;font-weight:700;margin-top:4px;">$${Number(v).toFixed(2)}</div>
          </div>`;
        }
        html += `</div>`;
      }

      html += `<p style="font-size:10px;color:var(--muted);margin-top:12px;font-style:italic;">Predictions use Linear Regression + Random Forest + ARIMA ensemble. Not financial advice.</p></div>`;
      resultsEl.innerHTML = html;
    } catch (e) {
      resultsEl.innerHTML = `<div style="background:var(--glass);border:1px solid var(--border);border-radius:12px;padding:16px;color:var(--red);">Prediction failed: ${e.message}</div>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-brain"></i> ML Price Prediction';
    }
  };

  // Backtest fetch handler
  window.__fetchBacktest = async function(symbol, btn) {
    const resultsEl = document.getElementById('ml-results-' + symbol);
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Backtesting...';
    try {
      const data = await apiFetch('/api/analytics/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, strategy: 'sma_crossover', shortWindow: 10, longWindow: 20, initialCapital: 100000 })
      });
      if (data.error || data.fallback) {
        resultsEl.innerHTML = `<div style="background:var(--glass);border:1px solid var(--border);border-radius:12px;padding:20px;"><p style="color:var(--gold);">Backtesting service unavailable — start the Python analytics server.</p></div>`;
        return;
      }
      const r = data.results || data;
      const totalReturn = r.totalReturn || r.total_return || 0;
      const sharpe = r.sharpeRatio || r.sharpe_ratio || 0;
      const maxDD = r.maxDrawdown || r.max_drawdown || 0;
      const trades = r.totalTrades || r.total_trades || 0;
      const winRate = r.winRate || r.win_rate || 0;
      const finalVal = r.finalValue || r.final_value || 0;

      const retColor = totalReturn >= 0 ? 'var(--green)' : 'var(--red)';

      let html = `
        <div style="background:var(--glass);border:1px solid var(--border);border-radius:12px;padding:20px;margin-top:12px;">
          <h4 style="font-size:13px;color:var(--muted);text-transform:uppercase;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
            <i class="fas fa-flask" style="color:var(--green);"></i> Backtest Results — SMA Crossover (10/20)
          </h4>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px;">
            <div style="text-align:center;padding:12px;background:rgba(255,255,255,0.03);border-radius:8px;">
              <div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Total Return</div>
              <div style="font-size:18px;font-weight:800;margin-top:4px;color:${retColor};">${(totalReturn * 100).toFixed(2)}%</div>
            </div>
            <div style="text-align:center;padding:12px;background:rgba(255,255,255,0.03);border-radius:8px;">
              <div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Final Value</div>
              <div style="font-size:18px;font-weight:800;margin-top:4px;">$${Number(finalVal).toLocaleString()}</div>
            </div>
            <div style="text-align:center;padding:12px;background:rgba(255,255,255,0.03);border-radius:8px;">
              <div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Sharpe Ratio</div>
              <div style="font-size:18px;font-weight:800;margin-top:4px;color:${sharpe >= 1 ? 'var(--green)' : sharpe >= 0 ? 'var(--gold)' : 'var(--red)'};">${Number(sharpe).toFixed(2)}</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
            <div style="text-align:center;padding:12px;background:rgba(255,255,255,0.03);border-radius:8px;">
              <div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Max Drawdown</div>
              <div style="font-size:15px;font-weight:700;margin-top:4px;color:var(--red);">${(maxDD * 100).toFixed(2)}%</div>
            </div>
            <div style="text-align:center;padding:12px;background:rgba(255,255,255,0.03);border-radius:8px;">
              <div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Total Trades</div>
              <div style="font-size:15px;font-weight:700;margin-top:4px;">${trades}</div>
            </div>
            <div style="text-align:center;padding:12px;background:rgba(255,255,255,0.03);border-radius:8px;">
              <div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Win Rate</div>
              <div style="font-size:15px;font-weight:700;margin-top:4px;color:${winRate >= 0.5 ? 'var(--green)' : 'var(--red)'};">${(winRate * 100).toFixed(1)}%</div>
            </div>
          </div>
          <p style="font-size:10px;color:var(--muted);margin-top:12px;font-style:italic;">SMA Crossover strategy with $100K initial capital. Past performance does not predict future results.</p>
        </div>`;
      resultsEl.innerHTML = html;
    } catch (e) {
      resultsEl.innerHTML = `<div style="background:var(--glass);border:1px solid var(--border);border-radius:12px;padding:16px;color:var(--red);">Backtest failed: ${e.message}</div>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-flask"></i> Backtest Strategy';
    }
  };

  function renderTechnicalChart(prices) {
    const card = $('#technicalChartCard');
    const container = $('#technicalChart');
    if (!card || !container) return;
    card.classList.remove('hidden');

    if (state.technicalChart) {
      state.technicalChart.remove();
      state.technicalChart = null;
    }

    state.technicalChart = LightweightCharts.createChart(container, {
      width: container.clientWidth,
      height: 300,
      layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#6b7a8d', fontSize: 11, fontFamily: 'Inter' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.06)' },
    });

    const now = Math.floor(Date.now() / 1000);
    const series = state.technicalChart.addLineSeries({ color: '#00c853', lineWidth: 2 });
    series.setData(prices.map((p, i) => ({ time: now - (prices.length - i) * 120, value: p })));

    // Add MA20 if enough data
    if (prices.length >= 20) {
      const ma20Series = state.technicalChart.addLineSeries({ color: '#ffd600', lineWidth: 1, lineStyle: 2 });
      const ma20Data = [];
      for (let i = 19; i < prices.length; i++) {
        const slice = prices.slice(i - 19, i + 1);
        const avg = slice.reduce((a, b) => a + b, 0) / 20;
        ma20Data.push({ time: now - (prices.length - i) * 120, value: avg });
      }
      ma20Series.setData(ma20Data);
    }

    new ResizeObserver(() => {
      state.technicalChart?.applyOptions({ width: container.clientWidth });
    }).observe(container);

    state.technicalChart.timeScale().fitContent();
  }

  function renderResearchChart(candles, fundamentals) {
    const card = $('#technicalChartCard');
    const container = $('#technicalChart');
    if (!card || !container) return;
    card.classList.remove('hidden');

    if (state.technicalChart) {
      state.technicalChart.remove();
      state.technicalChart = null;
    }

    state.technicalChart = LightweightCharts.createChart(container, {
      width: container.clientWidth,
      height: 350,
      layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#6b7a8d', fontSize: 11, fontFamily: 'Inter' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.06)', timeVisible: true },
    });

    // Candlestick series
    const candleSeries = state.technicalChart.addCandlestickSeries({
      upColor: '#00c853', downColor: '#ff1744',
      borderUpColor: '#00c853', borderDownColor: '#ff1744',
      wickUpColor: '#00c853', wickDownColor: '#ff1744',
    });
    candleSeries.setData(candles);

    // Volume histogram
    const volSeries = state.technicalChart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    });
    state.technicalChart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });
    volSeries.setData(candles.map(c => ({
      time: c.time,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(0,200,83,0.3)' : 'rgba(255,23,68,0.3)',
    })));

    // MA20 overlay
    if (candles.length >= 20) {
      const ma20Series = state.technicalChart.addLineSeries({ color: '#ffd600', lineWidth: 1, lineStyle: 2 });
      const ma20Data = [];
      for (let i = 19; i < candles.length; i++) {
        const slice = candles.slice(i - 19, i + 1);
        const avg = slice.reduce((a, b) => a + b.close, 0) / 20;
        ma20Data.push({ time: candles[i].time, value: +avg.toFixed(2) });
      }
      ma20Series.setData(ma20Data);
    }

    new ResizeObserver(() => {
      state.technicalChart?.applyOptions({ width: container.clientWidth });
    }).observe(container);

    state.technicalChart.timeScale().fitContent();

    // Update chart card header with fundamentals info if available
    if (fundamentals) {
      const header = card.querySelector('.card-header');
      if (header) {
        let fundsHtml = '<h3>Technical Chart (90-Day OHLCV)</h3>';
        const items = [];
        if (fundamentals.pe) items.push(`P/E: ${fundamentals.pe.toFixed(1)}x`);
        if (fundamentals.pb) items.push(`P/B: ${fundamentals.pb.toFixed(1)}x`);
        if (fundamentals.dividendYield) items.push(`Div: ${(fundamentals.dividendYield * 100).toFixed(2)}%`);
        if (fundamentals.beta) items.push(`Beta: ${fundamentals.beta.toFixed(2)}`);
        if (fundamentals.recommendation) items.push(`Analyst: ${fundamentals.recommendation}`);
        if (items.length) {
          fundsHtml += `<div style="font-size:12px;color:var(--muted);margin-top:4px;">${items.join(' | ')}</div>`;
        }
        header.innerHTML = fundsHtml;
      }
    }
  }

  // ── Financial Planner ──────────────────────────────────────────────────────
  // SERVER expects: { goals, riskTolerance, currentSavings, monthlyContribution, timeHorizon, portfolio }
  // SERVER returns: { plan: object|string, structured: bool }
  $('#generatePlanBtn')?.addEventListener('click', async () => {
    const current = parseFloat($('#plannerCurrent')?.value);
    const target = parseFloat($('#plannerTarget')?.value);
    const horizon = $('#plannerHorizon')?.value;
    const risk = $('#plannerRisk')?.value;
    const monthly = parseFloat($('#plannerMonthly')?.value) || 0;

    if (!current || !target) { alert('Enter current investment and target amount'); return; }

    const btn = $('#generatePlanBtn');
    const result = $('#planResult');
    const body = $('#planResultBody');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    result.classList.remove('hidden');
    body.innerHTML = '<div class="loading-shimmer" style="width:100%;height:200px;"></div>';

    try {
      const data = await apiFetch('/api/financial-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goals: `Grow J$${current.toLocaleString()} to J$${target.toLocaleString()}`,
          riskTolerance: risk,
          currentSavings: current,
          monthlyContribution: monthly,
          timeHorizon: horizon + ' years',
          portfolio: state.portfolio.length ? state.portfolio : undefined,
        }),
      });

      let planText = '';
      if (data.structured && data.plan && typeof data.plan === 'object') {
        body.innerHTML = renderFinancialPlan(data.plan);
        const p = data.plan;
        planText = `${p.planName || 'Investment Plan'}. ${p.summary || ''} Risk level: ${p.riskLevel || 'moderate'}. ${p.monthlyStrategy || ''}`;
      } else if (data.plan) {
        const text = typeof data.plan === 'string' ? data.plan : JSON.stringify(data.plan, null, 2);
        body.innerHTML = `<div style="white-space:pre-wrap;line-height:1.7;font-size:14px;">${formatMarkdown(text)}</div>`;
        planText = text;
      }
      // Wire listen button
      const listenPlanBtn = $('#listenPlanBtn');
      if (listenPlanBtn && planText) {
        listenPlanBtn.onclick = () => speakText(planText, listenPlanBtn);
      }
    } catch (e) {
      body.innerHTML = `<p style="color:var(--red);">Error: ${escHtml(e.message)}</p>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-magic"></i> Generate AI Financial Plan';
    }
  });

  function renderFinancialPlan(plan) {
    let html = `
      <h3 style="font-size:18px;font-weight:700;margin-bottom:4px;">${escHtml(plan.planName || 'Your Investment Plan')}</h3>
      <p style="color:var(--muted);font-size:13px;margin-bottom:16px;">${escHtml(plan.riskLevel)} Strategy</p>
      <p style="font-size:14px;line-height:1.7;margin-bottom:20px;">${escHtml(plan.summary)}</p>`;

    if (plan.projectedReturn) {
      html += `
        <div style="display:flex;gap:16px;margin-bottom:20px;">
          <div style="flex:1;background:var(--glass);border:1px solid var(--border);border-radius:10px;padding:16px;text-align:center;">
            <div style="font-size:11px;color:var(--muted);text-transform:uppercase;">Annual Return</div>
            <div style="font-size:22px;font-weight:800;color:var(--green);margin-top:6px;">${plan.projectedReturn.annual || '--'}</div>
          </div>
          <div style="flex:1;background:var(--glass);border:1px solid var(--border);border-radius:10px;padding:16px;text-align:center;">
            <div style="font-size:11px;color:var(--muted);text-transform:uppercase;">Total Return</div>
            <div style="font-size:22px;font-weight:800;color:var(--gold);margin-top:6px;">${plan.projectedReturn.total || '--'}</div>
          </div>
        </div>`;
    }

    if (plan.allocations?.length) {
      html += `<h4 style="font-size:14px;font-weight:600;margin-bottom:10px;">Recommended Allocations</h4>`;
      html += plan.allocations.map(a => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;">
          <div>
            <span style="font-weight:700;">${escHtml(a.symbol)}</span>
            <span style="color:var(--muted);font-size:12px;margin-left:8px;">${escHtml(a.name)}</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px;">
            <span style="font-weight:700;color:var(--gold);">${escHtml(a.weight)}%</span>
          </div>
        </div>
        <div style="font-size:12px;color:var(--muted);margin:-4px 0 10px 14px;">${escHtml(a.reasoning)}</div>
      `).join('');
    }

    if (plan.actionItems?.length) {
      html += `<h4 style="font-size:14px;font-weight:600;margin:16px 0 10px;">Action Items</h4>`;
      html += plan.actionItems.map((item, i) => `
        <div style="display:flex;gap:10px;padding:8px 0;font-size:13px;">
          <span style="background:var(--green);color:#000;font-weight:700;font-size:11px;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i + 1}</span>
          <span>${escHtml(item)}</span>
        </div>
      `).join('');
    }

    if (plan.monthlyStrategy) {
      html += `<div style="margin-top:16px;background:var(--glass);border:1px solid var(--border);border-radius:10px;padding:16px;"><h4 style="font-size:12px;color:var(--muted);text-transform:uppercase;margin-bottom:6px;">Monthly Strategy</h4><p style="font-size:13px;line-height:1.6;">${escHtml(plan.monthlyStrategy)}</p></div>`;
    }

    return html;
  }

  // ── Portfolio ──────────────────────────────────────────────────────────────
  function renderPortfolio() {
    const holdings = state.portfolio;
    const tbody = $('#holdingsBody');
    const empty = $('#emptyPortfolio');
    if (!tbody) return;

    if (!holdings || !holdings.length) {
      tbody.innerHTML = '';
      if (empty) empty.style.display = 'block';
      $('#portfolioValue').textContent = 'J$0.00';
      $('#portfolioPnl').textContent = '+J$0.00 (0.00%)';
      destroySectorChart();
      return;
    }

    if (empty) empty.style.display = 'none';

    let totalValue = 0, totalCost = 0;

    tbody.innerHTML = holdings.map(h => {
      const live = state.stocks.find(s => s.symbol === h.symbol);
      const currentPrice = live?.price ?? h.buyPrice;
      const value = currentPrice * h.shares;
      const cost = h.buyPrice * h.shares;
      const pnl = value - cost;
      const pnlPct = cost > 0 ? (pnl / cost * 100) : 0;
      totalValue += value;
      totalCost += cost;

      const cls = pnl >= 0 ? 'up' : 'down';
      return `<tr>
        <td class="sym-cell">${h.symbol}</td>
        <td>${fmtInt(h.shares)}</td>
        <td class="price-cell">$${fmt(h.buyPrice)}</td>
        <td class="price-cell">$${fmt(currentPrice)}</td>
        <td class="change-cell ${cls}">${pnl >= 0 ? '+' : ''}$${fmt(Math.abs(pnl))} (${pnlPct.toFixed(1)}%)</td>
        <td>
          <button class="table-action-btn" onclick="window.jseApp.removeFromPortfolio('${h.symbol}')" style="border-color:var(--red);color:var(--red);">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>`;
    }).join('');

    const totalPnl = totalValue - totalCost;
    const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost * 100) : 0;
    $('#portfolioValue').textContent = `J$${fmt(totalValue)}`;
    const pnlEl = $('#portfolioPnl');
    pnlEl.textContent = `${totalPnl >= 0 ? '+' : ''}J$${fmt(Math.abs(totalPnl))} (${totalPnlPct.toFixed(2)}%)`;
    pnlEl.className = `portfolio-pnl ${totalPnl >= 0 ? 'up' : 'down'}`;

    renderSectorChart(holdings);
  }

  function renderSectorChart(holdings) {
    const canvas = $('#sectorChart');
    if (!canvas) return;

    const sectorMap = {};
    holdings.forEach(h => {
      const stock = fullStockData.find(s => s.symbol === h.symbol);
      const sector = stock?.sector || 'Unknown';
      const live = state.stocks.find(s => s.symbol === h.symbol);
      const val = (live?.price ?? h.buyPrice) * h.shares;
      sectorMap[sector] = (sectorMap[sector] || 0) + val;
    });

    const labels = Object.keys(sectorMap);
    const values = Object.values(sectorMap);
    const colors = ['#00c853', '#ffd600', '#00b0ff', '#bb86fc', '#ff1744', '#ff9100', '#00e5ff', '#76ff03', '#f50057', '#651fff'];

    destroySectorChart();
    state.sectorChartInstance = new Chart(canvas, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values, backgroundColor: colors.slice(0, labels.length), borderWidth: 0 }] },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom', labels: { color: '#6b7a8d', padding: 12, font: { size: 11 } } } },
        cutout: '65%',
      },
    });
  }

  function destroySectorChart() {
    if (state.sectorChartInstance) {
      state.sectorChartInstance.destroy();
      state.sectorChartInstance = null;
    }
  }

  // Portfolio modal & actions
  let addPortfolioSymbol = '';

  window.jseApp = {
    addToPortfolioModal(symbol) {
      addPortfolioSymbol = symbol;
      const live = state.stocks.find(s => s.symbol === symbol);
      $('#addPortfolioSymbol').textContent = `Add ${symbol} to your portfolio`;
      $('#addBuyPrice').value = live?.price?.toFixed(2) || '';
      $('#addShares').value = '';
      $('#addPortfolioError').classList.remove('show');
      $('#addPortfolioModal').classList.add('show');
    },
    removeFromPortfolio(symbol) {
      if (!confirm(`Remove ${symbol} from portfolio?`)) return;
      state.portfolio = state.portfolio.filter(h => h.symbol !== symbol);
      savePortfolio();
      renderPortfolio();
    },
    selectStock(symbol) {
      selectStock(symbol);
      navigateTo('dashboard');
    },
  };

  $('#addPortfolioClose')?.addEventListener('click', () => {
    $('#addPortfolioModal').classList.remove('show');
  });

  $('#addPortfolioSubmit')?.addEventListener('click', async () => {
    const shares = parseInt($('#addShares').value);
    const buyPrice = parseFloat($('#addBuyPrice').value);
    if (!shares || shares < 1 || !buyPrice || buyPrice <= 0) {
      showFormError('addPortfolioError', 'Enter valid shares and price');
      return;
    }

    const existing = state.portfolio.find(h => h.symbol === addPortfolioSymbol);
    if (existing) {
      const totalShares = existing.shares + shares;
      existing.buyPrice = (existing.buyPrice * existing.shares + buyPrice * shares) / totalShares;
      existing.shares = totalShares;
    } else {
      state.portfolio.push({ symbol: addPortfolioSymbol, shares, buyPrice });
    }

    savePortfolio();
    renderPortfolio();
    $('#addPortfolioModal').classList.remove('show');
  });

  $('#addStockBtn')?.addEventListener('click', () => {
    addPortfolioSymbol = '';
    $('#addPortfolioSymbol').textContent = 'Add stock to your portfolio';
    const sym = prompt('Enter stock symbol (e.g. NCBFG):');
    if (sym) window.jseApp.addToPortfolioModal(sym.toUpperCase());
  });

  async function savePortfolio() {
    if (state.token) {
      try {
        await apiFetch('/api/user/portfolio', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ portfolio: state.portfolio }),
        });
      } catch (_) {
        localStorage.setItem('jse_portfolio', JSON.stringify(state.portfolio));
      }
    } else {
      localStorage.setItem('jse_portfolio', JSON.stringify(state.portfolio));
    }
  }

  function loadLocalPortfolio() {
    if (!state.token) {
      try { state.portfolio = JSON.parse(localStorage.getItem('jse_portfolio') || '[]'); }
      catch (_) { state.portfolio = []; }
    }
  }

  // ── Auto-Tune AI ──────────────────────────────────────────────────────────
  // SERVER expects: { holdings: [{symbol, qty, avgPrice}], goals, riskTolerance, timeHorizon }
  // SERVER returns: { decisions: [...], summary, ... }
  $('#autoTuneBtn')?.addEventListener('click', async () => {
    if (!state.portfolio.length) { alert('Add stocks to your portfolio first'); return; }

    const btn = $('#autoTuneBtn');
    const results = $('#autoTuneResults');
    const decisions = $('#autoTuneDecisions');
    const summary = $('#autoTuneSummary');

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> AI Analyzing...';
    results.classList.remove('hidden');
    decisions.innerHTML = '<div class="loading-shimmer" style="width:100%;height:60px;margin-bottom:8px;"></div>'.repeat(3);
    summary.innerHTML = '';

    try {
      // Convert portfolio format: {symbol, shares, buyPrice} -> {symbol, qty, avgPrice}
      const holdings = state.portfolio.map(h => ({
        symbol: h.symbol,
        qty: h.shares,
        avgPrice: h.buyPrice,
      }));

      const data = await apiFetch('/api/auto-invest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          holdings,
          goals: 'Maximize returns while managing risk',
          riskTolerance: 'Moderate',
          timeHorizon: '5 years',
        }),
      });

      // Server returns { result: { decisions, marketOutlook, ... }, structured, metrics }
      const aiResult = data.result || data;
      const decisionsList = aiResult.decisions || data.decisions;

      if (decisionsList && Array.isArray(decisionsList)) {
        decisions.innerHTML = decisionsList.map(d => `
          <div class="decision-card">
            <div style="display:flex;align-items:center;gap:12px;">
              <span class="action-badge ${(d.action || '').toLowerCase()}">${d.action || 'HOLD'}</span>
              <div>
                <div style="font-weight:600;">${d.symbol || ''}</div>
                <div style="font-size:12px;color:var(--muted);max-width:400px;">${d.reason || d.reasoning || ''}</div>
              </div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:12px;color:var(--muted);">Confidence</div>
              <div style="font-weight:700;color:var(--gold);">${d.confidence || '--'}%</div>
            </div>
          </div>
        `).join('');
      } else if (typeof decisionsList === 'string') {
        decisions.innerHTML = `<div style="white-space:pre-wrap;line-height:1.6;font-size:13px;">${formatMarkdown(decisionsList)}</div>`;
      }

      const summaryText = aiResult.marketOutlook || aiResult.summary || data.summary;
      if (summaryText) {
        summary.innerHTML = formatMarkdown(typeof summaryText === 'string' ? summaryText : JSON.stringify(summaryText));
      }
      // Wire listen button
      const listenATBtn = $('#listenAutoTuneBtn');
      if (listenATBtn) {
        const decisionsText = (Array.isArray(decisionsList) ? decisionsList.map(d => `${d.action} ${d.symbol}. ${d.reasoning || d.reason || ''}`).join('. ') : '') + (summaryText ? '. ' + summaryText : '');
        listenATBtn.onclick = () => speakText(decisionsText, listenATBtn);
      }
    } catch (e) {
      decisions.innerHTML = `<p style="color:var(--red);">Error: ${escHtml(e.message)}</p>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-magic"></i> AI Auto-Tune';
    }
  });

  // ── Stock Screener ─────────────────────────────────────────────────────────
  $('#screenerBtn')?.addEventListener('click', async () => {
    const sectorVal = $('#screenerSector')?.value;
    const params = {
      sectors: sectorVal ? [sectorVal] : undefined,
      minPE: parseFloat($('#screenerMinPE')?.value) || undefined,
      maxPE: parseFloat($('#screenerMaxPE')?.value) || undefined,
      minDiv: parseFloat($('#screenerMinDiv')?.value) || undefined,
      minChange: parseFloat($('#screenerMinChange')?.value) || undefined,
    };
    Object.keys(params).forEach(k => params[k] === undefined && delete params[k]);

    const btn = $('#screenerBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Screening...';

    try {
      const data = await apiFetch('/api/screener', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const tbody = $('#screenerBody');
      if (!data.results?.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted" style="padding:30px;">No stocks match your criteria</td></tr>';
        return;
      }

      tbody.innerHTML = data.results.map(s => {
        const change = s.change ?? s.liveChange ?? 0;
        const cls = change >= 0 ? 'up' : 'down';
        return `<tr data-symbol="${s.symbol}" style="cursor:pointer;" onclick="window.jseApp.selectStock('${s.symbol}')">
          <td class="sym-cell">${s.symbol}</td>
          <td>${s.name || s.symbol}</td>
          <td class="price-cell">$${fmt(s.price || s.livePrice)}</td>
          <td class="change-cell ${cls}">${change >= 0 ? '+' : ''}${change.toFixed(2)}%</td>
          <td>${s.pe || '--'}</td>
          <td>${s.divYield ? s.divYield + '%' : '--'}</td>
          <td>${s.sector || '--'}</td>
          <td class="vol-cell">${fmtInt(s.volume)}</td>
        </tr>`;
      }).join('');
    } catch (e) {
      $('#screenerBody').innerHTML = `<tr><td colspan="8" style="color:var(--red);padding:20px;">${e.message}</td></tr>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-search"></i> Screen';
    }
  });

  // ── News ───────────────────────────────────────────────────────────────────
  async function loadNews() {
    const grid = $('#newsGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="text-center text-muted" style="padding:40px;grid-column:1/-1;"><i class="fas fa-spinner fa-spin" style="font-size:24px;margin-bottom:8px;display:block;"></i>Loading news...</div>';

    try {
      const data = await apiFetch('/api/news');
      if (!data || !data.length) { grid.innerHTML = '<p class="text-muted text-center" style="grid-column:1/-1;padding:40px;">No news available</p>'; return; }

      // Sanitize helper for scraped external data
      const esc = (s) => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
      const safeUrl = (u) => { try { const url = new URL(u); return ['http:','https:'].includes(url.protocol) ? url.href : '#'; } catch { return '#'; } };

      grid.innerHTML = data.map(n => {
        const sentCls = n.sentiment === 'positive' ? 'positive' : n.sentiment === 'negative' ? 'negative' : 'neutral';
        const sentIcon = n.sentiment === 'positive' ? '📈' : n.sentiment === 'negative' ? '📉' : '📊';
        const safeSymbol = esc(n.symbol || '').replace(/[^A-Z0-9]/gi, '');
        return `<div class="news-card">
          <span class="news-sentiment ${sentCls}">${sentIcon} ${esc(n.sentiment) || 'neutral'}</span>
          <h4>${n.url ? `<a href="${safeUrl(n.url)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none;">${formatMarkdown(n.title || n.headline || '')}</a>` : formatMarkdown(n.title || n.headline || '')}</h4>
          <p>${esc(n.summary || n.sector || '')}</p>
          <div class="news-meta">
            ${n.source ? `<span><i class="fas fa-newspaper"></i> ${esc(n.source)}</span>` : ''}
            ${n.time || n.date ? `<span><i class="fas fa-clock"></i> ${esc(n.time || n.date)}</span>` : ''}
            ${safeSymbol ? `<span style="color:var(--green);cursor:pointer;" onclick="window.jseApp?.selectStock('${safeSymbol}')">${safeSymbol}</span>` : ''}
            ${n.url ? `<a href="${safeUrl(n.url)}" target="_blank" rel="noopener" style="color:var(--blue);font-size:11px;"><i class="fas fa-external-link-alt"></i> Read</a>` : ''}
          </div>
        </div>`;
      }).join('');
    } catch (e) {
      grid.innerHTML = `<p style="color:var(--red);grid-column:1/-1;padding:40px;">Error loading news: ${e.message}</p>`;
    }
  }

  $('#refreshNewsBtn')?.addEventListener('click', loadNews);

  // ── Sectors ────────────────────────────────────────────────────────────────
  async function loadSectors() {
    const grid = $('#sectorsGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="text-center text-muted" style="padding:40px;grid-column:1/-1;"><i class="fas fa-spinner fa-spin" style="font-size:24px;margin-bottom:8px;display:block;"></i>Loading sectors...</div>';

    try {
      const data = await apiFetch('/api/sectors');
      const sectors = Array.isArray(data) ? data : Object.entries(data).map(([name, info]) => ({ name, ...info }));
      if (!sectors.length) {
        grid.innerHTML = '<p class="text-muted text-center" style="grid-column:1/-1;padding:40px;">No sector data</p>';
        return;
      }

      sectors.sort((a, b) => (b.avgChange || 0) - (a.avgChange || 0));

      grid.innerHTML = sectors.map(s => {
        const change = s.avgChange || 0;
        const cls = change >= 0 ? 'up' : 'down';
        const stockList = (s.stocks || []).map(x => x.symbol || x).join(', ');
        const icon = change >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
        return `<div class="sector-card">
          <div style="display:flex;justify-content:space-between;align-items:start;">
            <h4>${s.name}</h4>
            <i class="fas ${icon}" style="color:${change >= 0 ? 'var(--green)' : 'var(--red)'};"></i>
          </div>
          <div class="sector-change ${cls}">${change >= 0 ? '+' : ''}${change.toFixed(2)}%</div>
          <div class="sector-stocks">${s.stockCount || s.count || ''} stocks: ${stockList}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:6px;">${s.performance || ''}</div>
        </div>`;
      }).join('');
    } catch (e) {
      grid.innerHTML = `<p style="color:var(--red);grid-column:1/-1;padding:40px;">${e.message}</p>`;
    }
  }

  $('#refreshSectorsBtn')?.addEventListener('click', loadSectors);

  // ── Compare ────────────────────────────────────────────────────────────────
  $('#compareBtn')?.addEventListener('click', async () => {
    const symbols = [
      ($('#compareInput1')?.value || '').trim().toUpperCase(),
      ($('#compareInput2')?.value || '').trim().toUpperCase(),
      ($('#compareInput3')?.value || '').trim().toUpperCase(),
    ].filter(Boolean);

    if (symbols.length < 2) { alert('Enter at least 2 symbols to compare'); return; }

    const btn = $('#compareBtn');
    const results = $('#compareResults');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Comparing...';
    results.innerHTML = '<div class="loading-shimmer" style="width:100%;height:200px;grid-column:1/-1;"></div>';

    try {
      const data = await apiFetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols }),
      });

      if (data.comparison && Array.isArray(data.comparison)) {
        results.innerHTML = data.comparison.map(s => {
          const change = s.change || s.liveChange || 0;
          const chgCls = change >= 0 ? 'text-green' : 'text-red';
          return `<div class="compare-card">
            <h4>${s.symbol} <span style="font-size:12px;color:var(--muted);font-weight:400;">${s.name || ''}</span></h4>
            <div class="compare-row"><span class="label">Price</span><span class="value">$${fmt(s.price || s.livePrice)}</span></div>
            <div class="compare-row"><span class="label">Change</span><span class="value ${chgCls}">${change >= 0 ? '+' : ''}${change.toFixed(2)}%</span></div>
            <div class="compare-row"><span class="label">Volume</span><span class="value">${fmtInt(s.volume)}</span></div>
            <div class="compare-row"><span class="label">P/E Ratio</span><span class="value">${s.pe || '--'}</span></div>
            <div class="compare-row"><span class="label">Div Yield</span><span class="value">${s.divYield ? s.divYield + '%' : '--'}</span></div>
            <div class="compare-row"><span class="label">Sector</span><span class="value">${s.sector || '--'}</span></div>
            <div class="compare-row"><span class="label">Market Cap</span><span class="value">${s.marketCap || '--'}</span></div>
            ${s.rsi ? `<div class="compare-row"><span class="label">RSI (14)</span><span class="value">${s.rsi}</span></div>` : ''}
            ${s.high30 ? `<div class="compare-row"><span class="label">30D High</span><span class="value">$${fmt(s.high30)}</span></div>` : ''}
            ${s.low30 ? `<div class="compare-row"><span class="label">30D Low</span><span class="value">$${fmt(s.low30)}</span></div>` : ''}
          </div>`;
        }).join('');
      } else {
        results.innerHTML = '<p class="text-muted" style="grid-column:1/-1;">No comparison data returned</p>';
      }
    } catch (e) {
      results.innerHTML = `<p style="color:var(--red);grid-column:1/-1;">${e.message}</p>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-balance-scale"></i> Compare';
    }
  });

  // ── Voice Input → AI Research → ElevenLabs Voice Response ─────────────────
  const voiceMic = $('#voiceMic');
  let recognition = null;
  let isVoiceProcessing = false;
  let currentAudio = null;

  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = async (e) => {
      const text = e.results[0][0].transcript;
      if (!text.trim()) return;

      // Show what was heard
      setVoiceMicState('processing');
      showVoiceToast(`🎤 "${text}"`, 'heard');

      try {
        isVoiceProcessing = true;
        showVoiceToast('🤔 Researching...', 'thinking');

        // Call the voice-chat endpoint which does AI + TTS
        const response = await fetch(API + '/api/voice-chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
          },
          body: JSON.stringify({ text, context: `Current view: ${state.currentView}` }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: 'Voice chat failed' }));
          throw new Error(err.error || 'Voice chat failed');
        }

        const data = await response.json();

        // Show the text response in a toast
        showVoiceToast(`💬 ${data.reply.slice(0, 120)}...`, 'reply');

        // Also add to chat history if on chat view
        if (state.currentView === 'chat') {
          addChatMessage('user', text);
          addChatMessage('assistant', data.reply);
          state.chatHistory.push({ role: 'user', content: text });
          state.chatHistory.push({ role: 'assistant', content: data.reply });
        }

        // Play audio response
        if (data.audio && data.audioData) {
          // ElevenLabs audio available
          showVoiceToast('🔊 Speaking...', 'speaking');
          const audioBlob = new Blob(
            [Uint8Array.from(atob(data.audioData), c => c.charCodeAt(0))],
            { type: 'audio/mpeg' }
          );
          const audioUrl = URL.createObjectURL(audioBlob);
          if (currentAudio) { currentAudio.pause(); currentAudio = null; }
          currentAudio = new Audio(audioUrl);
          currentAudio.onended = () => {
            setVoiceMicState('idle');
            URL.revokeObjectURL(audioUrl);
            currentAudio = null;
            hideVoiceToast();
          };
          currentAudio.onerror = () => {
            // Fallback to browser TTS
            speakWithBrowserTTS(data.reply);
            URL.revokeObjectURL(audioUrl);
          };
          currentAudio.play().catch(() => speakWithBrowserTTS(data.reply));
        } else {
          // Fallback to browser TTS
          speakWithBrowserTTS(data.reply);
        }
      } catch (err) {
        console.error('Voice chat error:', err);
        showVoiceToast(`❌ ${err.message}`, 'error');
        setVoiceMicState('idle');
      } finally {
        isVoiceProcessing = false;
      }
    };

    recognition.onerror = (e) => {
      console.warn('Speech recognition error:', e.error);
      if (e.error !== 'no-speech') {
        showVoiceToast(`❌ Mic error: ${e.error}`, 'error');
      }
      setVoiceMicState('idle');
    };

    recognition.onend = () => {
      if (!isVoiceProcessing) setVoiceMicState('idle');
    };
  }

  function setVoiceMicState(micState) {
    if (!voiceMic) return;
    switch (micState) {
      case 'listening':
        voiceMic.style.background = 'linear-gradient(135deg, var(--red), #d50000)';
        voiceMic.style.animation = 'pulse 1s infinite';
        voiceMic.innerHTML = '<i class="fas fa-microphone-alt"></i>';
        break;
      case 'processing':
        voiceMic.style.background = 'linear-gradient(135deg, var(--gold), #ffab00)';
        voiceMic.style.animation = 'pulse 0.5s infinite';
        voiceMic.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        break;
      case 'speaking':
        voiceMic.style.background = 'linear-gradient(135deg, var(--blue), #0091ea)';
        voiceMic.style.animation = 'pulse 1.5s infinite';
        voiceMic.innerHTML = '<i class="fas fa-volume-up"></i>';
        break;
      default:
        voiceMic.style.background = 'linear-gradient(135deg, var(--green), var(--green2))';
        voiceMic.style.animation = 'none';
        voiceMic.innerHTML = '<i class="fas fa-microphone"></i>';
    }
  }

  function showVoiceToast(message, type) {
    let toast = $('#voiceToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'voiceToast';
      toast.style.cssText = `
        position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
        background: var(--bg3); border: 1px solid var(--border2); border-radius: 12px;
        padding: 12px 20px; color: var(--text); font-size: 14px; z-index: 10000;
        max-width: 400px; text-align: center; backdrop-filter: blur(20px);
        box-shadow: 0 8px 32px rgba(0,0,0,0.4); transition: all 0.3s ease;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.display = 'block';

    if (type === 'error') {
      toast.style.borderColor = 'var(--red)';
      setTimeout(hideVoiceToast, 4000);
    } else if (type === 'reply') {
      toast.style.borderColor = 'var(--green)';
      setTimeout(hideVoiceToast, 8000);
    } else {
      toast.style.borderColor = 'var(--border2)';
    }
  }

  function hideVoiceToast() {
    const toast = $('#voiceToast');
    if (toast) { toast.style.opacity = '0'; setTimeout(() => { if (toast) toast.style.display = 'none'; }, 300); }
  }

  function speakWithBrowserTTS(text) {
    if ('speechSynthesis' in window) {
      setVoiceMicState('speaking');
      showVoiceToast('🔊 Speaking...', 'speaking');
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.onend = () => { setVoiceMicState('idle'); hideVoiceToast(); };
      utterance.onerror = () => { setVoiceMicState('idle'); hideVoiceToast(); };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } else {
      setVoiceMicState('idle');
      hideVoiceToast();
    }
  }

  voiceMic?.addEventListener('click', () => {
    // Stop any current audio
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    window.speechSynthesis?.cancel();

    if (isVoiceProcessing) {
      isVoiceProcessing = false;
      setVoiceMicState('idle');
      hideVoiceToast();
      return;
    }

    if (!recognition) {
      alert('Speech recognition not supported in this browser. Try Chrome or Edge.');
      return;
    }

    setVoiceMicState('listening');
    showVoiceToast('🎤 Listening... speak now', 'listening');
    try {
      recognition.start();
    } catch (e) {
      // Already started
      recognition.stop();
      setTimeout(() => { try { recognition.start(); } catch(_) {} }, 100);
    }
  });

  // ── Universal TTS (Listen) Button ──────────────────────────────────────────
  let ttsAudio = null;
  let ttsPlaying = false;

  async function speakText(text, btn) {
    // Stop any current TTS
    if (ttsAudio) { ttsAudio.pause(); ttsAudio = null; }
    window.speechSynthesis?.cancel();

    if (ttsPlaying && btn) {
      ttsPlaying = false;
      if (btn) { btn.innerHTML = '<i class="fas fa-volume-up"></i> Listen'; btn.style.borderColor = ''; }
      return;
    }

    // Truncate to ~800 chars for TTS (keep it reasonable)
    const cleanText = text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 800);
    if (!cleanText) return;

    if (btn) { btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Speaking...'; btn.style.borderColor = 'var(--blue)'; }
    ttsPlaying = true;

    // Try ElevenLabs first via /api/speak
    try {
      const res = await fetch(API + '/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        ttsAudio = new Audio(url);
        ttsAudio.onended = () => {
          ttsPlaying = false;
          URL.revokeObjectURL(url);
          ttsAudio = null;
          if (btn) { btn.innerHTML = '<i class="fas fa-volume-up"></i> Listen'; btn.style.borderColor = ''; }
        };
        ttsAudio.onerror = () => fallbackBrowserTTS(cleanText, btn);
        await ttsAudio.play();
        return;
      }
    } catch (_) {}

    // Fallback to browser TTS
    fallbackBrowserTTS(cleanText, btn);
  }

  function fallbackBrowserTTS(text, btn) {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.onend = () => {
        ttsPlaying = false;
        if (btn) { btn.innerHTML = '<i class="fas fa-volume-up"></i> Listen'; btn.style.borderColor = ''; }
      };
      utterance.onerror = utterance.onend;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } else {
      ttsPlaying = false;
      if (btn) { btn.innerHTML = '<i class="fas fa-volume-up"></i> Listen'; btn.style.borderColor = ''; }
    }
  }

  // ── Chat Listen Buttons ──────────────────────────────────────────────────
  // After each assistant message, add a listen button
  const origAddChatMessage = addChatMessage;
  // We'll monkey-patch addChatMessage to add listen buttons to assistant messages
  // (already defined above, so we modify the rendered output)

  // Add listen icon to each chat assistant message after it's rendered
  function addChatListenBtn(msgDiv, text) {
    if (!msgDiv) return;
    const listenBtn = document.createElement('button');
    listenBtn.className = 'chat-listen-btn';
    listenBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
    listenBtn.title = 'Listen to this message';
    listenBtn.style.cssText = 'background:none;border:1px solid var(--border);color:var(--muted);font-size:11px;padding:4px 8px;border-radius:6px;cursor:pointer;margin-top:6px;transition:all 0.2s;';
    listenBtn.addEventListener('click', () => speakText(text, null));
    listenBtn.addEventListener('mouseenter', () => { listenBtn.style.color = 'var(--green)'; listenBtn.style.borderColor = 'var(--green)'; });
    listenBtn.addEventListener('mouseleave', () => { listenBtn.style.color = 'var(--muted)'; listenBtn.style.borderColor = 'var(--border)'; });
    msgDiv.appendChild(listenBtn);
  }

  // ── Stock Detail Modal ──────────────────────────────────────────────────
  let detailChart = null;

  function openStockDetail(symbol) {
    const stock = fullStockData.find(s => s.symbol === symbol);
    const live = state.stocks.find(s => s.symbol === symbol);
    if (!stock && !live) return;

    const s = { ...stock, ...(live || {}) };
    const modal = $('#stockDetailModal');
    modal.style.display = 'flex';

    $('#detailSymbol').textContent = s.symbol;
    $('#detailName').textContent = s.name || s.symbol;
    $('#detailPrice').textContent = `$${fmt(s.price)}`;
    const chg = s.change || 0;
    const chgEl = $('#detailChange');
    chgEl.textContent = `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%`;
    chgEl.style.color = chg >= 0 ? 'var(--green)' : 'var(--red)';
    $('#detailVolume').textContent = fmtInt(s.volume);
    $('#detailSector').textContent = s.sector || '--';
    $('#detailMktCap').textContent = s.marketCap || '--';

    // Fundamentals grid
    const fundEl = $('#detailFundamentals');
    const fundItems = [
      { label: 'P/E Ratio', value: s.pe || '--' },
      { label: 'Div Yield', value: s.divYield ? s.divYield + '%' : '--' },
      { label: '52W High', value: s.high52 ? '$' + fmt(s.high52) : '--' },
      { label: '52W Low', value: s.low52 ? '$' + fmt(s.low52) : '--' },
      { label: 'Bid', value: s.bid ? '$' + fmt(s.bid) : '--' },
      { label: 'Ask', value: s.ask ? '$' + fmt(s.ask) : '--' },
    ];
    fundEl.innerHTML = fundItems.map(f => `
      <div style="background:var(--glass);border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center;">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;">${f.label}</div>
        <div style="font-weight:700;margin-top:4px;font-size:14px;">${f.value}</div>
      </div>
    `).join('');

    // Load chart
    const chartWrap = $('#detailChartWrap');
    if (detailChart) { detailChart.remove(); detailChart = null; }
    detailChart = LightweightCharts.createChart(chartWrap, {
      width: chartWrap.clientWidth,
      height: 260,
      layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#6b7a8d', fontSize: 11, fontFamily: 'Inter' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.06)' },
    });

    // Try to load Yahoo research data (candlestick chart)
    loadDetailChart(symbol);

    // Wire buttons
    $('#detailAnalyzeBtn').onclick = () => {
      modal.style.display = 'none';
      $('#analysisSymbol').value = symbol;
      navigateTo('analysis');
      setTimeout(() => $('#analyzeBtn')?.click(), 200);
    };
    $('#detailAddPortfolioBtn').onclick = () => {
      modal.style.display = 'none';
      window.jseApp.addToPortfolioModal(symbol);
    };
    $('#detailListenBtn').onclick = () => {
      const summary = `${s.name || s.symbol}. Price: $${fmt(s.price)} Jamaican dollars. Change: ${chg >= 0 ? 'up' : 'down'} ${Math.abs(chg).toFixed(2)} percent. Volume: ${fmtInt(s.volume)} shares. Sector: ${s.sector || 'unknown'}. Market Cap: ${s.marketCap || 'unknown'}.`;
      speakText(summary, $('#detailListenBtn'));
    };
  }

  async function loadDetailChart(symbol) {
    if (!detailChart) return;
    // Try Yahoo research data first (candlestick)
    try {
      const res = await apiFetch(`/api/research/${symbol}`);
      if (res.candles && res.candles.length > 1) {
        const candleSeries = detailChart.addCandlestickSeries({
          upColor: '#00c853', downColor: '#ff1744',
          borderUpColor: '#00c853', borderDownColor: '#ff1744',
          wickUpColor: '#00c853', wickDownColor: '#ff1744',
        });
        candleSeries.setData(res.candles);
        detailChart.timeScale().fitContent();
        return;
      }
    } catch (_) {}

    // Fallback to price history (line chart)
    try {
      const res = await apiFetch(`/api/history/${symbol}`);
      const hist = res.history || res;
      if (hist && hist.length > 1) {
        const lineSeries = detailChart.addAreaSeries({
          topColor: 'rgba(0,200,83,0.3)', bottomColor: 'rgba(0,200,83,0.02)',
          lineColor: '#00c853', lineWidth: 2,
        });
        const now = Math.floor(Date.now() / 1000);
        lineSeries.setData(hist.map((p, i) => ({ time: now - (hist.length - i) * 120, value: p })));
        detailChart.timeScale().fitContent();
      }
    } catch (_) {}
  }

  $('#stockDetailClose')?.addEventListener('click', () => {
    $('#stockDetailModal').style.display = 'none';
  });
  $('#stockDetailModal')?.addEventListener('click', (e) => {
    if (e.target === $('#stockDetailModal')) $('#stockDetailModal').style.display = 'none';
  });

  // Override selectStock to open the detail modal
  function selectStock(symbol) {
    state.selectedSymbol = symbol;
    loadChartData();
    updateChartPrice();
    const analysisInput = $('#analysisSymbol');
    if (analysisInput) analysisInput.value = symbol;
    openStockDetail(symbol);
  }

  // ── Notifications ────────────────────────────────────────────────────────
  let notifications = [];
  let lastNotifStocks = {};

  function generateNotifications() {
    const newNotifs = [];
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    state.stocks.forEach(s => {
      const prev = lastNotifStocks[s.symbol];
      // Big mover alerts (>5% change)
      if (Math.abs(s.change) >= 5 && (!prev || prev.change !== s.change)) {
        newNotifs.push({
          id: Date.now() + Math.random(),
          type: s.change > 0 ? 'gain' : 'loss',
          icon: s.change > 0 ? 'fa-arrow-up' : 'fa-arrow-down',
          color: s.change > 0 ? 'var(--green)' : 'var(--red)',
          title: `${s.symbol} ${s.change > 0 ? 'surges' : 'drops'} ${Math.abs(s.change).toFixed(2)}%`,
          detail: `Now trading at $${fmt(s.price)}`,
          time: timeStr,
          symbol: s.symbol,
        });
      }
      lastNotifStocks[s.symbol] = { ...s };
    });

    if (newNotifs.length > 0) {
      notifications = [...newNotifs, ...notifications].slice(0, 50);
      renderNotifications();
      updateNotifDot();
    }
  }

  function renderNotifications() {
    const list = $('#notifList');
    if (!list) return;
    if (!notifications.length) {
      list.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted);font-size:13px;">No notifications yet. Big market moves will appear here.</div>';
      return;
    }
    list.innerHTML = notifications.slice(0, 20).map(n => `
      <div class="notif-item" style="padding:10px 12px;border-bottom:1px solid var(--border);cursor:pointer;transition:background 0.2s;" data-symbol="${n.symbol || ''}"
        onmouseenter="this.style.background='var(--glass)'" onmouseleave="this.style.background='transparent'">
        <div style="display:flex;align-items:center;gap:10px;">
          <i class="fas ${n.icon}" style="color:${n.color};font-size:14px;width:20px;text-align:center;"></i>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:600;">${escHtml(n.title)}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px;">${escHtml(n.detail)}</div>
          </div>
          <div style="font-size:10px;color:var(--muted);white-space:nowrap;">${escHtml(n.time)}</div>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.notif-item[data-symbol]').forEach(item => {
      item.addEventListener('click', () => {
        const sym = item.dataset.symbol;
        if (sym) { openStockDetail(sym); $('#notifPanel').style.display = 'none'; }
      });
    });
  }

  function updateNotifDot() {
    const dot = $('#notifBtn .notif-dot');
    if (dot) dot.style.display = notifications.length > 0 ? 'block' : 'none';
  }

  $('#notifBtn')?.addEventListener('click', () => {
    const panel = $('#notifPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });

  $('#clearNotifsBtn')?.addEventListener('click', () => {
    notifications = [];
    renderNotifications();
    updateNotifDot();
  });

  // Close notif panel when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#notifPanel') && !e.target.closest('#notifBtn')) {
      const panel = $('#notifPanel');
      if (panel) panel.style.display = 'none';
    }
  });

  // ── Boot ───────────────────────────────────────────────────────────────────
  async function boot() {
    initParticles();
    initChart();
    loadLocalPortfolio();
    connectSSE();
    await loadFullStocks();

    if (state.token) {
      await loadUserData();
    } else {
      updateUserArea();
    }

    renderPortfolio();

    // Pre-load news for badge
    try {
      const news = await apiFetch('/api/news');
      const badge = $('#newsBadge');
      if (badge) badge.textContent = news.length || '0';
    } catch (_) {}
  }

  // ── Toast utility ──────────────────────────────────────────────────────
  function showToast(msg, type) {
    let toast = document.getElementById('appToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'appToast';
      toast.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;z-index:99999;transition:all 0.3s;pointer-events:none;font-family:inherit;`;
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.background = type === 'error' ? 'var(--red)' : type === 'success' ? 'var(--green)' : 'var(--blue)';
    toast.style.color = type === 'error' ? '#fff' : '#000';
    toast.style.opacity = '1';
    toast.style.display = 'block';
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => { toast.style.display = 'none'; }, 300); }, 3000);
  }
  window.showToast = showToast;

  // ══════════════════════════════════════════════════════════════════════════
  // ── TRADING SYSTEM — Order Placement, Wallet, Transaction History ────────
  // ══════════════════════════════════════════════════════════════════════════

  let orderSide = 'BUY';
  let orderSymbol = '';
  let orderPrice = 0;

  function openOrderModal(symbol, side = 'BUY') {
    const stock = fullStockData.find(s => s.symbol === symbol) ||
                  state.stocks.find(s => s.symbol === symbol);
    if (!stock) return;

    orderSymbol = symbol;
    orderSide = side;
    orderPrice = stock.price || stock.livePrice || 0;

    const modal = $('#orderModal');
    if (!modal) return;
    modal.style.display = 'flex';

    $('#orderSymbol').textContent = symbol;
    $('#orderStockName').textContent = stock.name || '';
    $('#orderCurrentPrice').textContent = `$${fmt(orderPrice)} JMD`;
    $('#orderQuantity').value = '';
    $('#orderLimitPrice').value = '';
    $('#orderStopPrice').value = '';
    $('#orderEstTotal').textContent = '$0.00';
    $('#orderFee').textContent = '$0.00';

    setOrderSide(side);
    updateOrderTypeFields();
    loadWalletBalance();
  }

  function setOrderSide(side) {
    orderSide = side;
    const buyBtn = $('#orderBuyToggle');
    const sellBtn = $('#orderSellToggle');
    if (side === 'BUY') {
      buyBtn.style.background = 'var(--green)';
      buyBtn.style.color = '#000';
      sellBtn.style.background = 'transparent';
      sellBtn.style.color = 'var(--red)';
    } else {
      sellBtn.style.background = 'var(--red)';
      sellBtn.style.color = '#fff';
      buyBtn.style.background = 'transparent';
      buyBtn.style.color = 'var(--green)';
    }
  }

  function updateOrderTypeFields() {
    const type = $('#orderTypeSelect')?.value || 'MARKET';
    const limitWrap = $('#orderLimitPriceWrap');
    const stopWrap = $('#orderStopPriceWrap');
    if (limitWrap) limitWrap.style.display = (type === 'LIMIT' || type === 'STOP_LIMIT') ? 'block' : 'none';
    if (stopWrap) stopWrap.style.display = (type === 'STOP' || type === 'STOP_LIMIT') ? 'block' : 'none';
  }

  function updateOrderEstimate() {
    const qty = parseFloat($('#orderQuantity')?.value) || 0;
    const type = $('#orderTypeSelect')?.value || 'MARKET';
    const price = (type === 'LIMIT' || type === 'STOP_LIMIT')
      ? (parseFloat($('#orderLimitPrice')?.value) || orderPrice)
      : orderPrice;
    const total = qty * price;
    const fee = total * 0.005;
    $('#orderEstTotal').textContent = `$${fmt(total)} JMD`;
    $('#orderFee').textContent = `$${fmt(fee)} JMD`;
  }

  async function loadWalletBalance() {
    try {
      const data = await apiFetch('/api/wallet/balance');
      if (data.wallets) {
        const jmd = data.wallets.find(w => w.currency === 'JMD');
        if (jmd) {
          $('#orderAvailBalance').textContent = `$${fmt(jmd.available)} JMD`;
          const headerBal = $('#headerWalletBalance');
          if (headerBal) headerBal.textContent = `J$${fmtInt(Math.floor(jmd.balance))}`;
          const walletDisp = $('#walletDisplay');
          if (walletDisp) walletDisp.style.display = '';
        }
      }
    } catch (_) {}
  }

  async function placeOrder() {
    const qty = parseInt($('#orderQuantity')?.value);
    if (!qty || qty <= 0) return showToast('Enter a valid quantity', 'error');

    const type = $('#orderTypeSelect')?.value || 'MARKET';
    const body = {
      symbol: orderSymbol,
      side: orderSide,
      orderType: type,
      quantity: qty,
      isPaper: true,
    };
    if (type === 'LIMIT' || type === 'STOP_LIMIT') {
      body.limitPrice = parseFloat($('#orderLimitPrice')?.value);
      if (!body.limitPrice) return showToast('Enter a limit price', 'error');
    }
    if (type === 'STOP' || type === 'STOP_LIMIT') {
      body.stopPrice = parseFloat($('#orderStopPrice')?.value);
      if (!body.stopPrice) return showToast('Enter a stop price', 'error');
    }

    const btn = $('#orderSubmitBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Placing...';

    try {
      const data = await apiFetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      showToast(data.message || 'Order placed!', 'success');
      $('#orderModal').style.display = 'none';
      loadWalletBalance();
      if (state.currentView === 'transactions') loadTransactionsView();
    } catch (e) {
      showToast(e.message || 'Order failed', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-check-circle"></i> Place Order';
    }
  }

  async function loadTransactionsView() {
    try {
      const [walletData, ordersData, histData] = await Promise.all([
        apiFetch('/api/wallet/balance'),
        apiFetch('/api/orders'),
        apiFetch('/api/portfolio/history'),
      ]);

      // Wallet
      if (walletData.wallets) {
        const jmd = walletData.wallets.find(w => w.currency === 'JMD');
        const usd = walletData.wallets.find(w => w.currency === 'USD');
        if (jmd) {
          $('#txWalletJMD').textContent = `J$${fmt(jmd.balance)}`;
          $('#txWalletJMDHeld').textContent = `Held: $${fmt(jmd.held)}`;
        }
        if (usd) {
          $('#txWalletUSD').textContent = `$${fmt(usd.balance)}`;
          $('#txWalletUSDHeld').textContent = `Held: $${fmt(usd.held)}`;
        }
      }

      // Open orders
      const openOrders = (ordersData.orders || []).filter(o => o.status === 'PENDING' || o.status === 'OPEN');
      $('#txOpenOrders').textContent = openOrders.length;

      const openList = $('#openOrdersList');
      if (openOrders.length === 0) {
        openList.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:20px;text-align:center;">No open orders</p>';
      } else {
        openList.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="border-bottom:1px solid var(--border);color:var(--muted);text-align:left;">
            <th style="padding:8px;">Symbol</th><th>Side</th><th>Type</th><th>Qty</th><th>Price</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>${openOrders.map(o => `<tr style="border-bottom:1px solid var(--border);">
            <td style="padding:8px;font-weight:700;">${escHtml(o.symbol)}</td>
            <td style="color:${o.side === 'BUY' ? 'var(--green)' : 'var(--red)'};font-weight:600;">${o.side}</td>
            <td>${o.orderType}</td>
            <td>${o.quantity}</td>
            <td>${o.limitPrice ? '$' + fmt(o.limitPrice) : 'Market'}</td>
            <td><span style="background:rgba(255,214,0,0.15);color:var(--gold);padding:2px 8px;border-radius:4px;font-size:11px;">${o.status}</span></td>
            <td><button onclick="cancelOrder('${o.id}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:12px;">Cancel</button></td>
          </tr>`).join('')}</tbody></table>`;
      }

      // Transaction history
      const txs = histData.transactions || [];
      const txList = $('#txHistoryList');
      if (txs.length === 0) {
        txList.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:40px 20px;text-align:center;"><i class="fas fa-receipt" style="font-size:32px;display:block;margin-bottom:12px;opacity:0.3;"></i>No transactions yet. Place your first trade!</p>';
      } else {
        txList.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="border-bottom:1px solid var(--border);color:var(--muted);text-align:left;">
            <th style="padding:8px;">Date</th><th>Type</th><th>Symbol</th><th>Shares</th><th>Price</th><th>Total</th><th>Fee</th>
          </tr></thead>
          <tbody>${txs.map(t => {
            const typeColor = t.type === 'BUY' ? 'var(--green)' : t.type === 'SELL' ? 'var(--red)' : 'var(--blue)';
            return `<tr style="border-bottom:1px solid var(--border);">
              <td style="padding:8px;font-family:'JetBrains Mono',monospace;font-size:11px;">${new Date(t.createdAt).toLocaleString()}</td>
              <td style="color:${typeColor};font-weight:600;">${t.type}</td>
              <td style="font-weight:700;">${t.symbol || '—'}</td>
              <td>${t.shares || '—'}</td>
              <td>${t.price ? '$' + fmt(t.price) : '—'}</td>
              <td style="font-weight:600;">$${fmt(t.totalAmount)}</td>
              <td style="color:var(--muted);">$${fmt(t.feeAmount)}</td>
            </tr>`;
          }).join('')}</tbody></table>`;
      }
    } catch (e) {
      console.error('Failed to load transactions:', e);
    }
  }

  window.cancelOrder = async function(orderId) {
    try {
      await apiFetch(`/api/orders/${orderId}`, { method: 'DELETE' });
      showToast('Order cancelled', 'success');
      loadTransactionsView();
      loadWalletBalance();
    } catch (e) {
      showToast(e.message || 'Cancel failed', 'error');
    }
  };

  // ── Onboarding ──────────────────────────────────────────────────────────

  function showOnboarding() {
    const modal = $('#onboardingModal');
    if (modal) modal.style.display = 'flex';
  }

  function setupOnboarding() {
    // Path buttons
    $$('.onboard-path-btn').forEach(btn => {
      btn.onclick = () => {
        const level = btn.dataset.level;
        state.analysisLevel = level === 'beginner' ? 'Beginner' : level === 'advanced' ? 'Advanced' : 'Intermediate';
        $('#onboardStep1').style.display = 'none';
        $('#onboardStep2').style.display = '';
        $$('.onboard-dot').forEach(d => d.style.background = d.dataset.step === '2' ? 'var(--green)' : 'var(--border)');
      };
    });

    // Risk next
    const riskNext = $('#onboardRiskNext');
    if (riskNext) riskNext.onclick = () => {
      // Calculate risk score from answers
      let score = 0;
      for (let i = 1; i <= 3; i++) {
        const checked = document.querySelector(`input[name="rq${i}"]:checked`);
        if (checked) score += parseInt(checked.value);
      }
      const profile = score <= 4 ? 'Conservative' : score <= 7 ? 'Moderate' : 'Aggressive';
      state.riskProfile = profile;

      $('#onboardStep2').style.display = 'none';
      $('#onboardStep3').style.display = '';
      $$('.onboard-dot').forEach(d => d.style.background = d.dataset.step === '3' ? 'var(--green)' : 'var(--border)');
    };

    // Start trading
    const startBtn = $('#onboardStart');
    if (startBtn) startBtn.onclick = () => {
      $('#onboardingModal').style.display = 'none';
      localStorage.setItem('jse_onboarded', 'true');
      showToast('Welcome! Your J$1,000,000 paper trading account is ready.', 'success');
      loadWalletBalance();
    };
  }

  // ── Wire up trading UI events ──────────────────────────────────────────

  function setupTradingUI() {
    // Order modal close
    const closeBtn = $('#orderModalClose');
    if (closeBtn) closeBtn.onclick = () => $('#orderModal').style.display = 'none';

    // Click overlay to close
    const modal = $('#orderModal');
    if (modal) modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

    // Side toggles
    const buyToggle = $('#orderBuyToggle');
    const sellToggle = $('#orderSellToggle');
    if (buyToggle) buyToggle.onclick = () => setOrderSide('BUY');
    if (sellToggle) sellToggle.onclick = () => setOrderSide('SELL');

    // Order type change
    const typeSelect = $('#orderTypeSelect');
    if (typeSelect) typeSelect.onchange = updateOrderTypeFields;

    // Quantity/price input → update estimate
    const qtyInput = $('#orderQuantity');
    const limInput = $('#orderLimitPrice');
    if (qtyInput) qtyInput.oninput = updateOrderEstimate;
    if (limInput) limInput.oninput = updateOrderEstimate;

    // Submit
    const submitBtn = $('#orderSubmitBtn');
    if (submitBtn) submitBtn.onclick = placeOrder;

    // Stock detail Buy/Sell buttons
    const detailBuy = $('#detailBuyBtn');
    const detailSell = $('#detailSellBtn');
    if (detailBuy) detailBuy.onclick = () => {
      const sym = $('#detailSymbol')?.textContent;
      if (sym) openOrderModal(sym, 'BUY');
    };
    if (detailSell) detailSell.onclick = () => {
      const sym = $('#detailSymbol')?.textContent;
      if (sym) openOrderModal(sym, 'SELL');
    };

    // Refresh orders button
    const refreshBtn = $('#refreshOrdersBtn');
    if (refreshBtn) refreshBtn.onclick = loadTransactionsView;

    // Transaction filter tabs
    $$('.tx-filter-btn').forEach(btn => {
      btn.onclick = () => {
        $$('.tx-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // Filter logic would go here (currently loads all)
        loadTransactionsView();
      };
    });

    // Onboarding
    setupOnboarding();
  }

  // Patch: load transactions when navigating to that view
  const _viewObserver = new MutationObserver(() => {
    const txView = $('#view-transactions');
    if (txView && txView.style.display !== 'none' && txView.offsetParent !== null) {
      loadTransactionsView();
    }
  });
  const mainEl = $('main');
  if (mainEl) _viewObserver.observe(mainEl, { attributes: true, subtree: true, attributeFilter: ['style', 'class'] });

  // Initialize trading UI
  setupTradingUI();

  // Show onboarding for first-time users after login
  if (state.user && !localStorage.getItem('jse_onboarded')) {
    setTimeout(showOnboarding, 500);
  }

  // Load wallet on boot if logged in
  if (state.token) {
    loadWalletBalance();
  }

  // Expose for stock detail modal
  window.jseApp = window.jseApp || {};
  window.jseApp.openOrderModal = openOrderModal;

  // ══════════════════════════════════════════════════════════════════════════
  // ── US STOCKS VIEW ─────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  let usChart = null;
  let usSeries = null;
  let usSelectedSymbol = null;

  // Search
  let usSearchTimeout = null;
  const usSearchInput = $('#usSearchInput');
  const usSearchResults = $('#usSearchResults');

  usSearchInput?.addEventListener('input', () => {
    clearTimeout(usSearchTimeout);
    const q = usSearchInput.value.trim();
    if (!q || q.length < 1) { usSearchResults?.classList.remove('show'); return; }
    usSearchTimeout = setTimeout(async () => {
      try {
        const data = await apiFetch(`/api/us/search?q=${encodeURIComponent(q)}`);
        const results = data.results || data || [];
        if (!results.length) { usSearchResults.classList.remove('show'); return; }
        usSearchResults.innerHTML = results.slice(0, 10).map(r => `
          <div class="us-search-item" data-symbol="${escHtml(r.symbol)}">
            <div>
              <div class="usi-sym">${escHtml(r.symbol)}</div>
              <div class="usi-name">${escHtml(r.name || '')}</div>
            </div>
            <div class="usi-type">${escHtml(r.type || r.exchange || '')}</div>
          </div>
        `).join('');
        usSearchResults.classList.add('show');
        usSearchResults.querySelectorAll('.us-search-item').forEach(item => {
          item.addEventListener('click', () => {
            const sym = item.dataset.symbol;
            usSearchInput.value = sym;
            usSearchResults.classList.remove('show');
            selectUSStock(sym);
          });
        });
      } catch (e) {
        usSearchResults.innerHTML = `<div style="padding:12px;color:var(--muted);font-size:13px;">Error: ${escHtml(e.message)}</div>`;
        usSearchResults.classList.add('show');
      }
    }, 300);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.us-search-wrap')) usSearchResults?.classList.remove('show');
  });

  async function selectUSStock(symbol) {
    usSelectedSymbol = symbol;
    $('#usEmptyState').style.display = 'none';
    $('#usTopGrid').style.display = 'grid';

    // Load quote
    try {
      const quote = await apiFetch(`/api/us/quote/${symbol}`);
      const q = quote.quote || quote;
      $('#usQuoteSymbol').textContent = symbol;
      $('#usQuoteName').textContent = q.name || '';
      $('#usQuotePrice').textContent = `$${fmt(q.latestPrice || q.price || q.last || 0)}`;
      const change = q.changePercent || q.change_percent || 0;
      const changeEl = $('#usQuoteChange');
      const cls = change >= 0 ? 'up' : 'down';
      changeEl.className = `us-quote-change ${cls}`;
      changeEl.textContent = `${change >= 0 ? '+' : ''}${(change * (Math.abs(change) < 1 ? 100 : 1)).toFixed(2)}%`;

      const detailsEl = $('#usQuoteDetails');
      const details = [
        { label: 'Bid', value: q.bid != null ? `$${fmt(q.bid)}` : '--' },
        { label: 'Ask', value: q.ask != null ? `$${fmt(q.ask)}` : '--' },
        { label: 'Open', value: q.open != null ? `$${fmt(q.open)}` : '--' },
        { label: 'Prev Close', value: q.previousClose || q.prev_close ? `$${fmt(q.previousClose || q.prev_close)}` : '--' },
        { label: 'Day High', value: q.high != null ? `$${fmt(q.high)}` : '--' },
        { label: 'Day Low', value: q.low != null ? `$${fmt(q.low)}` : '--' },
        { label: 'Volume', value: q.volume != null ? fmtInt(q.volume) : '--' },
        { label: 'VWAP', value: q.vwap != null ? `$${fmt(q.vwap)}` : '--' },
      ];
      detailsEl.innerHTML = details.map(d => `
        <div class="us-quote-detail"><div class="label">${d.label}</div><div class="value">${d.value}</div></div>
      `).join('');
    } catch (e) {
      $('#usQuotePrice').textContent = 'Error';
      $('#usQuoteDetails').innerHTML = `<p style="color:var(--red);grid-column:1/-1;font-size:12px;">${escHtml(e.message)}</p>`;
    }

    // Load chart
    loadUSChart(symbol);
    // Load account, positions, orders
    loadUSAccount();
    loadUSPositions();
    loadUSOrders();
  }

  async function loadUSChart(symbol) {
    const container = $('#usChart');
    if (!container) return;
    if (usChart) { usChart.remove(); usChart = null; }

    usChart = LightweightCharts.createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight || 380,
      layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#6b7a8d', fontSize: 11, fontFamily: 'Inter' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.06)', timeVisible: true },
    });

    try {
      const data = await apiFetch(`/api/us/bars/${symbol}`);
      const bars = data.bars || data || [];
      if (bars.length) {
        const candleSeries = usChart.addCandlestickSeries({
          upColor: '#00c853', downColor: '#ff1744',
          borderUpColor: '#00c853', borderDownColor: '#ff1744',
          wickUpColor: '#00c853', wickDownColor: '#ff1744',
        });
        const chartData = bars.map(b => ({
          time: typeof b.t === 'string' ? Math.floor(new Date(b.t).getTime() / 1000) : b.t || b.time,
          open: b.o || b.open, high: b.h || b.high,
          low: b.l || b.low, close: b.c || b.close,
        })).sort((a, b) => a.time - b.time);
        candleSeries.setData(chartData);
        usChart.timeScale().fitContent();
      } else {
        // Fallback: area chart with quote price
        usSeries = usChart.addAreaSeries({
          topColor: 'rgba(0,176,255,0.3)', bottomColor: 'rgba(0,176,255,0.02)',
          lineColor: '#00b0ff', lineWidth: 2,
        });
      }
    } catch (e) {
      // Empty chart
    }

    new ResizeObserver(() => {
      if (usChart) usChart.applyOptions({ width: container.clientWidth });
    }).observe(container);
  }

  async function loadUSAccount() {
    const el = $('#usAccountDetails');
    if (!el) return;
    try {
      const data = await apiFetch('/api/us/account');
      const acc = data.account || data;
      const rows = [
        { label: 'Cash', value: `$${fmt(parseFloat(acc.cash || 0))}` },
        { label: 'Buying Power', value: `$${fmt(parseFloat(acc.buying_power || acc.buyingPower || 0))}` },
        { label: 'Portfolio Value', value: `$${fmt(parseFloat(acc.portfolio_value || acc.portfolioValue || 0))}` },
        { label: 'Equity', value: `$${fmt(parseFloat(acc.equity || 0))}` },
        { label: 'Day P&L', value: `$${fmt(parseFloat(acc.unrealized_pl || acc.pnl || 0))}` },
        { label: 'Status', value: acc.status || acc.account_status || 'active' },
      ];
      el.innerHTML = rows.map(r => `
        <div class="us-account-row"><span class="label">${r.label}</span><span class="value">${r.value}</span></div>
      `).join('');
    } catch (e) {
      el.innerHTML = `<p style="color:var(--muted);font-size:12px;text-align:center;padding:20px;">${escHtml(e.message)}</p>`;
    }
  }

  async function loadUSPositions() {
    const el = $('#usPositionsList');
    if (!el) return;
    try {
      const data = await apiFetch('/api/us/positions');
      const positions = data.positions || data || [];
      if (!positions.length) {
        el.innerHTML = '<p style="color:var(--muted);font-size:13px;text-align:center;padding:20px;">No open positions</p>';
        return;
      }
      el.innerHTML = positions.map(p => {
        const pnl = parseFloat(p.unrealized_pl || p.pnl || 0);
        const cls = pnl >= 0 ? 'text-green' : 'text-red';
        return `
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;cursor:pointer;" onclick="document.querySelector('#usSearchInput').value='${escHtml(p.symbol)}';window.jseApp?.selectUSStock?.('${escHtml(p.symbol)}')">
            <div><span style="font-weight:700;">${escHtml(p.symbol)}</span> <span style="color:var(--muted);font-size:11px;">${p.qty || p.quantity || 0} shares</span></div>
            <div class="${cls}" style="font-family:'JetBrains Mono',monospace;font-weight:600;">${pnl >= 0 ? '+' : ''}$${fmt(Math.abs(pnl))}</div>
          </div>`;
      }).join('');
    } catch (e) {
      el.innerHTML = `<p style="color:var(--muted);font-size:12px;text-align:center;padding:20px;">Could not load positions</p>`;
    }
  }

  async function loadUSOrders() {
    const el = $('#usOrdersList');
    if (!el) return;
    try {
      const data = await apiFetch('/api/us/orders');
      const orders = data.orders || data || [];
      if (!orders.length) {
        el.innerHTML = '<p style="color:var(--muted);font-size:13px;text-align:center;padding:20px;">No open orders</p>';
        return;
      }
      el.innerHTML = orders.slice(0, 10).map(o => {
        const sideColor = (o.side || '').toLowerCase() === 'buy' ? 'var(--green)' : 'var(--red)';
        return `
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:12px;">
            <div><span style="font-weight:700;">${escHtml(o.symbol)}</span> <span style="color:${sideColor};font-weight:600;">${(o.side || '').toUpperCase()}</span></div>
            <div style="color:var(--muted);">${o.qty || o.quantity || 0} @ ${o.type || 'market'}</div>
          </div>`;
      }).join('');
    } catch (e) {
      el.innerHTML = `<p style="color:var(--muted);font-size:12px;text-align:center;padding:20px;">Could not load orders</p>`;
    }
  }

  // US Buy/Sell buttons
  $('#usBuyBtn')?.addEventListener('click', () => {
    if (!usSelectedSymbol) return;
    openUSOrderModal(usSelectedSymbol, 'buy');
  });
  $('#usSellBtn')?.addEventListener('click', () => {
    if (!usSelectedSymbol) return;
    openUSOrderModal(usSelectedSymbol, 'sell');
  });

  function openUSOrderModal(symbol, side) {
    // Reuse the order modal but adapted for US stocks
    const modal = $('#orderModal');
    if (!modal) return;
    modal.style.display = 'flex';
    orderSymbol = symbol;
    orderSide = side.toUpperCase();

    $('#orderSymbol').textContent = symbol;
    $('#orderStockName').textContent = '(US Stock)';
    const badge = $('#orderPaperBadge');
    if (badge) { badge.textContent = 'US / ALPACA'; badge.style.background = 'var(--blue)'; badge.style.color = '#fff'; }
    $('#orderCurrentPrice').textContent = $('#usQuotePrice')?.textContent || '$0.00';
    $('#orderQuantity').value = '';
    $('#orderLimitPrice').value = '';
    $('#orderStopPrice').value = '';
    $('#orderEstTotal').textContent = '$0.00';
    $('#orderFee').textContent = '$0.00';
    setOrderSide(side.toUpperCase());
    updateOrderTypeFields();

    // Override submit for US orders
    const submitBtn = $('#orderSubmitBtn');
    submitBtn.onclick = async () => {
      const qty = parseInt($('#orderQuantity')?.value);
      if (!qty || qty <= 0) return showToast('Enter a valid quantity', 'error');
      const type = ($('#orderTypeSelect')?.value || 'MARKET').toLowerCase();
      const body = { symbol, qty, side: side.toLowerCase(), type };
      if (type === 'limit' || type === 'stop_limit') {
        body.limit_price = parseFloat($('#orderLimitPrice')?.value);
        if (!body.limit_price) return showToast('Enter a limit price', 'error');
      }
      if (type === 'stop' || type === 'stop_limit') {
        body.stop_price = parseFloat($('#orderStopPrice')?.value);
        if (!body.stop_price) return showToast('Enter a stop price', 'error');
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Placing...';
      try {
        const data = await apiFetch('/api/us/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        showToast(data.message || 'US order placed!', 'success');
        modal.style.display = 'none';
        loadUSOrders();
        loadUSPositions();
        loadUSAccount();
      } catch (e) {
        showToast(e.message || 'Order failed', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Place Order';
        // Restore original handler
        submitBtn.onclick = placeOrder;
        if (badge) { badge.textContent = 'PAPER TRADING'; badge.style.background = 'var(--green)'; badge.style.color = '#000'; }
      }
    };
  }

  window.jseApp = window.jseApp || {};
  window.jseApp.selectUSStock = selectUSStock;

  // ══════════════════════════════════════════════════════════════════════════
  // ── CALCULATORS VIEW ───────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  let compoundChart = null;
  let retirementChart = null;
  let loanChart = null;

  // Calculator tab switching
  $$('.calc-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.calc-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      $$('.calc-panel').forEach(p => p.classList.remove('active'));
      const panel = $(`#calc-${tab.dataset.calc}`);
      if (panel) panel.classList.add('active');
    });
  });

  // ── Compound Growth Calculator ──
  $('#calcCompoundBtn')?.addEventListener('click', async () => {
    const principal = parseFloat($('#compPrincipal')?.value) || 0;
    const monthly = parseFloat($('#compMonthly')?.value) || 0;
    const rate = parseFloat($('#compRate')?.value) || 0;
    const years = parseInt($('#compYears')?.value) || 0;

    if (!principal && !monthly) return showToast('Enter principal or monthly contribution', 'error');
    if (!years) return showToast('Enter investment period', 'error');

    const btn = $('#calcCompoundBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Calculating...';

    try {
      const data = await apiFetch('/api/analytics/compound-growth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ principal, monthlyContribution: monthly, annualRate: rate, years }),
      });

      const result = data.result || data;
      const resultEl = $('#compoundResult');
      resultEl.classList.remove('hidden');

      // Result cards
      const finalBalance = result.finalBalance || result.total || 0;
      const totalContributions = result.totalContributions || (principal + monthly * years * 12);
      const totalInterest = result.totalInterest || (finalBalance - totalContributions);

      $('#compoundResultCards').innerHTML = `
        <div class="calc-result-card"><div class="label">Final Balance</div><div class="value green">$${fmt(finalBalance)}</div></div>
        <div class="calc-result-card"><div class="label">Total Contributions</div><div class="value blue">$${fmt(totalContributions)}</div></div>
        <div class="calc-result-card"><div class="label">Interest Earned</div><div class="value gold">$${fmt(totalInterest)}</div></div>
        <div class="calc-result-card"><div class="label">Growth</div><div class="value green">${totalContributions > 0 ? ((finalBalance / totalContributions - 1) * 100).toFixed(1) : 0}%</div></div>
      `;

      // Chart
      renderCompoundChart(result.projections || result.monthlyData || generateCompoundProjection(principal, monthly, rate, years));

    } catch (e) {
      // Fallback: compute locally
      const projection = generateCompoundProjection(principal, monthly, rate, years);
      const finalBalance = projection[projection.length - 1]?.balance || 0;
      const totalContributions = principal + monthly * years * 12;
      const totalInterest = finalBalance - totalContributions;

      const resultEl = $('#compoundResult');
      resultEl.classList.remove('hidden');
      $('#compoundResultCards').innerHTML = `
        <div class="calc-result-card"><div class="label">Final Balance</div><div class="value green">$${fmt(finalBalance)}</div></div>
        <div class="calc-result-card"><div class="label">Total Contributions</div><div class="value blue">$${fmt(totalContributions)}</div></div>
        <div class="calc-result-card"><div class="label">Interest Earned</div><div class="value gold">$${fmt(totalInterest)}</div></div>
        <div class="calc-result-card"><div class="label">Growth</div><div class="value green">${totalContributions > 0 ? ((finalBalance / totalContributions - 1) * 100).toFixed(1) : 0}%</div></div>
      `;
      renderCompoundChart(projection);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-calculator"></i> Calculate Growth';
    }
  });

  function generateCompoundProjection(principal, monthly, rate, years) {
    const monthlyRate = rate / 100 / 12;
    const data = [];
    let balance = principal;
    for (let m = 0; m <= years * 12; m++) {
      if (m > 0) {
        balance = balance * (1 + monthlyRate) + monthly;
      }
      if (m % (years > 10 ? 12 : years > 3 ? 3 : 1) === 0) {
        data.push({ month: m, balance: Math.round(balance * 100) / 100, contributions: principal + monthly * m });
      }
    }
    return data;
  }

  function renderCompoundChart(projections) {
    const container = $('#compoundChartWrap');
    if (!container) return;
    if (compoundChart) { compoundChart.remove(); compoundChart = null; }

    compoundChart = LightweightCharts.createChart(container, {
      width: container.clientWidth, height: container.clientHeight || 320,
      layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#6b7a8d', fontSize: 11, fontFamily: 'Inter' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.06)' },
    });

    const now = Math.floor(Date.now() / 1000);
    const monthSec = 30 * 24 * 3600;

    const balanceSeries = compoundChart.addAreaSeries({
      topColor: 'rgba(0,200,83,0.3)', bottomColor: 'rgba(0,200,83,0.02)',
      lineColor: '#00c853', lineWidth: 2,
    });
    const contribSeries = compoundChart.addLineSeries({
      color: '#00b0ff', lineWidth: 1, lineStyle: 2,
    });

    const balanceData = projections.map((p, i) => ({
      time: now + (p.month || i) * monthSec,
      value: p.balance || p.total || p.value || 0,
    }));
    const contribData = projections.map((p, i) => ({
      time: now + (p.month || i) * monthSec,
      value: p.contributions || p.principal || 0,
    }));

    balanceSeries.setData(balanceData);
    if (contribData.some(d => d.value > 0)) contribSeries.setData(contribData);
    compoundChart.timeScale().fitContent();

    new ResizeObserver(() => {
      if (compoundChart) compoundChart.applyOptions({ width: container.clientWidth });
    }).observe(container);
  }

  // ── Retirement Calculator ──
  $('#calcRetirementBtn')?.addEventListener('click', async () => {
    const currentAge = parseInt($('#retCurrentAge')?.value) || 0;
    const retireAge = parseInt($('#retRetireAge')?.value) || 0;
    const monthlyExpenses = parseFloat($('#retMonthlyExpenses')?.value) || 0;
    const inflation = parseFloat($('#retInflation')?.value) || 0;

    if (!currentAge || !retireAge) return showToast('Enter your current and retirement ages', 'error');
    if (retireAge <= currentAge) return showToast('Retirement age must be after current age', 'error');
    if (!monthlyExpenses) return showToast('Enter your monthly expenses', 'error');

    const btn = $('#calcRetirementBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Calculating...';

    try {
      const data = await apiFetch('/api/analytics/retirement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentAge, retirementAge: retireAge, monthlyExpenses, inflationRate: inflation }),
      });
      const result = data.result || data;
      showRetirementResult(result, currentAge, retireAge, monthlyExpenses, inflation);
    } catch (e) {
      // Local fallback
      const yearsToRetire = retireAge - currentAge;
      const retirementYears = 85 - retireAge;
      const inflatedExpenses = monthlyExpenses * Math.pow(1 + inflation / 100, yearsToRetire);
      const neededSavings = inflatedExpenses * 12 * retirementYears;
      const monthlyContribution = neededSavings / (yearsToRetire * 12);
      showRetirementResult({
        neededSavings, monthlyContribution, inflatedMonthlyExpenses: inflatedExpenses,
        yearsToRetire, retirementYears, projections: generateRetirementProjection(currentAge, retireAge, monthlyContribution, inflation)
      }, currentAge, retireAge, monthlyExpenses, inflation);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-calculator"></i> Calculate Retirement';
    }
  });

  function generateRetirementProjection(currentAge, retireAge, monthlyContrib, inflation) {
    const data = [];
    let savings = 0;
    const annualReturn = 0.07;
    for (let age = currentAge; age <= 85; age++) {
      if (age <= retireAge) {
        savings += monthlyContrib * 12;
        savings *= (1 + annualReturn);
      } else {
        const yearlyExpense = monthlyContrib * 12 * Math.pow(1 + inflation / 100, age - currentAge) * 0.5;
        savings -= yearlyExpense;
        savings *= (1 + annualReturn * 0.5);
        if (savings < 0) savings = 0;
      }
      data.push({ age, savings: Math.round(savings) });
    }
    return data;
  }

  function showRetirementResult(result, currentAge, retireAge, expenses, inflation) {
    const resultEl = $('#retirementResult');
    resultEl.classList.remove('hidden');

    const needed = result.neededSavings || result.totalNeeded || 0;
    const monthlyContrib = result.monthlyContribution || result.monthlySavings || 0;
    const inflatedExp = result.inflatedMonthlyExpenses || result.futureExpenses || (expenses * Math.pow(1 + inflation / 100, retireAge - currentAge));

    $('#retirementResultCards').innerHTML = `
      <div class="calc-result-card"><div class="label">Total Savings Needed</div><div class="value gold">$${fmt(needed)}</div></div>
      <div class="calc-result-card"><div class="label">Monthly Savings Required</div><div class="value green">$${fmt(monthlyContrib)}</div></div>
      <div class="calc-result-card"><div class="label">Future Monthly Expenses</div><div class="value red">$${fmt(inflatedExp)}</div></div>
      <div class="calc-result-card"><div class="label">Years to Retirement</div><div class="value blue">${retireAge - currentAge}</div></div>
    `;

    // Chart
    const projections = result.projections || generateRetirementProjection(currentAge, retireAge, monthlyContrib, inflation);
    renderRetirementChart(projections);
  }

  function renderRetirementChart(projections) {
    const container = $('#retirementChartWrap');
    if (!container) return;
    if (retirementChart) { retirementChart.remove(); retirementChart = null; }

    retirementChart = LightweightCharts.createChart(container, {
      width: container.clientWidth, height: container.clientHeight || 320,
      layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#6b7a8d', fontSize: 11, fontFamily: 'Inter' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.06)' },
    });

    const now = Math.floor(Date.now() / 1000);
    const yearSec = 365 * 24 * 3600;

    const series = retirementChart.addAreaSeries({
      topColor: 'rgba(255,214,0,0.3)', bottomColor: 'rgba(255,214,0,0.02)',
      lineColor: '#ffd600', lineWidth: 2,
    });

    series.setData(projections.map((p, i) => ({
      time: now + i * yearSec,
      value: p.savings || p.balance || p.value || 0,
    })));
    retirementChart.timeScale().fitContent();

    new ResizeObserver(() => {
      if (retirementChart) retirementChart.applyOptions({ width: container.clientWidth });
    }).observe(container);
  }

  // ── Loan Calculator ──
  $('#calcLoanBtn')?.addEventListener('click', async () => {
    const principal = parseFloat($('#loanPrincipal')?.value) || 0;
    const rate = parseFloat($('#loanRate')?.value) || 0;
    const years = parseInt($('#loanYears')?.value) || 0;

    if (!principal) return showToast('Enter loan principal', 'error');
    if (!years) return showToast('Enter loan term', 'error');

    const btn = $('#calcLoanBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Calculating...';

    try {
      const data = await apiFetch('/api/analytics/loan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ principal, annualRate: rate, years }),
      });
      const result = data.result || data;
      showLoanResult(result, principal, rate, years);
    } catch (e) {
      // Local fallback
      const monthlyRate = rate / 100 / 12;
      const numPayments = years * 12;
      const monthlyPayment = monthlyRate > 0
        ? (principal * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
        : principal / numPayments;
      const totalPayment = monthlyPayment * numPayments;
      const totalInterest = totalPayment - principal;
      const amortization = generateAmortization(principal, monthlyRate, monthlyPayment, numPayments);
      showLoanResult({ monthlyPayment, totalPayment, totalInterest, amortization }, principal, rate, years);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-calculator"></i> Calculate Loan';
    }
  });

  function generateAmortization(principal, monthlyRate, monthlyPayment, numPayments) {
    const data = [];
    let balance = principal;
    let totalPrincipal = 0;
    let totalInterest = 0;
    const step = numPayments > 120 ? 12 : numPayments > 36 ? 3 : 1;
    for (let m = 1; m <= numPayments; m++) {
      const interest = balance * monthlyRate;
      const principalPaid = monthlyPayment - interest;
      balance -= principalPaid;
      totalPrincipal += principalPaid;
      totalInterest += interest;
      if (m % step === 0 || m === numPayments) {
        data.push({ month: m, balance: Math.max(0, balance), principalPaid: totalPrincipal, interestPaid: totalInterest });
      }
    }
    return data;
  }

  function showLoanResult(result, principal, rate, years) {
    const resultEl = $('#loanResult');
    resultEl.classList.remove('hidden');

    const mp = result.monthlyPayment || 0;
    const tp = result.totalPayment || (mp * years * 12);
    const ti = result.totalInterest || (tp - principal);

    $('#loanResultCards').innerHTML = `
      <div class="calc-result-card"><div class="label">Monthly Payment</div><div class="value green">$${fmt(mp)}</div></div>
      <div class="calc-result-card"><div class="label">Total Payment</div><div class="value blue">$${fmt(tp)}</div></div>
      <div class="calc-result-card"><div class="label">Total Interest</div><div class="value red">$${fmt(ti)}</div></div>
      <div class="calc-result-card"><div class="label">Interest Ratio</div><div class="value gold">${principal > 0 ? (ti / principal * 100).toFixed(1) : 0}%</div></div>
    `;

    const monthlyRate = rate / 100 / 12;
    const amortization = result.amortization || generateAmortization(principal, monthlyRate, mp, years * 12);
    renderLoanChart(amortization);
  }

  function renderLoanChart(amortization) {
    const container = $('#loanChartWrap');
    if (!container) return;
    if (loanChart) { loanChart.remove(); loanChart = null; }

    loanChart = LightweightCharts.createChart(container, {
      width: container.clientWidth, height: container.clientHeight || 320,
      layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#6b7a8d', fontSize: 11, fontFamily: 'Inter' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.06)' },
    });

    const now = Math.floor(Date.now() / 1000);
    const monthSec = 30 * 24 * 3600;

    // Remaining balance line
    const balanceSeries = loanChart.addAreaSeries({
      topColor: 'rgba(255,23,68,0.2)', bottomColor: 'rgba(255,23,68,0.02)',
      lineColor: '#ff1744', lineWidth: 2,
    });
    // Principal paid line
    const principalSeries = loanChart.addLineSeries({
      color: '#00c853', lineWidth: 2,
    });

    balanceSeries.setData(amortization.map((a, i) => ({
      time: now + (a.month || i) * monthSec,
      value: a.balance || 0,
    })));
    principalSeries.setData(amortization.map((a, i) => ({
      time: now + (a.month || i) * monthSec,
      value: a.principalPaid || 0,
    })));

    loanChart.timeScale().fitContent();

    new ResizeObserver(() => {
      if (loanChart) loanChart.applyOptions({ width: container.clientWidth });
    }).observe(container);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── PRICE ALERTS ───────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  let stockAlerts = {};  // { symbol: [{ id, target, condition }] }

  $('#setAlertBtn')?.addEventListener('click', async () => {
    const symbol = $('#detailSymbol')?.textContent;
    if (!symbol) return;
    const targetPrice = parseFloat($('#alertTargetPrice')?.value);
    const condition = $('#alertCondition')?.value || 'above';

    if (!targetPrice || targetPrice <= 0) return showToast('Enter a valid target price', 'error');

    const btn = $('#setAlertBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
      const data = await apiFetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, targetPrice, condition }),
      });
      showToast(data.message || `Alert set: ${symbol} ${condition} $${fmt(targetPrice)}`, 'success');
      if (!stockAlerts[symbol]) stockAlerts[symbol] = [];
      stockAlerts[symbol].push({ id: data.id || Date.now(), target: targetPrice, condition });
      renderStockAlerts(symbol);
    } catch (e) {
      // Store locally as fallback
      if (!stockAlerts[symbol]) stockAlerts[symbol] = [];
      stockAlerts[symbol].push({ id: Date.now(), target: targetPrice, condition });
      renderStockAlerts(symbol);
      showToast(`Alert saved locally: ${symbol} ${condition} $${fmt(targetPrice)}`, 'success');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-bell"></i> Set Alert';
      $('#alertTargetPrice').value = '';
    }
  });

  function renderStockAlerts(symbol) {
    const el = $('#stockAlertsList');
    if (!el) return;
    const alerts = stockAlerts[symbol] || [];
    if (!alerts.length) {
      el.innerHTML = '<p style="color:var(--muted);font-size:11px;">No alerts set for this stock.</p>';
      return;
    }
    el.innerHTML = alerts.map(a => `
      <div class="alert-item">
        <div>
          <span class="alert-cond ${a.condition}">${a.condition === 'above' ? '&#9650;' : '&#9660;'} ${a.condition.toUpperCase()}</span>
          <span style="font-family:'JetBrains Mono',monospace;font-weight:700;margin-left:8px;">$${fmt(a.target)}</span>
        </div>
        <button class="alert-delete" data-alert-id="${a.id}" title="Remove alert"><i class="fas fa-trash-alt"></i></button>
      </div>
    `).join('');

    el.querySelectorAll('.alert-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const alertId = btn.dataset.alertId;
        stockAlerts[symbol] = (stockAlerts[symbol] || []).filter(a => String(a.id) !== String(alertId));
        try { await apiFetch(`/api/alerts/${alertId}`, { method: 'DELETE' }); } catch (_) {}
        renderStockAlerts(symbol);
      });
    });
  }

  // Load alerts when stock detail modal opens
  const origOpenStockDetail = openStockDetail;
  window._openStockDetailOrig = openStockDetail;
  // Patch openStockDetail to also load alerts
  function patchedOpenStockDetail(symbol) {
    window._openStockDetailOrig(symbol);
    // Load alerts for this symbol
    loadAlerts(symbol);
    // Set default alert price to current stock price
    const priceText = $('#detailPrice')?.textContent?.replace(/[^0-9.]/g, '');
    if (priceText) $('#alertTargetPrice').value = priceText;
  }

  // Replace selectStock's call
  // We need to monkey-patch: selectStock calls openStockDetail
  // The easiest way is to replace openStockDetail reference used in selectStock
  // Since selectStock is already defined, override it:
  const _origSelectStock = selectStock;

  // We can't re-declare selectStock, but we can override via reassignment in the closure
  // Actually selectStock is used directly. Let's patch openStockDetail instead.
  // openStockDetail is called at the end of selectStock.
  // Let's just add an observer that triggers when the modal opens.

  async function loadAlerts(symbol) {
    try {
      const data = await apiFetch(`/api/alerts?symbol=${symbol}`);
      stockAlerts[symbol] = (data.alerts || data || []).map(a => ({
        id: a.id || a._id, target: a.targetPrice || a.target, condition: a.condition
      }));
    } catch (_) {
      // Use local alerts
    }
    renderStockAlerts(symbol);
  }

  // Observe stock detail modal opening to trigger alert load
  const detailModal = $('#stockDetailModal');
  if (detailModal) {
    const alertObserver = new MutationObserver(() => {
      if (detailModal.style.display === 'flex') {
        const sym = $('#detailSymbol')?.textContent;
        if (sym) {
          loadAlerts(sym);
          const priceText = $('#detailPrice')?.textContent?.replace(/[^0-9.]/g, '');
          if (priceText) $('#alertTargetPrice').value = priceText;
        }
      }
    });
    alertObserver.observe(detailModal, { attributes: true, attributeFilter: ['style'] });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── PATCHED NAVIGATION — add new views to viewTitles and navigateTo ───
  // ══════════════════════════════════════════════════════════════════════════

  viewTitles['us-stocks'] = ['US Stocks', 'Trade US securities via Alpaca'];
  viewTitles['calculators'] = ['Calculators', 'Financial planning calculators'];
  viewTitles['forex'] = ['Forex', 'Live currency exchange rates'];
  viewTitles['global-markets'] = ['Global Markets', 'World indices and commodities'];

  // ══════════════════════════════════════════════════════════════════════════
  // ── FOREX VIEW ─────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  let forexRatesData = [];
  let forexRefreshInterval = null;

  async function loadForexRates() {
    try {
      const data = await apiFetch('/api/forex');
      const rates = data.rates || [];
      forexRatesData = rates;
      renderForexGrid(rates);
      populateForexConverter(rates);
      updateForexConversion();
    } catch (e) {
      console.error('Failed to load forex rates:', e);
      const grid = $('#forexGrid');
      if (grid) grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--muted);"><i class="fas fa-exclamation-triangle" style="font-size:40px;margin-bottom:12px;display:block;color:var(--red);"></i>Failed to load forex rates. Please try again later.</div>';
    }
  }

  function renderForexGrid(rates) {
    const grid = $('#forexGrid');
    if (!grid) return;
    if (!rates.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--muted);">No forex data available.</div>';
      return;
    }
    grid.innerHTML = rates.map(r => {
      const isUp = r.change >= 0;
      const changeColor = isUp ? 'var(--green)' : 'var(--red)';
      const changeIcon = isUp ? 'fa-caret-up' : 'fa-caret-down';
      const changeStr = (isUp ? '+' : '') + (r.change != null ? r.change.toFixed(2) : '0.00') + '%';
      return `
        <div class="card" style="padding:0;overflow:hidden;">
          <div style="padding:16px 20px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
              <div>
                <div style="font-size:16px;font-weight:700;color:var(--text);">${r.pair || '--'}</div>
                <div style="font-size:12px;color:var(--muted);margin-top:2px;">${r.name || ''}</div>
              </div>
              <div style="display:flex;align-items:center;gap:4px;font-size:13px;font-weight:600;color:${changeColor};font-family:'JetBrains Mono',monospace;">
                <i class="fas ${changeIcon}"></i> ${changeStr}
              </div>
            </div>
            <div style="font-size:24px;font-weight:800;font-family:'JetBrains Mono',monospace;color:var(--text);margin-bottom:12px;">
              ${r.rate != null ? r.rate.toFixed(4) : '--'}
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);border-top:1px solid var(--border);padding-top:10px;">
              <span>High: <span style="color:var(--green);font-family:'JetBrains Mono',monospace;">${r.dayHigh != null ? r.dayHigh.toFixed(4) : '--'}</span></span>
              <span>Low: <span style="color:var(--red);font-family:'JetBrains Mono',monospace;">${r.dayLow != null ? r.dayLow.toFixed(4) : '--'}</span></span>
              <span>Prev: <span style="font-family:'JetBrains Mono',monospace;">${r.prevClose != null ? r.prevClose.toFixed(4) : '--'}</span></span>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  function populateForexConverter(rates) {
    const select = $('#forexConvertTarget');
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">Select currency...</option>';
    rates.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.pair;
      opt.textContent = r.pair + ' — ' + (r.name || '');
      select.appendChild(opt);
    });
    if (current) select.value = current;
  }

  function updateForexConversion() {
    const amountEl = $('#forexConvertAmount');
    const targetEl = $('#forexConvertTarget');
    const resultEl = $('#forexConvertResult');
    if (!amountEl || !targetEl || !resultEl) return;

    const amount = parseFloat(amountEl.value) || 0;
    const pair = targetEl.value;
    if (!pair || !amount) { resultEl.textContent = '--'; return; }

    const rateObj = forexRatesData.find(r => r.pair === pair);
    if (!rateObj || !rateObj.rate) { resultEl.textContent = '--'; return; }

    const converted = amount * rateObj.rate;
    const target = pair.split('/')[1] || pair;
    resultEl.textContent = converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + ' ' + target;
  }

  // Bind converter events
  $('#forexConvertAmount')?.addEventListener('input', updateForexConversion);
  $('#forexConvertTarget')?.addEventListener('change', updateForexConversion);

  function startForexAutoRefresh() {
    if (forexRefreshInterval) clearInterval(forexRefreshInterval);
    forexRefreshInterval = setInterval(() => {
      if (state.currentView === 'forex') loadForexRates();
    }, 60000);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── GLOBAL MARKETS VIEW ────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  const marketGroupLabels = {
    'US': { label: 'United States', icon: 'fa-flag-usa', color: 'var(--blue)' },
    'UK': { label: 'United Kingdom', icon: 'fa-landmark', color: 'var(--purple)' },
    'Japan': { label: 'Japan', icon: 'fa-torii-gate', color: 'var(--red)' },
    'Germany': { label: 'Germany', icon: 'fa-industry', color: 'var(--gold)' },
    'Hong Kong': { label: 'Hong Kong', icon: 'fa-city', color: 'var(--green)' },
    'Commodity': { label: 'Commodities', icon: 'fa-gem', color: 'var(--gold)' },
    'Crypto': { label: 'Cryptocurrency', icon: 'fa-bitcoin-sign', color: '#f7931a' },
  };

  async function loadGlobalMarkets() {
    try {
      const data = await apiFetch('/api/global-markets');
      const indices = data.indices || [];
      renderGlobalMarkets(indices);
    } catch (e) {
      console.error('Failed to load global markets:', e);
      const el = $('#globalMarketsContent');
      if (el) el.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--muted);"><i class="fas fa-exclamation-triangle" style="font-size:40px;margin-bottom:12px;display:block;color:var(--red);"></i>Failed to load market data. Please try again later.</div>';
    }
  }

  function renderGlobalMarkets(indices) {
    const container = $('#globalMarketsContent');
    if (!container) return;
    if (!indices.length) {
      container.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--muted);">No market data available.</div>';
      return;
    }

    // Group by market
    const groups = {};
    indices.forEach(idx => {
      const market = idx.market || 'Other';
      if (!groups[market]) groups[market] = [];
      groups[market].push(idx);
    });

    let html = '';
    const groupOrder = ['US', 'UK', 'Germany', 'Japan', 'Hong Kong', 'Commodity', 'Crypto'];
    const sortedKeys = [...groupOrder.filter(k => groups[k]), ...Object.keys(groups).filter(k => !groupOrder.includes(k))];

    sortedKeys.forEach(market => {
      const items = groups[market];
      const meta = marketGroupLabels[market] || { label: market, icon: 'fa-chart-bar', color: 'var(--muted)' };

      html += `
        <div style="margin-bottom:28px;">
          <h3 style="font-size:15px;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:8px;">
            <i class="fas ${meta.icon}" style="color:${meta.color};"></i> ${meta.label}
          </h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;">
            ${items.map(idx => {
              const isUp = idx.change >= 0;
              const changeColor = isUp ? 'var(--green)' : 'var(--red)';
              const changeIcon = isUp ? 'fa-caret-up' : 'fa-caret-down';
              const changeStr = (isUp ? '+' : '') + (idx.change != null ? idx.change.toFixed(2) : '0.00') + '%';
              const dollarStr = idx.dollarChange != null ? ((idx.dollarChange >= 0 ? '+' : '') + idx.dollarChange.toFixed(2)) : '';
              return `
                <div class="card" style="padding:16px 20px;">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                    <div>
                      <div style="font-size:14px;font-weight:700;color:var(--text);">${idx.name || idx.symbol}</div>
                      <div style="font-size:11px;color:var(--muted);margin-top:2px;">${idx.symbol || ''}</div>
                    </div>
                    <div style="text-align:right;">
                      <div style="display:flex;align-items:center;gap:4px;font-size:13px;font-weight:600;color:${changeColor};font-family:'JetBrains Mono',monospace;">
                        <i class="fas ${changeIcon}"></i> ${changeStr}
                      </div>
                      ${dollarStr ? `<div style="font-size:11px;color:${changeColor};font-family:'JetBrains Mono',monospace;margin-top:2px;">${dollarStr}</div>` : ''}
                    </div>
                  </div>
                  <div style="font-size:20px;font-weight:800;font-family:'JetBrains Mono',monospace;color:var(--text);">
                    ${idx.price != null ? idx.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--'}
                  </div>
                  ${idx.volume ? `<div style="font-size:11px;color:var(--muted);margin-top:6px;">Vol: ${Number(idx.volume).toLocaleString()}</div>` : ''}
                </div>`;
            }).join('')}
          </div>
        </div>`;
    });

    container.innerHTML = html;
  }

  // Re-bind nav items for new views
  $$('.nav-item').forEach(item => {
    item.addEventListener('click', () => navigateTo(item.dataset.view));
  });

  // Patch navigateTo to handle new views
  const _origNavigateTo = navigateTo;
  const _patchedNav = (view) => {
    _origNavigateTo(view);
    if (view === 'us-stocks') {
      loadUSAccount();
      if (usSelectedSymbol) loadUSPositions();
    }
    if (view === 'calculators') {
      // Resize any active charts
      setTimeout(() => {
        if (compoundChart) compoundChart.applyOptions({ width: $('#compoundChartWrap')?.clientWidth || 600 });
        if (retirementChart) retirementChart.applyOptions({ width: $('#retirementChartWrap')?.clientWidth || 600 });
        if (loanChart) loanChart.applyOptions({ width: $('#loanChartWrap')?.clientWidth || 600 });
      }, 100);
    }
    if (view === 'forex') {
      loadForexRates();
      startForexAutoRefresh();
    }
    if (view === 'global-markets') {
      loadGlobalMarkets();
    }
  };

  // Override click handlers for nav items to use patched navigateTo
  $$('.nav-item').forEach(item => {
    // Remove old listeners by cloning
    const newItem = item.cloneNode(true);
    item.parentNode.replaceChild(newItem, item);
    newItem.addEventListener('click', () => _patchedNav(newItem.dataset.view));
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // ── Settings View (Enhanced) ──────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════════

  // Notification preference state (persisted in localStorage)
  const notifPrefs = JSON.parse(localStorage.getItem('jse_notif_prefs') || '{"priceTargets":true,"orderFills":true,"news":false}');

  function loadSettingsView() {
    const el = $('#settingsContent');
    if (!el) return;
    if (!state.user) {
      el.innerHTML = '<div class="card" style="padding:40px;text-align:center;"><p>Please sign in to access settings.</p></div>';
      return;
    }

    const memberSince = state.user.createdAt ? new Date(state.user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
    const has2FA = state.user.twoFactorEnabled || false;
    const tier = state.user.subscriptionTier || state.user.subscription?.plan || 'FREE';
    const tierColors = { FREE: 'var(--muted)', BASIC: 'var(--blue)', PRO: 'var(--gold)', ENTERPRISE: 'var(--green)' };
    const tierColor = tierColors[tier] || 'var(--muted)';

    el.innerHTML = `
      <!-- Profile Section -->
      <div class="card settings-section" style="padding:24px;">
        <div class="section-title"><i class="fas fa-user-circle" style="color:var(--blue);font-size:22px;"></i> Profile</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div class="wallet-form-group">
            <label>Display Name</label>
            <input type="text" class="settings-input" id="settingsName" value="${escHtml(state.user.name)}" placeholder="Your name">
          </div>
          <div class="wallet-form-group">
            <label>Email</label>
            <input type="email" class="settings-input" value="${escHtml(state.user.email)}" readonly>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;">
          <div style="font-size:12px;color:var(--muted);"><i class="fas fa-calendar" style="margin-right:6px;"></i>Member since ${memberSince}</div>
          <button class="settings-btn settings-btn-green-fill" onclick="window.__saveProfile()">Save Profile</button>
        </div>
      </div>

      <!-- Change Password Section -->
      <div class="card settings-section" style="padding:24px;">
        <div class="section-title"><i class="fas fa-key" style="color:var(--gold);font-size:20px;"></i> Change Password</div>
        <div style="display:grid;gap:12px;" id="changePasswordForm">
          <div class="wallet-form-group" style="margin-bottom:0;">
            <label>Current Password</label>
            <input type="password" class="settings-input" id="settingsCurrentPwd" placeholder="Enter current password">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="wallet-form-group" style="margin-bottom:0;">
              <label>New Password</label>
              <input type="password" class="settings-input" id="settingsNewPwd" placeholder="Min 6 characters">
            </div>
            <div class="wallet-form-group" style="margin-bottom:0;">
              <label>Confirm New Password</label>
              <input type="password" class="settings-input" id="settingsConfirmPwd" placeholder="Re-enter new password">
            </div>
          </div>
          <div style="text-align:right;margin-top:4px;">
            <button class="settings-btn settings-btn-gold" onclick="window.__changePasswordInline()">
              <i class="fas fa-lock" style="margin-right:6px;"></i>Update Password
            </button>
          </div>
        </div>
      </div>

      <!-- Two-Factor Authentication Section -->
      <div class="card settings-section" style="padding:24px;">
        <div class="section-title"><i class="fas fa-shield-halved" style="color:var(--green);font-size:20px;"></i> Two-Factor Authentication</div>
        <div class="settings-row">
          <div class="settings-row-info">
            <div class="label">TOTP Authentication</div>
            <div class="sublabel">Add an extra layer of security using an authenticator app</div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;">
            ${has2FA
              ? `<span class="badge-2fa"><i class="fas fa-check-circle"></i> 2FA Active</span>
                 <button class="settings-btn settings-btn-red" id="btn2FA" onclick="window.__disable2FA()">Disable 2FA</button>`
              : `<button class="settings-btn settings-btn-green" id="btn2FA" onclick="window.__toggle2FA()">Enable 2FA</button>`
            }
          </div>
        </div>
        <div id="settings2FAResult" style="margin-top:12px;"></div>
      </div>

      <!-- Subscription Tier Section -->
      <div class="card settings-section" style="padding:24px;">
        <div class="section-title"><i class="fas fa-crown" style="color:${tierColor};font-size:20px;"></i> Subscription</div>
        <div class="settings-row">
          <div class="settings-row-info">
            <div class="label" style="display:flex;align-items:center;gap:10px;">
              Current Plan
              <span class="tier-badge" style="background:${tierColor}20;color:${tierColor};">${tier}</span>
            </div>
            <div class="sublabel" id="settingsTierLimits">Loading feature limits...</div>
          </div>
          <button class="settings-btn settings-btn-green" onclick="navigateTo('subscription')">
            <i class="fas fa-arrow-up-right-from-square" style="margin-right:6px;"></i>Manage Plan
          </button>
        </div>
      </div>

      <!-- Notification Preferences Section -->
      <div class="card settings-section" style="padding:24px;">
        <div class="section-title"><i class="fas fa-bell" style="color:var(--purple);font-size:20px;"></i> Notification Preferences</div>
        <div style="display:grid;gap:12px;">
          <div class="settings-row">
            <div class="settings-row-info">
              <div class="label">Price Target Alerts</div>
              <div class="sublabel">Get notified when stocks hit your target prices</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" ${notifPrefs.priceTargets ? 'checked' : ''} onchange="window.__toggleNotifPref('priceTargets', this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="settings-row">
            <div class="settings-row-info">
              <div class="label">Order Fill Notifications</div>
              <div class="sublabel">Get notified when your orders are executed</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" ${notifPrefs.orderFills ? 'checked' : ''} onchange="window.__toggleNotifPref('orderFills', this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="settings-row">
            <div class="settings-row-info">
              <div class="label">News & Market Updates</div>
              <div class="sublabel">Receive email alerts for major market news</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" ${notifPrefs.news ? 'checked' : ''} onchange="window.__toggleNotifPref('news', this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>

      <!-- Preferences Section -->
      <div class="card settings-section" style="padding:24px;">
        <div class="section-title"><i class="fas fa-sliders" style="color:var(--gold);font-size:20px;"></i> Preferences</div>
        <div class="settings-row">
          <div class="settings-row-info">
            <div class="label">Analysis Level</div>
            <div class="sublabel">Controls the depth of AI-generated analysis</div>
          </div>
          <select id="settingsLevel" onchange="state.analysisLevel=this.value;localStorage.setItem('jse_level',this.value);" style="background:var(--glass2);border:1px solid var(--border);color:var(--text);padding:8px 14px;border-radius:8px;font-family:inherit;">
            <option value="Beginner" ${state.analysisLevel==='Beginner'?'selected':''}>Beginner</option>
            <option value="Intermediate" ${state.analysisLevel==='Intermediate'?'selected':''}>Intermediate</option>
            <option value="Advanced" ${state.analysisLevel==='Advanced'?'selected':''}>Advanced</option>
          </select>
        </div>
      </div>

      <!-- Logout Button -->
      <div style="text-align:center;padding:8px 0;">
        <button onclick="window.__logoutUser()" style="padding:12px 40px;border-radius:10px;border:1px solid var(--red);background:rgba(255,23,68,0.08);color:var(--red);font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;transition:var(--transition);"
          onmouseenter="this.style.background='rgba(255,23,68,0.15)'" onmouseleave="this.style.background='rgba(255,23,68,0.08)'">
          <i class="fas fa-sign-out-alt" style="margin-right:8px;"></i>Sign Out
        </button>
      </div>
    `;

    // Load subscription feature limits
    loadSettingsTierLimits(tier);
  }

  // ── Settings Helper Functions ────────────────────────────────────────────

  async function loadSettingsTierLimits(tier) {
    const el = $('#settingsTierLimits');
    if (!el) return;
    try {
      const data = await apiFetch('/api/subscription', { headers: { 'Authorization': 'Bearer ' + state.token } });
      const limits = data.limits || {};
      const parts = [];
      if (limits.maxTrades) parts.push(`${limits.maxTrades === -1 ? 'Unlimited' : limits.maxTrades} trades/mo`);
      if (limits.aiChats) parts.push(`${limits.aiChats === -1 ? 'Unlimited' : limits.aiChats} AI chats/day`);
      if (limits.maxAlerts) parts.push(`${limits.maxAlerts === -1 ? 'Unlimited' : limits.maxAlerts} alerts`);
      el.textContent = parts.length ? parts.join(' | ') : `${tier} plan active`;
    } catch (_) {
      el.textContent = `${tier} plan active`;
    }
  }

  window.__saveProfile = async function() {
    const name = $('#settingsName')?.value?.trim();
    if (!name) return showToast('Name cannot be empty', 'error');
    try {
      await apiFetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + state.token },
        body: JSON.stringify({ name })
      });
      state.user.name = name;
      updateUserArea();
      showToast('Profile updated', 'success');
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
  };

  window.__changePasswordInline = async function() {
    const currentPwd = $('#settingsCurrentPwd')?.value;
    const newPwd = $('#settingsNewPwd')?.value;
    const confirmPwd = $('#settingsConfirmPwd')?.value;
    if (!currentPwd) return showToast('Enter your current password', 'error');
    if (!newPwd || newPwd.length < 6) return showToast('New password must be at least 6 characters', 'error');
    if (newPwd !== confirmPwd) return showToast('Passwords do not match', 'error');
    try {
      const email = state.user.email;
      // First request reset token
      const res1 = await apiFetch('/api/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (res1.resetToken) {
        const res2 = await apiFetch('/api/auth/reset-password', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: res1.resetToken, newPassword: newPwd })
        });
        showToast(res2.message || 'Password changed!', 'success');
        $('#settingsCurrentPwd').value = '';
        $('#settingsNewPwd').value = '';
        $('#settingsConfirmPwd').value = '';
      } else {
        showToast('Password reset initiated. Check your email.', 'info');
      }
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
  };

  window.__toggleNotifPref = function(key, value) {
    notifPrefs[key] = value;
    localStorage.setItem('jse_notif_prefs', JSON.stringify(notifPrefs));
    showToast(`${key === 'priceTargets' ? 'Price target alerts' : key === 'orderFills' ? 'Order fill notifications' : 'News alerts'} ${value ? 'enabled' : 'disabled'}`, 'success');
  };

  window.__logoutUser = async function() {
    try {
      await apiFetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + state.token }
      });
    } catch (_) { /* Logout even if API call fails */ }
    state.user = null;
    state.token = null;
    state.portfolio = [];
    localStorage.removeItem('jse_token');
    localStorage.removeItem('jse_notif_prefs');
    updateUserArea();
    renderPortfolio();
    navigateTo('dashboard');
    showToast('Signed out successfully', 'success');
  };

  window.__toggle2FA = async function() {
    if (!state.token) return showToast('Please sign in first', 'error');
    try {
      const data = await apiFetch('/api/auth/2fa/setup', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + state.token }
      });
      if (data.otpauthUrl) {
        const el = $('#settings2FAResult');
        el.innerHTML = `
          <div class="card" style="padding:24px;margin-top:12px;">
            <h4 style="margin-bottom:12px;font-size:15px;font-weight:700;">
              <i class="fas fa-qrcode" style="color:var(--blue);margin-right:8px;"></i>Scan with your authenticator app
            </h4>
            <div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;">
              <div style="background:#fff;padding:16px;border-radius:12px;display:inline-block;">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(data.otpauthUrl)}" alt="QR Code" style="display:block;">
              </div>
              <div style="flex:1;min-width:200px;">
                <p style="font-size:12px;color:var(--muted);margin-bottom:12px;">Or enter this secret manually:</p>
                <code style="display:block;background:var(--glass2);padding:10px 14px;border-radius:8px;font-size:13px;word-break:break-all;margin-bottom:16px;">${data.secret}</code>
                <div class="wallet-form-group" style="margin-bottom:8px;">
                  <label>Verification Code</label>
                  <input type="text" id="verify2FACode" class="settings-input" placeholder="Enter 6-digit code" maxlength="6" style="font-family:'JetBrains Mono',monospace;font-size:18px;letter-spacing:4px;text-align:center;">
                </div>
                <button onclick="window.__confirm2FA()" class="settings-btn settings-btn-green-fill" style="width:100%;padding:12px;">
                  <i class="fas fa-check-circle" style="margin-right:6px;"></i>Verify & Enable 2FA
                </button>
              </div>
            </div>
          </div>`;
      }
    } catch (e) { showToast('Error setting up 2FA: ' + e.message, 'error'); }
  };

  window.__confirm2FA = async function() {
    const code = $('#verify2FACode')?.value;
    if (!code || code.length !== 6) return showToast('Enter a 6-digit code', 'error');
    try {
      const data = await apiFetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + state.token },
        body: JSON.stringify({ token: code })
      });
      showToast(data.message || '2FA enabled successfully!', 'success');
      if (state.user) state.user.twoFactorEnabled = true;
      loadSettingsView(); // Refresh to show active state
    } catch (e) { showToast('Invalid code: ' + e.message, 'error'); }
  };

  window.__disable2FA = async function() {
    const pwd = prompt('Enter your password to disable 2FA:');
    if (!pwd) return;
    const code = prompt('Enter your current 2FA code:');
    if (!code) return;
    try {
      await apiFetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + state.token },
        body: JSON.stringify({ password: pwd, token: code })
      });
      showToast('2FA disabled', 'success');
      if (state.user) state.user.twoFactorEnabled = false;
      loadSettingsView();
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
  };

  window.__verifyEmail = async function() {
    if (!state.token || !state.user) return showToast('Please sign in first', 'error');
    try {
      const data = await apiFetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: state.user.email })
      });
      showToast(data.message || 'Verification email sent! Check your inbox.', 'success');
      if (data.verifyToken) {
        const token = prompt('Dev mode: Enter the verification token (shown in server logs):');
        if (token) {
          const res = await apiFetch('/api/auth/verify-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
          });
          showToast(res.message || 'Email verified!', 'success');
        }
      }
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
  };

  window.__changePassword = async function() {
    if (!state.user) return showToast('Please sign in first', 'error');
    const email = state.user.email;
    try {
      const res1 = await apiFetch('/api/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (res1.resetToken) {
        const newPass = prompt('Enter your new password (min 6 chars):');
        if (newPass && newPass.length >= 6) {
          const res2 = await apiFetch('/api/auth/reset-password', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: res1.resetToken, newPassword: newPass })
          });
          showToast(res2.message || 'Password changed!', 'success');
        }
      } else {
        showToast('Password reset link sent to your email.', 'info');
      }
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // ── Subscription View ──────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════════
  async function loadSubscriptionView() {
    const el = $('#subscriptionContent');
    if (!el) return;
    if (!state.token) {
      el.innerHTML = '<div class="card" style="padding:40px;text-align:center;">Please sign in to view subscription plans.</div>';
      return;
    }

    el.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin" style="font-size:24px;color:var(--blue);"></i></div>';

    try {
      const [plans, current] = await Promise.all([
        apiFetch('/api/subscription/plans'),
        apiFetch('/api/subscription', { headers: { 'Authorization': 'Bearer ' + state.token } })
      ]);

      const currentPlan = current.plan || 'FREE';
      const planList = plans.plans || plans;

      let html = `
        <div class="card" style="padding:24px;">
          <h3 style="font-size:18px;font-weight:700;margin-bottom:8px;">Current Plan: <span style="color:var(--green);">${currentPlan}</span></h3>
          <p style="color:var(--muted);font-size:13px;">Upgrade to unlock more features and higher limits.</p>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px;">`;

      const planColors = { FREE: 'var(--muted)', BASIC: 'var(--blue)', PRO: 'var(--gold)', ENTERPRISE: 'var(--green)' };
      const planPrices = { FREE: '$0', BASIC: '$9.99/mo', PRO: '$29.99/mo', ENTERPRISE: '$99.99/mo' };

      for (const plan of (Array.isArray(planList) ? planList : Object.entries(planList).map(([name, features]) => ({name, features})))) {
        const name = plan.name || plan.plan;
        const features = plan.features || plan.limits || {};
        const isActive = name === currentPlan;
        const color = planColors[name] || 'var(--blue)';

        html += `
          <div style="background:var(--glass);border:${isActive ? '2px' : '1px'} solid ${isActive ? color : 'var(--border)'};border-radius:16px;padding:24px;${isActive ? 'box-shadow:0 0 20px ' + color + '20;' : ''}">
            <div style="font-size:13px;text-transform:uppercase;color:${color};font-weight:700;letter-spacing:1px;margin-bottom:8px;">${name}</div>
            <div style="font-size:28px;font-weight:800;margin-bottom:16px;">${planPrices[name] || '$?'}</div>
            <div style="display:grid;gap:8px;margin-bottom:20px;">`;

        const featureLabels = {
          maxTrades: 'Trades/month', maxWatchlists: 'Watchlists', maxAlerts: 'Price alerts',
          aiChats: 'AI chats/day', usStocks: 'US Stocks', advancedAnalytics: 'Advanced Analytics', mlPredictions: 'ML Predictions'
        };

        for (const [key, label] of Object.entries(featureLabels)) {
          const val = features[key];
          const display = val === -1 || val === 'unlimited' ? 'Unlimited' : typeof val === 'boolean' ? (val ? 'Yes' : 'No') : val;
          const icon = (val === true || val === -1 || val === 'unlimited' || (typeof val === 'number' && val > 0)) ? 'fa-check' : 'fa-xmark';
          const iconColor = icon === 'fa-check' ? 'var(--green)' : 'var(--red)';
          html += `<div style="display:flex;align-items:center;gap:8px;font-size:13px;"><i class="fas ${icon}" style="color:${iconColor};width:16px;"></i> ${display} ${label}</div>`;
        }

        html += `</div>`;
        if (isActive) {
          html += `<button disabled style="width:100%;padding:12px;border-radius:10px;border:1px solid ${color};background:transparent;color:${color};font-weight:700;">Current Plan</button>`;
        } else {
          html += `<button onclick="window.__upgradePlan('${name}')" style="width:100%;padding:12px;border-radius:10px;border:none;background:${color};color:#000;font-weight:700;cursor:pointer;">Upgrade to ${name}</button>`;
        }
        html += `</div>`;
      }

      html += `</div>`;

      if (current.usage) {
        html += `
          <div class="card" style="padding:24px;">
            <h3 style="font-size:16px;font-weight:700;margin-bottom:16px;">Usage This Period</h3>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;">`;
        for (const [key, val] of Object.entries(current.usage)) {
          const limit = current.limits?.[key] || '?';
          html += `
            <div style="background:var(--glass);border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center;">
              <div style="font-size:10px;color:var(--muted);text-transform:uppercase;">${key.replace(/([A-Z])/g, ' $1')}</div>
              <div style="font-size:18px;font-weight:700;margin-top:4px;">${val} <span style="font-size:12px;color:var(--muted);">/ ${limit === -1 ? '∞' : limit}</span></div>
            </div>`;
        }
        html += `</div></div>`;
      }

      el.innerHTML = html;
    } catch (e) {
      el.innerHTML = `<div class="card" style="padding:24px;color:var(--red);">Error loading subscription: ${e.message}</div>`;
    }
  }

  window.__upgradePlan = async function(plan) {
    if (!state.token) return alert('Please sign in first');
    if (!confirm(`Upgrade to ${plan}? (Payment integration coming soon — this will activate a trial.)`)) return;
    try {
      const res = await apiFetch('/api/subscription/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + state.token },
        body: JSON.stringify({ plan })
      });
      alert(res.message || `Upgraded to ${plan}!`);
      loadSubscriptionView();
    } catch (e) { alert('Error: ' + e.message); }
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // ── Wallet / Deposit-Withdrawal System ─────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════════

  let walletModalTab = 'deposit';

  // Open wallet modal from header deposit button or nav
  $('#walletDepositBtn')?.addEventListener('click', () => {
    openWalletModal('deposit');
  });

  function openWalletModal(tab = 'deposit') {
    walletModalTab = tab;
    const modal = $('#walletModal');
    if (modal) {
      modal.classList.add('show');
      window.__switchWalletTab(tab);
      loadWalletModalData();
    }
  }
  window.openWalletModal = openWalletModal;

  // Close wallet modal on overlay click
  $('#walletModal')?.addEventListener('click', (e) => {
    if (e.target === $('#walletModal')) $('#walletModal').classList.remove('show');
  });

  window.__switchWalletTab = function(tab) {
    walletModalTab = tab;
    const depTab = $('#wmDepositTab');
    const witTab = $('#wmWithdrawTab');
    const depForm = $('#wmDepositForm');
    const witForm = $('#wmWithdrawForm');

    if (tab === 'deposit') {
      depTab.className = 'wallet-tab-btn active-deposit';
      witTab.className = 'wallet-tab-btn';
      depForm.style.display = 'block';
      witForm.style.display = 'none';
    } else {
      depTab.className = 'wallet-tab-btn';
      witTab.className = 'wallet-tab-btn active-withdraw';
      depForm.style.display = 'none';
      witForm.style.display = 'block';
    }
  };

  async function loadWalletModalData() {
    if (!state.token) return;
    try {
      const data = await apiFetch('/api/wallet/balance');
      if (data.wallets) {
        const jmd = data.wallets.find(w => w.currency === 'JMD');
        const usd = data.wallets.find(w => w.currency === 'USD');
        if (jmd) {
          $('#wmJMDBalance').textContent = `J$${fmt(jmd.balance)}`;
          $('#wmJMDHeld').textContent = `Available: J$${fmt(jmd.available || jmd.balance)}`;
        }
        if (usd) {
          $('#wmUSDBalance').textContent = `$${fmt(usd.balance)}`;
          $('#wmUSDHeld').textContent = `Available: $${fmt(usd.available || usd.balance)}`;
        }
      }
    } catch (_) {}

    // Load transaction history
    loadWalletTxHistory();
  }

  async function loadWalletTxHistory() {
    const el = $('#wmTxHistory');
    if (!el || !state.token) return;
    try {
      const data = await apiFetch('/api/portfolio/history');
      const txns = data.history || data.transactions || data || [];
      if (!Array.isArray(txns) || txns.length === 0) {
        el.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:20px;text-align:center;"><i class="fas fa-receipt" style="display:block;font-size:24px;margin-bottom:8px;opacity:0.3;"></i>No transactions yet</p>';
        return;
      }
      el.innerHTML = `
        <table class="wallet-tx-table">
          <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
            ${txns.slice(0, 20).map(tx => {
              const date = tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '--';
              const type = (tx.type || tx.side || 'TRADE').toUpperCase();
              const typeClass = type === 'DEPOSIT' ? 'deposit' : type === 'WITHDRAWAL' ? 'withdrawal' : 'trade';
              const amount = tx.amount || tx.total || (tx.quantity && tx.price ? tx.quantity * tx.price : 0);
              const cur = tx.currency || 'JMD';
              const prefix = cur === 'JMD' ? 'J$' : '$';
              const sign = type === 'WITHDRAWAL' || type === 'SELL' ? '-' : '+';
              const signColor = sign === '+' ? 'var(--green)' : 'var(--red)';
              const status = (tx.status || 'COMPLETED').toUpperCase();
              const statusClass = status === 'COMPLETED' || status === 'FILLED' ? 'completed' : status === 'PENDING' ? 'pending' : 'failed';
              return `<tr>
                <td style="color:var(--muted);font-size:12px;">${date}</td>
                <td><span class="tx-type-badge ${typeClass}">${type}</span></td>
                <td style="font-family:'JetBrains Mono',monospace;color:${signColor};font-weight:600;">${sign}${prefix}${fmt(Math.abs(amount))}</td>
                <td><span class="tx-status-badge ${statusClass}">${status}</span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>`;
    } catch (_) {
      el.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:20px;text-align:center;">Could not load transactions</p>';
    }
  }

  window.__walletDeposit = async function() {
    const amount = parseFloat($('#wmDepositAmount')?.value);
    const currency = $('#wmDepositCurrency')?.value || 'JMD';
    if (!amount || amount <= 0) return showToast('Enter a valid amount', 'error');
    if (!state.token) return showToast('Please sign in first', 'error');

    const btn = $('#wmDepositSubmit');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    try {
      const data = await apiFetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + state.token },
        body: JSON.stringify({ amount, currency })
      });
      showToast(data.message || `Deposited ${currency === 'JMD' ? 'J$' : '$'}${fmt(amount)} ${currency}`, 'success');
      $('#wmDepositAmount').value = '';
      loadWalletModalData();
      loadWalletBalance(); // Update header
    } catch (e) {
      showToast('Deposit failed: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-arrow-down" style="margin-right:6px;"></i>Deposit Funds';
    }
  };

  window.__walletWithdraw = async function() {
    const amount = parseFloat($('#wmWithdrawAmount')?.value);
    const currency = $('#wmWithdrawCurrency')?.value || 'JMD';
    if (!amount || amount <= 0) return showToast('Enter a valid amount', 'error');
    if (!state.token) return showToast('Please sign in first', 'error');

    const btn = $('#wmWithdrawSubmit');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    try {
      const data = await apiFetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + state.token },
        body: JSON.stringify({ amount, currency })
      });
      showToast(data.message || `Withdrew ${currency === 'JMD' ? 'J$' : '$'}${fmt(amount)} ${currency}`, 'success');
      $('#wmWithdrawAmount').value = '';
      loadWalletModalData();
      loadWalletBalance(); // Update header
    } catch (e) {
      showToast('Withdrawal failed: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-arrow-up" style="margin-right:6px;"></i>Withdraw Funds';
    }
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // ── Enhanced Notification Bell System ──────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════════

  let serverNotifications = [];
  let serverNotifsLoaded = false;

  async function loadServerNotifications() {
    if (!state.token) return;
    try {
      const data = await apiFetch('/api/notifications');
      serverNotifications = data.notifications || data || [];
      serverNotifsLoaded = true;
      mergeAndRenderNotifications();
    } catch (_) {
      // API may not exist yet; fall back to local-only notifications
      serverNotifsLoaded = false;
    }
  }

  function mergeAndRenderNotifications() {
    // Merge server notifications with local market-move notifications
    const allNotifs = [];

    // Add server notifications first
    if (serverNotifsLoaded && Array.isArray(serverNotifications)) {
      serverNotifications.forEach(n => {
        allNotifs.push({
          id: n._id || n.id || Date.now() + Math.random(),
          type: n.type || 'info',
          icon: n.type === 'price_alert' ? 'fa-bullseye' : n.type === 'order_fill' ? 'fa-check-circle' : 'fa-info-circle',
          color: n.type === 'price_alert' ? 'var(--gold)' : n.type === 'order_fill' ? 'var(--green)' : 'var(--blue)',
          title: n.title || n.message || 'Notification',
          detail: n.body || n.detail || '',
          time: n.createdAt ? new Date(n.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '',
          symbol: n.symbol || '',
          read: n.read || false,
          isServer: true,
          serverId: n._id || n.id,
        });
      });
    }

    // Add local market notifications
    notifications.forEach(n => {
      allNotifs.push({ ...n, read: true, isServer: false });
    });

    renderEnhancedNotifications(allNotifs);
    updateNotifBadgeCount(allNotifs);
  }

  function renderEnhancedNotifications(allNotifs) {
    const list = $('#notifList');
    if (!list) return;

    if (!allNotifs.length) {
      list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted);font-size:13px;"><i class="fas fa-bell-slash" style="font-size:28px;display:block;margin-bottom:10px;opacity:0.3;"></i>No notifications yet</div>';
      return;
    }

    list.innerHTML = allNotifs.slice(0, 30).map(n => `
      <div class="notif-item-enhanced ${!n.read ? 'unread' : ''}" data-symbol="${n.symbol || ''}" data-id="${n.serverId || ''}">
        <div class="notif-icon-wrap" style="background:${n.color}15;">
          <i class="fas ${n.icon}" style="color:${n.color};font-size:13px;"></i>
        </div>
        <div class="notif-body">
          <div class="notif-title">${escHtml(n.title)}</div>
          ${n.detail ? `<div class="notif-detail">${escHtml(n.detail)}</div>` : ''}
          <div class="notif-time">${escHtml(n.time)}</div>
        </div>
        ${!n.read ? '<div class="notif-unread-dot"></div>' : ''}
      </div>
    `).join('');

    // Click handlers
    list.querySelectorAll('.notif-item-enhanced').forEach(item => {
      item.addEventListener('click', async () => {
        const sym = item.dataset.symbol;
        const id = item.dataset.id;

        // Mark as read if server notification
        if (id && state.token) {
          try {
            await apiFetch(`/api/notifications/${id}/read`, {
              method: 'PUT',
              headers: { 'Authorization': 'Bearer ' + state.token }
            });
            item.classList.remove('unread');
            const dot = item.querySelector('.notif-unread-dot');
            if (dot) dot.remove();
          } catch (_) {}
        }

        if (sym) {
          openStockDetail(sym);
          $('#notifPanel').style.display = 'none';
          $('#notifPanel').classList.remove('show');
        }
      });
    });
  }

  function updateNotifBadgeCount(allNotifs) {
    const unreadCount = allNotifs ? allNotifs.filter(n => !n.read).length : 0;
    const badge = $('#notifCountBadge');
    const dot = $('#notifBtn .notif-dot');

    if (badge) {
      if (unreadCount > 0) {
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }
    if (dot) dot.style.display = unreadCount > 0 || notifications.length > 0 ? 'block' : 'none';
  }

  // Override the existing notification rendering to use the enhanced version
  const origRenderNotifications = renderNotifications;
  renderNotifications = function() {
    mergeAndRenderNotifications();
  };

  const origUpdateNotifDot = updateNotifDot;
  updateNotifDot = function() {
    mergeAndRenderNotifications();
  };

  // Enhanced notif panel toggle
  $('#notifBtn')?.removeEventListener?.('click', () => {});
  // Re-bind
  const notifBtnEl = $('#notifBtn');
  if (notifBtnEl) {
    const newBtn = notifBtnEl.cloneNode(true);
    notifBtnEl.parentNode.replaceChild(newBtn, notifBtnEl);
    newBtn.addEventListener('click', () => {
      const panel = $('#notifPanel');
      const isOpen = panel.classList.contains('show');
      if (isOpen) {
        panel.classList.remove('show');
      } else {
        panel.classList.add('show');
        // Load server notifications on open
        if (state.token) loadServerNotifications();
      }
    });
  }

  // Mark all read
  $('#markAllReadBtn')?.addEventListener('click', async () => {
    if (state.token) {
      try {
        // Try to mark all as read on server
        await apiFetch('/api/notifications/read-all', {
          method: 'PUT',
          headers: { 'Authorization': 'Bearer ' + state.token }
        });
      } catch (_) {
        // Fall back: mark local as read
      }
    }
    serverNotifications.forEach(n => n.read = true);
    notifications = [];
    mergeAndRenderNotifications();
    showToast('All notifications marked as read', 'success');
  });

  // Clear all notifications
  const clearBtnEl = $('#clearNotifsBtn');
  if (clearBtnEl) {
    const newClearBtn = clearBtnEl.cloneNode(true);
    clearBtnEl.parentNode.replaceChild(newClearBtn, clearBtnEl);
    newClearBtn.addEventListener('click', () => {
      notifications = [];
      serverNotifications = [];
      mergeAndRenderNotifications();
    });
  }

  // Close notif panel on outside click (re-bind for enhanced panel)
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#notifPanel') && !e.target.closest('#notifBtn')) {
      const panel = $('#notifPanel');
      if (panel) panel.classList.remove('show');
    }
  });

  // Load server notifications on boot if logged in
  if (state.token) {
    setTimeout(loadServerNotifications, 1000);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // ── Admin Dashboard View ───────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════════
  async function loadAdminDashboard() {
    const el = $('#adminContent');
    if (!el) return;
    if (!state.token) {
      el.innerHTML = '<div class="card" style="padding:40px;text-align:center;">Admin access required.</div>';
      return;
    }

    el.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin" style="font-size:24px;color:var(--blue);"></i> Loading admin data...</div>';

    try {
      const data = await apiFetch('/api/admin/dashboard', {
        headers: { 'Authorization': 'Bearer ' + state.token }
      });

      if (data.error) {
        el.innerHTML = `<div class="card" style="padding:24px;color:var(--red);">${data.error}</div>`;
        return;
      }

      const m = data.metrics;
      let html = `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;">
          <div class="card" style="padding:20px;text-align:center;">
            <div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Total Users</div>
            <div style="font-size:28px;font-weight:800;color:var(--blue);margin-top:4px;">${m.totalUsers}</div>
            <div style="font-size:11px;color:var(--green);">+${m.newUsersToday} today</div>
          </div>
          <div class="card" style="padding:20px;text-align:center;">
            <div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Total Orders</div>
            <div style="font-size:28px;font-weight:800;color:var(--green);margin-top:4px;">${m.totalOrders}</div>
            <div style="font-size:11px;color:var(--green);">+${m.ordersToday} today</div>
          </div>
          <div class="card" style="padding:20px;text-align:center;">
            <div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Active Subs</div>
            <div style="font-size:28px;font-weight:800;color:var(--gold);margin-top:4px;">${m.activeSubscriptions}</div>
          </div>
          <div class="card" style="padding:20px;text-align:center;">
            <div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Active Alerts</div>
            <div style="font-size:28px;font-weight:800;color:var(--red);margin-top:4px;">${m.totalAlerts}</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div class="card" style="padding:24px;">
            <h3 style="font-size:16px;font-weight:700;margin-bottom:16px;">Recent Users</h3>
            <div style="display:grid;gap:8px;">
              ${(data.recentUsers || []).map(u => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:var(--glass);border-radius:8px;font-size:13px;">
                  <div>
                    <div style="font-weight:600;">${escHtml(u.name)}</div>
                    <div style="color:var(--muted);font-size:11px;">${escHtml(u.email)}</div>
                  </div>
                  <div style="text-align:right;">
                    <div style="font-size:10px;color:${u.isActive ? 'var(--green)' : 'var(--red)'};">${u.isActive ? 'Active' : 'Inactive'}</div>
                    <div style="font-size:10px;color:var(--muted);">${u.kycStatus}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="card" style="padding:24px;">
            <h3 style="font-size:16px;font-weight:700;margin-bottom:16px;">Recent Orders</h3>
            <div style="display:grid;gap:8px;">
              ${(data.recentOrders || []).map(o => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:var(--glass);border-radius:8px;font-size:13px;">
                  <div>
                    <span style="font-weight:700;color:${o.side === 'BUY' ? 'var(--green)' : 'var(--red)'};">${o.side}</span>
                    <span style="font-weight:600;margin-left:6px;">${escHtml(o.symbol)}</span>
                    <span style="color:var(--muted);margin-left:6px;">x${o.quantity}</span>
                  </div>
                  <span style="font-size:11px;padding:3px 8px;border-radius:6px;background:${o.status === 'FILLED' ? 'rgba(0,200,83,0.15)' : 'rgba(255,214,0,0.15)'};color:${o.status === 'FILLED' ? 'var(--green)' : 'var(--gold)'};">${o.status}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>`;

      el.innerHTML = html;
    } catch (e) {
      el.innerHTML = `<div class="card" style="padding:24px;color:var(--red);">Admin access denied or error: ${e.message}</div>`;
    }
  }

  // Show admin nav item if user email is admin
  function checkAdminAccess() {
    const adminNav = $('#adminNavItem');
    if (adminNav && state.user) {
      // Try loading admin dashboard — if it returns 403, hide the nav item
      apiFetch('/api/admin/dashboard', { headers: { 'Authorization': 'Bearer ' + state.token } })
        .then(data => { if (!data.error || data.metrics) adminNav.style.display = ''; })
        .catch(() => { adminNav.style.display = 'none'; });
    }
  }

  // Check admin access on login
  const origUpdateUserArea = updateUserArea;
  updateUserArea = function() {
    origUpdateUserArea();
    if (state.user) setTimeout(checkAdminAccess, 500);
  };

  boot();

})();

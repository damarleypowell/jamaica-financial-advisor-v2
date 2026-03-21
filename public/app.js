// ══════════════════════════════════════════════════════════════════════════════
// JSE Live — Complete Frontend Application (Debug Pass)
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
    analysisLevel: 'Beginner',
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
  };

  function navigateTo(view) {
    state.currentView = view;
    $$('.view').forEach(v => v.classList.remove('active'));
    const target = $(`#view-${view}`);
    if (target) target.classList.add('active');

    $$('.nav-item').forEach(n => n.classList.remove('active'));
    const navItem = $(`.nav-item[data-view="${view}"]`);
    if (navItem) navItem.classList.add('active');

    const [title, subtitle] = viewTitles[view] || ['JSE Live', ''];
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
          <div class="user-avatar">${initials}</div>
          <span class="user-name">${state.user.name}</span>
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
      const data = res.history || res;
      if (data && data.length) {
        const now = Math.floor(Date.now() / 1000);
        const chartData = data.map((price, i) => ({
          time: now - (data.length - i) * 120,
          value: price,
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

  function selectStock(symbol) {
    state.selectedSymbol = symbol;
    loadChartData();
    updateChartPrice();
    const analysisInput = $('#analysisSymbol');
    if (analysisInput) analysisInput.value = symbol;
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
    } catch (e) {
      loading.querySelector('.msg-content').innerHTML = `<span style="color:var(--red);">Error: ${e.message}</span>`;
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

      if (data.structured && data.analysis && typeof data.analysis === 'object') {
        resultEl.innerHTML = renderStructuredAnalysis(data.analysis, state.analysisLevel);
      } else if (data.analysis) {
        const text = typeof data.analysis === 'string' ? data.analysis : JSON.stringify(data.analysis, null, 2);
        resultEl.innerHTML = `<div style="white-space:pre-wrap;line-height:1.7;font-size:14px;">${formatMarkdown(text)}</div>`;
      } else {
        resultEl.innerHTML = '<p class="text-muted">No analysis returned.</p>';
      }

      // Load technical chart with price history
      try {
        const histRes = await apiFetch(`/api/history/${symbol}`);
        const hist = histRes.history || histRes;
        if (hist && hist.length) renderTechnicalChart(hist);
      } catch (_) {}

    } catch (e) {
      resultEl.innerHTML = `<p style="color:var(--red);padding:20px;">Error: ${e.message}</p>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-bolt"></i> Analyze';
    }
  });

  function renderStructuredAnalysis(a, level) {
    const recColor = a.recommendation === 'BUY' ? 'var(--green)' : a.recommendation === 'SELL' ? 'var(--red)' : 'var(--blue)';
    const riskWidth = ((a.riskScore || 5) / 10 * 100);
    const riskColor = a.riskScore <= 3 ? 'var(--green)' : a.riskScore <= 6 ? 'var(--gold)' : 'var(--red)';

    let html = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
        <div>
          <h3 style="font-size:20px;font-weight:700;">${a.company || ''}</h3>
          <p style="color:var(--muted);font-size:13px;margin-top:4px;">${level} Analysis</p>
        </div>
        <div style="padding:8px 20px;border-radius:8px;font-size:18px;font-weight:800;color:${recColor};border:2px solid ${recColor};background:${recColor}15;">
          ${a.recommendation || 'N/A'}
        </div>
      </div>

      <p style="font-size:14px;line-height:1.7;margin-bottom:20px;color:var(--text2);">${a.overview || ''}</p>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
        <div style="background:var(--glass);border:1px solid var(--border);border-radius:10px;padding:16px;">
          <h4 style="font-size:12px;color:var(--muted);text-transform:uppercase;margin-bottom:10px;">Key Points</h4>
          ${(a.keyPoints || []).map(p => `<div style="padding:4px 0;font-size:13px;display:flex;gap:8px;"><span style="color:var(--green);">•</span> ${p}</div>`).join('')}
        </div>
        <div style="background:var(--glass);border:1px solid var(--border);border-radius:10px;padding:16px;">
          <h4 style="font-size:12px;color:var(--muted);text-transform:uppercase;margin-bottom:10px;">Risks</h4>
          ${(a.risks || []).map(r => `<div style="padding:4px 0;font-size:13px;display:flex;gap:8px;"><span style="color:var(--red);">⚠</span> ${r}</div>`).join('')}
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
        <p style="font-size:14px;line-height:1.6;font-weight:500;">${a.verdict || ''}</p>
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
          ${a.catalysts.map(c => `<div style="padding:4px 0;font-size:13px;">🔥 ${c}</div>`).join('')}
        </div>`;
    }

    return html;
  }

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

      if (data.structured && data.plan && typeof data.plan === 'object') {
        body.innerHTML = renderFinancialPlan(data.plan);
      } else if (data.plan) {
        const text = typeof data.plan === 'string' ? data.plan : JSON.stringify(data.plan, null, 2);
        body.innerHTML = `<div style="white-space:pre-wrap;line-height:1.7;font-size:14px;">${formatMarkdown(text)}</div>`;
      }
    } catch (e) {
      body.innerHTML = `<p style="color:var(--red);">Error: ${e.message}</p>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-magic"></i> Generate AI Financial Plan';
    }
  });

  function renderFinancialPlan(plan) {
    let html = `
      <h3 style="font-size:18px;font-weight:700;margin-bottom:4px;">${plan.planName || 'Your Investment Plan'}</h3>
      <p style="color:var(--muted);font-size:13px;margin-bottom:16px;">${plan.riskLevel || ''} Strategy</p>
      <p style="font-size:14px;line-height:1.7;margin-bottom:20px;">${plan.summary || ''}</p>`;

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
            <span style="font-weight:700;">${a.symbol}</span>
            <span style="color:var(--muted);font-size:12px;margin-left:8px;">${a.name || ''}</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px;">
            <span style="font-weight:700;color:var(--gold);">${a.weight}%</span>
          </div>
        </div>
        <div style="font-size:12px;color:var(--muted);margin:-4px 0 10px 14px;">${a.reasoning || ''}</div>
      `).join('');
    }

    if (plan.actionItems?.length) {
      html += `<h4 style="font-size:14px;font-weight:600;margin:16px 0 10px;">Action Items</h4>`;
      html += plan.actionItems.map((item, i) => `
        <div style="display:flex;gap:10px;padding:8px 0;font-size:13px;">
          <span style="background:var(--green);color:#000;font-weight:700;font-size:11px;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i + 1}</span>
          <span>${item}</span>
        </div>
      `).join('');
    }

    if (plan.monthlyStrategy) {
      html += `<div style="margin-top:16px;background:var(--glass);border:1px solid var(--border);border-radius:10px;padding:16px;"><h4 style="font-size:12px;color:var(--muted);text-transform:uppercase;margin-bottom:6px;">Monthly Strategy</h4><p style="font-size:13px;line-height:1.6;">${plan.monthlyStrategy}</p></div>`;
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

      if (data.decisions && Array.isArray(data.decisions)) {
        decisions.innerHTML = data.decisions.map(d => `
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
      } else if (typeof data.decisions === 'string') {
        decisions.innerHTML = `<div style="white-space:pre-wrap;line-height:1.6;font-size:13px;">${formatMarkdown(data.decisions)}</div>`;
      }

      if (data.summary) {
        summary.innerHTML = formatMarkdown(typeof data.summary === 'string' ? data.summary : JSON.stringify(data.summary));
      }
    } catch (e) {
      decisions.innerHTML = `<p style="color:var(--red);">Error: ${e.message}</p>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-magic"></i> AI Auto-Tune';
    }
  });

  // ── Stock Screener ─────────────────────────────────────────────────────────
  $('#screenerBtn')?.addEventListener('click', async () => {
    const params = {
      sector: $('#screenerSector')?.value || undefined,
      minPE: parseFloat($('#screenerMinPE')?.value) || undefined,
      maxPE: parseFloat($('#screenerMaxPE')?.value) || undefined,
      minDividend: parseFloat($('#screenerMinDiv')?.value) || undefined,
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

      grid.innerHTML = data.map(n => {
        const sentCls = n.sentiment === 'positive' ? 'positive' : n.sentiment === 'negative' ? 'negative' : 'neutral';
        return `<div class="news-card">
          <span class="news-sentiment ${sentCls}">${n.sentiment || 'neutral'}</span>
          <h4>${formatMarkdown(n.title || n.headline || '')}</h4>
          <p>${n.summary || n.sector || ''}</p>
          <div class="news-meta">
            ${n.source ? `<span><i class="fas fa-newspaper"></i> ${n.source}</span>` : ''}
            ${n.time || n.date ? `<span><i class="fas fa-clock"></i> ${n.time || n.date}</span>` : ''}
            ${n.symbol ? `<span style="color:var(--green);cursor:pointer;" onclick="window.jseApp.selectStock('${n.symbol}')">${n.symbol}</span>` : ''}
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

  // ── Voice Input ────────────────────────────────────────────────────────────
  const voiceMic = $('#voiceMic');
  let recognition = null;

  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (e) => {
      const text = e.results[0][0].transcript;
      if (state.currentView === 'chat' && chatInput) {
        chatInput.value = text;
        sendChatMessage();
      } else if (state.currentView === 'analysis') {
        const input = $('#analysisSymbol');
        if (input) input.value = text.toUpperCase().replace(/\s/g, '');
      } else {
        // Default: put in search
        if (searchInput) {
          searchInput.value = text;
          searchInput.dispatchEvent(new Event('input'));
        }
      }
      voiceMic.style.background = 'linear-gradient(135deg, var(--green), var(--green2))';
    };

    recognition.onerror = () => {
      voiceMic.style.background = 'linear-gradient(135deg, var(--green), var(--green2))';
    };

    recognition.onend = () => {
      voiceMic.style.background = 'linear-gradient(135deg, var(--green), var(--green2))';
    };
  }

  voiceMic?.addEventListener('click', () => {
    if (!recognition) { alert('Speech recognition not supported in this browser'); return; }
    voiceMic.style.background = 'linear-gradient(135deg, var(--red), #d50000)';
    recognition.start();
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

  boot();

})();

// ─── chart-builder.js ────────────────────────────────────────────────────────
// Schema reference:
//   user        (email PK, password, user_id AUTO_INCREMENT UNIQUE)
//   events      (event_id PK, type, description, event_datetime, location, created_by FK→user.user_id)
//   registration(reg_id PK, user_id FK, event_id FK, reg_at DATETIME)   ← primary RSVP table
//   rsvp        (separate rsvp table — same pattern)
//   reminders   (reminder table)

const API = '/api';

let popup, popupBorder, popupIcon, popupMessage, popupButtons;
 
 
function showPopup(type, message) {
  popupBorder.className     = `popup-top-border ${type}`;
  popupIcon.textContent     = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
  popupMessage.textContent  = message;
  popupButtons.innerHTML    = '';
  popup.classList.remove('hidden');
  setTimeout(() => popup.classList.add('hidden'), 3500);
}
 
function showConfirm(message) {
  return new Promise(resolve => {
    popupBorder.className    = 'popup-top-border confirm';
    popupIcon.textContent    = '⚠️';
    popupMessage.textContent = message;
    popupButtons.innerHTML   = '';
 
    const yes = document.createElement('button');
    yes.textContent = 'Confirm'; yes.className = 'popup-btn-ok';
    const no  = document.createElement('button');
    no.textContent  = 'Cancel';  no.className  = 'popup-btn-cancel';
 
    yes.addEventListener('click', () => { popup.classList.add('hidden'); resolve(true);  });
    no.addEventListener ('click', () => { popup.classList.add('hidden'); resolve(false); });
 
    popupButtons.appendChild(yes);
    popupButtons.appendChild(no);
    popup.classList.remove('hidden');
  });
}
 
function showTestResults(results) {
  popupBorder.className  = 'popup-top-border info';
  popupIcon.textContent  = '🧪';
 
  const passed = results.filter(r => r.pass).length;
  const total  = results.length;
  const allOk  = passed === total;
 
  let listHTML = `<strong style="color:${allOk ? '#1e7e34' : '#c0392b'}">${passed}/${total} tests passed</strong>
<ul class="test-results-list" style="margin-top:10px;">`;
  results.forEach(r => {
    listHTML += `<li class="${r.pass ? 'pass' : 'fail'}">
      <span>${r.pass ? '✅' : '❌'}</span>
      <span>${r.name}${r.error ? `<br><small style="opacity:.7;font-size:11px;">${r.error}</small>` : ''}</span>
    </li>`;
  });
  listHTML += '</ul>';
 
  popupMessage.innerHTML = listHTML;
  popupButtons.innerHTML = '';
  const ok = document.createElement('button');
  ok.textContent = 'OK'; ok.className = 'popup-btn-ok';
  ok.addEventListener('click', () => popup.classList.add('hidden'));
  popupButtons.appendChild(ok);
  popup.classList.remove('hidden');
}
 
// ─── BACKEND STATUS ───────────────────────────────────────────────────────────
async function checkBackendStatus() {
  const dot  = document.getElementById('backendDot');
  const text = document.getElementById('backendStatusText');
  try {
    const res = await fetch(`${API}/health`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) { dot.className = 'dot online'; text.textContent = 'Backend Online'; }
    else throw new Error();
  } catch {
    dot.className = 'dot offline'; text.textContent = 'Backend Offline';
  }
}
 
// ─── STAT CARDS ──────────────────────────────────────────────────────────────
async function loadStatCards() {
  try {
    // Fetch all stats in parallel
    const [eventsRes, rsvpRes, usersRes] = await Promise.all([
      fetch(`${API}/events`),
      fetch(`${API}/rsvp-count`),          // existing endpoint
      fetch(`${API}/admin/stats/users`),   // new endpoint (see routes file)
    ]);
 
    // ── Events ──
    if (eventsRes.ok) {
      const events   = await eventsRes.json();
      const now      = new Date();
      const upcoming = events.filter(e => new Date(e.event_datetime) >= now).length;
      const past     = events.filter(e => new Date(e.event_datetime) <  now).length;
      setStatVal('stat-event-total',    events.length);
      setStatVal('stat-event-upcoming', upcoming);
      setStatVal('stat-event-past',     past);
    }
 
    // ── RSVPs ──
    if (rsvpRes.ok) {
      const rsvpData   = await rsvpRes.json();
      const totalRsvps = rsvpData.reduce((sum, r) => sum + Number(r.rsvp_count || 0), 0);
      const uniqueEvts = rsvpData.length;
      setStatVal('stat-rsvp-total',  totalRsvps);
      setStatVal('stat-rsvp-unique', uniqueEvts);
      // Today — try dedicated endpoint
      try {
        const todayRes  = await fetch(`${API}/admin/stats/rsvp-today`);
        const todayData = await todayRes.json();
        setStatVal('stat-rsvp-today', todayData.count ?? '—');
      } catch { setStatVal('stat-rsvp-today', '—'); }
    }
 
    // ── Users ──
    if (usersRes.ok) {
      const uData = await usersRes.json();
      setStatVal('stat-user-total',  uData.total   ?? '—');
      setStatVal('stat-user-new',    uData.new30d  ?? '—');
      setStatVal('stat-user-active', uData.withRsvp ?? '—');
    }
 
  } catch (err) {
    console.warn('Stat cards: using placeholders —', err.message);
    // Show dashes so the cards still look clean
    ['stat-rsvp-total','stat-rsvp-today','stat-rsvp-unique',
     'stat-event-total','stat-event-upcoming','stat-event-past',
     'stat-user-total','stat-user-new','stat-user-active'].forEach(id => setStatVal(id, '—'));
  }
}
 
function setStatVal(id, val) {
  const el = document.getElementById(id);
  if (el) { el.textContent = val; el.classList.remove('loading'); }
}
 
// ─── BACKEND TESTS ────────────────────────────────────────────────────────────
const TEST_DEFS = {
  'backend': {
    name: 'Backend Online',
    run: async () => {
      const r = await fetch(`${API}/health`, { signal: AbortSignal.timeout(4000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    }
  },
  'events-fetch': {
    name: 'Fetch Events',
    run: async () => {
      const r = await fetch(`${API}/events`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (!Array.isArray(d)) throw new Error('Expected array of events');
    }
  },
  'event-create': {
    name: 'Create Event',
    run: async () => {
      const token = localStorage.getItem('jwtToken');
      if (!token) throw new Error('No JWT — must be logged in');
      const fd = new FormData();
      fd.append('description',    '[DIAG TEST] Auto-created');
      fd.append('type',           'Academic');
      fd.append('event_datetime', '2099-06-15T12:00');
      fd.append('location',       'Diagnostics Lab');
      fd.append('tags',           'test');
      const r = await fetch(`${API}/events`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      window._diagEventId = d.event_id || d.id || null;
    }
  },
  'event-delete': {
    name: 'Delete Test Event',
    run: async () => {
      const token = localStorage.getItem('jwtToken');
      if (!token) throw new Error('No JWT — must be logged in');
      const id = window._diagEventId;
      if (!id)   throw new Error('Run "Create Event" first to get a test ID');
      const r = await fetch(`${API}/events/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      window._diagEventId = null;
    }
  },
  'rsvp': {
    name: 'RSVP System',
    run: async () => {
      // Tests the registration/rsvp-count endpoint that reads from `registration` table
      const r = await fetch(`${API}/rsvp-count`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (!Array.isArray(d)) throw new Error('Expected RSVP count array');
    }
  },
  'charts-db': {
    name: 'Charts DB Table',
    run: async () => {
      const r = await fetch(`${API}/saved-charts`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (!d.charts) throw new Error('Missing "charts" key — table may not exist');
    }
  }
};
 
async function runTest(key) {
  const def = TEST_DEFS[key];
  const btn = document.getElementById(`test-${key}`);
  const sta = document.getElementById(`status-${key}`);
  if (!def || !btn) return { name: key, pass: false, error: 'Unknown test' };
 
  btn.classList.remove('pass','fail');
  btn.classList.add('running');
  sta.textContent = 'Running…';
 
  try {
    await def.run();
    btn.classList.remove('running'); btn.classList.add('pass');
    sta.textContent = 'PASS ✓';
    return { name: def.name, pass: true };
  } catch(err) {
    btn.classList.remove('running'); btn.classList.add('fail');
    sta.textContent = 'FAIL ✗';
    return { name: def.name, pass: false, error: err.message };
  }
}
 
async function runAllTests() {
  const results = [];
  for (const key of Object.keys(TEST_DEFS)) {
    results.push(await runTest(key));
  }
  showTestResults(results);
}
 
// ─── CHART STATE ──────────────────────────────────────────────────────────────
let currentChartType = 'bar';
let chartInstance    = null;
let currentChartData = null;
let savedCharts      = [];
let draggedId        = null;
 
const PALETTE = [
  'rgba(140,29,64,.85)','rgba(255,198,39,.85)',
  'rgba(0,100,164,.85)','rgba(40,167,69,.85)',
  'rgba(231,76,60,.85)','rgba(52,152,219,.85)',
  'rgba(155,89,182,.85)','rgba(26,188,156,.85)',
];
 
// Tables that belong to each data category (matches your actual schema)
const CATEGORY_TABLES = {
  rsvp:  ['registration'],
  event: ['events'],
  user:  ['user'],
};

// Which tables can be joined with each primary table
const JOIN_OPTIONS = {
  registration:   ['events', 'user'],
  events:         ['registration', 'user', 'user_reminders'],
  user:           ['registration', 'events', 'user_reminders'],
  user_reminders: ['events', 'user'],
};
 
// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  popup        = document.getElementById('customPopup');
  popupBorder  = document.getElementById('popupBorder');
  popupIcon    = document.getElementById('popupIcon');
  popupMessage = document.getElementById('popupMessage');
  popupButtons = document.getElementById('popupButtons');
  await checkBackendStatus();
  loadStatCards();
  await loadAllSavedCharts();
  renderAllZones();

  // Close save modal when clicking outside
  const saveModal = document.getElementById('saveModal');
  if (saveModal) saveModal.addEventListener('click', function(e) {
    if (e.target === this) closeSaveModal();
  });
});
 
// ─── CATEGORY CHANGE ──────────────────────────────────────────────────────────
function onCategoryChange() {
  const cat = document.getElementById('dataCategory').value;
  const sel = document.getElementById('tableSelect');
  sel.innerHTML = '<option value="">— select table —</option>';

  // Reset join table
  document.getElementById('joinTableField').style.display = 'none';
  document.getElementById('joinTableSelect').innerHTML = '<option value="">— none —</option>';
  populateAxisSelects([]);

  if (!cat) return;
  (CATEGORY_TABLES[cat] || []).forEach(t => sel.innerHTML += `<option value="${t}">${t}</option>`);
  const saveCat = document.getElementById('saveCategoryInput');
  if (saveCat && cat) saveCat.value = cat;
  setStatus(`Category "${cat}" selected — choose a table`);
}
 
async function onTableChange() {
  const table = document.getElementById('tableSelect').value;

  // Reset join dropdown and axes
  document.getElementById('joinTableSelect').innerHTML = '<option value="">— none —</option>';
  document.getElementById('joinTableField').style.display = 'none';
  populateAxisSelects([]);

  if (!table) return;

  // Populate join options for this table
  const joinOptions = JOIN_OPTIONS[table] || [];
  if (joinOptions.length > 0) {
    const joinSel = document.getElementById('joinTableSelect');
    joinOptions.forEach(t => joinSel.innerHTML += `<option value="${t}">${t}</option>`);
    document.getElementById('joinTableField').style.display = 'block';
  }

  // Load columns for the primary table
  await loadColumnsForTable(table, null);
}

async function onJoinTableChange() {
  const table     = document.getElementById('tableSelect').value;
  const joinTable = document.getElementById('joinTableSelect').value;
  await loadColumnsForTable(table, joinTable || null);
}

async function loadColumnsForTable(table, joinTable) {
  try {
    // Fetch columns from primary table
    const res1  = await fetch(`${API}/columns/${table}`);
    const data1 = await res1.json();
    let columns = data1.columns.map(c => ({ col: `\`${table}\`.\`${c}\``, label: `${table}.${c}` }));

    // If join table selected, fetch its columns too and merge
    if (joinTable) {
      const res2  = await fetch(`${API}/columns/${joinTable}`);
      const data2 = await res2.json();
      const joinCols = data2.columns.map(c => ({ col: `\`${joinTable}\`.\`${c}\``, label: `${joinTable}.${c}` }));
      columns = [...columns, ...joinCols];
      setStatus(`${columns.length} combined columns from "${table}" + "${joinTable}"`);
    } else {
      setStatus(`${columns.length} columns loaded from "${table}"`);
    }

    populateAxisSelectsWithLabels(columns);
  } catch (err) {
    console.error('loadColumns error:', err.message);
    setStatus(`Could not load columns — check terminal.`);
  }
}
 
function populateAxisSelects(columns) {
  ['xAxis','yAxis'].forEach(id => {
    const s = document.getElementById(id);
    s.innerHTML = '<option value="">— select column —</option>';
    columns.forEach(c => s.innerHTML += `<option value="${c}">${c}</option>`);
  });
}
function populateAxisSelectsWithLabels(columns) {
  ['xAxis','yAxis'].forEach(id => {
    const s = document.getElementById(id);
    s.innerHTML = '<option value="">— select column —</option>';
    columns.forEach(c => s.innerHTML += `<option value="${c.col}">${c.label}</option>`);
  });
}
 
// ─── BUILD CHART ──────────────────────────────────────────────────────────────
async function buildChart() {
  const table = document.getElementById('tableSelect').value;
  const xCol  = document.getElementById('xAxis').value;
  const yCol  = document.getElementById('yAxis').value;
  const agg   = document.getElementById('aggFunc').value;
 
  if (!table || !xCol || !yCol) {
    showPopup('error', 'Please select a table, X axis, and Y axis before generating.');
    return;
  }
 
  const btn = document.getElementById('buildBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating…';
  setStatus('Querying database…');
 
  try {
    // Call the real backend — no silent fallback so errors surface clearly
    const joinTable = document.getElementById('joinTableSelect').value || null;
    const res = await fetch(`${API}/chart-data`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ table, joinTable, xCol, yCol, agg })
    });
 
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Server returned ${res.status}`);
    }
 
    const chartData = await res.json();
 
    if (!chartData.labels || chartData.labels.length === 0) {
      showPopup('error', 'No data returned for that combination. Try different columns or check that the table has data.');
      setStatus('No data returned.');
      return;
    }
 
    const dataCategory = document.getElementById('dataCategory').value || 'parked';
    currentChartData   = { table, xCol, yCol, agg, chartType: currentChartType, dataCategory, ...chartData };
    renderChart(chartData.labels, chartData.values);
    document.getElementById('saveBtn').disabled = false;
   if (!document.getElementById('chartTitle').value) {
      const joinTable2 = document.getElementById('joinTableSelect').value;
      document.getElementById('chartTitle').value = joinTable2
        ? `${agg}(${yCol}) by ${xCol} [${table} + ${joinTable2}]`
        : `${agg}(${yCol}) by ${xCol}`;
    }
    setStatus(`${chartData.labels.length} data points — chart ready`);
    showPopup('success', 'Chart generated!');
 
  } catch(err) {
    showPopup('error', `Could not generate chart: ${err.message}`);
    setStatus(`Error: ${err.message}`);
    console.error('buildChart error:', err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-bolt"></i> Generate Chart';
  }
}
 
function getDemoData() {
  const labels = ['Spring','Summer','Fall','Winter','Jan','Feb','Mar','Apr'];
  return { labels, values: labels.map(() => Math.floor(Math.random() * 90) + 10) };
}
 
function renderChart(labels, values) {
  document.getElementById('placeholder').style.display = 'none';
  const canvas = document.getElementById('myChart');
  canvas.style.display = 'block';
  if (chartInstance) chartInstance.destroy();
 
  const isPie = ['pie','doughnut'].includes(currentChartType);
  chartInstance = new Chart(canvas, {
    type: currentChartType,
    data: {
      labels,
      datasets: [{
        label: document.getElementById('yAxis').value,
        data: values,
        backgroundColor: isPie ? PALETTE.slice(0, labels.length) : 'rgba(140,29,64,.8)',
        borderColor:     isPie ? PALETTE.map(c => c.replace('.85','1')) : 'rgba(140,29,64,1)',
        borderWidth:  isPie ? 2 : 0,
        borderRadius: currentChartType === 'bar' ? 5 : 0,
        tension: 0.4,
        pointBackgroundColor: 'rgba(255,198,39,1)',
        pointRadius:      currentChartType === 'line' ? 5 : 0,
        pointHoverRadius: 7,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: {
        legend: { display: isPie, labels: { color:'#333', font:{ family:'Roboto', size:12 }, padding:14 } },
        tooltip: { backgroundColor:'white', borderColor:'#ddd', borderWidth:1, titleColor:'#8C1D40', bodyColor:'#555', titleFont:{ family:'Roboto', weight:'bold', size:13 }, bodyFont:{ family:'Roboto', size:12 }, padding:12 }
      },
      scales: isPie ? {} : {
        x: { ticks:{ color:'#666', font:{ family:'Roboto', size:11 } }, grid:{ color:'rgba(0,0,0,.05)' } },
        y: { ticks:{ color:'#666', font:{ family:'Roboto', size:11 } }, grid:{ color:'rgba(0,0,0,.05)' } }
      }
    }
  });
}
 
function clearChart() {
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  document.getElementById('placeholder').style.display = 'block';
  document.getElementById('myChart').style.display     = 'none';
  document.getElementById('saveBtn').disabled = true;
  document.getElementById('chartTitle').value = '';
  currentChartData = null;
  setStatus('Ready — select a category to begin');
}
 
function downloadChart() {
  if (!chartInstance) return showPopup('error', 'Generate a chart first.');
  const a = document.createElement('a');
  a.download = (document.getElementById('chartTitle').value || 'chart') + '.png';
  a.href = document.getElementById('myChart').toDataURL();
  a.click();
}
 
function selectChartType(btn) {
  document.querySelectorAll('.chart-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentChartType = btn.dataset.type;
}
 
function setStatus(msg) { document.getElementById('statusText').textContent = msg; }
 
// ─── SAVE MODAL ───────────────────────────────────────────────────────────────
function openSaveModal() {
  if (!currentChartData) return;
  document.getElementById('saveNameInput').value = document.getElementById('chartTitle').value || '';
  const cat = document.getElementById('dataCategory').value;
  if (cat) document.getElementById('saveCategoryInput').value = cat;
  document.getElementById('saveModal').classList.add('show');
  setTimeout(() => document.getElementById('saveNameInput').focus(), 60);
}
function closeSaveModal() { document.getElementById('saveModal').classList.remove('show'); }
 
async function confirmSave() {
  const name     = document.getElementById('saveNameInput').value.trim();
  const category = document.getElementById('saveCategoryInput').value;
  const shared   = document.getElementById('saveSharedInput').checked;
 
  if (!name) return showPopup('error', 'Please enter a name for this chart.');
 
  const chart = {
    id: Date.now(),
    name, category, shared,
    ...currentChartData,
    createdAt: new Date().toLocaleDateString(),
    createdBy: localStorage.getItem('adminUser') || 'admin',
  };
 
  savedCharts.push(chart);
  renderAllZones();
  closeSaveModal();
  showPopup('success', `"${name}" saved${shared ? ' and shared with all admins' : ''}.`);
 
  try {
    const token = localStorage.getItem('jwtToken');
    await fetch(`${API}/saved-charts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(chart)
    });
  } catch (err) {
    console.error('Save to DB failed:', err.message);
  }
}
 
// ─── LOAD ALL SAVED CHARTS ────────────────────────────────────────────────────
async function loadAllSavedCharts() {
  try {
    const token = localStorage.getItem('jwtToken');
    const res = await fetch(`${API}/saved-charts`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    savedCharts = data.charts || [];
    // Keep localStorage in sync as backup
    localStorage.setItem('adminSavedCharts', JSON.stringify(savedCharts));
  } catch (err) {
    console.error('Could not load charts from DB:', err.message);
    savedCharts = JSON.parse(localStorage.getItem('adminSavedCharts') || '[]');
  }
}
 
// ─── RENDER ZONES ─────────────────────────────────────────────────────────────
const ZONES = ['parked','rsvp','event','user'];
 
function renderAllZones() {
  ZONES.forEach(renderZone);
  localStorage.setItem('adminSavedCharts', JSON.stringify(savedCharts));
}
 
function renderZone(zone) {
  const el    = document.getElementById(`zone-${zone}`);
  const count = document.getElementById(`count-${zone}`);
  if (!el) return;
 
  const charts = savedCharts.filter(c => c.category === zone);
  if (count) count.textContent = charts.length;
 
  const emptyMsg = {
    parked: '<i class="fas fa-inbox"></i>Newly saved charts appear here — drag them to a category below',
    rsvp:   '<i class="fas fa-chart-bar"></i>Drag RSVP-related charts here',
    event:  '<i class="fas fa-chart-pie"></i>Drag Event-related charts here',
    user:   '<i class="fas fa-chart-line"></i>Drag User-related charts here',
  };
 
  if (charts.length === 0) {
    el.innerHTML = `<div class="lane-empty">${emptyMsg[zone]}</div>`;
    return;
  }
 
  el.innerHTML = charts.map(buildCardHTML).join('');

  // Render mini charts after DOM is updated
  charts.forEach(chart => {
    const canvas = document.getElementById(`mini-${chart.id}`);
    if (!canvas || !chart.labels || chart.labels.length === 0) return;

    // Destroy existing instance if re-rendering
    if (canvas._chartInstance) canvas._chartInstance.destroy();

    const isPie = ['pie', 'doughnut'].includes(chart.chartType);
    canvas._chartInstance = new Chart(canvas, {
      type: chart.chartType,
      data: {
        labels: chart.labels,
        datasets: [{
          data: chart.values,
          backgroundColor: isPie
            ? PALETTE.slice(0, chart.labels.length)
            : 'rgba(140,29,64,.8)',
          borderColor: isPie
            ? PALETTE.map(c => c.replace('.85','1'))
            : 'rgba(140,29,64,1)',
          borderWidth: isPie ? 2 : 0,
          borderRadius: chart.chartType === 'bar' ? 3 : 0,
          tension: 0.4,
          pointRadius: 0,
        }]
      },
      options: {
        responsive: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
        },
        scales: isPie ? {} : {
          x: { display: false },
          y: { display: false },
        }
      }
    });
  });

  el.querySelectorAll('.saved-card').forEach(card => {
    card.addEventListener('dragstart', e => {
      draggedId = card.dataset.id;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });
}
 
function buildCardHTML(chart) {
  const badgeMap = { rsvp:'badge-rsvp', event:'badge-event', user:'badge-user', parked:'badge-parked' };
  const labelMap = { rsvp:'RSVP', event:'Event', user:'User', parked:'Parked' };

  return `
  <div class="saved-card" draggable="true" data-id="${chart.id}">
    <span class="cat-badge ${badgeMap[chart.category] || 'badge-parked'}">${labelMap[chart.category] || '?'}</span>
    ${chart.shared ? '<span class="shared-badge">Shared</span>' : ''}
    <div class="saved-card-title">${chart.name}</div>
    <div class="saved-card-subtitle">${chart.table}${chart.joinTable ? ' + ' + chart.joinTable : ''} · ${chart.createdAt}</div>
    <div class="mini-chart-wrapper">
      <canvas class="mini-chart-canvas" id="mini-${chart.id}" width="220" height="120"></canvas>
    </div>
    <div class="saved-card-actions">
      <button class="card-action-btn" onclick="loadSavedChart(${chart.id})"><i class="fas fa-expand"></i> Load</button>
      <button class="card-action-btn" onclick="toggleShare(${chart.id})">${chart.shared ? '<i class="fas fa-lock"></i> Unshare' : '<i class="fas fa-share-nodes"></i> Share'}</button>
      <button class="card-action-btn danger" onclick="deleteChart(${chart.id})"><i class="fas fa-trash"></i></button>
    </div>
  </div>`;
}
 
// ─── LOAD CHART INTO BUILDER ─────────────────────────────────────────────────
function loadSavedChart(id) {
  const chart = savedCharts.find(c => c.id === id);
  if (!chart) return;
  document.getElementById('tableSelect').value = chart.table;
  document.getElementById('xAxis').innerHTML   = `<option value="${chart.xCol}">${chart.xCol}</option>`;
  document.getElementById('yAxis').innerHTML   = `<option value="${chart.yCol}">${chart.yCol}</option>`;
  document.getElementById('aggFunc').value     = chart.agg;
  document.getElementById('chartTitle').value  = chart.name;
  document.querySelectorAll('.chart-type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === chart.chartType));
  currentChartType = chart.chartType;
  currentChartData = chart;
  renderChart(chart.labels, chart.values);
  document.getElementById('saveBtn').disabled = false;
  showPopup('success', `Loaded "${chart.name}"`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
 
// ─── DELETE ───────────────────────────────────────────────────────────────────
async function deleteChart(id) {
  const confirmed = await showConfirm('Delete this chart? This cannot be undone.');
  if (!confirmed) return;
  savedCharts = savedCharts.filter(c => c.id !== id);
  renderAllZones();
  showPopup('success', 'Chart deleted.');
  const token = localStorage.getItem('jwtToken');
  fetch(`${API}/saved-charts/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  }).catch(err => console.error('Delete failed:', err.message));
}
 
// ─── SHARE TOGGLE ─────────────────────────────────────────────────────────────
async function toggleShare(id) {
  const chart = savedCharts.find(c => c.id === id);
  if (!chart) return;
  chart.shared = !chart.shared;
  renderAllZones();
  showPopup('success', chart.shared
    ? `"${chart.name}" is now shared with all admins.`
    : `"${chart.name}" is now private.`);
  const token = localStorage.getItem('jwtToken');
  fetch(`${API}/saved-charts/${id}/share`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ shared: chart.shared })
  }).catch(err => console.error('Share update failed:', err.message));
}
 
// ─── DRAG & DROP ──────────────────────────────────────────────────────────────
function onDragOver(e)  { e.preventDefault(); e.currentTarget.classList.add('drag-over'); e.dataTransfer.dropEffect = 'move'; }
function onDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
 
function onDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const targetZone = e.currentTarget.dataset.zone;
  const id         = Number(draggedId);
  const chart      = savedCharts.find(c => c.id === id);
  if (!chart || chart.category === targetZone) return;
  chart.category = targetZone;
  renderAllZones();
  showPopup('success', `"${chart.name}" moved to ${targetZone} charts.`);
  draggedId = null;
  const token = localStorage.getItem('jwtToken');
  fetch(`${API}/saved-charts/${id}/category`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ category: targetZone })
  }).catch(err => console.error('Category update failed:', err.message));
}
 
// ─── LANE FILTER ──────────────────────────────────────────────────────────────
function filterLanes(btn) {
  document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const filter = btn.dataset.filter;
  document.querySelectorAll('.graph-lane').forEach(lane => {
    lane.style.display = (filter === 'all' || lane.dataset.lane === filter) ? '' : 'none';
  });
}

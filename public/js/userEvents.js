
document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("jwtToken");
  loadUserEvents(token);
  initCalendar();
});

// State
let allUserEvents = [];
let allEvents     = [];
let eventView     = 'upcoming';
let calYear, calMonth;

// Custom Popup (mirrors events.js exactly)
const popup = document.createElement('div');
popup.id = 'customPopup';
popup.className = 'hidden';
popup.innerHTML = `
  <div class="popup-content">
    <div class="popup-top-border" id="popupBorder"></div>
    <div class="popup-icon"    id="popupIcon"></div>
    <div class="popup-message" id="popupMessage"></div>
    <div class="popup-buttons" id="popupButtons"></div>
  </div>
`;
document.body.appendChild(popup);

const popupBorder  = document.getElementById('popupBorder');
const popupIcon    = document.getElementById('popupIcon');
const popupMessage = document.getElementById('popupMessage');
const popupButtons = document.getElementById('popupButtons');

function showPopup(type, message) {
  popupBorder.className    = `popup-top-border ${type}`;
  popupIcon.textContent    = type === 'error' ? '❌' : '✅';
  popupMessage.textContent = message;
  popupButtons.innerHTML   = '';
  popup.classList.remove('hidden');
  setTimeout(() => popup.classList.add('hidden'), 3000);
}

function showConfirm(message) {
  return new Promise(resolve => {
    popupBorder.className    = 'popup-top-border confirm';
    popupIcon.textContent    = '⚠️';
    popupMessage.textContent = message;
    popupButtons.innerHTML   = '';

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Confirm';
    confirmBtn.className   = 'popup-btn-danger';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className   = 'popup-btn-cancel';

    confirmBtn.addEventListener('click', () => { popup.classList.add('hidden'); resolve(true);  });
    cancelBtn.addEventListener('click',  () => { popup.classList.add('hidden'); resolve(false); });

    popupButtons.appendChild(confirmBtn);
    popupButtons.appendChild(cancelBtn);
    popup.classList.remove('hidden');
  });
}

// Data loading
async function loadUserEvents(token) {
  const listEl = document.getElementById('userEventList');

  if (!token) {
    listEl.innerHTML = '<div class="empty-message">Please log in to see your events.</div>';
    renderStats([]);
    renderCategoryChart([]);
    return;
  }

  try {
    const [eventsResp, userEventsResp] = await Promise.all([
      fetch('/api/events'),
      fetch('/api/user-events', { headers: { 'Authorization': `Bearer ${token}` } })
    ]);

    if (!eventsResp.ok)     throw new Error('Failed to load events');
    if (!userEventsResp.ok) throw new Error('Failed to load your events');

    allEvents = await eventsResp.json();
    const userRsvps = await userEventsResp.json();

    const rsvpIds = userRsvps.map(e => Number(e.event_id));
    allUserEvents = allEvents
      .filter(e => rsvpIds.includes(Number(e.event_id)))
      .sort((a, b) => new Date(a.event_datetime) - new Date(b.event_datetime));

    renderStats(allUserEvents);
    renderCategoryChart(allUserEvents);
    updateCalendarDots(allUserEvents);
    updateEventList();

  } catch (err) {
    console.error('Error loading user events:', err);
    listEl.innerHTML = "<div class='empty-message'>Unable to load your events.</div>";
  }
}

// Stats
function renderStats(events) {
  const now      = new Date();
  const upcoming = events.filter(e => new Date(e.event_datetime) >= now);
  const past     = events.filter(e => new Date(e.event_datetime) <  now);

  document.getElementById('statUpcoming').textContent = upcoming.length;

  if (upcoming.length > 0) {
    const dateStr = new Date(upcoming[0].event_datetime)
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    document.getElementById('statNextDate').textContent = `Next: ${dateStr}`;
  } else {
    document.getElementById('statNextDate').textContent = 'No upcoming events';
  }

  document.getElementById('statAttended').textContent = past.length;

  const total = events.length;
  if (total > 0) {
    const rate = Math.round((past.length / total) * 100);
    document.getElementById('statRate').textContent    = `${rate}%`;
    document.getElementById('statRateSub').textContent = `${past.length} of ${total} RSVPs attended`;
  } else {
    document.getElementById('statRate').textContent    = '—';
    document.getElementById('statRateSub').textContent = 'No events yet';
  }

  const counts = {};
  events.forEach(e => { counts[e.type] = (counts[e.type] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  if (sorted.length > 0) {
    document.getElementById('statFavorite').textContent = sorted[0][0];
    document.getElementById('statFavSub').textContent   = `${sorted[0][1]} event${sorted[0][1] !== 1 ? 's' : ''} attended`;
  } else {
    document.getElementById('statFavorite').textContent = '—';
    document.getElementById('statFavSub').textContent   = '';
  }
}

// Toggle
const upcomingBtn = document.getElementById('upcomingBtn');
const pastBtn     = document.getElementById('pastBtn');

upcomingBtn.addEventListener('click', () => {
  eventView = 'upcoming';
  upcomingBtn.classList.add('active');
  pastBtn.classList.remove('active');
  updateEventList();
});

pastBtn.addEventListener('click', () => {
  eventView = 'past';
  pastBtn.classList.add('active');
  upcomingBtn.classList.remove('active');
  updateEventList();
});

// Search and sort listeners — attached after DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('userSearchInput');
  const sortFilter  = document.getElementById('userSortFilter');
  if (searchInput) searchInput.addEventListener('input', updateEventList);
  if (sortFilter)  sortFilter.addEventListener('change', updateEventList);
}, { once: true });

function updateEventList() {
  const now         = new Date();
  const searchInput = document.getElementById('userSearchInput');
  const sortFilter  = document.getElementById('userSortFilter');
  const searchTerm  = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const sortValue   = sortFilter  ? sortFilter.value : 'date-asc';

  let filtered = allUserEvents.filter(e =>
    eventView === 'upcoming'
      ? new Date(e.event_datetime) >= now
      : new Date(e.event_datetime) < now
  );

  if (searchTerm) {
    filtered = filtered.filter(e =>
      e.description.toLowerCase().includes(searchTerm) ||
      e.location.toLowerCase().includes(searchTerm) ||
      (e.tags && e.tags.toLowerCase().includes(searchTerm)) ||
      (e.type && e.type.toLowerCase().includes(searchTerm))
    );
  }

  if (sortValue === 'date-asc') {
    filtered.sort((a, b) => new Date(a.event_datetime) - new Date(b.event_datetime));
  } else if (sortValue === 'date-desc') {
    filtered.sort((a, b) => new Date(b.event_datetime) - new Date(a.event_datetime));
  }

  renderEventList(filtered);
}

function renderEventList(events) {
  const listEl = document.getElementById('userEventList');
  listEl.innerHTML = '';

  if (events.length === 0) {
    const msg = eventView === 'upcoming'
      ? "You have no upcoming RSVPs. <a href='/events.html'>Browse events</a> to RSVP!"
      : "No past events found.";
    listEl.innerHTML = `<div class="empty-message">${msg}</div>`;
    return;
  }

  const now = new Date();
  events.forEach(event => {
    const dateObj  = new Date(event.event_datetime);
    const month    = dateObj.toLocaleDateString('en-US', { month: 'short' });
    const day      = dateObj.getDate();
    const timeStr  = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const isPast   = dateObj < now;

    const card = document.createElement('div');
    card.classList.add('event-card');
    if (isPast) card.classList.add('past-card');

    card.innerHTML = `
      <div class="event-date-box">
        <div class="month">${month}</div>
        <div class="day">${day}</div>
      </div>
      <div class="event-info">
        <div class="event-title">${event.description}</div>
        <div class="event-meta">${timeStr} &middot; ${event.location} &middot; ${event.type}</div>
        <div class="badges">
          ${isPast
            ? '<span class="badge badge-attended">&#10003; Attended</span>'
            : '<span class="badge badge-rsvp">RSVP\'d</span>'
          }
          <span class="badge ${getCategoryClass(event.type)}">${event.type}</span>
          ${event.tags ? `<span class="badge badge-social">${event.tags}</span>` : ''}
        </div>
      </div>
      ${!isPast ? `
        <div class="event-action">
          <button class="btn-cancel-rsvp" data-id="${event.event_id}">Cancel RSVP</button>
        </div>` : ''}
    `;
    listEl.appendChild(card);
  });

  listEl.querySelectorAll('.btn-cancel-rsvp').forEach(btn => {
    btn.addEventListener('click', () => cancelRsvp(Number(btn.dataset.id)));
  });
}

function getCategoryClass(type) {
  const map = { Academic: 'badge-academic', Social: 'badge-social', Sports: 'badge-sports' };
  return map[type] || 'badge-other';
}

// Cancel RSVP
async function cancelRsvp(eventId) {
  const token = localStorage.getItem('jwtToken');
  if (!token) return showPopup('error', 'Login required to manage RSVPs');

  const confirmed = await showConfirm('Are you sure you want to cancel this RSVP?');
  if (!confirmed) return;

  try {
    const resp = await fetch(`/api/rsvp/${eventId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.message || 'Failed to cancel RSVP');

    showPopup('success', 'RSVP cancelled successfully!');
    await loadUserEvents(token);

  } catch (err) {
    console.error('Cancel RSVP error:', err);
    showPopup('error', err.message);
  }
}

// Category bar chart
function renderCategoryChart(events) {
  const chartEl = document.getElementById('categoryChart');
  const counts  = {};
  events.forEach(e => { counts[e.type] = (counts[e.type] || 0) + 1; });

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    chartEl.innerHTML = '<div class="empty-message">No data yet.</div>';
    return;
  }

  const colorMap = { Academic: '#8C1D40', Social: '#888780', Sports: '#639922' };
  const max = Math.max(...entries.map(e => e[1]));

  chartEl.innerHTML = entries.map(([label, count]) => {
    const pct   = Math.round((count / max) * 100);
    const color = colorMap[label] || '#534AB7';
    return `
      <div class="chart-row">
        <span class="chart-label">${label}</span>
        <div class="chart-bar-track">
          <div class="chart-bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <span class="chart-count">${count}</span>
      </div>
    `;
  }).join('');
}

// Mini calendar
function initCalendar() {
  const now = new Date();
  calYear  = now.getFullYear();
  calMonth = now.getMonth();

  document.getElementById('calPrev').addEventListener('click', () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
  });

  document.getElementById('calNext').addEventListener('click', () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
  });

  renderCalendar();
}

function updateCalendarDots(events) {
  // Build a map of "YYYY-M-D" -> [event, ...] for fast lookup
  window._rsvpEventMap = {};
  events.forEach(e => {
    const d   = new Date(e.event_datetime);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!window._rsvpEventMap[key]) window._rsvpEventMap[key] = [];
    window._rsvpEventMap[key].push(e);
  });
  renderCalendar();
}

function renderCalendar() {
  const label    = document.getElementById('calMonthLabel');
  const daysEl   = document.getElementById('calDays');
  const eventMap = window._rsvpEventMap || {};

  const monthNames = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];
  label.textContent = `${monthNames[calMonth]} ${calYear}`;

  const today     = new Date();
  const firstDay  = new Date(calYear, calMonth, 1).getDay();
  const daysInMon = new Date(calYear, calMonth + 1, 0).getDate();
  const prevDays  = new Date(calYear, calMonth, 0).getDate();

  // Clear and rebuild day cells as real elements so we can attach listeners
  daysEl.innerHTML = '';

  const addCell = (text, classes) => {
    const el = document.createElement('div');
    el.className = classes;
    el.textContent = text;
    daysEl.appendChild(el);
    return el;
  };

  // Prev month overflow
  for (let i = firstDay - 1; i >= 0; i--) {
    addCell(prevDays - i, 'cal-day other-month');
  }

  // Current month
  for (let d = 1; d <= daysInMon; d++) {
    const isToday  = d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
    const key      = `${calYear}-${calMonth}-${d}`;
    const events   = eventMap[key] || [];
    const hasEvent = events.length > 0;
    const cellDate = new Date(calYear, calMonth, d, 23, 59, 59);
    const allPast  = hasEvent && cellDate < today;
    const dotClass = hasEvent ? (allPast ? 'is-past' : 'is-future') : '';
    const classes  = ['cal-day', isToday ? 'today' : '', hasEvent ? 'has-event' : '', dotClass].filter(Boolean).join(' ');
    const cell     = addCell(d, classes);

    if (hasEvent) {
      cell.addEventListener('mouseenter', (e) => showCalTooltip(e.currentTarget, events));
      cell.addEventListener('mouseleave', hideCalTooltip);
    }
  }

  // Next month overflow
  const totalCells = firstDay + daysInMon;
  const remainder  = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let d = 1; d <= remainder; d++) {
    addCell(d, 'cal-day other-month');
  }
}

// Calendar tooltip
const calTooltip = document.createElement('div');
calTooltip.id = 'calTooltip';
calTooltip.className = 'cal-tooltip hidden';
document.body.appendChild(calTooltip);

function showCalTooltip(cell, events) {
  const now = new Date();

  calTooltip.innerHTML = `
    <div class="cal-tooltip-list">
      ${events.map(e => {
        const dateObj  = new Date(e.event_datetime);
        const timeStr  = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        const isPast   = dateObj < now;
        const statusCls = isPast ? 'cal-tt-status past' : 'cal-tt-status upcoming';
        const statusTxt = isPast ? 'Attended' : "RSVP'd";
        return `
          <div class="cal-tooltip-event">
            <div class="cal-tt-title">${e.description}</div>
            <div class="cal-tt-meta">${timeStr} &middot; ${e.location}</div>
            <div class="cal-tt-row">
              <span class="cal-tt-type">${e.type}</span>
              <span class="${statusCls}">${statusTxt}</span>
            </div>
          </div>
        `;
      }).join('<div class="cal-tt-divider"></div>')}
    </div>
  `;

  calTooltip.classList.remove('hidden');

  // Position tooltip relative to the cell
  const rect      = cell.getBoundingClientRect();
  const tipWidth  = 220;
  const scrollY   = window.scrollY;
  let left = rect.left + rect.width / 2 - tipWidth / 2;
  // Keep within viewport
  left = Math.max(8, Math.min(left, window.innerWidth - tipWidth - 8));
  calTooltip.style.left  = `${left}px`;
  calTooltip.style.top   = `${rect.bottom + scrollY + 6}px`;
  calTooltip.style.width = `${tipWidth}px`;
}

function hideCalTooltip() {
  calTooltip.classList.add('hidden');
}
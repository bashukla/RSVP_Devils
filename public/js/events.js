// EVENTS.JS
document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("jwtToken");
    loadEvents(token);
});

// DOM ELEMENTS
const eventListEl = document.getElementById('eventList');
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const sortFilter = document.getElementById('sortFilter');
const tagsFilter = document.getElementById('tagsFilter');
const newEventBtn = document.getElementById('newEventBtn');

let eventsData = [];
let userRSVPs = [];
let selectedEventId = null;

// MODAL SETUP
const modal = document.createElement('div');
modal.id = 'eventFormModal';
modal.className = 'modal hidden';
modal.innerHTML = `
  <div class="modal-content">
    <h2 id="modalTitle">New Event</h2>
    <form id="eventForm">
      <label>Description (Title)</label>
      <input id="description" type="text" placeholder="Event title" required>
      <label>Type</label>
      <select id="type" required>
        <option value="">Select Type</option>
        <option value="Academic">Academic</option>
        <option value="Social">Social</option>
        <option value="Sports">Sports</option>
      </select>
      <label>Date & Time</label>
      <input id="event_datetime" type="datetime-local" required>
      <label>Location</label>
      <input id="location" type="text" placeholder="Event location" required>
      <label>Tags</label>
      <input id="tags" type="text" placeholder="(Optional)">
      <div class="modal-buttons">
        <button type="submit" id="saveEventBtn">Save</button>
        <button type="button" id="deleteEventBtn" style="background-color: #E74C3C; color: #fff; display:none;">Delete</button>
        <button type="button" id="closeModalBtn">Cancel</button>
      </div>
    </form>
  </div>
`;
document.body.appendChild(modal);

const modalForm = document.getElementById('eventForm');
const modalTitle = document.getElementById('modalTitle');
const closeBtn = document.getElementById('closeModalBtn');
const deleteBtn = document.getElementById('deleteEventBtn');

closeBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    selectedEventId = null;
    modalForm.reset();
});

if (newEventBtn) newEventBtn.addEventListener('click', () => openModalForCreate());

// MODAL FUNCTIONS
function openModalForCreate() {
    selectedEventId = null;
    modalTitle.textContent = 'New Event';
    modalForm.reset();
    modal.classList.remove('hidden');
    deleteBtn.style.display = 'none';
}

function openModalForEdit(eventData) {
    selectedEventId = eventData.event_id;
    modalTitle.textContent = 'Edit Event';
    modalForm.description.value = eventData.description;
    modalForm.type.value = eventData.type;
    modalForm.event_datetime.value = new Date(eventData.event_datetime).toISOString().slice(0,16);
    modalForm.location.value = eventData.location;
    modalForm.tags.value = eventData.tags || '';
    modal.classList.remove('hidden');
    deleteBtn.style.display = 'inline-block';
}

// LOAD EVENTS
async function loadEvents(token) {
    try {
        const [eventsResp, rsvpResp] = await Promise.all([
            fetch('/api/events'),
            fetch('/api/rsvp-count')
        ]);

        if (!eventsResp.ok) throw new Error('Failed to load events');
        if (!rsvpResp.ok) throw new Error('Failed to load RSVP counts');

        const events = await eventsResp.json();
        const rsvpData = await rsvpResp.json();

        // Merge RSVP counts
        eventsData = events.map(event => {
            const rsvp = rsvpData.find(r => Number(r.event_id) === Number(event.event_id));
            return {
                ...event,
                rsvp_count: rsvp ? rsvp.rsvp_count : 0
            };
        });

        // Fetch user's RSVPs if logged in
        if (token) {
            const userEventsResp = await fetch('/api/user-events', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (userEventsResp.ok) {
                const userEvents = await userEventsResp.json();
                userRSVPs = userEvents.map(e => Number(e.event_id));
            } else {
                userRSVPs = [];
            }
        }

        updateEvents();
    } catch (err) {
        console.error('Error loading events:', err);
        eventListEl.innerHTML = "<div class='empty-message'>Unable to load events.</div>";
    }
}

// RENDER EVENTS
function renderEvents(events) {
    eventListEl.innerHTML = '';
    if (events.length === 0) {
        eventListEl.innerHTML = '<div class="empty-message">No events match your criteria.</div>';
        return;
    }

    const token = localStorage.getItem("jwtToken");

    events.forEach(event => {
        const card = document.createElement('div');
        card.classList.add('event-card');

        const dateObj = new Date(event.event_datetime);
        const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

        const isRsvped = userRSVPs.includes(Number(event.event_id));

        card.innerHTML = `
        <div class="card-header">
            <span class="card-category">${event.type}</span>
            <div class="card-icons">
            <span class="edit-icon" title="Edit Event" data-id="${event.event_id}">&#9998;</span>
            <span class="delete-icon" title="Delete Event" data-id="${event.event_id}">&#128465;</span>
            </div>
        </div>
        <div class="card-body">
            <h3 class="event-title">${event.description}</h3>
            <div class="event-details"><strong>Date:</strong> ${dateStr}</div>
            <div class="event-details"><strong>Time:</strong> ${timeStr}</div>
            <div class="event-details"><strong>Location:</strong> ${event.location}</div>
            <div class="event-details"><strong>RSVPs:</strong> ${event.rsvp_count}</div>
        </div>
        <div class="card-actions">
            <button class="rsvp-button ${isRsvped ? 'rsvped' : ''}" 
                    data-id="${event.event_id}" 
                    ${!token ? 'disabled title="Login to RSVP"' : ''}>
                ${isRsvped ? 'Cancel RSVP' : 'RSVP Now'}
            </button>
        </div>
        `;
        eventListEl.appendChild(card);
    });

    attachCardListeners(token);
}

// ATTACH ICON + RSVP LISTENERS
function attachCardListeners(token) {
    document.querySelectorAll('.edit-icon').forEach(icon => {
        icon.addEventListener('click', () => {
            const eventId = icon.dataset.id;
            const eventData = eventsData.find(ev => ev.event_id == eventId);
            openModalForEdit(eventData);
        });
    });

    document.querySelectorAll('.delete-icon').forEach(icon => {
        icon.addEventListener('click', async () => {
            const eventId = icon.dataset.id;
            if (!confirm("Delete this event?")) return;
            if (!token) return alert('Login required');
            try {
                const resp = await fetch(`/api/events/${eventId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!resp.ok) throw new Error('Failed to delete');
                await loadEvents(token);
            } catch (err) {
                console.error(err);
                alert('Failed to delete event.');
            }
        });
    });

    document.querySelectorAll('.rsvp-button').forEach(btn => {
        btn.addEventListener('click', async () => {
            const token = localStorage.getItem('jwtToken');
            if (!token) return alert('Login required to RSVP');

            const eventId = Number(btn.dataset.id);
            const isRsvped = userRSVPs.includes(eventId);

            try {
                let resp;
                if (isRsvped) {
                    resp = await fetch(`/api/rsvp/${eventId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                } else {
                    resp = await fetch(`/api/rsvp`, {
                        method: 'POST',
                        headers: { 
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ event_id: eventId })
                    });
                }

                const data = await resp.json();
                if (!resp.ok) throw new Error(data.message || 'RSVP failed');

                if (isRsvped) userRSVPs = userRSVPs.filter(id => id !== eventId);
                else userRSVPs.push(eventId);

                await loadEvents(token);
            } catch (err) {
                console.error('RSVP Error:', err);
                alert(err.message);
            }
        });
    });
}

// FILTER + SORT
function updateEvents() {
    let filtered = [...eventsData];
    const searchTerm = searchInput.value.trim().toLowerCase();
    const categoryValue = categoryFilter.value;
    const sortValue = sortFilter.value;

    if (searchTerm) filtered = filtered.filter(e =>
        e.description.toLowerCase().includes(searchTerm) ||
        e.location.toLowerCase().includes(searchTerm) ||
        (e.tags && e.tags.toLowerCase().includes(searchTerm))
    );

    if (categoryValue) filtered = filtered.filter(e => e.type === categoryValue);

    if (sortValue === 'date-asc') filtered.sort((a,b) => new Date(a.event_datetime) - new Date(b.event_datetime));
    else if (sortValue === 'date-desc') filtered.sort((a,b) => new Date(b.event_datetime) - new Date(a.event_datetime));

    renderEvents(filtered);
}

// MODAL SUBMISSION (CREATE/EDIT)
modalForm.addEventListener('submit', async e => {
    e.preventDefault();
    const token = localStorage.getItem("jwtToken");
    if (!token) return alert('Login required');

    const payload = {
        description: document.getElementById('description').value,
        type: document.getElementById('type').value,
        event_datetime: document.getElementById('event_datetime').value,
        location: document.getElementById('location').value,
        tags: document.getElementById('tags').value
    };

    try {
        let resp;
        if (selectedEventId) {
            resp = await fetch(`/api/events/${selectedEventId}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            resp = await fetch(`/api/events`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        if (!resp.ok) throw new Error('Failed to save event');
        modal.classList.add('hidden');
        modalForm.reset();
        selectedEventId = null;
        await loadEvents(token);
    } catch (err) {
        console.error(err);
        alert('Failed to save event');
    }
});

// MODAL DELETE BUTTON
deleteBtn.addEventListener('click', async () => {
    const token = localStorage.getItem("jwtToken");
    if (!token) return alert('Login required');
    if (!selectedEventId) return;
    if (!confirm("Delete this event?")) return;

    try {
        const resp = await fetch(`/api/events/${selectedEventId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!resp.ok) throw new Error('Failed to delete event');
        modal.classList.add('hidden');
        modalForm.reset();
        selectedEventId = null;
        await loadEvents(token);
    } catch (err) {
        console.error(err);
        alert('Failed to delete event');
    }
});

// FILTER LISTENERS
searchInput.addEventListener('input', updateEvents);
categoryFilter.addEventListener('change', updateEvents);
sortFilter.addEventListener('change', updateEvents);
if (tagsFilter) tagsFilter.addEventListener('change', updateEvents);

// INITIAL SORT
sortFilter.value = 'date-asc';
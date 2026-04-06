document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("jwtToken");
    loadEvents(token);
});

// Dom elements
const eventListEl = document.getElementById('eventList');
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const sortFilter = document.getElementById('sortFilter');
const tagsFilter = document.getElementById('tagsFilter');
const newEventBtn = document.getElementById('newEventBtn');

let eventsData = [];
let userRSVPs = [];
let selectedEventId = null;

// Custom Popup
const popup = document.createElement('div');
popup.id = 'customPopup';
popup.className = 'hidden';
popup.innerHTML = `
  <div class="popup-content">
    <div class="popup-top-border" id="popupBorder"></div>
    <div class="popup-icon" id="popupIcon"></div>
    <div class="popup-message" id="popupMessage"></div>
    <div class="popup-buttons" id="popupButtons"></div>
  </div>
`;
document.body.appendChild(popup);

const popupBorder  = document.getElementById('popupBorder');
const popupIcon    = document.getElementById('popupIcon');
const popupMessage = document.getElementById('popupMessage');
const popupButtons = document.getElementById('popupButtons');

// Show error or success (auto-closes after 3s)
function showPopup(type, message) {
  popupBorder.className  = `popup-top-border ${type}`;
  popupIcon.textContent  = type === 'error' ? '❌' : '✅';
  popupMessage.textContent = message;
  popupButtons.innerHTML = '';
  popup.classList.remove('hidden');
  setTimeout(() => popup.classList.add('hidden'), 3000);
}

// Show confirmation dialog, returns a Promise<boolean>
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

    confirmBtn.addEventListener('click', () => {
      popup.classList.add('hidden');
      resolve(true);
    });
    cancelBtn.addEventListener('click', () => {
      popup.classList.add('hidden');
      resolve(false);
    });

    popupButtons.appendChild(confirmBtn);
    popupButtons.appendChild(cancelBtn);
    popup.classList.remove('hidden');
  });
}
// added state for toggle
let eventView = 'upcoming';

// Setup modal
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
      <label>Event Image</label>
      <input type="file" id="eventImageInput" accept="image/*">
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
const eventImageInput = document.getElementById('eventImageInput');


closeBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    selectedEventId = null;
    modalForm.reset();
});

if (newEventBtn) newEventBtn.addEventListener('click', () => openModalForCreate());

// toggle buttons
const upcomingBtn = document.getElementById('upcomingBtn');
const pastBtn = document.getElementById('pastBtn');

if (upcomingBtn && pastBtn) {
    upcomingBtn.addEventListener('click', () => {
        eventView = 'upcoming';
        upcomingBtn.classList.add('active');
        pastBtn.classList.remove('active');
        updateEvents();
    });

    pastBtn.addEventListener('click', () => {
        eventView = 'past';
        pastBtn.classList.add('active');
        upcomingBtn.classList.remove('active');
        updateEvents();
    });
}

// Modal functions
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

// Load events and RSVP counts
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

        eventsData = events.map(event => {
            const rsvp = rsvpData.find(r => Number(r.event_id) === Number(event.event_id));
            return {
                ...event,
                rsvp_count: rsvp ? rsvp.rsvp_count : 0
            };
        });

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

// Render events 
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
        const isPast = new Date(event.event_datetime).getTime() < new Date().getTime();

        card.innerHTML = `
        <div class="card-header">
            <span class="card-category">${event.type}</span>
            <div class="card-icons">
            <span class="edit-icon" title="Edit Event" data-id="${event.event_id}">&#9998;</span>
            <span class="delete-icon" title="Delete Event" data-id="${event.event_id}">&#128465;</span>
            </div>
        </div>

        <div class="card-body">
          <img src="${event.image ? `/uploads/${event.image}` : '/images/ASU Logos/Arizona-State-Sun-Devils-logo.png'}" class="event-image">
            <h3 class="event-title">${event.description}</h3>
            <div class="event-details"><strong>Date:</strong> ${dateStr}</div>
            <div class="event-details"><strong>Time:</strong> ${timeStr}</div>
            <div class="event-details"><strong>Location:</strong> ${event.location}</div>
            <div class="event-details"><strong>RSVPs:</strong> ${event.rsvp_count}</div>
            ${event.tags ? `<div class="event-details"><strong>Tag(s):</strong> ${event.tags}</div>` : ''}
        </div>

        <div class="card-actions">
            <button 
                class="rsvp-button ${isRsvped ? 'rsvped' : ''} ${isPast ? 'disabled' : ''}" 
                data-id="${event.event_id}" 
                ${!token ? 'disabled title="Login to RSVP"' : ''}
                ${isPast ? 'disabled title="Event ended"' : ''}>
                
                ${isPast 
                    ? (isRsvped ? 'Attended' : 'Not Attended') 
                    : (isRsvped ? 'Cancel RSVP' : 'RSVP Now')
                }
            </button>
        </div>
        `;
        eventListEl.appendChild(card);
    });

    attachCardListeners(token);
}

// Attach listeners 
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
            const token = localStorage.getItem('jwtToken');
            if (!token) return showPopup('error', 'Sorry, but you must be logged in to continue');
            
            const confirmed = await showConfirm('Are you sure you want to delete this event?');
            if (!confirmed) return;

            try {
                const resp = await fetch(`/api/events/${eventId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!resp.ok) throw new Error('Failed to delete');
                await loadEvents(token);
                showPopup('success', 'Event deleted successfully!');
            } catch (err) {
                console.error(err);
                showPopup('error', 'Sorry, we are unable to delete event');
            }
        });
    });

    document.querySelectorAll('.rsvp-button').forEach(btn => {
        btn.addEventListener('click', async () => {
            const token = localStorage.getItem('jwtToken');
            if (!token) return showPopup('error','Login required to RSVP');

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

                if (isRsvped) {
                    userRSVPs = userRSVPs.filter(id => id !== eventId);
                    showPopup('success', 'RSVP cancelled successfully!');
                } else {
                    userRSVPs.push(eventId);
                    const prefs = JSON.parse(localStorage.getItem('notifPrefs') || '{}');
                    const msg = prefs.confirmations !== false
                        ? 'RSVP successful! A confirmation email will be sent to you.'
                        : 'RSVP successful!';
                    showPopup('success', msg);
                }

                await loadEvents(token);
            } catch (err) {
                console.error('RSVP Error:', err);
                showPopup('error', err.message);
            }
        });
    });
            // Image upload handler
    document.querySelectorAll('.image-upload').forEach(input => {
        input.addEventListener('change', async () => {
            const file = input.files[0];
            if (!file) return;

            const eventId = input.dataset.id;
            const token = localStorage.getItem('jwtToken');

            if (!token) {
                showPopup('error', 'Login required to upload image');
                return;
            }

            const formData = new FormData();
            formData.append('image', file);

            try {
                const resp = await fetch(`/api/events/${eventId}/upload-cover`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });

                const data = await resp.json();
                if (!resp.ok) throw new Error(data.message || 'Upload failed');

                showPopup('success', 'Image uploaded successfully!');
                await loadEvents(token);

            } catch (err) {
                console.error('Upload error:', err);
                showPopup('error', err.message);
            }
        });
    });
}

// Filter and sort events
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

    const now = new Date();
    if (eventView === 'upcoming') {
        filtered = filtered.filter(e => new Date(e.event_datetime).getTime() >= now.getTime());
    } else if (eventView === 'past') {
        filtered = filtered.filter(e => new Date(e.event_datetime).getTime() < now.getTime());
    }

    if (sortValue === 'date-asc') filtered.sort((a,b) => new Date(a.event_datetime) - new Date(b.event_datetime));
    else if (sortValue === 'date-desc') filtered.sort((a,b) => new Date(b.event_datetime) - new Date(a.event_datetime));

    renderEvents(filtered);
}

// Modal submission
modalForm.addEventListener('submit', async e => {
    e.preventDefault();
    const token = localStorage.getItem("jwtToken");
    if (!token) return showPopup('error','Login required');

    const formData = new FormData();
    formData.append('description', document.getElementById('description').value);
    formData.append('type', document.getElementById('type').value);
    formData.append('event_datetime', document.getElementById('event_datetime').value);
    formData.append('location', document.getElementById('location').value);
    formData.append('tags', document.getElementById('tags').value.trim() || '');

    // Add image if present
    const imageFile = document.getElementById('eventImageInput').files[0];
    if (imageFile) formData.append('image', imageFile);

    try {
        let resp;
        if (selectedEventId) {
            resp = await fetch(`/api/events/${selectedEventId}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }, // remove Content-Type
                body: formData
            });
        } else {
            resp = await fetch(`/api/events`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }, // remove Content-Type
                body: formData
            });
        }

        if (!resp.ok) throw new Error('Failed to save event');

        modal.classList.add('hidden');
        modalForm.reset();
        showPopup('success', selectedEventId ? 'Event updated successfully!' : 'Event created successfully!');
        selectedEventId = null;
        await loadEvents(token);

    } catch (err) {
        console.error(err);
        showPopup('error', 'Sorry, but we were unable to save event');
    }
});

// Delete modal button
deleteBtn.addEventListener('click', async () => {
    const token = localStorage.getItem("jwtToken"); // ✅ FIXED
    if (!token) return showPopup('error', 'Login required');
    
    if (!selectedEventId) return;

    const confirmed = await showConfirm('Are you sure you want to delete this event?');
    if (!confirmed) return;

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

        showPopup('success', 'Event deleted successfully!');
    } catch (err) {
        console.error(err);
        showPopup('error', 'Failed to delete event');
    }
});

// listeners
searchInput.addEventListener('input', updateEvents);
categoryFilter.addEventListener('change', updateEvents);
sortFilter.addEventListener('change', updateEvents);
if (tagsFilter) tagsFilter.addEventListener('change', updateEvents);

// default sort
sortFilter.value = 'date-asc';

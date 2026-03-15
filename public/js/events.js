
// Check login and load events
document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("jwtToken");
    if (!token) {
        window.location.href = '/logon.html';
        return;
    }
    await loadEvents(token);
});

// DOM Elements
const eventListEl = document.getElementById('eventList');
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const sortFilter = document.getElementById('sortFilter');
const tagsFilter = document.getElementById('tagsFilter');

let eventsData = [];
let selectedEventId = null;

// Modal Form for Create/Edit
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

// Modal Buttons
const modalForm = document.getElementById('eventForm');
const modalTitle = document.getElementById('modalTitle');
const closeBtn = document.getElementById('closeModalBtn');
const deleteBtn = document.getElementById('deleteEventBtn');

closeBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    selectedEventId = null;
    modalForm.reset();
});

// New Event Button
const newEventBtn = document.getElementById('newEventBtn');
if (newEventBtn) {
    newEventBtn.addEventListener('click', () => {
        openModalForCreate();
    });
}

// Open Modal Functions
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
    modalForm.tags.value = eventData.tags;
    modal.classList.remove('hidden');
    deleteBtn.style.display = 'inline-block';
}


// Fetch Events
async function loadEvents(token) {
    try {
        const response = await fetch("/api/events", {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!response.ok) throw new Error("Failed to fetch events.");
        eventsData = await response.json();
        updateEvents();
    } catch (error) {
        console.error("Error loading events:", error);
        eventListEl.innerHTML = "<div class='empty-message'>Unable to load events.</div>";
    }
}

// Render Events
function renderEvents(events) {
    eventListEl.innerHTML = '';

    if (events.length === 0) {
        eventListEl.innerHTML = '<div class="empty-message">No events match your criteria.</div>';
        return;
    }

    events.forEach(event => {
        const card = document.createElement('div');
        card.classList.add('event-card');

        // Format date & time
        const dateObj = new Date(event.event_datetime);
        const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

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
          </div>
        `;

        eventListEl.appendChild(card);
    });

    // Attach icon listeners
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
            const confirmDelete = confirm("Are you sure you want to delete this event?");
            if (!confirmDelete) return;

            try {
                const token = localStorage.getItem("jwtToken");
                const response = await fetch(`/api/events/${eventId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);

                alert("Event deleted successfully!");
                await loadEvents(token);
            } catch (err) {
                console.error(err);
                alert("Failed to delete event.");
            }
        });
    });
}

// Filter and Sort
function updateEvents() {
    let filtered = [...eventsData];

    const searchTerm = searchInput.value.trim().toLowerCase();
    if (searchTerm) filtered = filtered.filter(event =>
        event.description.toLowerCase().includes(searchTerm) ||
        event.location.toLowerCase().includes(searchTerm) ||
        (event.tags && event.tags.toLowerCase().includes(searchTerm))
    );

    const categoryValue = categoryFilter.value;
    if (categoryValue) filtered = filtered.filter(event => event.type === categoryValue);

    const sortValue = sortFilter.value;
    if (sortValue === 'date-asc') filtered.sort((a,b) => new Date(a.event_datetime) - new Date(b.event_datetime));
    else if (sortValue === 'date-desc') filtered.sort((a,b) => new Date(b.event_datetime) - new Date(a.event_datetime));

    renderEvents(filtered);
}

// Modal Form Submission (Create / Edit)
modalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("jwtToken");

    const payload = {
        description: document.getElementById('description').value,
        type: document.getElementById('type').value,
        event_datetime: document.getElementById('event_datetime').value,
        location: document.getElementById('location').value,
        tags: document.getElementById('tags').value
    };

    try {
        let response;
        if (selectedEventId) {
            response = await fetch(`/api/events/${selectedEventId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
        } else {
            response = await fetch(`/api/events`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
        }

        const data = await response.json();
        if (!response.ok) throw new Error(data.message);

        alert(selectedEventId ? 'Event updated!' : 'Event created!');
        modal.classList.add('hidden');
        modalForm.reset();
        selectedEventId = null;
        await loadEvents(token);
    } catch (err) {
        console.error(err);
        alert('Failed to save event.');
    }
});

// Modal Delete Button
deleteBtn.addEventListener('click', async () => {
    if (!selectedEventId) return;

    const confirmDelete = confirm("Are you sure you want to delete this event?");
    if (!confirmDelete) return;

    try {
        const token = localStorage.getItem("jwtToken");
        const response = await fetch(`/api/events/${selectedEventId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);

        alert("Event deleted successfully!");
        modal.classList.add('hidden');
        modalForm.reset();
        selectedEventId = null;
        await loadEvents(token);
    } catch (err) {
        console.error(err);
        alert("Failed to delete event.");
    }
});

// Event Listeners
searchInput.addEventListener('input', updateEvents);
categoryFilter.addEventListener('change', updateEvents);
sortFilter.addEventListener('change', updateEvents);
tagsFilter.addEventListener('change', updateEvents);

// Initial Setup
sortFilter.value = 'date-asc';
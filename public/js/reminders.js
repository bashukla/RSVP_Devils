// CHECK AUTH ON LOAD
document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("jwtToken");
    if (!token) {
        window.location.href = '/logon.html';
        return;
    }
    loadReminders();
    loadUserEmail();
});

// DOM ELEMENTS
const remindersList = document.getElementById('remindersList');
const cancelledList = document.getElementById('cancelledList');
const emailPreview = document.getElementById('emailPreview');
const userEmailInput = document.getElementById('userEmail');
const notificationContainer = document.getElementById('notificationContainer');
const refreshBtn = document.getElementById('refreshBtn');

// Modal Elements
const modal = document.getElementById('confirmationModal');
const modalTitle = document.getElementById('modalEventTitle');
const modalTime = document.getElementById('modalEventTime');
const modalLocation = document.getElementById('modalEventLocation');
const modalAction = document.getElementById('modalAction');
const modalConfirmBtn = document.getElementById('modalConfirmBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');

// State to hold pending toggle action
let pendingToggle = null; 

// HELPER: Get Token
function getToken() {
    return localStorage.getItem("jwtToken");
}

// HELPER: Show Notification
function showNotification(title, message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <h4>${title}</h4>
            <p>${message}</p>
        </div>
    `;
    notificationContainer.appendChild(notification);
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// HELPER: Format Date
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
}

// HELPER: Format Time
function formatTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// LOAD USER EMAIL (From LocalStorage or Mock for now)
function loadUserEmail() {
    // In a real app, you might decode the JWT to get the email
    // For now, we leave it blank for user to fill or fetch from profile API
    const token = getToken();
    if(token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            if(payload.email) {
                userEmailInput.value = payload.email;
            }
        } catch(e) { console.error("Token parse error", e); }
    }
}

// Store loaded events for preview lookup
let loadedEvents = [];

// PREVIEW EMAIL for a specific event
window.previewEmail = function(eventId) {
    const event = loadedEvents.find(e => e.event_id === eventId);
    if (!event) return;
    updateEmailPreview(event);
    document.querySelector('.card:has(#emailPreview)').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// LOAD REMINDERS FROM API
async function loadReminders() {
    remindersList.innerHTML = '<div class="empty-state"><p>Loading your events...</p></div>';
    cancelledList.innerHTML = '<div class="empty-state"><p>Loading cancelled...</p></div>';

    try {
        const response = await fetch('/api/reminders', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Failed to fetch reminders');
        
        const data = await response.json();
        loadedEvents = data;
        renderReminders(data);
        
        // Update preview with first active reminder
        const active = data.find(r => r.is_active);
        if(active) updateEmailPreview(active);

    } catch (error) {
        console.error(error);
        remindersList.innerHTML = '<div class="empty-state"><p>Error loading reminders. Please log in again.</p></div>';
    }
}

// RENDER REMINDERS
function renderReminders(events) {
    remindersList.innerHTML = '';
    cancelledList.innerHTML = '';

    if (events.length === 0) {
        remindersList.innerHTML = '<div class="empty-state"><p>No upcoming events found.</p><a href="events.html" style="color:var(--asu-maroon)">Browse Events</a></div>';
        return;
    }

    events.forEach(event => {
        const isCancelled = !event.rsvp_id && !event.is_active; 
        // Logic: If rsvp_id exists, they are registered. If is_active is false, reminder is off.
        
        // We will show all events returned, but differentiate status
        const div = document.createElement('div');
        div.className = event.is_active ? 'reminder' : 'cancelled-item';
        
        const statusBadge = event.is_active 
            ? '<span class="status-badge scheduled">Scheduled</span>' 
            : '<span class="status-badge" style="background:#ccc; color:#333;">Disabled</span>';

        const actionText = event.is_active ? 'Disable Reminder' : 'Enable Reminder';
        const toggleState = event.is_active ? 0 : 1; // What it WILL become

        div.innerHTML = `
            <div class="reminder-info">
                <h3>${event.title}</h3>
                <p><strong>Date:</strong> ${formatDate(event.event_datetime)}</p>
                <p><strong>Time:</strong> ${formatTime(event.event_datetime)}</p>
                <p><strong>Location:</strong> ${event.location}</p>
            </div>
            <div class="reminder-status">
                ${statusBadge}
                <button class="btn-secondary" style="padding:5px 10px; font-size:12px; margin-top:5px;" 
                    onclick="openConfirmModal(${event.event_id}, '${event.title}', '${event.event_datetime}', '${event.location}', ${toggleState})">
                    ${actionText}
                </button>
                ${event.is_active ? `<button class="btn-preview" onclick="previewEmail(${event.event_id})">Preview Email</button>` : ''}
            </div>
        `;

        if (event.is_active) {
            remindersList.appendChild(div);
        } else {
            // If disabled/cancelled, show in cancelled list or bottom of main list
            // For this design, let's put disabled reminders in the main list but styled differently
            // OR strictly follow requirement: "Cancelled RSVPs" section
            // Let's put non-active in cancelledList for clarity
            cancelledList.appendChild(div);
        }
    });

    if(cancelledList.children.length === 0) {
        cancelledList.innerHTML = '<div class="empty-state"><p>No cancelled or disabled reminders.</p></div>';
    }
}

// OPEN CONFIRMATION MODAL
window.openConfirmModal = function(id, title, datetime, location, newState) {
    pendingToggle = { id, newState };
    
    modalTitle.innerText = title;
    modalTime.innerText = formatDate(datetime) + ' ' + formatTime(datetime);
    modalLocation.innerText = location;
    modalAction.innerText = newState === 1 ? "ENABLE Reminder" : "DISABLE Reminder";
    modalAction.style.color = newState === 1 ? "var(--success-green)" : "var(--error-red)";
    
    modal.style.display = 'flex';
};

// CLOSE MODAL
function closeModal() {
    modal.style.display = 'none';
    pendingToggle = null;
}

// CONFIRM TOGGLE ACTION
modalConfirmBtn.addEventListener('click', async () => {
    if (!pendingToggle) return;

    // Validate Email .edu
    const email = userEmailInput.value;
    if (!email.endsWith('.edu')) {
        showNotification('Invalid Email', 'Please use your .edu email address for reminders.', 'info');
        closeModal();
        return;
    }

    try {
        const response = await fetch('/api/reminders/toggle', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                event_id: pendingToggle.id,
                is_active: pendingToggle.newState
            })
        });

        if (!response.ok) throw new Error('Failed to update reminder');

        const result = await response.json();
        showNotification('Success', result.message, 'success');
        closeModal();
        loadReminders(); // Refresh list

    } catch (error) {
        console.error(error);
        showNotification('Error', 'Could not update reminder setting.', 'error');
        closeModal();
    }
});

modalCancelBtn.addEventListener('click', closeModal);

// UPDATE EMAIL PREVIEW
function updateEmailPreview(event) {
    const email = userEmailInput.value || 'student@asu.edu';
    emailPreview.innerHTML = `
        <div class="email-header">
            <p><strong>From:</strong> ASU Events &lt;events@asu.edu&gt;</p>
            <p><strong>To:</strong> ${email}</p>
            <p><strong>Subject:</strong> Reminder: ${event.title} - Tomorrow!</p>
        </div>
        <div class="email-body">
            <h3>Event Reminder</h3>
            <p>Hi Sun Devil,</p>
            <p>This is a friendly reminder that you're registered for the following event:</p>
            <div class="email-details">
                <p><strong>Event:</strong> ${event.title}</p>
                <p><strong>Date:</strong> ${formatDate(event.event_datetime)}</p>
                <p><strong>Time:</strong> ${formatTime(event.event_datetime)}</p>
                <p><strong>Location:</strong> ${event.location}</p>
            </div>
            <p>We look forward to seeing you there! Go Devils!</p>
            <div class="email-footer">
                <p>Arizona State University | Sun Devil Central</p>
                <p>To unsubscribe from event reminders, update your preferences in your account settings.</p>
            </div>
        </div>
    `;
}

// REFRESH BUTTON
refreshBtn.addEventListener('click', loadReminders);

// EMAIL INPUT VALIDATION
userEmailInput.addEventListener('blur', () => {
    if (userEmailInput.value && !userEmailInput.value.endsWith('.edu')) {
        userEmailInput.style.borderColor = 'var(--error-red)';
    } else {
        userEmailInput.style.borderColor = '#ddd';
    }
});
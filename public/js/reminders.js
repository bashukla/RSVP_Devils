document.addEventListener('DOMContentLoaded', () => {
  // Mock RSVP Data (events user has registered for)
  const userRSVPs = [
    { 
      eventId: 1, 
      title: "Sun Devil Football vs. UCLA", 
      date: "2023-11-18", 
      time: "7:00 PM", 
      location: "Mountain America Stadium", 
      category: "Sports" 
    },
    { 
      eventId: 2, 
      title: "Engineering Career Fair", 
      date: "2023-11-10", 
      time: "10:00 AM", 
      location: "Sun Devil Fitness Complex", 
      category: "Academic" 
    },
    { 
      eventId: 3, 
      title: "Lemonade Day Concert", 
      date: "2023-11-15", 
      time: "6:00 PM", 
      location: "Memorial Union Patio", 
      category: "Social" 
    }
  ];

  // Cancelled RSVPs (No reminders will be sent for these)
  const cancelledRSVPs = [
    { 
      eventId: 4, 
      title: "Graduate School Prep Workshop", 
      date: "2023-11-12", 
      time: "2:00 PM", 
      location: "Hayden Library Room 101", 
      category: "Academic" 
    }
  ];

  // DOM Elements
  const remindersList = document.getElementById('remindersList');
  const cancelledList = document.getElementById('cancelledList');
  const emailPreview = document.getElementById('emailPreview');
  const emailReminders = document.getElementById('emailReminders');
  const userEmail = document.getElementById('userEmail');
  const simulateSendBtn = document.getElementById('simulateSendBtn');
  const notificationContainer = document.getElementById('notificationContainer');

  // Calculate hours until event
  function getHoursUntilEvent(eventDate) {
    const now = new Date();
    const event = new Date(eventDate);
    const diffMs = event - now;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    return diffHours;
  }

  // Format date for display
  function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  }

  // Show Notification
  function showNotification(title, message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    // Removed icon div to avoid symbols/emojis
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

  // Render Reminders List
  function renderReminders() {
    if (!emailReminders.checked) {
      remindersList.innerHTML = `
        <div class="empty-state">
          <p>Email reminders are currently disabled. Enable them in settings above.</p>
        </div>
      `;
      return;
    }

    if (userRSVPs.length === 0) {
      remindersList.innerHTML = `
        <div class="empty-state">
          <p>No upcoming events with reminders.</p>
          <a href="rsvp.html">RSVP to events</a>
        </div>
      `;
      return;
    }

    remindersList.innerHTML = '';
    
    userRSVPs.forEach((rsvp) => {
      const hoursUntil = getHoursUntilEvent(rsvp.date);
      const willSendReminder = hoursUntil <= 24 && hoursUntil > 0;
      
      const reminderDiv = document.createElement('div');
      reminderDiv.className = 'reminder';
      
      let statusBadge = '';
      let countdownText = '';
      
      if (hoursUntil <= 0) {
        statusBadge = '<span class="status-badge sent">Sent</span>';
        countdownText = 'Event has started';
      } else if (willSendReminder) {
        statusBadge = '<span class="status-badge scheduled">Scheduled</span>';
        countdownText = `Reminder in ${hoursUntil} hours`;
      } else {
        statusBadge = '<span class="status-badge scheduled">Scheduled</span>';
        countdownText = `Reminder 24h before event`;
      }

      reminderDiv.innerHTML = `
        <div class="reminder-info">
          <h3>${rsvp.title}</h3>
          <p><strong>Date:</strong> ${formatDate(rsvp.date)}</p>
          <p><strong>Time:</strong> ${rsvp.time}</p>
          <p><strong>Location:</strong> ${rsvp.location}</p>
        </div>
        <div class="reminder-status">
          ${statusBadge}
          <span class="countdown">${countdownText}</span>
        </div>
      `;
      
      remindersList.appendChild(reminderDiv);
    });

    // Update email preview with first event
    if (userRSVPs.length > 0) {
      updateEmailPreview(userRSVPs[0]);
    }
  }

  // Render Cancelled RSVPs
  function renderCancelled() {
    if (cancelledRSVPs.length === 0) {
      cancelledList.innerHTML = '<div class="empty-state"><p>No cancelled RSVPs</p></div>';
      return;
    }

    cancelledList.innerHTML = '';
    
    cancelledRSVPs.forEach(rsvp => {
      const cancelledDiv = document.createElement('div');
      cancelledDiv.className = 'cancelled-item';
      cancelledDiv.innerHTML = `
        <h4>${rsvp.title}</h4>
        <p><strong>Date:</strong> ${formatDate(rsvp.date)} at ${rsvp.time}</p>
        <p><strong>Location:</strong> ${rsvp.location}</p>
        <p style="color: var(--error-red); font-weight: 700; margin-top: 10px;">
          No reminder will be sent (RSVP cancelled)
        </p>
      `;
      cancelledList.appendChild(cancelledDiv);
    });
  }

  // Update Email Preview
  function updateEmailPreview(rsvp) {
    const email = userEmail.value || 'student@asu.edu';
    
    emailPreview.innerHTML = `
      <div class="email-header">
        <p><strong>From:</strong> ASU Events &lt;events@asu.edu&gt;</p>
        <p><strong>To:</strong> ${email}</p>
        <p><strong>Subject:</strong> Reminder: ${rsvp.title} - Tomorrow!</p>
      </div>
      <div class="email-body">
        <h3>Event Reminder</h3>
        <p>Hi Sun Devil,</p>
        <p>This is a friendly reminder that you're registered for the following event:</p>
        
        <div class="email-details">
          <p><strong>Event:</strong> ${rsvp.title}</p>
          <p><strong>Date:</strong> ${formatDate(rsvp.date)}</p>
          <p><strong>Time:</strong> ${rsvp.time}</p>
          <p><strong>Location:</strong> ${rsvp.location}</p>
          <p><strong>Category:</strong> ${rsvp.category}</p>
        </div>
        
        <p>We look forward to seeing you there! Go Devils!</p>
        <p>Questions? Reply to this email or contact ASU Events.</p>
        
        <div class="email-footer">
          <p>Arizona State University | Sun Devil Central</p>
          <p>To unsubscribe from event reminders, update your preferences in your account settings.</p>
        </div>
      </div>
    `;
  }

  // Simulate Send Reminder
  simulateSendBtn.addEventListener('click', () => {
    if (!emailReminders.checked) {
      showNotification('Reminders Disabled', 'Please enable email reminders in settings.', 'info');
      return;
    }

    if (userRSVPs.length === 0) {
      showNotification('No Events', 'You have no upcoming events to send reminders for.', 'info');
      return;
    }

    // Simulate sending
    showNotification(
      'Reminders Sent', 
      `${userRSVPs.length} reminder email(s) sent to ${userEmail.value}`, 
      'success'
    );

    // Update status badges to "Sent"
    const statusBadges = document.querySelectorAll('.status-badge');
    statusBadges.forEach(badge => {
      badge.className = 'status-badge sent';
      badge.innerHTML = 'Sent';
    });
  });

  // Event Listeners
  emailReminders.addEventListener('change', renderReminders);
  userEmail.addEventListener('input', () => {
    if (userRSVPs.length > 0) {
      updateEmailPreview(userRSVPs[0]);
    }
  });

  // Initial Load
  renderReminders();
  renderCancelled();
});
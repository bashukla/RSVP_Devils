document.addEventListener('DOMContentLoaded', () => {
  // 1. Mock Data (Resets on every page load/refresh)
  const eventsData = [
    {
      id: 1,
      title: "Sun Devil Football vs. UCLA",
      date: "2023-11-18",
      time: "7:00 PM",
      location: "Mountain America Stadium",
      category: "Sports",
      description: "Come support the Devils in this crucial Pac-12 matchup.",
      capacity: 100,
      rsvpCount: 45
    },
    {
      id: 2,
      title: "Engineering Career Fair",
      date: "2023-11-10",
      time: "10:00 AM",
      location: "Sun Devil Fitness Complex",
      category: "Academic",
      description: "Meet top recruiters from tech companies looking for ASU grads.",
      capacity: 50,
      rsvpCount: 49
    },
    {
      id: 3,
      title: "Lemonade Day Concert",
      date: "2023-11-15",
      time: "6:00 PM",
      location: "Memorial Union Patio",
      category: "Social",
      description: "Free concert featuring student bands and local food trucks.",
      capacity: 200,
      rsvpCount: 156
    },
    {
      id: 4,
      title: "Graduate School Prep Workshop",
      date: "2023-11-12",
      time: "2:00 PM",
      location: "Hayden Library Room 101",
      category: "Academic",
      description: "Learn how to write personal statements and prepare for GRE.",
      capacity: 30,
      rsvpCount: 30
    },
    {
      id: 5,
      title: "Basketball Season Opener",
      date: "2023-11-20",
      time: "8:00 PM",
      location: "Desert Financial Arena",
      category: "Sports",
      description: "Tip off the season with the men's basketball team.",
      capacity: 75,
      rsvpCount: 12
    }
  ];

  // 2. Volatile State (Resets on Page Refresh)
  let userRSVPs = []; 

  // 3. DOM Elements
  const eventListEl = document.getElementById('eventList');
  const searchInput = document.getElementById('searchInput');
  const categoryFilter = document.getElementById('categoryFilter');
  const notificationContainer = document.getElementById('notificationContainer');

  // 4. Show Notification Function
  function showNotification(title, message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icon = type === 'success' ? '✓' : (type === 'error' ? '✕' : 'ℹ');
    const color = type === 'success' ? 'var(--success-green)' : (type === 'error' ? 'var(--error-red)' : 'var(--cancel-orange)');
    
    notification.innerHTML = `
      <div class="notification-icon" style="color:${color}">${icon}</div>
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

  // 5. Handle RSVP/Cancel Click
  window.handleRSVP = function(eventId) {
    const event = eventsData.find(e => e.id === eventId);
    if (!event) return;
    
    const isRsvped = userRSVPs.includes(eventId);

    // If already RSVP'd, allow CANCEL
    if (isRsvped) {
      event.rsvpCount--;
      userRSVPs = userRSVPs.filter(id => id !== eventId);
      
      showNotification(
        'RSVP Cancelled', 
        `You are no longer registered for ${event.title}.`, 
        'info'
      );
    } 
    // If NOT RSVP'd, allow REGISTER
    else {
      if (event.rsvpCount >= event.capacity) {
        showNotification('Event Full', `Sorry, ${event.title} has reached capacity.`, 'error');
        return;
      }
      
      event.rsvpCount++;
      userRSVPs.push(eventId);
      
      showNotification(
        'RSVP Confirmed! ⚡', 
        `You're registered for ${event.title}. Check your email for reminders!`, 
        'success'
      );
    }
    
    renderEvents();
  };

  // 6. Render Events
  function renderEvents() {
    eventListEl.innerHTML = '';
    
    const searchTerm = searchInput.value.toLowerCase();
    const categoryValue = categoryFilter.value;

    let filtered = eventsData.filter(event => {
      const matchesSearch = event.title.toLowerCase().includes(searchTerm) || 
                            event.description.toLowerCase().includes(searchTerm);
      const matchesCategory = categoryValue ? event.category === categoryValue : true;
      return matchesSearch && matchesCategory;
    });

    filtered.sort((a, b) => new Date(a.date) - new Date(b.date));

    if (filtered.length === 0) {
      eventListEl.innerHTML = '<div class="empty-message">No events match your criteria.</div>';
      return;
    }

    filtered.forEach(event => {
      const card = document.createElement('div');
      card.classList.add('event-card');

      const dateObj = new Date(event.date);
      const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      const isRsvped = userRSVPs.includes(event.id);
      const isFull = event.rsvpCount >= event.capacity;
      const spotsLeft = event.capacity - event.rsvpCount;

      // Determine Button State
      let buttonClass = 'available';
      let buttonText = 'RSVP Now';
      let disabled = '';

      if (isRsvped) {
        buttonClass = 'cancel';
        buttonText = 'Cancel RSVP';
      } else if (isFull) {
        buttonClass = 'full';
        buttonText = 'Event Full';
        disabled = 'disabled';
      }

      card.innerHTML = `
        <div class="card-header">
          <span class="card-category">${event.category}</span>
          <span class="rsvp-count">${event.rsvpCount}/${event.capacity} Going</span>
        </div>
        <div class="card-body">
          <h3 class="event-title">${event.title}</h3>
          <div class="event-details"><strong>Date:</strong> ${dateStr}</div>
          <div class="event-details"><strong>Time:</strong> ${event.time}</div>
          <div class="event-details"><strong>Location:</strong> ${event.location}</div>
          <p class="event-description">${event.description}</p>
          ${!isFull && !isRsvped ? `<p style="color: var(--asu-maroon); font-size: 13px; margin-top: 10px;"><strong>${spotsLeft}</strong> spots remaining!</p>` : ''}
        </div>
        <div class="card-actions">
          <button class="rsvp-button ${buttonClass}" onclick="handleRSVP(${event.id})" ${disabled}>
            ${buttonText}
          </button>
        </div>
      `;
      eventListEl.appendChild(card);
    });
  }

  // 7. Event Listeners
  searchInput.addEventListener('input', renderEvents);
  categoryFilter.addEventListener('change', renderEvents);

  // 8. Initial Load
  renderEvents();
});
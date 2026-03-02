// 1. Mock Data (ASU Themed)
const eventsData = [
  {
    id: 1,
    title: "Sun Devil Football vs. UCLA",
    date: "2023-11-18",
    time: "7:00 PM",
    location: "Mountain America Stadium",
    category: "Sports",
    description: "Come support the Devils in this crucial Pac-12 matchup."
  },
  {
    id: 2,
    title: "Engineering Career Fair",
    date: "2023-11-10",
    time: "10:00 AM",
    location: "Sun Devil Fitness Complex",
    category: "Academic",
    description: "Meet top recruiters from tech companies looking for ASU grads."
  },
  {
    id: 3,
    title: "Lemonade Day Concert",
    date: "2023-11-15",
    time: "6:00 PM",
    location: "Memorial Union Patio",
    category: "Social",
    description: "Free concert featuring student bands and local food trucks."
  },
  {
    id: 4,
    title: "Graduate School Prep Workshop",
    date: "2023-11-12",
    time: "2:00 PM",
    location: "Hayden Library Room 101",
    category: "Academic",
    description: "Learn how to write personal statements and prepare for GRE."
  },
  {
    id: 5,
    title: "Basketball Season Opener",
    date: "2023-11-20",
    time: "8:00 PM",
    location: "Desert Financial Arena",
    category: "Sports",
    description: "Tip off the season with the men's basketball team."
  }
];

// 2. Select DOM Elements
const eventListEl = document.getElementById('eventList');
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const sortFilter = document.getElementById('sortFilter');

// 3. Render Function
function renderEvents(events) {
  eventListEl.innerHTML = ''; // Clear current list

  if (events.length === 0) {
    eventListEl.innerHTML = '<div class="empty-message">No events match your criteria.</div>';
    return;
  }

  events.forEach(event => {
    const card = document.createElement('div');
    card.classList.add('event-card');

    // Format Date for display
    const dateObj = new Date(event.date);
    const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    card.innerHTML = `
      <div class="card-header">
        <span class="card-category">${event.category}</span>
      </div>
      <div class="card-body">
        <h3 class="event-title">${event.title}</h3>
        <div class="event-details"><strong>Date:</strong> ${dateStr}</div>
        <div class="event-details"><strong>Time:</strong> ${event.time}</div>
        <div class="event-details"><strong>Location:</strong> ${event.location}</div>
        <p class="event-description">${event.description}</p>
      </div>
    `;
    eventListEl.appendChild(card);
  });
}

// 4. Filter and Sort Logic
function updateEvents() {
  let filtered = [...eventsData];

  // Search Filter
  const searchTerm = searchInput.value.toLowerCase();
  if (searchTerm) {
    filtered = filtered.filter(event => 
      event.title.toLowerCase().includes(searchTerm) || 
      event.description.toLowerCase().includes(searchTerm)
    );
  }

  // Category Filter
  const categoryValue = categoryFilter.value;
  if (categoryValue) {
    filtered = filtered.filter(event => event.category === categoryValue);
  }

  // Sort Filter
  const sortValue = sortFilter.value;
  if (sortValue === 'date-asc') {
    filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
  } else if (sortValue === 'date-desc') {
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  renderEvents(filtered);
}

// 5. Event Listeners
searchInput.addEventListener('input', updateEvents);
categoryFilter.addEventListener('change', updateEvents);
sortFilter.addEventListener('change', updateEvents);

// 6. Initial Load
// Sort by date ascending by default to meet User Story requirement
sortFilter.value = 'date-asc'; 
updateEvents();
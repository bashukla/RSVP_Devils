// prevent multiple initializations
let isCarouselInitialized = false;
let isTransitioning = false;

// carousel state
let currentIndex = 1;
let autoSlide;

// check for jwt token when page loads
document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("jwtToken");
    if (!token) {
        window.location.href = '/logon.html';
        return;
    }
    await loadHighlightedEvents();
    setupFilters();
});

// load highlighted events
// ── Filter dropdown ──────────────────────────────────────────

const STORAGE_KEY = 'carouselEventTypePrefs';

// Returns Set of event types the user wants to see.
// If nothing saved yet, returns null (meaning "show all").
function getSavedPrefs() {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : null;
}

function savePrefs(typesSet) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...typesSet]));
}

// ── Updated loadHighlightedEvents ────────────────────────────

async function loadHighlightedEvents() {
    try {
        const track = document.getElementById('highlightCarousel');
        if (!track) {
            console.error('highlightCarousel not found');
            return;
        }

        const resp = await fetch('/api/events');
        if (!resp.ok) throw new Error('failed to fetch events');

        const events = await resp.json();
        window._allCarouselEvents = events;

        // Build dynamic filter buttons from actual event types
        const now = new Date();
        const upcoming = events.filter(e => new Date(e.event_datetime) >= now);
        const allTypes = [...new Set(upcoming.map(e => e.type).filter(Boolean))];
        buildFilterButtons(allTypes);

        applyCarouselFilters();

    } catch (err) {
        console.error('carousel error:', err);
    }
}

// Build dynamic filter pill buttons from actual event types
function buildFilterButtons(allTypes) {
    const container = document.querySelector('.carousel-filters');
    if (!container) return;

    // Keep the "All" button, remove any dynamically added ones
    container.querySelectorAll('.cat-filter:not([data-cat="All"])').forEach(b => b.remove());

    allTypes.forEach(type => {
        const btn = document.createElement('button');
        btn.className = 'cat-filter';
        btn.dataset.cat = type;
        btn.textContent = type;
        container.appendChild(btn);
    });

    setupFilters();
}

// Apply category filters and render
function applyCarouselFilters() {
    const events = window._allCarouselEvents || [];
    const saved = getSavedPrefs();
    const now = new Date();

    let filtered = events.filter(e => new Date(e.event_datetime) >= now);

    if (saved && saved.size > 0) {
        const withFilter = filtered.filter(e => saved.has(e.type));
        filtered = withFilter.length > 0 ? withFilter : filtered;
    }

    filtered = filtered
        .sort((a, b) => new Date(a.event_datetime) - new Date(b.event_datetime))
        .slice(0, 5);

    const track = document.getElementById('highlightCarousel');
    if (filtered.length === 0) {
        track.innerHTML = "<p style='color:white;text-align:center;padding:20px;'>No events match your interests.</p>";
        return;
    }

    renderCarousel(filtered);
    setupCarousel();
}

// Setup filter toggle buttons
function setupFilters() {
    const saved = getSavedPrefs();
    const buttons = document.querySelectorAll('.cat-filter');

    buttons.forEach(btn => {
        // Remove old listeners by cloning
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
    });

    document.querySelectorAll('.cat-filter').forEach(btn => {
        const cat = btn.dataset.cat;
        const isActive = !saved || saved.size === 0 
            ? cat === 'All' 
            : saved.has(cat);
        if (isActive) btn.classList.add('active');
        else btn.classList.remove('active');

        btn.addEventListener('click', () => {
            if (cat === 'All') {
                document.querySelectorAll('.cat-filter').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                localStorage.removeItem(STORAGE_KEY);
            } else {
                document.querySelector('.cat-filter[data-cat="All"]').classList.remove('active');
                btn.classList.toggle('active');

                const active = [...document.querySelectorAll('.cat-filter.active')]
                    .map(b => b.dataset.cat)
                    .filter(c => c !== 'All');

                if (active.length === 0) {
                    document.querySelector('.cat-filter[data-cat="All"]').classList.add('active');
                    localStorage.removeItem(STORAGE_KEY);
                } else {
                    savePrefs(new Set(active));
                }
            }
            applyCarouselFilters();
        });
    });
}

// render cards
function renderCarousel(events) {
    const track = document.getElementById('highlightCarousel');
    track.innerHTML = '';

    events.forEach(event => {
        const card = document.createElement('div');
        card.classList.add('carousel-card');

        const date = new Date(event.event_datetime);
        const dateStr = date.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });
        const timeStr = date.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });

        card.innerHTML = `
        <div class="carousel-card-inner">
            <span class="carousel-badge">${event.type || 'Event'}</span>
            <div class="image-wrapper">
                <img src="${event.image ? `/uploads/${event.image}` : '/images/ASU Logos/Arizona-State-Sun-Devils-logo.png'}" class="event-image" onerror="this.src='/images/ASU Logos/Arizona-State-Sun-Devils-logo.png'">
            </div>
            <div class="carousel-info">
                <h3>${event.description}</h3>
                <p><strong>Date:</strong> ${dateStr}</p>
                <p><strong>Time:</strong> ${timeStr}</p>
                <p><strong>Location:</strong> ${event.location}</p>
            </div>
        </div>
        `;

        // OPTIONAL: store id for future use
        card.dataset.id = event.id;

        track.appendChild(card);
    });
}

// setup infinite carousel 
function setupCarousel() {
    const track = document.getElementById('highlightCarousel');

    // hard reset to clear old clones/listeners
    track.innerHTML = track.innerHTML;
    track.style.transition = 'none';

    const slides = Array.from(track.children);
    if (slides.length === 0) return;

    currentIndex = 1;

    // remove old listeners (critical fix)
    const newTrack = track.cloneNode(true);
    track.parentNode.replaceChild(newTrack, track);

    const freshTrack = document.getElementById('highlightCarousel');
    const freshSlides = Array.from(freshTrack.children);
    if (freshSlides.length === 0) return;

    // clone once per fresh setup
    const firstClone = freshSlides[0].cloneNode(true);
    const lastClone = freshSlides[freshSlides.length - 1].cloneNode(true);

    freshTrack.appendChild(firstClone);
    freshTrack.insertBefore(lastClone, freshSlides[0]);

    freshTrack.style.transform = 'translateX(-100%)';

    // transition handler
    freshTrack.addEventListener('transitionend', handleTransitionEnd);

    // event delegation for card clicks 
    freshTrack.addEventListener('click', (e) => {
        const card = e.target.closest('.carousel-card');
        if (card) {
            window.location.href = '/events.html';
        
        }
    });

    startAutoSlide();

    // pause on hover
    const container = document.querySelector('.highlight-container');

    if (container) {
        container.removeEventListener('mouseenter', pauseAutoSlide);
        container.removeEventListener('mouseleave', startAutoSlide);

        container.addEventListener('mouseenter', pauseAutoSlide);
        container.addEventListener('mouseleave', startAutoSlide);
    }
}

// handle seamless infinite loop reset
function handleTransitionEnd() {
    const track = document.getElementById('highlightCarousel');
    const slides = track.children;

    if (!slides || slides.length < 3) {
        isTransitioning = false;
        return;
    }

    const lastIndex = slides.length - 1;

    // if at clone (end)
    if (currentIndex === lastIndex) {
        track.style.transition = 'none';
        currentIndex = 1;
        track.style.transform = 'translateX(-100%)';
    }

    // if at clone (start)
    if (currentIndex === 0) {
        track.style.transition = 'none';
        currentIndex = slides.length - 2;
        track.style.transform = `translateX(-${currentIndex * 100}%)`;
    }

    isTransitioning = false;
}

// move slide
function moveSlide(direction) {
    const track = document.getElementById('highlightCarousel');

    if (isTransitioning) return;

    isTransitioning = true;

    currentIndex += direction;

    track.style.transition = 'transform 0.5s ease';
    track.style.transform = `translateX(-${currentIndex * 100}%)`;
}

// auto slide
function startAutoSlide() {
    clearInterval(autoSlide);

    autoSlide = setInterval(() => {
        moveSlide(1);
    }, 4000);
}

// pause auto slide
function pauseAutoSlide() {
    clearInterval(autoSlide);
}

// reset auto slide
function resetAutoSlide() {
    startAutoSlide();
}

// navigation buttons
const nextBtn = document.getElementById('nextBtn');
const prevBtn = document.getElementById('prevBtn');

if (nextBtn && prevBtn) {
    nextBtn.addEventListener('click', () => {
        moveSlide(1);
        resetAutoSlide();
    });

    prevBtn.addEventListener('click', () => {
        moveSlide(-1);
        resetAutoSlide();
    });
}
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

// BACKGROUND PICKER
const bgOptions = document.querySelectorAll('.bg-option');

// Apply saved background on load
const savedBg = localStorage.getItem('homeBg');
if (savedBg) window.applyBackground(savedBg);

bgOptions.forEach(option => {
    const bg = option.dataset.bg;

    // Mark active option
    if (bg === savedBg) option.classList.add('active');

    option.addEventListener('click', () => {
        bgOptions.forEach(o => o.classList.remove('active'));
        option.classList.add('active');
        localStorage.setItem('homeBg', bg);
        applyBackground(bg);
    });
});

function applyBackground(bg) {
    if (bg === 'none') {
        document.body.style.backgroundImage = 'none';
        document.body.style.backgroundColor = '#f5f6fa';
    } else if (bg.startsWith('url')) {
        document.body.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), ${bg}`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundAttachment = 'fixed';
        document.body.style.backgroundPosition = 'center';
    } else {
        document.body.style.backgroundImage = bg;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundAttachment = 'fixed';
    }
}

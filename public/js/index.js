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
});

// logout button functionality
const logoutBtn = document.getElementById('logoutBtn');

logoutBtn.addEventListener('click', async () => {
    const confirm = await showConfirm('Are you sure you want to logout?');
    if(!confirm) return;
    localStorage.clear('jwtToken');
    window.location = '/logon.html';
});

// load highlighted events
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

        const now = new Date();

        const upcoming = events
            .filter(e => new Date(e.event_datetime) >= now)
            .sort((a, b) => new Date(a.event_datetime) - new Date(b.event_datetime))
            .slice(0, 5);

        if (upcoming.length === 0) {
            track.innerHTML = "<p>No upcoming events</p>";
            return;
        }

        renderCarousel(upcoming);
        setupCarousel();

    } catch (err) {
        console.error('carousel error:', err);
    }
}

// render cards
function renderCarousel(events) {
    const track = document.getElementById('highlightCarousel');
    track.innerHTML = '';

    events.forEach(event => {
        const card = document.createElement('div');
        card.classList.add('carousel-card');

        const date = new Date(event.event_datetime);

        card.innerHTML = `
        
        <div class="image-wrapper">
        <img src="${event.image ? `/images/uploads/${event.image}` : '/images/Arizona-State-Sun-Devils-logo.png'}" class="event-image">

            <h3>${event.description}</h3>
            <p>${date.toLocaleDateString()}</p>
            <p>${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            <p>${event.location}</p>
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
const token = localStorage.getItem('jwtToken');

// ── POPUP SYSTEM (matches events.js) ──────────────────────
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

// ── EMAIL DISPLAY ──────────────────────────────────────────
function getEmailFromToken() {
    try {
        const payload = token.split('.')[1];
        const decoded = JSON.parse(atob(payload));
        return decoded.email;
    } catch (e) {
        return 'Unable to load email';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('accountEmail').textContent = getEmailFromToken();
});

// ── PASSWORD SECTION TOGGLE ────────────────────────────────
function togglePasswordSection() {
    const section = document.getElementById('passwordSection');
    section.classList.toggle('visible');
}

// ── SAVE ACCOUNT / CHANGE PASSWORD ────────────────────────
function saveAccountInfo() {
    const currentPass = document.getElementById('currentPassword').value;
    const newPass     = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmPassword').value;
    const section     = document.getElementById('passwordSection');

    if (section.classList.contains('visible')) {
        if (!currentPass) {
            showPopup('error', 'Please enter your current password.');
            return;
        }
        if (!newPass) {
            showPopup('error', 'Please enter a new password.');
            return;
        }
        if (newPass.length < 8) {
            showPopup('error', 'Password must be at least 8 characters.');
            return;
        }
        if (newPass !== confirmPass) {
            showPopup('error', 'Passwords do not match.');
            return;
        }

        fetch('/api/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ currentPassword: currentPass, newPassword: newPass })
        })
        .then(res => res.json())
        .then(data => {
            if (data.message === 'Password changed successfully.') {
                showPopup('success', 'Password changed successfully!');
                document.getElementById('currentPassword').value = '';
                document.getElementById('newPassword').value = '';
                document.getElementById('confirmPassword').value = '';
                document.getElementById('passwordSection').classList.remove('visible');
            } else {
                showPopup('error', data.message);
            }
        })
        .catch(() => showPopup('error', 'Error connecting to server.'));

        return;
    }

    showPopup('success', 'Account info saved successfully!');
}

// ── NOTIFICATIONS ──────────────────────────────────────────
function saveNotifications() {
    showPopup('success', 'Notification preferences updated!');
}

// ── DELETE ACCOUNT ─────────────────────────────────────────
async function confirmDelete() {
    const confirmed = await showConfirm(
        'Are you sure you want to permanently delete your account? This cannot be undone.'
    );
    if (!confirmed) return;

    try {
        const resp = await fetch('/api/delete-account', {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
        });

        const data = await resp.json();

        if (resp.ok) {
            showPopup('success', 'Account deleted. Goodbye!');
            setTimeout(() => {
                localStorage.clear();
                window.location.href = '/logon.html';
            }, 2000);
        } else {
            showPopup('error', data.message);
        }
    } catch (error) {
        showPopup('error', 'Error connecting to server.');
    }
}
//Fetch account creation
document.addEventListener("DOMContentLoaded", loadUserInfo);

async function loadUserInfo() {
    const token = localStorage.getItem("jwtToken");

    if (!token) {
        console.error("No token found");
        return;
    }

    try {
        const resp = await fetch('/api/user-info', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!resp.ok) throw new Error("Failed to fetch user info");

        const data = await resp.json();

        // 👇 THIS is where you update UI
        displayUserInfo(data);

    } catch (err) {
        console.error("Error loading user info:", err);
    }
}
function displayUserInfo(user) {
    const createdE1 = document.getElementById("creationDisplay");

    //Date Format code
    const date = new Date(user.created_at);
    const formatted = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    createdE1.textContent = formatted;
}

// ── BACKGROUND PICKER ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const bgOptions = document.querySelectorAll('.bg-option');
    const savedBg = localStorage.getItem('homeBg');

    bgOptions.forEach(option => {
        const bg = option.dataset.bg;
        if (bg === savedBg) option.classList.add('active');

        option.addEventListener('click', () => {
            bgOptions.forEach(o => o.classList.remove('active'));
            option.classList.add('active');
            localStorage.setItem('homeBg', bg);
            showPopup('success', 'Background updated!');
        });
    });
});

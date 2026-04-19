function getTokenPayload() {
    const token = localStorage.getItem('jwtToken');
    if (!token) return null;
    try {
        const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(base64));
    } catch {
        return null;
    }
}

function applyRoleVisibility() {
    const payload = getTokenPayload();
    if (!payload || payload.role !== 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = 'none';
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const hamburger = document.getElementById("hamburger");
    const navMenu = document.getElementById("navMenu");
    const overlay = document.getElementById("overlay");
    const profileBtn = document.getElementById("profileBtn");
    const profileDropdown = document.getElementById("profileDropdown");
    const dropdownLogout = document.getElementById("dropdownLogout");

    // Hamburger - slide from left
    if (hamburger && navMenu && overlay) {
        hamburger.addEventListener("click", () => {
            navMenu.classList.toggle("show");
            overlay.classList.toggle("show");
        });

        overlay.addEventListener("click", () => {
            navMenu.classList.remove("show");
            overlay.classList.remove("show");
            if (profileDropdown) profileDropdown.classList.add("hidden");
        });

        document.querySelectorAll("#navMenu a").forEach(link => {
            link.addEventListener("click", () => {
                navMenu.classList.remove("show");
                overlay.classList.remove("show");
            });
        });
    }

    // Profile dropdown toggle
    if (profileBtn && profileDropdown) {
        profileBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            profileDropdown.classList.toggle("hidden");
        });

        document.addEventListener("click", () => {
            profileDropdown.classList.add("hidden");
        });

        profileDropdown.addEventListener("click", (e) => e.stopPropagation());
    }

    // Logout from dropdown
    if (dropdownLogout) {
        dropdownLogout.addEventListener("click", (e) => {
            e.preventDefault();
            localStorage.removeItem("jwtToken");
            window.location.href = "/logon.html";
        });
    }

    // Active page highlight
    const currentPage = window.location.pathname;
    document.querySelectorAll("#navMenu a").forEach(link => {
        if (link.getAttribute("href") === currentPage) {
            link.classList.add("active");
        }
    });

    // ← ADD THIS: hide admin-only nav links for non-admins
    applyRoleVisibility();
});

function goDashboard() {
    window.location.href = "/index.html";
}

function handleExpiredToken() {
    localStorage.removeItem("jwtToken");
    window.location.href = "/logon.html?reason=expired";
}

(function checkTokenExpiry() {
    const token = localStorage.getItem("jwtToken");
    if (!token) return;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp && Date.now() / 1000 > payload.exp) {
            handleExpiredToken();
        }
    } catch(e) {}
})();
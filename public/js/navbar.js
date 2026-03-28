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
});

function goDashboard() {
    window.location.href = "/index.html";
}

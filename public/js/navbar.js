document.addEventListener("DOMContentLoaded", () => {
    const hamburger = document.getElementById("hamburger");
    const navMenu = document.getElementById("navMenu");
    const overlay = document.getElementById("overlay");

    if (hamburger && navMenu && overlay) {
        hamburger.addEventListener("click", () => {
            navMenu.classList.toggle("show");
            overlay.classList.toggle("show");
        });

        overlay.addEventListener("click", () => {
            navMenu.classList.remove("show");
            overlay.classList.remove("show");
        });

        // close menu when clicking a link
        document.querySelectorAll("#navMenu a").forEach(link => {
            link.addEventListener("click", () => {
                navMenu.classList.remove("show");
                overlay.classList.remove("show");
            });
        });
    }
});

/* BACK BUTTON FUNCTION */
function goDashboard() {
    window.location.href = "/index.html";
}
// ACTIVE PAGE HIGHLIGHT
const currentPage = window.location.pathname;

document.querySelectorAll("#navMenu a").forEach(link => {
    if (link.getAttribute("href") === currentPage) {
        link.classList.add("active");
    }
});
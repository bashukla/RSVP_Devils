// Check for JWT token when page loads
document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("jwtToken");
    if (!token) {
        window.location.href = '/logon.html';
    }
});

// Logout button functionality
const logoutBtn = document.getElementById('logoutBtn');

if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {

        // Remove token from browser storage
        localStorage.removeItem('jwtToken');

        // Redirect to login page
        window.location.href = '/logon.html';
    });
}
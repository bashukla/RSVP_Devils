// Show/hide the password fields when "Change Password?" is clicked
function togglePasswordSection() {
  const section = document.getElementById('passwordSection');
  section.classList.toggle('visible'); // adds or removes the class
}

// Slide a toast message up from the bottom, then hide it
function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// Validate and save account info
function saveAccountInfo() {
  const newPass     = document.getElementById('newPassword').value;
  const confirmPass = document.getElementById('confirmPassword').value;
  const section     = document.getElementById('passwordSection');

  // Only validate passwords if the section is open
  if (section.classList.contains('visible')) {
    if (newPass && newPass !== confirmPass) {
      showToast('⚠️ Passwords do not match.');
      return; // stop here, don't save
    }
    if (newPass && newPass.length < 8) {
      showToast('⚠️ Password must be at least 8 characters.');
      return;
    }
  }

  // If all checks pass:
  showToast('✅ Account info saved successfully!');
}

// Save notification toggle states
function saveNotifications() {
  showToast('✅ Notification preferences updated!');
}

// Confirm before deleting account
function confirmDelete() {
  const confirmed = confirm(
    'Are you sure you want to permanently delete your account? This cannot be undone.'
  );
  if (confirmed) {
    showToast('Account deletion requested. Goodbye! 👋');
    // TODO: call your backend delete endpoint here
  }
}
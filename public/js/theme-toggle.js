(function () {
  if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.classList.add('dark');
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('theme-toggle-btn');
    if (!btn) return;

    updateIcon(btn);

    btn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      updateIcon(btn);
    });
  });

  function updateIcon(btn) {
    const isDark = document.documentElement.classList.contains('dark');
    btn.innerHTML = isDark
      ? '<i class="fas fa-sun"></i>'
      : '<i class="fas fa-moon"></i>';
    btn.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
  }
})();
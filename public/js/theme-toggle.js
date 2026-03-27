(function () {
  // Fix #2 — correct target
  if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.classList.add('dark');
  }

  // Fix #3 — correct event name spelling
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('theme-toggle-btn');
    if (!btn) return;

    updateLabel(btn);

    btn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      updateLabel(btn);
    });
  });

  // Fix #4 — consistent spelling
  function updateLabel(btn) {
    const isDark = document.documentElement.classList.contains('dark');
    btn.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
  }
})();
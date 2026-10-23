// Run before styles load to avoid flashing the wrong theme on repeat visits.
(() => {
  const key = 'maple-mvp:theme';
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = 'system';
  try {
    const saved = localStorage.getItem(key);
    if (['light', 'dark', 'system'].includes(saved)) preference = saved;
  } catch { /* Theme switching still works when storage is unavailable. */ }

  function apply() {
    const theme = preference === 'system' ? (system.matches ? 'dark' : 'light') : preference;
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#191b19' : '#f7f6f2');
    document.querySelectorAll('[data-theme-choice]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.themeChoice === preference));
    });
  }
  apply();
  system.addEventListener('change', () => { if (preference === 'system') apply(); });
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.querySelectorAll('[data-theme-choice]').forEach(button => {
      button.addEventListener('click', () => {
        preference = button.dataset.themeChoice;
        try { localStorage.setItem(key, preference); } catch { /* Keep session choice. */ }
        apply();
      });
    });
  });
})();

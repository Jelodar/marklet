(() => {
  try {
    const theme = localStorage.getItem('marklet-theme') || 'system';
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      return;
    }
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      return;
    }
    if (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch (error) {}
})();

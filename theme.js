// Theme Manager: Light / Dark Mode
(function () {
  const STORAGE_KEY = "realEstateTheme";
  const ROOT = document.documentElement;

  function safeGetSavedTheme() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === "dark" || saved === "light" ? saved : "";
    } catch (_) {
      return "";
    }
  }

  function safeSaveTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (_) {}
  }

  function getPreferredTheme() {
    const saved = safeGetSavedTheme();
    if (saved) return saved;

    const prefersDark = window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    return prefersDark ? "dark" : "light";
  }

  function syncThemeButtons(theme) {
    const buttons = document.querySelectorAll("[data-theme-toggle]");
    buttons.forEach((button) => {
      button.textContent = theme === "dark" ? "☀️ Light" : "🌙 Dark";
      button.setAttribute(
        "aria-label",
        theme === "dark" ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن"
      );
      button.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    });
  }

  function applyTheme(theme) {
    const nextTheme = theme === "dark" ? "dark" : "light";
    ROOT.setAttribute("data-theme", nextTheme);
    safeSaveTheme(nextTheme);
    syncThemeButtons(nextTheme);
  }

  function toggleTheme() {
    const current = ROOT.getAttribute("data-theme") || getPreferredTheme();
    applyTheme(current === "dark" ? "light" : "dark");
  }

  // Apply as early as possible so CSS variables work before the page finishes loading.
  applyTheme(getPreferredTheme());

  document.addEventListener("DOMContentLoaded", () => {
    syncThemeButtons(ROOT.getAttribute("data-theme") || getPreferredTheme());
  });

  // Event delegation fixes buttons added later by auth.js or any dynamic navbar render.
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-theme-toggle]");
    if (!button) return;
    event.preventDefault();
    toggleTheme();
  });

  window.RealEstateTheme = {
    apply: applyTheme,
    toggle: toggleTheme,
    current: () => ROOT.getAttribute("data-theme") || getPreferredTheme()
  };
})();

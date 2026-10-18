// Shared page preferences: theme toggle and text-size selector.
// Choices persist in localStorage (pref-theme, pref-font-size); the inline <head> script restores them before first paint.
(function () {
  "use strict";
  var root = document.documentElement;
  var SIZES = ["sm", "md", "lg", "xl"];
  var LABELS = { sm: "Small", md: "Medium", lg: "Large", xl: "Extra large" };

  function store(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* storage unavailable */ } }

  function syncSize() {
    var current = root.getAttribute("data-font-size") || "sm";
    document.querySelectorAll("[data-font-choice]").forEach(function (btn) {
      var v = btn.getAttribute("data-font-choice");
      var on = v === current;
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.setAttribute("aria-label", "Text size " + LABELS[v] + (on ? " (current)" : ""));
    });
  }

  function syncTheme() {
    var theme = root.getAttribute("data-theme") || "light";
    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
      var dark = theme === "dark";
      btn.setAttribute("aria-pressed", dark ? "true" : "false");
      btn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
      var label = btn.querySelector("[data-theme-label]");
      if (label) label.textContent = dark ? "Light" : "Dark";
    });
  }

  document.addEventListener("click", function (ev) {
    var sizeBtn = ev.target.closest("[data-font-choice]");
    if (sizeBtn) {
      var v = sizeBtn.getAttribute("data-font-choice");
      if (SIZES.indexOf(v) !== -1) { root.setAttribute("data-font-size", v); store("pref-font-size", v); syncSize(); }
      return;
    }
    var themeBtn = ev.target.closest("[data-theme-toggle]");
    if (themeBtn) {
      var next = (root.getAttribute("data-theme") === "dark") ? "light" : "dark";
      root.setAttribute("data-theme", next);
      store("pref-theme", next);
      syncTheme();
    }
  });

  if (!root.getAttribute("data-font-size")) root.setAttribute("data-font-size", "sm");
  syncSize();
  syncTheme();
})();

(function () {
  try {
    var t = localStorage.getItem("shelf-theme");
    if (t !== "light" && t !== "dark") return;
    document.documentElement.setAttribute("data-theme", t);
    var scheme = document.querySelector('meta[name="color-scheme"]');
    if (scheme) scheme.setAttribute("content", t);
    var color = t === "dark" ? "#161310" : "#f4efe6";
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) {
      m.setAttribute("content", color);
      m.removeAttribute("media");
    });
  } catch (e) {}
})();

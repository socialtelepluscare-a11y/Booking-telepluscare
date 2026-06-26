// Mobile header menu toggle. Shared by every page that has the site header.
(function () {
  const header = document.querySelector(".site-header");
  if (!header) return;
  const toggle = header.querySelector(".nav-toggle");
  const nav = header.querySelector(".top-nav");
  if (!toggle || !nav) return;

  function setOpen(open) {
    header.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }

  toggle.addEventListener("click", function (event) {
    event.stopPropagation();
    setOpen(!header.classList.contains("nav-open"));
  });

  // Close after choosing a destination.
  nav.addEventListener("click", function (event) {
    if (event.target.closest("a")) setOpen(false);
  });

  // Close when tapping outside the header or pressing Escape.
  document.addEventListener("click", function (event) {
    if (header.classList.contains("nav-open") && !header.contains(event.target)) {
      setOpen(false);
    }
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") setOpen(false);
  });
})();

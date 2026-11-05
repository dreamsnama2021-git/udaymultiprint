// Scroll effects for the Industry pages (styles in industry-fx.css).
(function () {
  if (!('IntersectionObserver' in window)) return;
  var root = document.documentElement;
  root.classList.add('fx-ready');

  // Elements that fade/slide in as they scroll into view.
  function mark(selector, kind, delay) {
    document.querySelectorAll(selector).forEach(function (el) {
      el.classList.add('fx');
      if (kind) el.classList.add(kind);
      if (delay) el.style.setProperty('--fx-delay', delay + 's');
    });
  }
  mark('.precision-title');
  mark('.precision-text', null, 0.15);
  mark('.tb-header h2');
  mark('.tb-header p', null, 0.12);
  mark('.tb-marquee', 'fx-zoom', 0.2);
  mark('.product-section .tab-buttons');
  mark('.site-footer .footer-col', null);
  document.querySelectorAll('.site-footer .footer-col').forEach(function (el, i) {
    el.style.setProperty('--fx-delay', (i * 0.1) + 's');
  });

  // Gallery photos rise one after another.
  document.querySelectorAll('.elementor-image-gallery').forEach(function (g) {
    g.querySelectorAll('.gallery-item').forEach(function (item, i) { item.style.setProperty('--i', i); });
  });

  // Product cards are re-drawn by the page's own script each time a tab is clicked,
  // so number them (for the stagger) whenever the grid's contents change.
  var grid = document.getElementById('tab-content');
  function numberCards() {
    if (!grid) return;
    grid.querySelectorAll('.product-card').forEach(function (c, i) { c.style.setProperty('--i', i); });
  }
  if (grid) {
    numberCards();
    new MutationObserver(numberCards).observe(grid, { childList: true });
  }

  var watched = [].slice.call(document.querySelectorAll('.fx, .elementor-image-gallery, .product-grid'));
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('fx-in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  watched.forEach(function (el) { io.observe(el); });

  // Thin orange reading-progress bar along the top of the window.
  var bar = document.createElement('div');
  bar.className = 'fx-progress';
  document.body.appendChild(bar);
  var ticking = false;
  function update() {
    var max = root.scrollHeight - window.innerHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(window.scrollY / max, 1) : 0) + ')';
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();
})();

// Blog page, design 2 (blog-2.html): all posts as a grid of image cards (newest first),
// with search. Uses helpers from blog.js (window.UMBlog).
(function () {
  var root = document.getElementById('ubRoot');
  if (!root || !window.UMBlog) return;
  var B = window.UMBlog, esc = B.esc;

  // The two original posts have their own pages; uploaded ones come from data/posts.json.
  var STATIC_POSTS = [
    {
      title: 'Choosing the Right Packaging Partner for Your Business',
      url: 'choosing-the-right-packaging-partner-for-your-business.html',
      date: '2026-07-21', author: 'Greensmediallp', category: 'Print Shop', minutes: 2,
      image: 'wp-content/uploads/2026/07/ChatGPT-Image-Jul-20-2026-06_11_01-PM.webp',
      excerpt: 'Selecting the right packaging partner is one of the most important decisions a business can make. Beyond manufacturing cartons, a reliable packaging company becomes an extension of your brand, ensuring every package reflects your quality.',
    },
    {
      title: 'Why Packaging Is More Than Just a Box',
      url: 'why-packaging-is-more-than-just-a-box.html',
      date: '2026-07-20', author: 'Greensmediallp', category: 'Print Shop', minutes: 2,
      image: 'wp-content/uploads/2026/07/ChatGPT-Image-Jul-20-2026-05_19_47-PM.webp',
      excerpt: 'Packaging has evolved far beyond its traditional role of protecting products. Today, it serves as a powerful marketing tool, a reflection of brand identity, and a key factor in influencing purchasing decisions.',
    },
  ];

  function fromUpload(p) {
    var words = String(p.content).split(/\s+/).filter(Boolean).length;
    return {
      title: p.title, url: B.postUrl(p), date: p.date, author: p.author, category: p.category,
      image: p.image, excerpt: B.excerpt(p, 260), minutes: Math.max(1, Math.round(words / 200)), created: p.created || '',
    };
  }

  // One card per post: image on top, bold title below (whole card is the link).
  function card(p, i) {
    return '<a class="ub-card ub-reveal" style="--d:' + ((i % 3) * 0.08) + 's" href="' + esc(p.url) + '">' +
      '<span class="ub-card-img"><img src="' + esc(p.image) + '" alt="' + esc(p.title) + '" loading="lazy"></span>' +
      '<span class="ub-card-body"><h3>' + esc(p.title) + '</h3></span>' +
      '</a>';
  }

  root.innerHTML =
    '<div class="ub-tools">' +
    '<label class="ub-search"><i class="fa-solid fa-magnifying-glass"></i>' +
    '<input type="search" id="ubSearch" placeholder="Search articles" aria-label="Search articles"></label>' +
    '</div>' +
    '<div class="ub-grid" id="ubGrid"></div>' +
    '<div class="ub-empty" id="ubEmpty" hidden><i class="fa-regular fa-file-lines"></i><p>No articles match your search.</p></div>';

  var all = [];
  function render(q) {
    q = (q || '').trim().toLowerCase();
    var match = all.filter(function (p) {
      return !q || (p.title + ' ' + p.excerpt + ' ' + p.category).toLowerCase().indexOf(q) !== -1;
    });
    document.getElementById('ubGrid').innerHTML = match.map(card).join('');
    document.getElementById('ubEmpty').hidden = match.length > 0;
    reveal();
  }

  // fade/slide cards in as they scroll into view
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('ub-in'); io.unobserve(e.target); } });
  }, { threshold: 0.12 }) : null;
  function reveal() {
    root.querySelectorAll('.ub-reveal:not(.ub-in)').forEach(function (el) {
      if (io) io.observe(el); else el.classList.add('ub-in');
    });
  }

  document.getElementById('ubSearch').addEventListener('input', function () { render(this.value); });

  fetch('data/posts.json', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : []; })
    .catch(function () { return []; })
    .then(function (uploaded) {
      all = (Array.isArray(uploaded) ? uploaded : []).map(fromUpload).concat(STATIC_POSTS)
        .sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : ((a.created || '') < (b.created || '') ? 1 : -1); });
      render('');
    });

  // ---- Blog page (blog-grid.html): "Design 1 / Design 2" switch ----
  // Both layouts live on the page; the switch shows one. The choice is kept in the URL (?view=2)
  // and remembered in this browser for the next visit.
  var bar = document.getElementById('umViewBar');
  var classic = document.querySelector('.latest-blog__area');
  var cards = document.getElementById('ubSection');
  if (!bar || !classic || !cards) return;
  var KEY = 'um-blog-view';

  function setView(v, remember) {
    v = v === '2' ? '2' : '1';
    classic.classList.toggle('um-view-hide', v !== '1');
    cards.classList.toggle('um-view-hide', v !== '2');
    bar.classList.toggle('um-view-2', v === '2');
    bar.querySelectorAll('[data-view]').forEach(function (b) {
      b.setAttribute('aria-selected', String(b.getAttribute('data-view') === v));
    });
    if (v === '2') reveal();
    if (remember) {
      try { localStorage.setItem(KEY, v); } catch (e) { /* storage blocked: still switches */ }
      var url = new URL(location.href);
      if (v === '2') url.searchParams.set('view', '2'); else url.searchParams.delete('view');
      history.replaceState(null, '', url);
    }
  }
  bar.addEventListener('click', function (e) {
    var b = e.target.closest('[data-view]');
    if (b) setView(b.getAttribute('data-view'), true);
  });

  var start = new URLSearchParams(location.search).get('view');
  if (!start) { try { start = localStorage.getItem(KEY); } catch (e) { start = null; } }
  setView(start || '1', false);
})();

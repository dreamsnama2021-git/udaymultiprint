// Shows posts added through blog-admin.html (stored in data/posts.json) on:
//  - blog-grid.html  (cards, newest first)
//  - index.html      ("Read Latest News": the two newest posts overall)
//  - post pages      (sidebar "Recent Posts" lists)
//  - post.html       (the full post, chosen by ?slug=...)
(function () {
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function parseDate(d) { var p = String(d).split('-'); return { y: +p[0], m: +p[1] - 1, d: +p[2] }; }
  function longDate(d) { var x = parseDate(d); return MONTHS[x.m] + ' ' + x.d + ', ' + x.y; }
  // the date badge on blog cards is narrow: long month names become "Nov", "Sep", ...
  function badgeMonth(m) { return MONTHS[m].length > 5 ? MONTHS[m].slice(0, 3) : MONTHS[m]; }
  function postUrl(p) { return 'post.html?slug=' + encodeURIComponent(p.slug); }

  // Post body format (same rules the upload page explains):
  //   blank line = new paragraph, "## " = heading, "- " = bullet, **text** = bold
  function inline(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); }
  function renderBody(text) {
    var out = [], list = null;
    String(text).replace(/\r\n/g, '\n').split(/\n\s*\n/).forEach(function (block) {
      var lines = block.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      if (!lines.length) return;
      if (lines.length === 1 && /^##\s+/.test(lines[0])) { out.push('<h4>' + inline(lines[0].replace(/^##\s+/, '')) + '</h4>'); return; }
      if (lines.every(function (l) { return /^[-*]\s+/.test(l); })) {
        out.push('<ul>' + lines.map(function (l) { return '<li>' + inline(l.replace(/^[-*]\s+/, '')) + '</li>'; }).join('') + '</ul>');
        return;
      }
      out.push('<p>' + lines.map(inline).join('<br>') + '</p>');
    });
    return out.join('\n');
  }
  function plain(text) {
    return String(text).replace(/^##\s+/gm, '').replace(/^[-*]\s+/gm, '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  }
  function excerpt(p, n) {
    var t = p.excerpt || plain(p.content);
    return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '...' : t;
  }
  function frag(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content; }

  // ---------- blog-grid.html ----------
  function gridCard(p) {
    var x = parseDate(p.date), url = postUrl(p);
    return '<div class="col-lg-4 col-md-6 mb-30" data-um-post="' + esc(p.slug) + '"><div class="swiper-slide latest-blog__item-slide"><div class="latest-blog__item-slide-inner">' +
      '<div class="latest-blog__item-media"><img src="' + esc(p.image) + '" alt="' + esc(p.title) + '" class="attachment-post-thumbnail size-post-thumbnail wp-post-image"></div>' +
      '<div class="latest-blog__item-text"><div class="latest-blog__item-text-meta d-flex">' +
      '<div class="latest-blog__item-text-meta-calender"><h4>' + x.d + '</h4><p>' + badgeMonth(x.m) + '</p></div>' +
      '<span><a class="rr-el-blog-meta" href="' + url + '"><i class="fa-regular fa-user"></i> ' + esc(p.author) + '</a></span>' +
      '<span class="meta-comment "><a class="rr-el-blog-meta" href="' + url + '"><i class="fa-regular fa-comment"></i> No Comments</a></span>' +
      '</div><div class="latest-blog__item-text-bottom"><a href="' + url + '"><h4 class="rr-el-title">' + esc(p.title) + '</h4></a>' +
      '<a href="' + url + '" class="readmore d-flex align-items-center rr-el-btn">Read More <i class="fa-solid fa-arrow-right"></i></a>' +
      '</div></div></div></div></div>';
  }
  function fillGrid(posts) {
    var row = document.querySelector('.latest-blog__area .row');
    if (!row) return;
    var first = row.firstElementChild;
    posts.forEach(function (p) { row.insertBefore(frag(gridCard(p)), first); });
  }

  // ---------- index.html ----------
  function homeItem(p) {
    var url = postUrl(p);
    return '<div class="col-12 mb-30" data-um-post="' + esc(p.slug) + '"><div class="latest-blog2__item-wrapper white-bg">' +
      '<div class="latest-blog2__item-wrapper-item"><div class="latest-blog2__item-wrapper-item-img"><img src="' + esc(p.image) + '" alt="' + esc(p.title) + '" class="attachment-post-thumbnail size-post-thumbnail wp-post-image"></div></div>' +
      '<div class="latest-blog2__item-wrapper-body"><div class="post-content">' +
      '<span>' + esc(p.category) + ' | ' + longDate(p.date) + '</span>' +
      '<a href="' + url + '"><h5 class="rr-el-re-Title">' + esc(p.title) + '</h5></a>' +
      '<p>' + esc(excerpt(p, 220)) + '</p>' +
      '<h6 class="rr-el-blog-meta">Author : <span>' + esc(p.author) + '</span></h6></div>' +
      '<div class="latest-blog2__item-wrapper-button"><a href="' + url + '" class="rr-btn btn-transparent rr-el-btn">Read More</a></div>' +
      '</div></div></div>';
  }
  function fillHome(posts) {
    var row = document.querySelector('.latest-blog2__area .row');
    if (!row || !posts.length) return;
    var first = row.firstElementChild;
    posts.forEach(function (p) { row.insertBefore(frag(homeItem(p)), first); });
    // keep the section to the two newest posts, as on the original site
    [].slice.call(row.children).slice(2).forEach(function (el) { el.remove(); });
  }

  // ---------- sidebars on post pages ----------
  function fillSidebars(posts, currentSlug) {
    var list = posts.filter(function (p) { return p.slug !== currentSlug; });
    if (!list.length) return;
    document.querySelectorAll('.wp-block-latest-posts__list').forEach(function (ul) {
      var first = ul.firstElementChild;
      list.forEach(function (p) {
        ul.insertBefore(frag('<li><a class="wp-block-latest-posts__post-title" href="' + postUrl(p) + '">' + esc(p.title) + '</a></li>'), first);
      });
    });
    document.querySelectorAll('.widget_rr-latest-posts .sidebar__widget-content').forEach(function (box) {
      var first = box.firstElementChild;
      list.forEach(function (p) {
        box.insertBefore(frag('<div class="rc__post d-flex align-items-center"><div class="rc__post-thumb mr-20"><a href="' + postUrl(p) + '">' +
          '<img width="150" height="150" src="' + esc(p.image) + '" alt="" style="width:75px;height:75px;object-fit:cover;"></a></div>' +
          '<div class="rc__post-content"><div class="rc__meta"><span><i class="fa-regular fa-calendar"></i> ' + longDate(p.date) + '</span></div>' +
          '<h3 class="rc__post-title"><a href="' + postUrl(p) + '">' + esc(p.title) + '</a></h3></div></div>'), first);
      });
    });
  }

  // ---------- post.html ----------
  function fillPost(posts) {
    var slug = new URLSearchParams(location.search).get('slug');
    var p = posts.filter(function (x) { return x.slug === slug; })[0];
    var article = document.querySelector('.blog__details-content article');
    document.body.classList.remove('um-post-loading');
    if (!p) {
      document.title = 'Post not found – greensmedia';
      setText('.breadcrumb__title', 'Post not found');
      setText('.breadcrumb__menu .current-item', 'Post not found');
      if (article) article.innerHTML = '<div class="um-post-missing"><h3>This post isn’t available</h3><p>It may have been removed.</p><a class="rr-btn" href="blog-grid.html">Back to Blog</a></div>';
      return;
    }
    document.title = p.title + ' – greensmedia';
    setText('.breadcrumb__title', p.title);
    setText('.breadcrumb__menu .current-item', p.title);
    var img = document.querySelector('.blog__details-thumb img');
    if (img) { img.src = p.image; img.alt = p.title; img.removeAttribute('width'); img.removeAttribute('height'); }
    var meta = document.querySelectorAll('.blog__details-meta li');
    if (meta[0]) replaceTrailingText(meta[0].querySelector('a') || meta[0], ' ' + p.author + ' ');
    if (meta[1]) replaceTrailingText(meta[1], ' ' + longDate(p.date) + ' ');
    setText('.postbox__title', p.title);
    var body = document.querySelector('.postbox__text');
    if (body) {
      var bottom = body.querySelector('.blog__details-bottom');
      body.innerHTML = '<div class="um-post-body">' + renderBody(p.content) + '</div>';
      if (bottom) body.appendChild(bottom);
    }
  }
  function setText(sel, t) { var el = document.querySelector(sel); if (el) el.textContent = t; }
  // meta items are "<svg/> text": swap only the text, keep the icon
  function replaceTrailingText(el, t) {
    for (var i = el.childNodes.length - 1; i >= 0; i--) {
      var n = el.childNodes[i];
      if (n.nodeType === 3 && n.textContent.trim()) { n.textContent = t; return; }
    }
    el.appendChild(document.createTextNode(t));
  }

  // ---------- go ----------
  var isGrid = !!document.querySelector('.latest-blog__area');
  var isHome = !!document.querySelector('.latest-blog2__area');
  var isPostPage = !!document.querySelector('.blog__details-content');
  var isDynamicPost = /(^|\/)post\.html$/.test(location.pathname);

  fetch('data/posts.json', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : []; })
    .catch(function () { return []; })
    .then(function (posts) {
      posts = (Array.isArray(posts) ? posts : []).slice().sort(function (a, b) {
        return a.date < b.date ? 1 : a.date > b.date ? -1 : (a.created < b.created ? 1 : -1);
      });
      // each card is inserted before the original first card, so insertion order = display order (newest first)
      if (isGrid) fillGrid(posts);
      if (isHome) fillHome(posts);
      if (isDynamicPost) fillPost(posts);
      if (isPostPage) fillSidebars(posts, isDynamicPost ? new URLSearchParams(location.search).get('slug') : null);
    });

  window.UMBlog = {
    renderBody: renderBody, longDate: longDate, parseDate: parseDate, badgeMonth: badgeMonth,
    esc: esc, excerpt: excerpt, postUrl: postUrl,
  };
})();

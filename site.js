// Small stand-ins for the WordPress plugins that need a server.
(function () {
  // Contact page enquiry form: handled by contact-form.js (Web3Forms).

  // Blog comment form: WordPress isn't here to store comments, so email them instead.
  document.querySelectorAll('form#commentform, form.comment-form').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var get = function (n) { var el = form.querySelector('[name="' + n + '"]'); return el ? el.value.trim() : ''; };
      window.location.href = 'mailto:udaymultiprint@gmail.com?subject=' + encodeURIComponent('Comment on: ' + document.title) +
        '&body=' + encodeURIComponent('Name: ' + get('author') + '\nEmail: ' + get('email') + '\n\n' + get('comment'));
    });
  });

  // Image popup (lightbox) for the homepage "Recent Projects" + buttons and the
  // Industry page galleries, so images open over the page instead of a new tab.
  var css = document.createElement('style');
  css.textContent =
    '.um-lb{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;' +
    'background:rgba(0,0,0,.88);opacity:0;visibility:hidden;transition:opacity .25s ease,visibility .25s;padding:60px 70px;}' +
    '.um-lb.um-open{opacity:1;visibility:visible;}' +
    '.um-lb figure{margin:0;padding:0;max-width:100%;max-height:100%;display:flex;flex-direction:column;align-items:center;}' +
    '.um-lb img{display:block;max-width:100%;max-height:calc(100vh - 160px);width:auto;height:auto;border-radius:8px;' +
    'box-shadow:0 20px 60px rgba(0,0,0,.5);transform:scale(.96);transition:transform .25s ease;}' +
    '.um-lb.um-open img{transform:scale(1);}' +
    '.um-lb figcaption{color:#fff;font-family:Poppins,sans-serif;font-size:16px;line-height:1.5;margin:14px 0 0;padding:0;text-align:center;}' +
    '.um-lb figcaption small{display:block;color:rgba(255,255,255,.7);font-size:13px;}' +
    '.um-lb button{position:absolute;margin:0;padding:0;width:48px;height:48px;border-radius:50%;border:2px solid #fff;' +
    'background:transparent;color:#fff;font-size:22px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;' +
    'transition:background .2s ease,color .2s ease,border-color .2s ease;}' +
    '.um-lb button:hover{background:#ff3d00;border-color:#ff3d00;}' +
    '.um-lb .um-close{top:18px;right:18px;font-size:26px;}' +
    '.um-lb .um-prev{left:16px;top:50%;transform:translateY(-50%);}' +
    '.um-lb .um-next{right:16px;top:50%;transform:translateY(-50%);}' +
    '@media (max-width:600px){.um-lb{padding:60px 12px;}.um-lb .um-prev,.um-lb .um-next{top:auto;bottom:16px;transform:none;}' +
    '.um-lb .um-prev{left:calc(50% - 60px);}.um-lb .um-next{right:calc(50% - 60px);}}';
  document.head.appendChild(css);

  var lb = document.createElement('div');
  lb.className = 'um-lb';
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.setAttribute('aria-hidden', 'true');
  lb.innerHTML =
    '<button class="um-close" aria-label="Close">&times;</button>' +
    '<button class="um-prev" aria-label="Previous image">&#10094;</button>' +
    '<figure><img alt=""><figcaption></figcaption></figure>' +
    '<button class="um-next" aria-label="Next image">&#10095;</button>';
  document.body.appendChild(lb);
  var lbImg = lb.querySelector('img'), lbCap = lb.querySelector('figcaption');
  var group = [], index = 0, lastFocus = null;

  function show(i) {
    index = (i + group.length) % group.length;
    var item = group[index];
    lbImg.src = item.src;
    lbImg.alt = item.title || '';
    lbCap.innerHTML = '';
    if (item.title) lbCap.appendChild(document.createTextNode(item.title));
    if (item.sub) { var s = document.createElement('small'); s.textContent = item.sub; lbCap.appendChild(s); }
    var multi = group.length > 1;
    lb.querySelector('.um-prev').style.display = multi ? '' : 'none';
    lb.querySelector('.um-next').style.display = multi ? '' : 'none';
  }
  function open(items, i) {
    group = items;
    lastFocus = document.activeElement;
    show(i);
    lb.classList.add('um-open');
    lb.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    lb.querySelector('.um-close').focus();
  }
  function close() {
    lb.classList.remove('um-open');
    lb.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }
  lb.querySelector('.um-close').addEventListener('click', close);
  lb.querySelector('.um-prev').addEventListener('click', function () { show(index - 1); });
  lb.querySelector('.um-next').addEventListener('click', function () { show(index + 1); });
  lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
  document.addEventListener('keydown', function (e) {
    if (!lb.classList.contains('um-open')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') show(index - 1);
    else if (e.key === 'ArrowRight') show(index + 1);
  });

  function bind(links, describe) {
    var items = links.map(describe);
    links.forEach(function (a, i) {
      a.removeAttribute('target');
      a.addEventListener('click', function (e) { e.preventDefault(); open(items, i); });
    });
  }
  // Homepage "Explore our Recent Projects"
  bind([].slice.call(document.querySelectorAll('.csg-item .csg-plus')), function (a) {
    var item = a.closest('.csg-item');
    var h = item.querySelector('.csg-caption h3'), p = item.querySelector('.csg-caption p');
    return { src: a.getAttribute('href'), title: h ? h.textContent : '', sub: p ? p.textContent : '' };
  });
  // Industry page image galleries (Elementor's own lightbox needs its JS, which isn't shipped)
  document.querySelectorAll('.elementor-image-gallery').forEach(function (g) {
    bind([].slice.call(g.querySelectorAll('a[data-elementor-open-lightbox="yes"]')), function (a) {
      return { src: a.getAttribute('href'), title: '' };
    });
  });
})();

// Contact page enquiry form -> Web3Forms (https://web3forms.com), settings in form-config.js.
//
// Protection layers (Web3Forms' free plan only accepts submissions sent from the browser):
//  - Web3Forms' own server-side spam filter on every submission
//  - hidden "botcheck" field (honeypot): bots fill it, Web3Forms drops those submissions
//  - time trap: forms sent less than 3 seconds after the page opened are ignored (typical of bots)
//  - per-browser limit: at most 3 enquiries per 10 minutes
//  - every field checked (required, length, email/phone format); line breaks stripped from
//    single-line fields so nothing can be smuggled into email headers
//  - optional hCaptcha (useHcaptcha in form-config.js + switched on in the Web3Forms dashboard)
(function () {
  var form = document.querySelector('form.wpcf7-form');
  if (!form) return;
  var cfg = window.UM_FORM_CONFIG || {};
  var KEY = String(cfg.web3formsAccessKey || '').trim();
  var ENDPOINT = 'https://api.web3forms.com/submit';
  var LIMIT = 3, WINDOW_MS = 10 * 60 * 1000, MIN_FILL_MS = 3000;
  var openedAt = Date.now();

  var FIELDS = {
    name: { el: form.querySelector('[name="text-115"]'), label: 'Name', min: 2, max: 80 },
    email: { el: form.querySelector('[name="text-email"]'), label: 'Email', max: 120 },
    phone: { el: form.querySelector('[name="text-phone"]'), label: 'Phone', max: 20 },
    subject: { el: form.querySelector('[name="text-subject"]'), label: 'Subject', min: 3, max: 120 },
    message: { el: form.querySelector('[name="text-message"]'), label: 'Message', min: 10, max: 2000 },
  };
  var submitBtn = form.querySelector('[type="submit"]');
  var btnText = submitBtn ? submitBtn.value : '';

  // ---- styles for messages and field errors ----
  var css = document.createElement('style');
  css.textContent =
    '.um-field-error{ display:block; color:#c62828; font-size:13px; line-height:1.4; margin-top:6px; }' +
    '.um-invalid{ border-color:#c62828 !important; box-shadow:0 0 0 3px rgba(198,40,40,.08) !important; }' +
    '.um-form-msg{ display:none; margin-top:20px; padding:14px 16px; border-radius:8px; font-size:15px; line-height:1.5; }' +
    '.um-form-msg.show{ display:block; }' +
    '.um-form-msg.ok{ background:#e8f6ee; color:#1f7a45; border:1px solid #bfe6cf; }' +
    '.um-form-msg.err{ background:#fdecec; color:#b42318; border:1px solid #f5c2c2; }' +
    '.um-hp{ position:absolute !important; left:-9999px !important; width:1px; height:1px; overflow:hidden; }' +
    '.um-captcha{ margin-top:20px; }';
  document.head.appendChild(css);

  // ---- honeypot (Web3Forms reads "botcheck") ----
  var hp = document.createElement('input');
  hp.type = 'checkbox'; hp.name = 'botcheck'; hp.tabIndex = -1; hp.autocomplete = 'off';
  hp.className = 'um-hp'; hp.setAttribute('aria-hidden', 'true'); hp.style.display = 'none';
  form.appendChild(hp);

  // ---- message box (replaces Contact Form 7's own output) ----
  var oldOut = form.querySelector('.wpcf7-response-output');
  if (oldOut) oldOut.remove();
  var msg = document.createElement('div');
  msg.className = 'um-form-msg'; msg.setAttribute('role', 'status'); msg.setAttribute('aria-live', 'polite');
  form.appendChild(msg);
  function say(kind, text) { msg.className = 'um-form-msg show ' + kind; msg.textContent = text; }
  function clearMsg() { msg.className = 'um-form-msg'; msg.textContent = ''; }

  // ---- optional hCaptcha ----
  if (KEY && cfg.useHcaptcha && submitBtn) {
    var cap = document.createElement('div');
    cap.className = 'h-captcha um-captcha';
    cap.setAttribute('data-captcha', 'true');
    submitBtn.parentNode.insertBefore(cap, submitBtn);
    var s = document.createElement('script');
    s.src = 'https://web3forms.com/client/script.js'; s.async = true; s.defer = true;
    document.body.appendChild(s);
  }

  // ---- validation ----
  var EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;
  var PHONE_RE = /^\+?[0-9 ()-]{7,20}$/;
  function oneLine(v) { return String(v || '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim(); }

  function fieldError(f, text) {
    var wrap = f.el.parentNode;
    var e = wrap.querySelector('.um-field-error');
    if (!text) { if (e) e.remove(); f.el.classList.remove('um-invalid'); f.el.removeAttribute('aria-invalid'); return; }
    if (!e) { e = document.createElement('span'); e.className = 'um-field-error'; wrap.appendChild(e); }
    e.textContent = text;
    f.el.classList.add('um-invalid'); f.el.setAttribute('aria-invalid', 'true');
  }
  function check(name) {
    var f = FIELDS[name];
    if (!f.el) return '';
    var v = name === 'message' ? String(f.el.value || '').trim() : oneLine(f.el.value);
    var err = '';
    if (!v) err = f.label + ' is required.';
    else if (f.min && v.length < f.min) err = f.label + ' is too short.';
    else if (v.length > f.max) err = f.label + ' is too long (max ' + f.max + ' characters).';
    else if (name === 'email' && !EMAIL_RE.test(v)) err = 'Please enter a valid email address.';
    else if (name === 'phone' && !PHONE_RE.test(v)) err = 'Please enter a valid phone number.';
    else if (/<\s*\/?\s*(script|iframe|object|embed|style)\b/i.test(v)) err = 'Please remove code or HTML tags.';
    fieldError(f, err);
    return err;
  }
  Object.keys(FIELDS).forEach(function (n) {
    if (!FIELDS[n].el) return;
    FIELDS[n].el.addEventListener('blur', function () { if (this.value) check(n); });
    FIELDS[n].el.addEventListener('input', function () { if (this.classList.contains('um-invalid')) check(n); });
  });

  // ---- per-browser rate limit ----
  function recent() {
    try {
      return JSON.parse(localStorage.getItem('um-enquiries') || '[]').filter(function (t) { return Date.now() - t < WINDOW_MS; });
    } catch (e) { return []; }
  }
  function remember() {
    try { var r = recent(); r.push(Date.now()); localStorage.setItem('um-enquiries', JSON.stringify(r)); } catch (e) { /* ignore */ }
  }

  function setBusy(b) {
    if (!submitBtn) return;
    submitBtn.disabled = b;
    submitBtn.value = b ? 'Sending…' : btnText;
    submitBtn.style.opacity = b ? '.7' : '';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    clearMsg();

    var firstBad = null;
    Object.keys(FIELDS).forEach(function (n) { if (check(n) && !firstBad) firstBad = FIELDS[n].el; });
    if (firstBad) { say('err', 'Please correct the highlighted fields.'); firstBad.focus(); return; }

    var data = {
      name: oneLine(FIELDS.name.el.value),
      email: oneLine(FIELDS.email.el.value),
      phone: oneLine(FIELDS.phone.el.value),
      subject: oneLine(FIELDS.subject.el.value),
      message: String(FIELDS.message.el.value).trim(),
    };

    // bots: honeypot ticked or form sent instantly -> pretend success, send nothing
    if (hp.checked || Date.now() - openedAt < MIN_FILL_MS) {
      say('ok', 'Thank you! Your enquiry has been sent. We will get back to you soon.');
      form.reset();
      return;
    }
    if (recent().length >= LIMIT) {
      say('err', 'You have sent several enquiries in a short time. Please wait a few minutes, or call us on +91 98200 61825.');
      return;
    }

    if (!KEY) {
      // not set up yet: don't lose the enquiry, hand it to the visitor's email app
      say('err', 'Online form is not set up yet. Opening your email app so you can send the enquiry directly…');
      var body = 'Name: ' + data.name + '\nEmail: ' + data.email + '\nPhone: ' + data.phone + '\n\n' + data.message;
      window.location.href = 'mailto:udaymultiprint@gmail.com?subject=' + encodeURIComponent(data.subject) +
        '&body=' + encodeURIComponent(body);
      return;
    }

    var fd = new FormData();
    fd.append('access_key', KEY);
    fd.append('subject', (cfg.siteName || 'Website') + ' – New enquiry: ' + data.subject);
    fd.append('from_name', cfg.siteName || 'Website');
    fd.append('name', data.name);
    fd.append('email', data.email);
    fd.append('phone', data.phone);
    fd.append('enquiry_subject', data.subject);
    fd.append('message', data.message);
    fd.append('page', location.pathname);
    fd.append('botcheck', '');
    if (cfg.useHcaptcha) {
      var token = form.querySelector('[name="h-captcha-response"]');
      if (!token || !token.value) { say('err', 'Please complete the captcha check.'); return; }
      fd.append('h-captcha-response', token.value);
    }

    setBusy(true);
    var ctrl = 'AbortController' in window ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 20000) : null;
    fetch(ENDPOINT, { method: 'POST', headers: { Accept: 'application/json' }, body: fd, signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, json: j }; }); })
      .then(function (res) {
        if (res.json && res.json.success) {
          remember();
          say('ok', 'Thank you! Your enquiry has been sent. We will get back to you soon.');
          form.reset();
          if (window.hcaptcha && cfg.useHcaptcha) try { window.hcaptcha.reset(); } catch (x) { /* ignore */ }
        } else if (res.status === 429) {
          say('err', 'Too many enquiries right now. Please try again in a few minutes.');
        } else {
          say('err', 'Sorry, your enquiry could not be sent. Please try again, or email udaymultiprint@gmail.com.');
          if (window.console) console.warn('Enquiry form error:', res.status, res.json && (res.json.message || (res.json.body && res.json.body.message)));
        }
      })
      .catch(function () {
        say('err', 'Network problem – your enquiry was not sent. Please check your connection and try again.');
      })
      .then(function () { if (timer) clearTimeout(timer); setBusy(false); });
  }, true);
})();

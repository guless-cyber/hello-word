/* Download webpage as PDF — article template behaviour. No dependencies. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* Toast */
  var toastEl = $('[data-toast]'), toastTimer;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2200);
  }

  /* 1. Before / after switch in the large image */
  $$('[data-compare]').forEach(function (box) {
    var btns = $$('[data-set]', box);
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        box.dataset.view = b.dataset.set;
        btns.forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
        $$('[data-when]', box).forEach(function (el) { el.hidden = el.dataset.when !== b.dataset.set; });
      });
    });
  });

  /* 2. Share panel: build URLs from canonical + title, copy link */
  var canonical = ($('link[rel=canonical]') || {}).href || location.href;
  var title = ($('meta[property="og:title"]') || {}).content || document.title;
  var u = encodeURIComponent(canonical), t = encodeURIComponent(title);
  var shareUrls = {
    whatsapp: 'https://wa.me/?text=' + t + '%20' + u,
    linkedin: 'https://www.linkedin.com/sharing/share-offsite/?url=' + u,
    facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + u,
    x: 'https://x.com/intent/post?url=' + u + '&text=' + t,
    telegram: 'https://t.me/share/url?url=' + u + '&text=' + t,
    reddit: 'https://www.reddit.com/submit?url=' + u + '&title=' + t
  };
  $$('[data-net]').forEach(function (a) { if (shareUrls[a.dataset.net]) a.href = shareUrls[a.dataset.net]; });

  $$('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var done = function () {
        btn.setAttribute('data-copied', '');
        var label = $('span', btn), old = label.textContent;
        label.textContent = 'Copied';
        toast('Link copied');
        setTimeout(function () { label.textContent = old; btn.removeAttribute('data-copied'); }, 2000);
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(canonical).then(done, fallback);
      } else { fallback(); }
      function fallback() {
        var ta = document.createElement('textarea');
        ta.value = canonical; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { toast(canonical); }
        document.body.removeChild(ta);
      }
    });
  });

  /* 3. TOC: scroll-spy + collapsed on mobile */
  var toc = $('[data-toc]');
  if (toc) {
    var mq = window.matchMedia('(max-width: 900px)');
    var syncOpen = function () { toc.open = !mq.matches; };
    syncOpen();
    mq.addEventListener ? mq.addEventListener('change', syncOpen) : mq.addListener(syncOpen);
    // on desktop the summary is a label, not a toggle
    $('summary', toc).addEventListener('click', function (e) { if (!mq.matches) e.preventDefault(); });

    var links = $$('a[href^="#"]', toc);
    var map = links.map(function (a) { return { a: a, el: document.getElementById(a.getAttribute('href').slice(1)) }; })
                   .filter(function (x) { return x.el; });
    var setCurrent = function (link) {
      links.forEach(function (a) { a.removeAttribute('aria-current'); });
      if (link) link.setAttribute('aria-current', 'true');
    };
    var onScroll = function () {
      var y = window.scrollY + 120, cur = null;
      map.forEach(function (x) { if (x.el.getBoundingClientRect().top + window.scrollY <= y) cur = x.a; });
      setCurrent(cur || (map[0] && map[0].a));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    links.forEach(function (a) { a.addEventListener('click', function () { if (mq.matches) toc.open = false; }); });
  }

  /* 4. Reading progress in the header */
  var bar = $('.progress'), article = $('article.prose');
  if (bar && article) {
    var prog = function () {
      var r = article.getBoundingClientRect(), h = r.height - window.innerHeight;
      var p = h > 0 ? Math.min(1, Math.max(0, -r.top / h)) : 0;
      bar.style.setProperty('--p', p.toFixed(4));
    };
    window.addEventListener('scroll', prog, { passive: true });
    window.addEventListener('resize', prog);
    prog();
  }

  /* 5. Interactive callout: highlights on hover / focus (CSS) and on first tap on touch.
        First tap highlights, second tap follows the link. */
  $$('[data-callout]').forEach(function (c) {
    c.addEventListener('touchstart', function () {}, { passive: true });
    c.addEventListener('click', function (e) {
      var touch = window.matchMedia('(hover: none)').matches;
      if (touch && !c.classList.contains('is-active')) {
        e.preventDefault();
        $$('[data-callout].is-active').forEach(function (o) { o.classList.remove('is-active'); });
        c.classList.add('is-active');
      }
    });
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-callout]')) $$('[data-callout].is-active').forEach(function (o) { o.classList.remove('is-active'); });
  });

  /* 6. File upload from the article (local only, nothing is sent; no validation, no error state) */
  var EDITOR_URL = 'https://annotatepdf.app/'; // TODO: real editor entry point that accepts a local file
  $$('[data-drop]').forEach(function (zone) {
    var input = $('input[type=file]', zone);
    var fmt = function (b) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; };
    var take = function (file) {
      zone.classList.remove('has-file');
      if (!file) return;
      // Product decision: no size limit and no error state. Any file is taken as is.
      $('[data-name]', zone).textContent = file.name;
      $('[data-size]', zone).textContent = fmt(file.size);
      var open = $('[data-open]', zone);
      // Hand-off is not defined yet: today we open the file in a new tab via an object URL.
      var url = URL.createObjectURL(file);
      open.href = url; open.target = '_blank'; open.rel = 'noopener';
      open.dataset.editor = EDITOR_URL;
      zone.classList.add('has-file');
      zone.dispatchEvent(new CustomEvent('pdf:selected', { bubbles: true, detail: { file: file } }));
    };
    input.addEventListener('change', function () { take(input.files[0]); });
    ['dragenter', 'dragover'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add('is-over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.remove('is-over'); });
    });
    zone.addEventListener('drop', function (e) { take(e.dataTransfer.files[0]); });
  });

  /* 7. FAQ: one open at a time */
  var faq = $$('.faq details');
  faq.forEach(function (d) {
    d.addEventListener('toggle', function () { if (d.open) faq.forEach(function (o) { if (o !== d) o.open = false; }); });
  });
})();

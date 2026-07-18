/* ============================================================
   ADVANCED FX PACK (2026-07-18)
   Pairs with advanced-fx.css. Progressive enhancement only —
   any failure here silently no-ops and never blocks the page.
   - Cursor spotlight glow + accent ring (desktop fine-pointer only)
   - Magnetic pull on primary CTA buttons
   - Cinematic film-grain overlay
   - Animated count-up for any [data-count-to] element on scroll-in
   ============================================================ */
(function () {
  try {
    if (window.__advFxInit) return; window.__advFxInit = true;

    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var finePointer = window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches;

    /* ---- Count-up on scroll-into-view (works on every device) ---- */
    function initCountUp() {
      var els = document.querySelectorAll('[data-count-to]');
      if (!els.length || !('IntersectionObserver' in window)) return;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          io.unobserve(entry.target);
          var el = entry.target;
          var target = parseFloat(el.getAttribute('data-count-to'));
          if (isNaN(target)) return;
          var suffix = el.getAttribute('data-count-suffix') || '';
          var prefix = el.getAttribute('data-count-prefix') || '';
          var decimals = parseInt(el.getAttribute('data-count-decimals') || '0', 10);
          var dur = reduce ? 0 : 1200;
          var start = performance.now();
          function tick(now) {
            var p = dur ? Math.min(1, (now - start) / dur) : 1;
            var eased = 1 - Math.pow(1 - p, 3);
            var val = target * eased;
            el.textContent = prefix + val.toFixed(decimals) + suffix;
            if (p < 1) requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
        });
      }, { threshold: 0.4 });
      els.forEach(function (el) { io.observe(el); });
    }

    /* ---- Desktop-only cinematic layer: grain + cursor glow/ring + magnetism ---- */
    function initDesktopFx() {
      if (reduce || !finePointer) return;

      var grain = document.createElement('div');
      grain.className = 'fx-grain';
      grain.setAttribute('aria-hidden', 'true');
      document.body.appendChild(grain);

      var glow = document.createElement('div');
      glow.className = 'fx-cursor-glow';
      glow.setAttribute('aria-hidden', 'true');
      document.body.appendChild(glow);

      var ring = document.createElement('div');
      ring.className = 'fx-cursor-ring';
      ring.setAttribute('aria-hidden', 'true');
      document.body.appendChild(ring);

      var mx = window.innerWidth / 2, my = window.innerHeight / 2;
      var gx = mx, gy = my;
      var hoverSel = 'a, button, .plc, .review-card, .offer-card, .bento-tile, .glass-card, input, select, textarea, [role="button"]';

      document.addEventListener('pointermove', function (e) {
        mx = e.clientX; my = e.clientY;
        document.body.classList.add('fx-pointer-active');
        ring.style.transform = 'translate(' + mx + 'px,' + my + 'px) translate(-50%,-50%)';
        var target = e.target && e.target.closest ? e.target.closest(hoverSel) : null;
        ring.classList.toggle('fx-cursor-hover', !!target);
      }, { passive: true });

      document.addEventListener('pointerleave', function () {
        document.body.classList.remove('fx-pointer-active');
      });

      (function raf() {
        gx += (mx - gx) * 0.09;
        gy += (my - gy) * 0.09;
        glow.style.transform = 'translate(' + gx + 'px,' + gy + 'px) translate(-50%,-50%)';
        requestAnimationFrame(raf);
      })();

      /* Magnetic pull on primary CTAs */
      var magnets = [];
      function collectMagnets() {
        magnets = Array.prototype.slice.call(
          document.querySelectorAll('.btn-primary, .order-now-btn, .review-cta-btn')
        );
      }
      collectMagnets();
      if ('MutationObserver' in window) {
        new MutationObserver(function () { collectMagnets(); }).observe(document.body, { childList: true, subtree: true });
      }

      document.addEventListener('pointermove', function (e) {
        for (var i = 0; i < magnets.length; i++) {
          var btn = magnets[i];
          var r = btn.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          var dx = e.clientX - cx, dy = e.clientY - cy;
          var dist = Math.hypot(dx, dy);
          var radius = Math.max(r.width, r.height) * 1.3;
          if (dist < radius) {
            var pull = (1 - dist / radius) * 0.3;
            btn.style.transform = 'translate(' + (dx * pull).toFixed(1) + 'px,' + (dy * pull).toFixed(1) + 'px)';
          } else if (btn.style.transform) {
            btn.style.transform = '';
          }
        }
      }, { passive: true });
    }

    function init() {
      initCountUp();
      initDesktopFx();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  } catch (e) {
    /* progressive enhancement only -- silently no-op on any failure */
  }
})();
